/**
 * Lips-Style Minimalist Square Grid Library & 4-Player Selector.
 * Features:
 * - Square 1:1 Album Covers with Alphabetical Badge (Lips standard)
 * - Clean Title and Artist underneath
 * - Quick Mode Selection: 1P, 2P, 3P, 4P
 * - Floating Play Bar on song selection
 * - Minimalist Profiles Manager
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
    this.playerCount = ProfileManager.getPlayerCount(); // 1, 2, 3, or 4

    this.init();
  }

  async init() {
    this.renderLayout();
    this.bindEvents();
    await this.loadCatalogFromGitHub();
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="lips-screen">
        <!-- Top Minimalist Bar -->
        <header class="lips-header">
          <div class="lips-brand">
            <img src="src/assets/images/svg/mic.svg" alt="Karaoke" class="brand-icon" />
            <span class="brand-title">ETERNO KARAOKE</span>
          </div>

          <!-- Player Count Tabs (1P, 2P, 3P, 4P) -->
          <div class="player-count-tabs">
            <button class="count-tab ${this.playerCount === 1 ? 'active' : ''}" data-count="1">1 JUGADOR</button>
            <button class="count-tab ${this.playerCount === 2 ? 'active' : ''}" data-count="2">2 JUGADORES</button>
            <button class="count-tab ${this.playerCount === 3 ? 'active' : ''}" data-count="3">3 JUGADORES</button>
            <button class="count-tab ${this.playerCount === 4 ? 'active' : ''}" data-count="4">4 JUGADORES</button>
          </div>

          <!-- Right Actions -->
          <div class="header-actions">
            <div class="search-wrap">
              <img src="src/assets/images/svg/search.svg" alt="Buscar" />
              <input type="text" id="search-input" placeholder="Buscar canciones..." />
            </div>

            <button id="btn-open-profiles" class="btn-action-minimal" title="Perfiles">
              <img src="src/assets/images/svg/settings.svg" alt="Perfiles" />
              <span>Perfiles</span>
            </button>

            <label class="btn-action-minimal" for="folder-upload" title="Importar carpeta UltraStar">
              <img src="src/assets/images/svg/folder-plus.svg" alt="Importar" />
              <span>Importar</span>
            </label>
            <input type="file" id="folder-upload" webkitdirectory directory multiple style="display: none;" />
          </div>
        </header>

        <!-- Main Square Grid (Lips / Xbox 360 Style) -->
        <main class="lips-grid-view">
          <div id="lips-grid" class="lips-grid">
            <div class="loading-state">Cargando biblioteca de canciones...</div>
          </div>
        </main>

        <!-- Floating Action Play Bar at Bottom -->
        <footer id="floating-play-bar" class="floating-play-bar hidden">
          <div class="bar-song-info">
            <img id="bar-cover" src="" alt="Portada" class="bar-thumb" />
            <div>
              <h3 id="bar-title" class="bar-title">-</h3>
              <p id="bar-artist" class="bar-artist">-</p>
            </div>
          </div>
          <button id="btn-bar-play" class="btn-bar-play">
            <img src="src/assets/images/svg/play.svg" alt="Cantar" />
            <span>CANTAR AHORA</span>
          </button>
        </footer>

        <!-- Profiles Modal -->
        <aside id="profiles-modal" class="modal-overlay hidden">
          <div class="profiles-card">
            <header class="modal-header">
              <h2>PERFILES DE JUGADORES (HASTA 4)</h2>
              <button id="btn-close-profiles" class="btn-close">&times;</button>
            </header>

            <div class="profiles-content">
              <div class="profile-tabs" id="profile-selector-tabs"></div>

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
                  <label>Canal de Entrada de Audio</label>
                  <div class="segmented-control" id="channel-control">
                    <button type="button" class="btn-segment active" data-val="0">Canal 1 (L / Predeterminado)</button>
                    <button type="button" class="btn-segment" data-val="1">Canal 2 (R / Mic 2)</button>
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
    // Player Count tabs
    const countTabs = this.container.querySelectorAll('.count-tab');
    countTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        countTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.playerCount = parseInt(tab.dataset.count, 10);
        ProfileManager.setPlayerCount(this.playerCount);
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
      this.renderLipsGrid();
      this.updateFloatingBar();
    });

    // Play button in floating bar
    const btnBarPlay = document.getElementById('btn-bar-play');
    btnBarPlay.addEventListener('click', () => {
      this.launchSelectedSong();
    });

    // Keyboard support: Enter / Space to start selected song
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.container.closest('.hidden')) {
        this.launchSelectedSong();
      }
    });

    // Import Local Folder
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
    this.renderLipsGrid();
    this.updateFloatingBar();
  }

  renderLipsGrid() {
    const grid = document.getElementById('lips-grid');
    if (!grid) return;

    if (this.filteredSongs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>No se encontraron canciones.</p>
          <span>Usa "Importar" para cargar carpetas UltraStar.</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.filteredSongs.map((song, idx) => {
      const initial = (song.title || 'A')[0].toUpperCase();
      return `
        <div class="lips-card ${idx === this.selectedSongIndex ? 'selected' : ''}" data-idx="${idx}">
          <div class="lips-square">
            <span class="letter-badge">${initial}</span>
            ${song.cover || song.coverUrl 
              ? `<img src="${encodeURI(song.cover || song.coverUrl)}" alt="" class="square-img" />`
              : `<img src="src/assets/images/svg/music.svg" alt="" class="fallback-img" />`
            }
          </div>
          <div class="lips-info">
            <h4 class="lips-title">${this.escapeHtml(song.title)}</h4>
            <p class="lips-artist">${this.escapeHtml(song.artist)}</p>
          </div>
        </div>
      `;
    }).join('');

    // Bind card clicks
    grid.querySelectorAll('.lips-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx, 10);
        this.selectedSongIndex = idx;
        grid.querySelectorAll('.lips-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.updateFloatingBar();
      });

      card.addEventListener('dblclick', () => {
        this.launchSelectedSong();
      });
    });
  }

  updateFloatingBar() {
    const bar = document.getElementById('floating-play-bar');
    const song = this.filteredSongs[this.selectedSongIndex];
    if (!song) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    document.getElementById('bar-title').textContent = song.title;
    document.getElementById('bar-artist').textContent = song.artist;

    const img = document.getElementById('bar-cover');
    if (song.cover || song.coverUrl) {
      img.src = encodeURI(song.cover || song.coverUrl);
      img.style.display = 'block';
    } else {
      img.src = 'src/assets/images/svg/music.svg';
    }
  }

  async launchSelectedSong() {
    const song = this.filteredSongs[this.selectedSongIndex];
    if (!song) return;

    // Get up to N active profiles (1, 2, 3 or 4)
    const allProfiles = ProfileManager.getProfiles();
    const activeProfiles = allProfiles.slice(0, this.playerCount);

    if (song.isRemote) {
      try {
        const res = await fetch(encodeURI(song.txtPath));
        const text = await res.text();
        const parsed = UltraStarParser.parse(text);
        const audioUrl = song.audioPath ? encodeURI(song.audioPath) : null;
        const videoUrl = song.videoPath ? encodeURI(song.videoPath) : null;
        this.onStartGame(parsed, audioUrl, videoUrl, activeProfiles);
      } catch (err) {
        alert('Error al descargar la canción: ' + err.message);
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
    this.renderLipsGrid();
    this.updateFloatingBar();
  }

  /* --- PROFILES MODAL --- */

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
        <span>P${idx + 1}: ${this.escapeHtml(p.name)}</span>
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

    this.setSegmentActive('#diff-control', profile.difficulty);
    this.setSegmentActive('#channel-control', (profile.channel !== undefined ? profile.channel : 0).toString());
  }

  setSegmentActive(containerSelector, val) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    container.querySelectorAll('.btn-segment').forEach(b => {
      b.classList.toggle('active', b.dataset.val === val);
    });
  }

  bindProfileFormEvents() {
    document.querySelectorAll('.avatar-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const avatarName = thumb.dataset.avatar;
        document.getElementById('profile-avatar-preview').src = `src/assets/images/svg/${avatarName}.svg`;
        if (this.profiles && this.profiles[this.activeProfileIdx]) {
          this.profiles[this.activeProfileIdx].avatar = avatarName;
        }
      });
    });

    ['#diff-control', '#channel-control'].forEach(selector => {
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

    const activeChan = document.querySelector('#channel-control .btn-segment.active');
    if (activeChan) prof.channel = parseInt(activeChan.dataset.val, 10);

    ProfileManager.saveProfiles(this.profiles);
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }
}
