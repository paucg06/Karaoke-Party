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
    this.selectedDuration = 'completa'; // 'completa' or 'corta' (Partida rápida ~2 min)
    this.currentSort = 'alpha-asc'; // Alphabetical by default

    this.modeOptions = [
      { id: 'batalla', label: 'Batalla' },
      { id: 'dueto', label: 'Dueto' },
      { id: 'equipo', label: 'Equipo' }
    ];

    this.durationOptions = [
      { id: 'completa', label: 'Completa' },
      { id: 'corta', label: 'Rápida (~2 min)' }
    ];

    this.diffOptions = [
      { id: 'facil', label: 'Fácil' },
      { id: 'normal', label: 'Normal' },
      { id: 'dificil', label: 'Difícil' }
    ];

    // 30-second audio preview player with 0.25-second auto-start delay
    this.previewAudio = new Audio();
    this.isPreviewPlaying = false;
    this.previewTimer = null;
    this.previewScheduleTimer = null;
    this.previewToken = 0;

    this.previewAudio.addEventListener('ended', () => {
      this.stopSongPreview();
    });

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
            <button id="btn-back-home" class="btn-action-minimal" title="Volver al inicio">
              <img src="src/assets/images/svg/arrow-left.svg" alt="Atrás" />
            </button>
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

            <div class="sort-wrap">
              <select id="sort-select" class="sort-select" title="Ordenar canciones">
                <option value="alpha-asc" selected>A - Z</option>
                <option value="alpha-desc">Z - A</option>
                <option value="artist-asc">Artista</option>
                <option value="diff-asc">Dificultad (Menor a Mayor)</option>
                <option value="diff-desc">Dificultad (Mayor a Menor)</option>
                <option value="recent">Recientes</option>
              </select>
            </div>

            <label class="btn-action-minimal" for="folder-upload" title="Importar carpeta de canciones">
              <img src="src/assets/images/svg/folder-plus.svg" alt="Importar" style="filter: brightness(0) invert(1);" />
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
              
              <!-- Song Duration Badge (Top Left, opposite to preview audio badge) -->
              <div id="panel-cover-duration" class="cover-duration-pill" title="Duración de la canción">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span id="panel-cover-duration-text">--:--</span>
              </div>

              <!-- Audio Preview Playing Indicator (Bottom Right) -->
              <div id="preview-indicator" class="preview-playing-pill hidden" title="Música sonando">
                <div class="audio-wave-bars">
                  <span class="bar"></span>
                  <span class="bar"></span>
                  <span class="bar"></span>
                  <span class="bar"></span>
                </div>
              </div>
            </div>

            <div class="panel-song-meta">
              <h2 id="panel-song-title" class="panel-title">-</h2>
              <p id="panel-song-artist" class="panel-artist">-</p>
              <div id="panel-diff-badge" class="panel-diff-badge">
                <span class="diff-badge-label">Dificultad Letra:</span>
                <span id="panel-diff-stars" class="diff-stars-container"></span>
                <span id="panel-diff-name" class="diff-name-pill diff-easy">Fácil</span>
              </div>
            </div>

            <!-- Compact Stepper Controls -->
            <div class="panel-steppers-container">
              <div class="panel-stepper-row">
                <span class="stepper-label">Modo</span>
                <div class="stepper-control">
                  <button id="stepper-mode-prev" class="stepper-btn" type="button" aria-label="Anterior">&lsaquo;</button>
                  <span id="stepper-mode-val" class="stepper-val">Batalla</span>
                  <button id="stepper-mode-next" class="stepper-btn" type="button" aria-label="Siguiente">&rsaquo;</button>
                </div>
              </div>

              <div class="panel-stepper-row">
                <span class="stepper-label">Duración</span>
                <div class="stepper-control">
                  <button id="stepper-dur-prev" class="stepper-btn" type="button" aria-label="Anterior">&lsaquo;</button>
                  <span id="stepper-dur-val" class="stepper-val">Completa</span>
                  <button id="stepper-dur-next" class="stepper-btn" type="button" aria-label="Siguiente">&rsaquo;</button>
                </div>
              </div>

              <div class="panel-stepper-row">
                <span class="stepper-label">Tolerancia</span>
                <div class="stepper-control">
                  <button id="stepper-diff-prev" class="stepper-btn" type="button" aria-label="Anterior">&lsaquo;</button>
                  <span id="stepper-diff-val" class="stepper-val">Normal</span>
                  <button id="stepper-diff-next" class="stepper-btn" type="button" aria-label="Siguiente">&rsaquo;</button>
                </div>
              </div>
            </div>

            <div class="panel-actions">
              <button id="btn-panel-play" class="btn-panel-play">
                <img src="src/assets/images/svg/play.svg" alt="Jugar" />
                <span>JUGAR</span>
              </button>
            </div>
          </aside>
        </div>

        <!-- Drag and Drop Overlay for multi-folder import -->
        <div id="drop-zone-overlay" class="drop-zone-overlay hidden">
          <div class="drop-zone-content">
            <img src="src/assets/images/svg/folder-plus.svg" alt="" class="drop-zone-icon" />
            <h3 class="drop-zone-title">Suelta aquí tus carpetas de canciones</h3>
            <p class="drop-zone-desc">Puedes arrastrar 20 carpetas o más simultáneamente</p>
          </div>
        </div>

        <!-- Toast notification -->
        <div id="library-toast" class="library-toast hidden"></div>
      </div>
    `;
  }

  bindEvents() {
    // Back to Home
    const btnBackHome = document.getElementById('btn-back-home');
    if (btnBackHome) {
      btnBackHome.addEventListener('click', () => {
        this.stopSongPreview();
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

    // Stepper Controls: Mode, Duration, Difficulty (Pitch Tolerance)
    document.getElementById('stepper-mode-prev')?.addEventListener('click', () => this.cycleMode(-1));
    document.getElementById('stepper-mode-next')?.addEventListener('click', () => this.cycleMode(1));
    document.getElementById('stepper-mode-val')?.addEventListener('click', () => this.cycleMode(1));

    document.getElementById('stepper-dur-prev')?.addEventListener('click', () => this.cycleDuration(-1));
    document.getElementById('stepper-dur-next')?.addEventListener('click', () => this.cycleDuration(1));
    document.getElementById('stepper-dur-val')?.addEventListener('click', () => this.cycleDuration(1));

    document.getElementById('stepper-diff-prev')?.addEventListener('click', () => this.cycleDifficulty(-1));
    document.getElementById('stepper-diff-next')?.addEventListener('click', () => this.cycleDifficulty(1));
    document.getElementById('stepper-diff-val')?.addEventListener('click', () => this.cycleDifficulty(1));

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
      this.applySortAndFilter(term);
      this.selectedSongIndex = 0;
      this.renderLipsGrid();
      this.updateDetailPanel();
      if (this.filteredSongs.length > 0) {
        this.scheduleSongPreview();
      } else {
        this.stopSongPreview();
      }
    });

    // Sort selector
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        const term = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
        this.applySortAndFilter(term);
        this.selectedSongIndex = 0;
        this.renderLipsGrid();
        this.updateDetailPanel();
        if (this.filteredSongs.length > 0) {
          this.scheduleSongPreview();
        } else {
          this.stopSongPreview();
        }
      });
    }

    // Keyboard support: Enter to start selected song
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.container.closest('.hidden')) {
        this.launchSelectedSong();
      }
    });

    // Import Folder Button (Select parent folder containing multiple song subfolders)
    const folderInput = document.getElementById('folder-upload');
    if (folderInput) {
      folderInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.processLocalFiles(Array.from(e.target.files));
          e.target.value = ''; // Reset input so same folder can be re-selected if needed
        }
      });
    }

    // Multi-Folder Drag and Drop with full recursive directory traversal
    const dropOverlay = document.getElementById('drop-zone-overlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      if (this.container.closest('.hidden')) return;
      e.preventDefault();
      dragCounter++;
      if (dropOverlay) dropOverlay.classList.remove('hidden');
    });

    window.addEventListener('dragover', (e) => {
      if (this.container.closest('.hidden')) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('dragleave', (e) => {
      if (this.container.closest('.hidden')) return;
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (dropOverlay) dropOverlay.classList.add('hidden');
      }
    });

    window.addEventListener('drop', async (e) => {
      if (this.container.closest('.hidden')) return;
      e.preventDefault();
      dragCounter = 0;
      if (dropOverlay) dropOverlay.classList.add('hidden');

      if (e.dataTransfer) {
        const files = await this.getFilesFromDataTransfer(e.dataTransfer);
        if (files && files.length > 0) {
          this.processLocalFiles(files);
        }
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

    this.applySortAndFilter();
    this.selectedSongIndex = 0;
    this.renderLipsGrid();
    this.updateDetailPanel();
    this.updateConnectedPlayersDisplay();
    if (this.filteredSongs.length > 0) {
      this.scheduleSongPreview();
    }
  }

  applySortAndFilter(term = '') {
    let list = this.songs;
    if (term) {
      list = list.filter(s =>
        (s.title || '').toLowerCase().includes(term) || (s.artist || '').toLowerCase().includes(term)
      );
    }

    // Default: Alphabetical (A-Z)
    const sorted = [...list].sort((a, b) => {
      switch (this.currentSort) {
        case 'alpha-asc':
          return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base', numeric: true });
        case 'alpha-desc':
          return (b.title || '').localeCompare(a.title || '', 'es', { sensitivity: 'base', numeric: true });
        case 'artist-asc':
          return (a.artist || '').localeCompare(b.artist || '', 'es', { sensitivity: 'base', numeric: true });
        case 'diff-asc':
          return (a.difficultyStars || 1) - (b.difficultyStars || 1) || (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base', numeric: true });
        case 'diff-desc':
          return (b.difficultyStars || 1) - (a.difficultyStars || 1) || (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base', numeric: true });
        case 'recent':
          return (b.importOrder || 0) - (a.importOrder || 0);
        default:
          return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base', numeric: true });
      }
    });

    this.filteredSongs = sorted;
  }

  renderLipsGrid() {
    const grid = document.getElementById('lips-grid');
    if (!grid) return;

    if (this.filteredSongs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>No hay canciones en la biblioteca.</p>
          <span>Usa el botón de importar o arrastra tus carpetas de canciones aquí.</span>
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
            <div class="lips-sub-row">
              <p class="lips-artist">${this.escapeHtml(song.artist)}</p>
              <span class="lips-stars" title="Dificultad letra: ${song.difficultyLabel || 'Fácil'}">${this.renderStarIcons(song.difficultyStars || 1)}</span>
            </div>
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
        this.scheduleSongPreview();
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

    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = song.artist;

    if (imgEl) {
      if (song.cover || song.coverUrl) {
        imgEl.src = encodeURI(song.cover || song.coverUrl);
      } else {
        imgEl.src = 'src/assets/images/svg/music.svg';
      }
    }

    // Song rhythm & lyric difficulty
    const starsEl = document.getElementById('panel-diff-stars');
    const diffNameEl = document.getElementById('panel-diff-name');
    const stars = song.difficultyStars || 1;
    const label = song.difficultyLabel || 'Fácil';

    if (starsEl) starsEl.innerHTML = this.renderStarIcons(stars);
    if (diffNameEl) {
      diffNameEl.textContent = label;
      diffNameEl.className = 'diff-name-pill ' + (stars === 3 ? 'diff-hard' : (stars === 2 ? 'diff-medium' : 'diff-easy'));
    }

    // Calculate & display song duration in minutes
    let durationSecs = song.durationSecs || 0;
    if (!durationSecs && song.parsedData && song.parsedData.notes && song.parsedData.notes.length > 0) {
      const lastNote = song.parsedData.notes[song.parsedData.notes.length - 1];
      durationSecs = Math.round(lastNote.endTime + 5);
    }
    this.updateDurationBadge(durationSecs);

    // Update compact steppers (Mode, Duration, Tolerance)
    this.updateSteppersDisplay();

    this.showPreviewIndicator(this.isPreviewPlaying);
  }

  updateDurationBadge(secs) {
    const durEl = document.getElementById('panel-cover-duration-text');
    if (!durEl) return;
    if (!secs || isNaN(secs) || secs <= 0) {
      durEl.textContent = '--:--';
      return;
    }
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    durEl.textContent = `${m}:${s.toString().padStart(2, '0')} min`;
  }

  updateSteppersDisplay() {
    const song = this.filteredSongs[this.selectedSongIndex];
    const hasDuet = song ? !!song.hasDuet : false;

    // Dueto is only available when the song actually has duet data
    const availableModes = this.modeOptions.filter(m => m.id !== 'dueto' || hasDuet);
    if (!availableModes.some(m => m.id === this.selectedMode)) {
      this.selectedMode = 'batalla';
    }

    const currentModeObj = availableModes.find(m => m.id === this.selectedMode) || availableModes[0];
    const currentDurObj = this.durationOptions.find(d => d.id === this.selectedDuration) || this.durationOptions[0];
    const currentDiffObj = this.diffOptions.find(d => d.id === this.selectedDifficulty) || this.diffOptions[1];

    const modeEl = document.getElementById('stepper-mode-val');
    const durEl = document.getElementById('stepper-dur-val');
    const diffEl = document.getElementById('stepper-diff-val');

    if (modeEl) modeEl.textContent = currentModeObj.label;
    if (durEl) durEl.textContent = currentDurObj.label;
    if (diffEl) diffEl.textContent = currentDiffObj.label;
  }

  cycleMode(direction) {
    const song = this.filteredSongs[this.selectedSongIndex];
    const hasDuet = song ? !!song.hasDuet : false;
    const availableModes = this.modeOptions.filter(m => m.id !== 'dueto' || hasDuet);
    let idx = availableModes.findIndex(m => m.id === this.selectedMode);
    if (idx === -1) idx = 0;
    idx = (idx + direction + availableModes.length) % availableModes.length;
    this.selectedMode = availableModes[idx].id;
    this.updateSteppersDisplay();
  }

  cycleDuration(direction) {
    let idx = this.durationOptions.findIndex(d => d.id === this.selectedDuration);
    if (idx === -1) idx = 0;
    idx = (idx + direction + this.durationOptions.length) % this.durationOptions.length;
    this.selectedDuration = this.durationOptions[idx].id;
    this.updateSteppersDisplay();
  }

  cycleDifficulty(direction) {
    let idx = this.diffOptions.findIndex(d => d.id === this.selectedDifficulty);
    if (idx === -1) idx = 0;
    idx = (idx + direction + this.diffOptions.length) % this.diffOptions.length;
    this.selectedDifficulty = this.diffOptions[idx].id;
    this.updateSteppersDisplay();
  }

  renderStarIcons(stars = 1) {
    let out = '';
    for (let i = 1; i <= 3; i++) {
      const isFilled = i <= stars;
      const fill = isFilled ? '#F59E0B' : '#334155';
      out += `<svg class="star-svg" viewBox="0 0 24 24" width="13" height="13" fill="${fill}"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>`;
    }
    return out;
  }

  scheduleSongPreview() {
    this.stopSongPreview();
    const song = this.filteredSongs[this.selectedSongIndex];
    if (!song) return;

    const currentToken = ++this.previewToken;
    // Wait 0.25 seconds (250ms) before auto-playing preview
    this.previewScheduleTimer = setTimeout(() => {
      if (this.previewToken === currentToken) {
        this.playSongPreview(currentToken);
      }
    }, 250);
  }

  playSongPreview(expectedToken) {
    const currentToken = expectedToken || ++this.previewToken;
    const song = this.filteredSongs[this.selectedSongIndex];
    if (!song) return;

    const audioUrl = song.isRemote ? (song.audioPath ? encodeURI(song.audioPath) : null) : song.audioUrl;
    if (!audioUrl) return;

    this.previewAudio.src = audioUrl;

    const onMeta = () => {
      this.previewAudio.removeEventListener('loadedmetadata', onMeta);
      if (this.previewToken !== currentToken) return;

      const dur = this.previewAudio.duration || 60;
      if (dur && !isNaN(dur) && dur > 0) {
        song.durationSecs = Math.round(dur);
        const currentSelected = this.filteredSongs[this.selectedSongIndex];
        if (currentSelected && currentSelected.id === song.id) {
          this.updateDurationBadge(song.durationSecs);
        }
      }

      // Seek to ~35% into the song (chorus / hook)
      const startTime = Math.min(Math.max(15, dur * 0.35), Math.max(0, dur - 35));
      this.previewAudio.currentTime = startTime;

      this.previewAudio.play().then(() => {
        if (this.previewToken !== currentToken) {
          this.previewAudio.pause();
          return;
        }
        this.isPreviewPlaying = true;
        this.showPreviewIndicator(true);

        // Auto-stop after 30 seconds (doubled duration)
        this.previewTimer = setTimeout(() => {
          if (this.previewToken === currentToken) {
            this.stopSongPreview();
          }
        }, 30000);
      }).catch(err => {
        console.log('Preview playback notice:', err?.message);
        this.showPreviewIndicator(false);
      });
    };

    this.previewAudio.addEventListener('loadedmetadata', onMeta);
    this.previewAudio.load();
  }

  stopSongPreview() {
    if (this.previewScheduleTimer) {
      clearTimeout(this.previewScheduleTimer);
      this.previewScheduleTimer = null;
    }
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
    }
    this.isPreviewPlaying = false;
    this.showPreviewIndicator(false);
  }

  showPreviewIndicator(isPlaying) {
    const indicator = document.getElementById('preview-indicator');
    if (!indicator) return;
    if (isPlaying) {
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  }

  showToast(message, duration = 3500) {
    const toast = document.getElementById('library-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  async launchSelectedSong() {
    this.stopSongPreview();
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
      difficulty: this.selectedDifficulty || 'normal',
      duration: this.selectedDuration || 'completa'
    };

    if (song.isRemote) {
      try {
        const res = await fetch(encodeURI(song.txtPath));
        const buf = await res.arrayBuffer();
        let parsed = SongParser.parse(buf);
        if (this.selectedDuration === 'corta') {
          parsed = SongParser.createShortVersion(parsed, 120);
        }
        const audioUrl = song.audioPath ? encodeURI(song.audioPath) : null;
        const videoUrl = song.videoPath ? encodeURI(song.videoPath) : null;
        this.onStartGame(parsed, audioUrl, videoUrl, activePlayers, gameOptions);
      } catch (err) {
        alert('Error al descargar la canción: ' + err.message);
      }
    } else {
      let activeParsed = (this.selectedMode === 'dueto' && song.duetParsedData)
        ? song.duetParsedData
        : song.parsedData;
      if (this.selectedDuration === 'corta' && activeParsed) {
        activeParsed = SongParser.createShortVersion(activeParsed, 120);
      }
      this.onStartGame(activeParsed, song.audioUrl, song.videoUrl, activePlayers, gameOptions);
    }
  }

  /**
   * Recursively extract all files from dropped DataTransfer items,
   * supporting multiple dropped folders (e.g. 15-30 folders at once).
   */
  async getFilesFromDataTransfer(dataTransfer) {
    const files = [];

    // CRITICAL FIX: Synchronously extract all entries from dataTransfer.items BEFORE any await,
    // because Chromium clears/invalidates dataTransfer.items across asynchronous microtask turns!
    const entries = [];
    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            entries.push(entry);
          }
        }
      }
    }

    const readEntryRecursively = async (entry, path = '') => {
      if (entry.isFile) {
        return new Promise(resolve => {
          entry.file(file => {
            const fullPath = path + file.name;
            file.customPath = fullPath;
            try {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: fullPath,
                writable: true,
                configurable: true
              });
            } catch (_) {}
            resolve([file]);
          }, () => resolve([]));
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        let allEntries = [];

        // Chrome readEntries returns entries in batches of at most 100.
        // Loop until an empty batch is returned.
        const readBatch = () => {
          return new Promise(resolve => {
            dirReader.readEntries(entries => {
              resolve(entries || []);
            }, () => resolve([]));
          });
        };

        let batch = await readBatch();
        while (batch && batch.length > 0) {
          allEntries = allEntries.concat(batch);
          batch = await readBatch();
        }

        const nestedFiles = [];
        for (const subEntry of allEntries) {
          const subFiles = await readEntryRecursively(subEntry, path + entry.name + '/');
          nestedFiles.push(...subFiles);
        }
        return nestedFiles;
      }
      return [];
    };

    if (entries.length > 0) {
      for (const entry of entries) {
        const entryFiles = await readEntryRecursively(entry);
        files.push(...entryFiles);
      }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (const f of dataTransfer.files) {
        files.push(f);
      }
    }

    return files;
  }

  async processLocalFiles(files) {
    if (!files || files.length === 0) return;

    const getFilePath = (f) => f.customPath || f.webkitRelativePath || f.name || '';

    const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
    if (txtFiles.length === 0) {
      alert('No se encontraron partituras (.txt) en las carpetas seleccionadas.');
      return;
    }

    // Group txt files by folder to deduplicate songs with multiple TXTs (e.g. standard and [MULTI] / [DUET])
    const dirMap = new Map();
    for (const txtFile of txtFiles) {
      const filePath = getFilePath(txtFile);
      let baseDir = '';
      if (filePath.includes('/')) {
        baseDir = filePath.split('/').slice(0, -1).join('/');
      } else {
        baseDir = 'dir_' + txtFile.name.replace(/\s*\[(multi|duet)\]/i, '').replace(/\.txt$/i, '');
      }

      if (!dirMap.has(baseDir)) {
        dirMap.set(baseDir, []);
      }
      dirMap.get(baseDir).push(txtFile);
    }

    let importedCount = 0;
    const skippedFolders = [];

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
          const p = getFilePath(f);
          if (baseDir && !baseDir.startsWith('dir_')) {
            return p === baseDir || p.startsWith(baseDir + '/');
          }
          return true;
        });

        let audioFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          if (stdParsed.mp3 && name === stdParsed.mp3.toLowerCase()) return true;
          if (stdParsed.mp3 && name.includes(stdParsed.mp3.toLowerCase())) return true;
          return name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.m4a') || name.endsWith('.wav');
        });

        let videoFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          if (stdParsed.video) {
            const vBase = stdParsed.video.replace(/\.[^/.]+$/, '').toLowerCase();
            if (name === stdParsed.video.toLowerCase()) return true;
            if (name.startsWith(vBase) && (name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.m4v') || name.endsWith('.mov'))) return true;
          }
          return name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.m4v') || name.endsWith('.mov');
        });

        let coverFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          if (stdParsed.cover && name === stdParsed.cover.toLowerCase()) return true;
          if (stdParsed.cover && name.includes(stdParsed.cover.toLowerCase())) return true;
          return name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.jpeg') || name.endsWith('.webp');
        });

        const folderDisplayName = baseDir.replace(/^dir_/, '').split('/').pop() || standardTxt.name.replace(/\.txt$/i, '');

        // Strict Requirement: Must have TXT, IMAGE, and VIDEO
        if (!coverFile || !videoFile) {
          const missing = [];
          if (!coverFile) missing.push('carátula/imagen');
          if (!videoFile) missing.push('vídeo');
          skippedFolders.push({
            name: folderDisplayName,
            missing: missing.join(' y ')
          });
          continue; // DO NOT import this folder!
        }

        let calculatedDuration = 0;
        if (stdParsed.end && stdParsed.end > 0) {
          calculatedDuration = stdParsed.end > 1000 ? Math.round(stdParsed.end / 1000) : Math.round(stdParsed.end);
        } else if (stdParsed.notes && stdParsed.notes.length > 0) {
          calculatedDuration = Math.round(stdParsed.notes[stdParsed.notes.length - 1].endTime + 5);
        }

        const localSong = {
          id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          title: stdParsed.title || standardTxt.name.replace(/\.txt$/i, ''),
          artist: stdParsed.artist || 'Artista Desconocido',
          parsedData: stdParsed,
          duetParsedData: multiParsed,
          hasDuet: !!multiParsed,
          difficultyStars: stdParsed.difficultyStars || 1,
          difficultyLabel: stdParsed.difficultyLabel || 'Fácil',
          durationSecs: calculatedDuration,
          coverUrl: coverFile ? URL.createObjectURL(coverFile) : null,
          audioUrl: audioFile ? URL.createObjectURL(audioFile) : (videoFile ? URL.createObjectURL(videoFile) : null),
          videoUrl: videoFile ? URL.createObjectURL(videoFile) : null,
          importOrder: Date.now() + importedCount,
          isRemote: false
        };

        // Deduplicate against existing songs by title + artist
        const existingIdx = this.songs.findIndex(s =>
          s.title.toLowerCase().trim() === localSong.title.toLowerCase().trim() &&
          s.artist.toLowerCase().trim() === localSong.artist.toLowerCase().trim()
        );

        if (existingIdx !== -1) {
          this.songs[existingIdx] = localSong;
        } else {
          this.songs.unshift(localSong);
        }

        importedCount++;
      } catch (err) {
        console.error('Error importando canción:', baseDir, err);
      }
    }

    if (importedCount > 0) {
      const term = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
      this.applySortAndFilter(term);
      this.selectedSongIndex = 0;
      this.renderLipsGrid();
      this.updateDetailPanel();
      this.scheduleSongPreview();

      if (skippedFolders.length > 0) {
        const skippedNames = skippedFolders.map(s => `"${s.name}" (falta ${s.missing})`).join(', ');
        this.showToast(`¡${importedCount} importada${importedCount > 1 ? 's' : ''}! Omitidas: ${skippedNames}`, 8000);
      } else {
        this.showToast(`¡${importedCount} canción${importedCount > 1 ? 'es' : ''} importada${importedCount > 1 ? 's' : ''} con éxito!`);
      }
    } else if (skippedFolders.length > 0) {
      const skippedNames = skippedFolders.map(s => `"${s.name}" (falta ${s.missing})`).join(', ');
      this.showToast(`No se importaron canciones. Omitidas por faltar archivos: ${skippedNames}`, 8000);
    }
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }
}
