/**
 * Song Library UI & File Loader for Vocaluxe Web.
 * Supports:
 * 1. Fetching GitHub repository hosted songs from songs/songs.json.
 * 2. Drag & Drop or Local folder selection of UltraStar files (.txt, .mp3, .mp4, images).
 */

import { UltraStarParser } from '../parser/ultrastarParser.js';

export class LibraryUI {
  constructor(containerElement, onSelectSong) {
    this.container = containerElement;
    this.onSelectSong = onSelectSong;
    this.songs = [];
    this.filteredSongs = [];
    
    this.init();
  }

  async init() {
    this.renderLayout();
    this.bindEvents();
    await this.loadCatalogFromGitHub();
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="library-container">
        <header class="library-header">
          <div class="header-branding">
            <img src="src/assets/images/svg/mic.svg" alt="Micrófono" class="app-icon" />
            <h1 class="app-title">VOCALUXE WEB</h1>
          </div>
          <div class="header-actions">
            <label class="btn-action" for="folder-upload" title="Cargar carpeta de canciones">
              <img src="src/assets/images/svg/folder-plus.svg" alt="Cargar" />
              <span>Cargar Canciones</span>
            </label>
            <input type="file" id="folder-upload" webkitdirectory directory multiple style="display: none;" />
          </div>
        </header>

        <div class="search-bar">
          <img src="src/assets/images/svg/search.svg" alt="Buscar" class="search-icon" />
          <input type="text" id="search-input" placeholder="Buscar por canción o artista..." />
        </div>

        <!-- Drop zone for drag and drop -->
        <div id="drop-zone" class="drop-zone">
          <img src="src/assets/images/svg/folder-plus.svg" alt="Subir" class="drop-icon" />
          <p class="drop-text">Arrastra aquí archivos o carpetas UltraStar (.txt + .mp3)</p>
        </div>

        <!-- Song grid -->
        <div id="songs-grid" class="songs-grid">
          <div class="loading-state">Cargando biblioteca de canciones...</div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      this.filteredSongs = this.songs.filter(s =>
        s.title.toLowerCase().includes(term) || s.artist.toLowerCase().includes(term)
      );
      this.renderSongsList();
    });

    const folderInput = document.getElementById('folder-upload');
    folderInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.processLocalFiles(Array.from(e.target.files));
      }
    });

    const dropZone = document.getElementById('drop-zone');
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) {
        this.processLocalFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  /**
   * Load songs list from GitHub Pages songs/songs.json.
   */
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
      console.warn('No se encontró songs/songs.json o catálogo remoto aún:', e);
    }

    this.filteredSongs = [...this.songs];
    this.renderSongsList();
  }

  /**
   * Process uploaded local files (.txt, audio, video, covers).
   */
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

        // Find associated media files by folder or filename reference
        const baseDir = txtFile.webkitRelativePath
          ? txtFile.webkitRelativePath.split('/').slice(0, -1).join('/')
          : '';

        const sameDirFiles = files.filter(f => {
          if (f.webkitRelativePath && baseDir) {
            return f.webkitRelativePath.startsWith(baseDir);
          }
          return true;
        });

        // Match audio
        let audioFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          return (parsed.mp3 && name.includes(parsed.mp3.toLowerCase())) ||
                 name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.m4a');
        });

        // Match video
        let videoFile = sameDirFiles.find(f => {
          const name = f.name.toLowerCase();
          return (parsed.video && name.includes(parsed.video.toLowerCase())) ||
                 name.endsWith('.mp4') || name.endsWith('.webm');
        });

        // Match cover
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
        console.error('Error procesando archivo:', txtFile.name, err);
      }
    }

    this.filteredSongs = [...this.songs];
    this.renderSongsList();
  }

  renderSongsList() {
    const grid = document.getElementById('songs-grid');
    if (!grid) return;

    if (this.filteredSongs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>No hay canciones en la biblioteca.</p>
          <span class="sub-empty">Sube una carpeta UltraStar o agrega canciones en songs/songs.json</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.filteredSongs.map(song => `
      <div class="song-card" data-id="${song.id}">
        <div class="song-cover">
          ${song.cover || song.coverUrl 
            ? `<img src="${song.cover || song.coverUrl}" alt="Portada" />`
            : `<img src="src/assets/images/svg/music.svg" alt="Música" class="default-cover" />`
          }
        </div>
        <div class="song-info">
          <h3 class="song-title">${this.escapeHtml(song.title)}</h3>
          <p class="song-artist">${this.escapeHtml(song.artist)}</p>
        </div>
        <button class="btn-play-song" title="Cantar">
          <img src="src/assets/images/svg/play.svg" alt="Cantar" />
          <span>Cantar</span>
        </button>
      </div>
    `).join('');

    // Bind click events on song cards
    grid.querySelectorAll('.song-card').forEach(card => {
      card.addEventListener('click', () => {
        const songId = card.getAttribute('data-id');
        this.selectSongById(songId);
      });
    });
  }

  async selectSongById(id) {
    const song = this.songs.find(s => s.id === id);
    if (!song) return;

    if (song.isRemote) {
      // Fetch remote .txt from repository
      try {
        const res = await fetch(song.txtPath);
        const text = await res.text();
        const parsed = UltraStarParser.parse(text);
        this.onSelectSong(parsed, song.audioPath, song.videoPath);
      } catch (err) {
        alert('Error al descargar la canción: ' + err.message);
      }
    } else {
      this.onSelectSong(song.parsedData, song.audioUrl, song.videoUrl);
    }
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }
}
