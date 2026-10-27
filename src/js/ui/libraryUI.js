/**
 * Lips-Style Minimalist Song Library with Real Connected Players.
 * Features:
 * - Dynamic real connected players strip (0 players by default)
 * - Square 1:1 Album Covers with Alphabetical Badge
 * - Seamless Back to Home navigation
 * - Floating Play Bar
 */

import { SongParser } from '../parser/songParser.js';

export class LibraryUI {
  constructor(containerElement, getConnectedPlayers, onStartGame, onOpenConnect) {
    this.container = containerElement;
    this.getConnectedPlayers = getConnectedPlayers;
    this.onStartGame = onStartGame;
    this.onOpenConnect = onOpenConnect;

    this.songs = [];
    this.filteredSongs = [];
    this.selectedSongIndex = 0;
    this.selectedMode = 'batalla';
    this.selectedDifficulty = 'normal';

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
              <span>Conectar</span>
            </button>
          </div>

          <!-- Right Actions -->
          <div class="header-actions">
            <div class="search-wrap">
              <img src="src/assets/images/svg/search.svg" alt="Buscar" />
              <input type="text" id="search-input" placeholder="Buscar canciones..." />
            </div>

            <label class="btn-action-minimal" for="folder-upload" title="Importar carpeta de canciones">
              <img src="src/assets/images/svg/folder-plus.svg" alt="Importar" />
              <span>Importar</span>
            </label>
            <input type="file" id="folder-upload" webkitdirectory directory multiple style="display: none;" />
          </div>
        </header>

        <!-- Body with Grid on left and Vocaluxe Details Side Panel on right -->
        <div class="library-body">
          <main class="lips-grid-view">
            <div id="lips-grid" class="lips-grid">
              <div class="loading-state">Cargando biblioteca de canciones...</div>
            </div>
          </main>

          <!-- Vocaluxe Side Detail Panel -->
          <aside id="song-detail-panel" class="vocaluxe-side-panel">
            <div class="panel-cover-wrap">
              <img id="panel-cover-img" src="src/assets/images/svg/music.svg" alt="Portada" class="panel-cover-img" />
            </div>

            <div class="panel-song-meta">
              <h2 id="panel-song-title" class="panel-title">-</h2>
              <p id="panel-song-artist" class="panel-artist">-</p>
            </div>

            <span class="panel-section-title">Modo de Juego</span>
            <div id="mode-selector-group" class="panel-toggle-group">
              <button class="panel-tab-btn active" data-mode="batalla">Batalla</button>
              <button class="panel-tab-btn" data-mode="dueto">Dueto</button>
              <button class="panel-tab-btn" data-mode="equipo">Equipo</button>
            </div>

            <span class="panel-section-title">Dificultad</span>
            <div id="diff-selector-group" class="panel-toggle-group">
              <button class="panel-tab-btn" data-diff="facil">Fácil</button>
              <button class="panel-tab-btn active" data-diff="normal">Normal</button>
              <button class="panel-tab-btn" data-diff="dificil">Difícil</button>
            </div>

            <div class="panel-actions">
              <button id="btn-panel-play" class="btn-panel-play">
                <img src="src/assets/images/svg/play.svg" alt="Jugar" />
                <span>JUGAR</span>
              </button>
              <p id="panel-players-status" class="panel-players-status">0 micrófonos conectados</p>
            </div>
          </aside>
        </div>
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

    // Mode Selector
    const modeButtons = document.querySelectorAll('#mode-selector-group .panel-tab-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMode = btn.dataset.mode;
      });
    });

    // Difficulty Selector
    const diffButtons = document.querySelectorAll('#diff-selector-group .panel-tab-btn');
    diffButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = btn.dataset.diff;
      });
    });

    // Play button in side panel
    const btnPanelPlay = document.getElementById('btn-panel-play');
    if (btnPanelPlay) {
      btnPanelPlay.addEventListener('click', () => {
        this.launchSelectedSong();
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
      this.updateDetailPanel();
    });

    // Keyboard support: Enter to start selected song
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
    const players = this.getConnectedPlayers();

    if (badgesContainer) {
      if (players.length === 0) {
        badgesContainer.innerHTML = '<span class="no-players-text">0 Micrófonos Conectados</span>';
      } else {
        badgesContainer.innerHTML = players.map(p => `
          <div class="player-badge-pill" style="border-color: ${p.color};">
            <img src="src/assets/images/svg/${p.avatar}.svg" alt="" class="badge-avatar" />
            <span class="badge-name">${this.escapeHtml(p.name)}</span>
          </div>
        `).join('');
      }
    }

    this.updateDetailPanel();
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
    this.updateDetailPanel();
    this.updateConnectedPlayersDisplay();
  }

  renderLipsGrid() {
    const grid = document.getElementById('lips-grid');
    if (!grid) return;

    if (this.filteredSongs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>No se encontraron canciones.</p>
          <span>Usa "Importar" para cargar carpetas de canciones.</span>
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
        this.updateDetailPanel();
      });

      card.addEventListener('dblclick', () => {
        this.launchSelectedSong();
      });
    });
  }

  updateDetailPanel() {
    const panel = document.getElementById('song-detail-panel');
    const song = this.filteredSongs[this.selectedSongIndex];
    if (!song) {
      if (panel) panel.classList.add('hidden');
      return;
    }

    if (panel) panel.classList.remove('hidden');
    const titleEl = document.getElementById('panel-song-title');
    const artistEl = document.getElementById('panel-song-artist');
    const imgEl = document.getElementById('panel-cover-img');
    const statusEl = document.getElementById('panel-players-status');

    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = song.artist;

    if (imgEl) {
      if (song.cover || song.coverUrl) {
        imgEl.src = encodeURI(song.cover || song.coverUrl);
      } else {
        imgEl.src = 'src/assets/images/svg/music.svg';
      }
    }

    const players = this.getConnectedPlayers();
    if (statusEl) {
      if (players.length === 0) {
        statusEl.textContent = '0 micrófonos conectados (conecta un móvil)';
        statusEl.style.color = '#F59E0B';
      } else {
        statusEl.textContent = `✓ ${players.length} micrófono${players.length > 1 ? 's' : ''} conectado${players.length > 1 ? 's' : ''}`;
        statusEl.style.color = '#10B981';
      }
    }
  }

  async launchSelectedSong() {
    const song = this.filteredSongs[this.selectedSongIndex];
    if (!song) return;

    let activePlayers = this.getConnectedPlayers();

    // Must have at least 1 player connected
    if (activePlayers.length === 0) {
      if (this.onOpenConnect) {
        this.onOpenConnect();
      }
      alert('Debes conectar al menos un micrófono (móvil) escaneando el código QR para cantar.');
      return;
    }

    const gameOptions = {
      mode: this.selectedMode || 'batalla',
      difficulty: this.selectedDifficulty || 'normal'
    };

    if (song.isRemote) {
      try {
        const res = await fetch(encodeURI(song.txtPath));
        const buf = await res.arrayBuffer();
        const parsed = SongParser.parse(buf);
        const audioUrl = song.audioPath ? encodeURI(song.audioPath) : null;
        const videoUrl = song.videoPath ? encodeURI(song.videoPath) : null;
        this.onStartGame(parsed, audioUrl, videoUrl, activePlayers, gameOptions);
      } catch (err) {
        alert('Error al descargar la canción: ' + err.message);
      }
    } else {
      const activeParsed = (this.selectedMode === 'dueto' && song.duetParsedData)
        ? song.duetParsedData
        : song.parsedData;
      this.onStartGame(activeParsed, song.audioUrl, song.videoUrl, activePlayers, gameOptions);
    }
  }

  async processLocalFiles(files) {
    const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
    if (txtFiles.length === 0) {
      alert('No se encontraron archivos de texto con partituras en la selección.');
      return;
    }

    // Group txt files by folder to deduplicate songs with multiple TXTs (e.g. standard and [MULTI] / [DUET])
    const dirMap = new Map();
    for (const txtFile of txtFiles) {
      const baseDir = txtFile.webkitRelativePath
        ? txtFile.webkitRelativePath.split('/').slice(0, -1).join('/')
        : 'dir_' + txtFile.name.replace(/\s*\[(multi|duet)\]/i, '').replace(/\.txt$/i, '');
      if (!dirMap.has(baseDir)) {
        dirMap.set(baseDir, []);
      }
      dirMap.get(baseDir).push(txtFile);
    }

    for (const [baseDir, txtsInDir] of dirMap) {
      try {
        // Detect standard txt vs multi/duet txt
        let standardTxt = txtsInDir.find(f => !f.name.toLowerCase().includes('multi') && !f.name.toLowerCase().includes('duet'));
        let multiTxt = txtsInDir.find(f => f.name.toLowerCase().includes('multi') || f.name.toLowerCase().includes('duet'));

        if (!standardTxt) standardTxt = txtsInDir[0];

        // Read buffer with auto UTF-8 / Windows-1252 detection
        const stdBuf = await standardTxt.arrayBuffer();
        const stdParsed = SongParser.parse(stdBuf);

        let multiParsed = null;
        if (multiTxt) {
          const multiBuf = await multiTxt.arrayBuffer();
          multiParsed = SongParser.parse(multiBuf);
        }

        const sameDirFiles = files.filter(f => {
          if (f.webkitRelativePath && !baseDir.startsWith('dir_')) {
            return f.webkitRelativePath.startsWith(baseDir);
          }
          return true;
        });

        let audioFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          return (stdParsed.mp3 && name.includes(stdParsed.mp3.toLowerCase())) ||
                 name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.m4a');
        });

        let videoFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          return (stdParsed.video && name.includes(stdParsed.video.toLowerCase())) ||
                 name.endsWith('.mp4') || name.endsWith('.webm');
        });

        let coverFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          return (stdParsed.cover && name.includes(stdParsed.cover.toLowerCase())) ||
                 name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.jpeg');
        });

        const localSong = {
          id: 'local-' + Date.now() + '-' + Math.random(),
          title: stdParsed.title,
          artist: stdParsed.artist,
          parsedData: stdParsed,
          duetParsedData: multiParsed,
          hasDuet: !!multiParsed,
          coverUrl: coverFile ? URL.createObjectURL(coverFile) : null,
          audioUrl: audioFile ? URL.createObjectURL(audioFile) : null,
          videoUrl: videoFile ? URL.createObjectURL(videoFile) : null,
          isRemote: false
        };

        this.songs.unshift(localSong);
      } catch (err) {
        console.error('Error importando carpeta:', baseDir, err);
      }
    }

    this.filteredSongs = [...this.songs];
    this.selectedSongIndex = 0;
    this.renderLipsGrid();
    this.updateDetailPanel();
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }
}
