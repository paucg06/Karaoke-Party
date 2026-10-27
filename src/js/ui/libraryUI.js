/**
 * Lips-Style Minimalist Song Library with Real Connected Players.
 * Features:
 * - Dynamic real connected players strip (0 players by default)
 * - Square 1:1 Album Covers with Alphabetical Badge
 * - Seamless Back to Home navigation
 * - Floating Play Bar
 */

import { UltraStarParser } from '../parser/ultrastarParser.js';

export class LibraryUI {
  constructor(containerElement, getConnectedPlayers, onStartGame, onOpenConnect) {
    this.container = containerElement;
    this.getConnectedPlayers = getConnectedPlayers;
    this.onStartGame = onStartGame;
    this.onOpenConnect = onOpenConnect;

    this.songs = [];
    this.filteredSongs = [];
    this.selectedSongIndex = 0;

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
            <button id="btn-back-home" class="btn-action-minimal" style="margin-right: 12px;" title="Volver al inicio">
              <img src="src/assets/images/svg/arrow-left.svg" alt="Atrás" />
              <span>Inicio</span>
            </button>
            <img src="src/assets/images/svg/mic.svg" alt="Karaoke" class="brand-icon" />
            <span class="brand-title">ETERNO KARAOKE</span>
          </div>

          <!-- Real Connected Players Strip -->
          <div class="library-players-strip">
            <div id="library-players-badges" class="players-badges-row">
              <span class="no-players-text">0 Micrófonos Conectados</span>
            </div>
            <button id="btn-library-connect" class="btn-action-minimal" title="Conectar móvil con QR">
              <img src="src/assets/images/svg/mic.svg" alt="Conectar" />
              <span>+ Conectar Móvil</span>
            </button>
          </div>

          <!-- Right Actions -->
          <div class="header-actions">
            <div class="search-wrap">
              <img src="src/assets/images/svg/search.svg" alt="Buscar" />
              <input type="text" id="search-input" placeholder="Buscar canciones..." />
            </div>

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
      </div>
    `;
  }

  bindEvents() {
    // Back to Home
    const btnBackHome = document.getElementById('btn-back-home');
    if (btnBackHome) {
      btnBackHome.addEventListener('click', () => {
        document.getElementById('view-library').classList.add('hidden');
        document.getElementById('view-home').classList.remove('hidden');
      });
    }

    // Connect Button in Library
    const btnConnect = document.getElementById('btn-library-connect');
    if (btnConnect) {
      btnConnect.addEventListener('click', () => {
        if (this.onOpenConnect) this.onOpenConnect();
      });
    }

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

    // Drag and drop
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        this.processLocalFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  updateConnectedPlayersDisplay() {
    const badgesContainer = document.getElementById('library-players-badges');
    if (!badgesContainer) return;

    const players = this.getConnectedPlayers();

    if (players.length === 0) {
      badgesContainer.innerHTML = '<span class="no-players-text">0 Micrófonos Conectados</span>';
      return;
    }

    badgesContainer.innerHTML = players.map((p, idx) => `
      <div class="player-badge-pill" style="border-color: ${p.color};">
        <img src="src/assets/images/svg/${p.avatar}.svg" alt="" class="badge-avatar" />
        <span class="badge-name">P${idx + 1}: ${this.escapeHtml(p.name)}</span>
      </div>
    `).join('');
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
    this.updateConnectedPlayersDisplay();
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

    let activePlayers = this.getConnectedPlayers();

    // If no players connected, prompt to use PC mic or open connect modal
    if (activePlayers.length === 0) {
      const usePc = confirm('No hay ningún móvil conectado como micrófono.\n\n¿Quieres activar el micrófono del ordenador para cantar?');
      if (usePc) {
        activePlayers = [{
          id: 'local_pc',
          name: 'Jugador 1 (PC)',
          avatar: 'avatar-1',
          color: '#2563EB',
          isMobile: false
        }];
      } else {
        if (this.onOpenConnect) this.onOpenConnect();
        return;
      }
    }

    if (song.isRemote) {
      try {
        const res = await fetch(encodeURI(song.txtPath));
        const text = await res.text();
        const parsed = UltraStarParser.parse(text);
        const audioUrl = song.audioPath ? encodeURI(song.audioPath) : null;
        const videoUrl = song.videoPath ? encodeURI(song.videoPath) : null;
        this.onStartGame(parsed, audioUrl, videoUrl, activePlayers);
      } catch (err) {
        alert('Error al descargar la canción: ' + err.message);
      }
    } else {
      this.onStartGame(song.parsedData, song.audioUrl, song.videoUrl, activePlayers);
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

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }
}
