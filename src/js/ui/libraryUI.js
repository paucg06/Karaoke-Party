/**
 * Vocaluxe-Style Song Library, Mode Selection and Profiles UI.
 * Features:
 * - Left panel: Selected song preview (cover/video thumbnail, title, artist, duration, BPM)
 * - Right panel: Cover grid with smooth selection and active indicator
 * - Header tabs: Game Mode selector (Solo, Batalla 1v1, Dúo) and Profiles modal
 * - Profiles management: Avatar picker, name, difficulty (Easy, Normal, Hard), role, active toggle
 * - Discrete folder upload button
 */

import { UltraStarParser } from '../parser/ultrastarParser.js';
import { ProfileManager } from '../engine/profileManager.js';

export class LibraryUI {
  constructor(containerElement, onStartGame) {
    this.container = containerElement;
    this.onStartGame = onStartGame;
    this.songs = [];
    this.filteredSongs = [];
    this.selectedSongIndex = 0;
    this.currentMode = ProfileManager.getGameMode(); // 'solo' | 'battle' | 'duet'

    this.init();
  }

  async init() {
    this.renderLayout();
    this.bindEvents();
    await this.loadCatalogFromGitHub();
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="vocaluxe-screen">
        <!-- Top Navigation Bar -->
        <header class="vocaluxe-nav">
          <div class="nav-brand">
            <img src="src/assets/images/svg/mic.svg" alt="Karaoke" class="nav-logo" />
            <span class="nav-title">ETERNO KARAOKE</span>
          </div>

          <!-- Mode Selector Tabs -->
          <nav class="mode-tabs">
            <button class="tab-btn ${this.currentMode === 'solo' ? 'active' : ''}" data-mode="solo">
              <img src="src/assets/images/svg/user.svg" alt="Solo" />
              <span>Solo</span>
            </button>
            <button class="tab-btn ${this.currentMode === 'battle' ? 'active' : ''}" data-mode="battle">
              <img src="src/assets/images/svg/swords.svg" alt="Batalla" />
              <span>Batalla (1 vs 1)</span>
            </button>
            <button class="tab-btn ${this.currentMode === 'duet' ? 'active' : ''}" data-mode="duet">
              <img src="src/assets/images/svg/users.svg" alt="Dúo" />
              <span>Dúo</span>
            </button>
          </nav>

          <!-- Right Action Buttons -->
          <div class="nav-actions">
            <button id="btn-open-profiles" class="btn-nav" title="Gestionar Perfiles de Jugador">
              <img src="src/assets/images/svg/settings.svg" alt="Perfiles" />
              <span>Perfiles</span>
            </button>
            <label class="btn-nav" for="folder-upload" title="Cargar canciones locales">
              <img src="src/assets/images/svg/folder-plus.svg" alt="Cargar" />
              <span>Importar</span>
            </label>
            <input type="file" id="folder-upload" webkitdirectory directory multiple style="display: none;" />
          </div>
        </header>

        <!-- Main Song Browser (Vocaluxe Split Layout) -->
        <main class="browser-layout">
          <!-- Left: Preview & Details Pane -->
          <section class="song-preview-pane">
            <div class="preview-media-box">
              <img id="preview-cover" src="" alt="Portada" class="preview-cover" />
              <div class="preview-badge" id="preview-mode-badge">1 JUGADOR</div>
            </div>
            
            <div class="preview-details">
              <h2 id="preview-title" class="preview-title">-</h2>
              <h3 id="preview-artist" class="preview-artist">-</h3>
              <div class="preview-meta">
                <span id="preview-duration" class="meta-item">00:00</span>
                <span id="preview-bpm" class="meta-item">BPM: -</span>
              </div>
            </div>

            <!-- Start Button -->
            <button id="btn-start-play" class="btn-start-game">
              <img src="src/assets/images/svg/play.svg" alt="Jugar" />
              <span>CANTAR AHORA</span>
            </button>
          </section>

          <!-- Right: Covers Grid -->
          <section class="songs-grid-pane">
            <div class="search-box">
              <img src="src/assets/images/svg/search.svg" alt="Buscar" />
              <input type="text" id="search-input" placeholder="Buscar canción o artista..." />
            </div>

            <div id="grid-container" class="grid-container">
              <div class="loading-state">Cargando biblioteca...</div>
            </div>
          </section>
        </main>

        <!-- Profiles Modal (Vocaluxe Style) -->
        <aside id="profiles-modal" class="modal-overlay hidden">
          <div class="profiles-card">
            <header class="modal-header">
              <h2>PERFILES DE JUGADORES</h2>
              <button id="btn-close-profiles" class="btn-close">&times;</button>
            </header>

            <div class="profiles-content">
              <!-- Player profile tabs / switcher -->
              <div class="profile-tabs" id="profile-selector-tabs"></div>

              <!-- Profile Form -->
              <div class="profile-form">
                <div class="avatar-selection-box">
                  <img id="profile-avatar-preview" src="src/assets/images/svg/avatar-1.svg" alt="Avatar" class="avatar-large" />
                  <div class="avatar-picker-row">
                    <button class="avatar-thumb" data-avatar="avatar-1"><img src="src/assets/images/svg/avatar-1.svg" alt="1" /></button>
                    <button class="avatar-thumb" data-avatar="avatar-2"><img src="src/assets/images/svg/avatar-2.svg" alt="2" /></button>
                    <button class="avatar-thumb" data-avatar="avatar-3"><img src="src/assets/images/svg/avatar-3.svg" alt="3" /></button>
                    <button class="avatar-thumb" data-avatar="avatar-4"><img src="src/assets/images/svg/avatar-4.svg" alt="4" /></button>
                  </div>
                </div>

                <div class="form-group">
                  <label for="prof-name">Nombre del jugador</label>
                  <input type="text" id="prof-name" placeholder="Nombre..." />
                </div>

                <div class="form-group">
                  <label>Dificultad de afinación</label>
                  <div class="segmented-control" id="diff-control">
                    <button type="button" class="btn-segment" data-val="easy">Fácil</button>
                    <button type="button" class="btn-segment active" data-val="normal">Normal</button>
                    <button type="button" class="btn-segment" data-val="hard">Difícil</button>
                  </div>
                </div>

                <div class="form-group">
                  <label>Rol de usuario</label>
                  <div class="segmented-control" id="role-control">
                    <button type="button" class="btn-segment active" data-val="normal">Normal</button>
                    <button type="button" class="btn-segment" data-val="guest">Invitado</button>
                  </div>
                </div>

                <div class="form-group">
                  <label>Activo en la partida</label>
                  <div class="segmented-control" id="active-control">
                    <button type="button" class="btn-segment active" data-val="true">Sí (Activo)</button>
                    <button type="button" class="btn-segment" data-val="false">No (Inactivo)</button>
                  </div>
                </div>
              </div>
            </div>

            <footer class="modal-footer">
              <button id="btn-save-profile" class="btn-modal primary">Guardar Perfil</button>
              <button id="btn-cancel-profile" class="btn-modal secondary">Cerrar</button>
            </footer>
          </div>
        </aside>
      </div>
    `;
  }

  bindEvents() {
    // Mode tabs
    const modeTabs = this.container.querySelectorAll('.mode-tabs .tab-btn');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentMode = tab.dataset.mode;
        ProfileManager.setGameMode(this.currentMode);
        this.updateModeBadge();
      });
    });

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      this.filteredSongs = this.songs.filter(s =>
        s.title.toLowerCase().includes(term) || s.artist.toLowerCase().includes(term)
      );
      this.selectedSongIndex = 0;
      this.renderCoversGrid();
      this.updatePreviewPane();
    });

    // Start Song
    const btnStart = document.getElementById('btn-start-play');
    btnStart.addEventListener('click', () => {
      this.launchSelectedSong();
    });

    // Local Folder upload
    const folderInput = document.getElementById('folder-upload');
    folderInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.processLocalFiles(Array.from(e.target.files));
      }
    });

    // Drag and drop anywhere
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        this.processLocalFiles(Array.from(e.dataTransfer.files));
      }
    });

    // Profiles Modal
    const btnOpenProfiles = document.getElementById('btn-open-profiles');
    const btnCloseProfiles = document.getElementById('btn-close-profiles');
    const btnCancelProfile = document.getElementById('btn-cancel-profile');
    const btnSaveProfile = document.getElementById('btn-save-profile');
    const profilesModal = document.getElementById('profiles-modal');

    btnOpenProfiles.addEventListener('click', () => {
      this.openProfilesModal();
    });

    [btnCloseProfiles, btnCancelProfile].forEach(btn => {
      btn.addEventListener('click', () => {
        profilesModal.classList.add('hidden');
      });
    });

    btnSaveProfile.addEventListener('click', () => {
      this.saveCurrentEditingProfile();
      profilesModal.classList.add('hidden');
    });

    this.bindProfileFormEvents();
  }

  updateModeBadge() {
    const badge = document.getElementById('preview-mode-badge');
    if (!badge) return;
    if (this.currentMode === 'battle') {
      badge.textContent = 'BATALLA (1 vs 1)';
      badge.style.backgroundColor = '#EF4444';
    } else if (this.currentMode === 'duet') {
      badge.textContent = 'DÚO COOPERATIVO';
      badge.style.backgroundColor = '#10B981';
    } else {
      badge.textContent = 'SOLO (1 JUGADOR)';
      badge.style.backgroundColor = '#2563EB';
    }
  }

  async loadCatalogFromGitHub() {
    try {
      const response = await fetch('songs/songs.json');
      if (response.ok) {
        const catalog = await response.json();
        for (const item of catalog) {
          this.songs.push({
            id: item.id || Math.random().toString(),
            title: item.title,
            artist: item.artist,
            cover: item.cover || null,
            txtPath: item.txt,
            audioPath: item.audio,
            videoPath: item.video || null,
            isRemote: true
          });
        }
      }
    } catch (e) {
      console.warn('Error loading songs.json:', e);
    }

    this.filteredSongs = [...this.songs];
    this.selectedSongIndex = 0;
    this.renderCoversGrid();
    this.updatePreviewPane();
    this.updateModeBadge();
  }

  renderCoversGrid() {
    const container = document.getElementById('grid-container');
    if (!container) return;

    if (this.filteredSongs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No se encontraron canciones.</p>
          <span>Usa el botón "Importar" para cargar canciones UltraStar.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = this.filteredSongs.map((song, idx) => `
      <div class="cover-card ${idx === this.selectedSongIndex ? 'selected' : ''}" data-idx="${idx}">
        <div class="cover-img-wrapper">
          ${song.cover || song.coverUrl 
            ? `<img src="${encodeURI(song.cover || song.coverUrl)}" alt="Portada" />`
            : `<img src="src/assets/images/svg/music.svg" alt="Música" class="fallback-cover" />`
          }
        </div>
        <div class="cover-card-label">
          <span class="cover-title">${this.escapeHtml(song.title)}</span>
          <span class="cover-artist">${this.escapeHtml(song.artist)}</span>
        </div>
      </div>
    `).join('');

    // Bind card clicks
    container.querySelectorAll('.cover-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx, 10);
        this.selectedSongIndex = idx;
        container.querySelectorAll('.cover-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.updatePreviewPane();
      });

      card.addEventListener('dblclick', () => {
        this.launchSelectedSong();
      });
    });
  }

  updatePreviewPane() {
    const song = this.filteredSongs[this.selectedSongIndex];
    if (!song) return;

    const img = document.getElementById('preview-cover');
    const title = document.getElementById('preview-title');
    const artist = document.getElementById('preview-artist');
    const bpm = document.getElementById('preview-bpm');
    const duration = document.getElementById('preview-duration');

    title.textContent = song.title;
    artist.textContent = song.artist;

    if (song.cover || song.coverUrl) {
      img.src = encodeURI(song.cover || song.coverUrl);
      img.style.display = 'block';
    } else {
      img.src = 'src/assets/images/svg/music.svg';
    }

    bpm.textContent = song.parsedData ? `BPM: ${song.parsedData.bpm}` : 'BPM: -';
    duration.textContent = song.parsedData ? `DURACIÓN: ~3 min` : 'DURACIÓN: -';
  }

  async launchSelectedSong() {
    const song = this.filteredSongs[this.selectedSongIndex];
    if (!song) return;

    // Determine active player profiles based on mode
    let profiles = ProfileManager.getProfiles();
    let activeProfiles = [];

    if (this.currentMode === 'battle' || this.currentMode === 'duet') {
      // Need 2 players
      activeProfiles = [
        profiles[0] || ProfileManager.DEFAULT_PROFILES[0],
        profiles[1] || ProfileManager.DEFAULT_PROFILES[1]
      ];
    } else {
      // 1 player
      const active = profiles.find(p => p.active) || profiles[0];
      activeProfiles = [active];
    }

    if (song.isRemote) {
      try {
        const res = await fetch(encodeURI(song.txtPath));
        const text = await res.text();
        const parsed = UltraStarParser.parse(text);
        const audioUrl = song.audioPath ? encodeURI(song.audioPath) : null;
        const videoUrl = song.videoPath ? encodeURI(song.videoPath) : null;
        this.onStartGame(parsed, audioUrl, videoUrl, activeProfiles);
      } catch (err) {
        alert('Error al descargar canción: ' + err.message);
      }
    } else {
      this.onStartGame(song.parsedData, song.audioUrl, song.videoUrl, activeProfiles);
    }
  }

  async processLocalFiles(files) {
    const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
    if (txtFiles.length === 0) {
      alert('No se encontraron archivos .txt con partitura UltraStar en la selección.');
      return;
    }

    for (const txtFile of txtFiles) {
      try {
        const text = await txtFile.text();
        const parsed = UltraStarParser.parse(text);

        const baseDir = txtFile.webkitRelativePath
          ? txtFile.webkitRelativePath.split('/').slice(0, -1).join('/')
          : '';

        const sameDirFiles = files.filter(f => {
          if (f.webkitRelativePath && baseDir) {
            return f.webkitRelativePath.startsWith(baseDir);
          }
          return true;
        });

        let audioFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          return (parsed.mp3 && name.includes(parsed.mp3.toLowerCase())) ||
                 name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.m4a');
        });

        let videoFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          return (parsed.video && name.includes(parsed.video.toLowerCase())) ||
                 name.endsWith('.mp4') || name.endsWith('.webm');
        });

        let coverFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          return (parsed.cover && name.includes(parsed.cover.toLowerCase())) ||
                 name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.jpeg');
        });

        const localSong = {
          id: 'local-' + Date.now() + '-' + Math.random(),
          title: parsed.title,
          artist: parsed.artist,
          parsedData: parsed,
          coverUrl: coverFile ? URL.createObjectURL(coverFile) : null,
          audioUrl: audioFile ? URL.createObjectURL(audioFile) : null,
          videoUrl: videoFile ? URL.createObjectURL(videoFile) : null,
          isRemote: false
        };

        this.songs.unshift(localSong);
      } catch (err) {
        console.error('Error importando:', txtFile.name, err);
      }
    }

    this.filteredSongs = [...this.songs];
    this.selectedSongIndex = 0;
    this.renderCoversGrid();
    this.updatePreviewPane();
  }

  /* --- PROFILES MODAL MANAGEMENT --- */

  openProfilesModal() {
    this.profiles = ProfileManager.getProfiles();
    this.activeProfileIdx = 0;
    this.renderProfileTabs();
    this.loadProfileIntoForm(this.profiles[0]);
    document.getElementById('profiles-modal').classList.remove('hidden');
  }

  renderProfileTabs() {
    const tabsContainer = document.getElementById('profile-selector-tabs');
    tabsContainer.innerHTML = this.profiles.map((p, idx) => `
      <button class="profile-tab-item ${idx === this.activeProfileIdx ? 'active' : ''}" data-idx="${idx}">
        <img src="src/assets/images/svg/${p.avatar}.svg" alt="" />
        <span>${this.escapeHtml(p.name)}</span>
      </button>
    `).join('');

    tabsContainer.querySelectorAll('.profile-tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.saveCurrentEditingProfile();
        this.activeProfileIdx = parseInt(btn.dataset.idx, 10);
        this.renderProfileTabs();
        this.loadProfileIntoForm(this.profiles[this.activeProfileIdx]);
      });
    });
  }

  loadProfileIntoForm(profile) {
    if (!profile) return;
    document.getElementById('prof-name').value = profile.name;
    document.getElementById('profile-avatar-preview').src = `src/assets/images/svg/${profile.avatar}.svg`;

    // Segmented buttons
    this.setSegmentActive('#diff-control', profile.difficulty);
    this.setSegmentActive('#role-control', profile.role);
    this.setSegmentActive('#active-control', profile.active ? 'true' : 'false');
  }

  setSegmentActive(containerSelector, val) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    container.querySelectorAll('.btn-segment').forEach(b => {
      b.classList.toggle('active', b.dataset.val === val);
    });
  }

  bindProfileFormEvents() {
    // Avatar thumbs click
    document.querySelectorAll('.avatar-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const avatarName = thumb.dataset.avatar;
        document.getElementById('profile-avatar-preview').src = `src/assets/images/svg/${avatarName}.svg`;
        if (this.profiles && this.profiles[this.activeProfileIdx]) {
          this.profiles[this.activeProfileIdx].avatar = avatarName;
        }
      });
    });

    // Segmented buttons clicks
    ['#diff-control', '#role-control', '#active-control'].forEach(selector => {
      const container = document.querySelector(selector);
      if (container) {
        container.querySelectorAll('.btn-segment').forEach(btn => {
          btn.addEventListener('click', () => {
            container.querySelectorAll('.btn-segment').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          });
        });
      }
    });
  }

  saveCurrentEditingProfile() {
    if (!this.profiles || !this.profiles[this.activeProfileIdx]) return;
    const prof = this.profiles[this.activeProfileIdx];

    prof.name = document.getElementById('prof-name').value.trim() || `Jugador ${this.activeProfileIdx + 1}`;
    
    const activeDiff = document.querySelector('#diff-control .btn-segment.active');
    if (activeDiff) prof.difficulty = activeDiff.dataset.val;

    const activeRole = document.querySelector('#role-control .btn-segment.active');
    if (activeRole) prof.role = activeRole.dataset.val;

    const activeStatus = document.querySelector('#active-control .btn-segment.active');
    if (activeStatus) prof.active = (activeStatus.dataset.val === 'true');

    ProfileManager.saveProfiles(this.profiles);
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }
}
