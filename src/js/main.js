/**
 * Application Main Controller (Eterno Karaoke).
 * Vocaluxe Home Screen, Mobile Mic Connect (QR + P2P), Library, 4-Player Game and Results.
 */

import { LibraryUI } from './ui/libraryUI.js';
import { PitchDetector } from './audio/pitchDetector.js';
import { SoundPlayer } from './audio/soundPlayer.js';
import { GameEngine } from './engine/gameEngine.js';
import { GameRenderer } from './render/gameRenderer.js';
import { RoomSync } from './audio/roomSync.js';
import { ProfileManager } from './engine/profileManager.js';

class App {
  constructor() {
    // Views
    this.viewHome = document.getElementById('view-home');
    this.viewLibrary = document.getElementById('view-library');
    this.viewGame = document.getElementById('view-game');
    this.viewResults = document.getElementById('view-results');
    this.gameCanvas = document.getElementById('game-canvas');
    this.bgVideo = document.getElementById('bg-video');

    // Modals
    this.connectModal = document.getElementById('connect-modal');
    this.optionsModal = document.getElementById('options-modal');

    // Home navigation buttons
    this.btnNavSing = document.getElementById('nav-btn-sing');
    this.btnNavConnect = document.getElementById('nav-btn-connect');
    this.btnNavPlayers = document.getElementById('nav-btn-players');
    this.btnNavOptions = document.getElementById('nav-btn-options');

    // Connect modal elements
    this.btnCloseConnect = document.getElementById('btn-close-connect');
    this.btnDoneConnect = document.getElementById('btn-done-connect');
    this.btnAddLocalMic = document.getElementById('btn-add-local-mic');
    this.connectedCount = document.getElementById('connected-count');
    this.lobbyPlayersTags = document.getElementById('lobby-players-tags');

    // Options modal elements
    this.btnCloseOptions = document.getElementById('btn-close-options');
    this.btnCloseOptionsFoot = document.getElementById('btn-close-options-foot');
    this.optVuMeter = document.getElementById('opt-vu-meter');
    this.optPitchText = document.getElementById('opt-pitch-text');

    // In-game HUD
    this.hudPlayersRow = document.getElementById('hud-players-row');
    this.hudSongTitle = document.getElementById('hud-song-title');
    this.hudSongArtist = document.getElementById('hud-song-artist');
    this.btnBack = document.getElementById('btn-back');
    this.btnPause = document.getElementById('btn-pause');

    // Results modal
    this.resWinnerTitle = document.getElementById('res-winner-title');
    this.resultsContainer = document.getElementById('results-players-container');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnExitResults = document.getElementById('btn-exit-results');

    // Audio & Engine modules
    this.detector = new PitchDetector();
    this.player = new SoundPlayer();
    this.player.setVideoElement(this.bgVideo);
    this.renderer = new GameRenderer(this.gameCanvas);
    this.engine = null;

    // Room Sync for mobile devices
    this.roomSync = new RoomSync(
      (mic) => this.onMobileJoined(mic),
      (id) => this.onMobileLeft(id),
      (id, pitch, vol, isSinging) => this.onMobilePitch(id, pitch, vol, isSinging)
    );

    this.localPlayerEnabled = false;
    this.currentSong = null;
    this.currentAudioUrl = null;
    this.currentVideoUrl = null;
    this.activeProfiles = [];

    this.animationFrameId = null;

    this.init();
  }

  init() {
    // 1. Setup Library UI
    new LibraryUI(this.viewLibrary, (song, audioUrl, videoUrl, profiles) => {
      this.startGame(song, audioUrl, videoUrl, profiles);
    });

    // 2. Home Navigation
    this.btnNavSing.addEventListener('click', () => {
      this.viewHome.classList.add('hidden');
      this.viewLibrary.classList.remove('hidden');
    });

    this.btnNavConnect.addEventListener('click', () => {
      this.connectModal.classList.remove('hidden');
      this.updateLobbyDisplay();
    });

    this.btnNavPlayers.addEventListener('click', () => {
      this.connectModal.classList.remove('hidden');
      this.updateLobbyDisplay();
    });

    this.btnNavOptions.addEventListener('click', () => {
      this.openOptionsCalibration();
    });

    // Connect Modal controls
    [this.btnCloseConnect, this.btnDoneConnect].forEach(btn => {
      btn.addEventListener('click', () => {
        this.connectModal.classList.add('hidden');
      });
    });

    this.btnAddLocalMic.addEventListener('click', () => {
      this.localPlayerEnabled = true;
      this.updateLobbyDisplay();
    });

    // Options Modal controls
    [this.btnCloseOptions, this.btnCloseOptionsFoot].forEach(btn => {
      btn.addEventListener('click', () => {
        this.optionsModal.classList.add('hidden');
        this.detector.stop();
      });
    });

    // Game HUD controls
    this.btnBack.addEventListener('click', () => this.exitToLibrary());
    this.btnPause.addEventListener('click', () => this.togglePause());

    this.btnRetry.addEventListener('click', () => {
      this.viewResults.classList.add('hidden');
      this.startGame(this.currentSong, this.currentAudioUrl, this.currentVideoUrl, this.activeProfiles);
    });

    this.btnExitResults.addEventListener('click', () => {
      this.viewResults.classList.add('hidden');
      this.exitToLibrary();
    });

    this.player.onEnded(() => {
      if (this.engine) this.engine.finish();
    });
  }

  onMobileJoined(mic) {
    this.updateLobbyDisplay();
  }

  onMobileLeft(id) {
    this.updateLobbyDisplay();
  }

  onMobilePitch(id, pitch, vol, isSinging) {
    // Live stream handled via reference in GameEngine
  }

  updateLobbyDisplay() {
    const mobiles = this.roomSync.getConnectedPlayers();
    const count = mobiles.length + (this.localPlayerEnabled ? 1 : 0);
    this.connectedCount.textContent = count;

    let html = '';
    mobiles.forEach((m, idx) => {
      html += `
        <span style="background-color: ${m.color}; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px;">
          P${idx + 1}: ${this.escapeHtml(m.name)} (Móvil)
        </span>
      `;
    });

    if (this.localPlayerEnabled) {
      html += `
        <span style="background-color: #2563EB; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px;">
          Micrófono PC
        </span>
      `;
    }

    if (count === 0) {
      html = '<span style="font-size: 12px; color: #475569;">Ningún móvil conectado aún. Escanea el QR para entrar.</span>';
    }

    this.lobbyPlayersTags.innerHTML = html;
  }

  async openOptionsCalibration() {
    this.optionsModal.classList.remove('hidden');
    try {
      await this.detector.start();
      const testLoop = () => {
        if (!this.optionsModal.classList.contains('hidden') && this.detector.isRunning) {
          const res = this.detector.update(0);
          this.optVuMeter.style.width = Math.round(res.volume * 100) + '%';
          this.optPitchText.textContent = res.isSinging
            ? `Tono detectado: ${Math.round(res.frequency)} Hz`
            : 'Silencio...';
          requestAnimationFrame(testLoop);
        }
      };
      requestAnimationFrame(testLoop);
    } catch (err) {
      this.optPitchText.textContent = 'Error: ' + err.message;
    }
  }

  async startGame(song, audioUrl, videoUrl, profiles = []) {
    this.currentSong = song;
    this.currentAudioUrl = audioUrl;
    this.currentVideoUrl = videoUrl;

    // Check if any mobile players are connected
    const mobilePlayers = this.roomSync.getConnectedPlayers();
    let effectiveProfiles = [];

    if (mobilePlayers.length > 0) {
      // Use connected mobile players
      effectiveProfiles = mobilePlayers.slice(0, 4).map((m, idx) => ({
        id: m.id,
        name: m.name,
        difficulty: 'normal',
        avatar: m.avatar,
        color: m.color,
        channel: idx,
        isMobile: true,
        mobileRef: m
      }));
    } else {
      // Use selected local profiles
      effectiveProfiles = profiles.slice(0, 4);
    }

    this.activeProfiles = effectiveProfiles;

    // Start local mic if not all are mobile
    const hasLocalPlayer = effectiveProfiles.some(p => !p.isMobile);
    if (hasLocalPlayer) {
      try {
        await this.detector.start();
      } catch (err) {
        alert(`No se pudo acceder al micrófono: ${err.message}`);
        return;
      }
    }

    if (audioUrl) {
      await this.player.loadSource(audioUrl, videoUrl);
    }

    this.engine = new GameEngine(song, this.player, this.detector, effectiveProfiles);
    this.setupHUD(effectiveProfiles);

    this.engine.onScoreUpdate = (playersStats) => {
      for (const stat of playersStats) {
        const scoreEl = document.getElementById(`score-p${stat.index + 1}`);
        const comboEl = document.getElementById(`combo-p${stat.index + 1}`);
        const feedEl = document.getElementById(`feedback-p${stat.index + 1}`);

        if (scoreEl) scoreEl.textContent = stat.score.toString().padStart(5, '0');
        if (comboEl) comboEl.textContent = stat.combo > 1 ? `x${stat.combo}` : '';
        if (feedEl) {
          feedEl.textContent = stat.feedback;
          feedEl.className = 'player-hud-feedback ' + (stat.feedback === 'PERFECTO' ? 'hit' : '');
        }
      }
    };

    this.engine.onStateChange = (state) => {
      if (state === 'finished') {
        this.showResults();
      }
    };

    this.hudSongTitle.textContent = song.title;
    this.hudSongArtist.textContent = song.artist;

    this.viewHome.classList.add('hidden');
    this.viewLibrary.classList.add('hidden');
    this.viewResults.classList.add('hidden');
    this.viewGame.classList.remove('hidden');
    this.renderer.resize();

    if (audioUrl) {
      try {
        await this.player.play();
      } catch (e) {
        console.warn('Auto-play blocked:', e);
      }
    }

    this.engine.start();
    this.startLoop();
  }

  setupHUD(profiles) {
    this.hudPlayersRow.innerHTML = profiles.map((p, idx) => `
      <div class="player-hud-pill" style="border-color: ${p.color};">
        <div class="pill-avatar">
          <img src="src/assets/images/svg/${p.avatar}.svg" alt="" />
        </div>
        <div class="pill-data">
          <div class="pill-top">
            <span class="pill-name">${this.escapeHtml(p.name)}</span>
            <span id="combo-p${idx + 1}" class="pill-combo"></span>
          </div>
          <span id="score-p${idx + 1}" class="pill-score" style="color: ${p.color};">00000</span>
        </div>
        <div id="feedback-p${idx + 1}" class="player-hud-feedback"></div>
      </div>
    `).join('');
  }

  startLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const tick = () => {
      if (this.engine && this.engine.state === 'playing') {
        const currentTime = this.player.getCurrentTime();
        this.engine.update(currentTime);
        this.renderer.render(this.engine, currentTime);
      }
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  togglePause() {
    if (!this.engine) return;

    if (this.engine.state === 'playing') {
      this.engine.pause();
    } else if (this.engine.state === 'paused') {
      this.engine.resume();
    }
  }

  showResults() {
    if (!this.engine) return;
    const results = this.engine.getResults();

    if (results.length > 1) {
      const sorted = [...results].sort((a, b) => b.score - a.score);
      if (sorted[0].score > sorted[1].score) {
        this.resWinnerTitle.textContent = `¡GANADOR: ${sorted[0].profile.name.toUpperCase()}!`;
      } else {
        this.resWinnerTitle.textContent = '¡EMPATE!';
      }
    } else {
      this.resWinnerTitle.textContent = '¡CANCION COMPLETADA!';
    }

    const maxScore = Math.max(...results.map(r => r.score));

    this.resultsContainer.innerHTML = results.map(r => `
      <div class="result-player-card ${results.length > 1 && r.score === maxScore && r.score > 0 ? 'winner' : ''}">
        <div class="result-player-header" style="border-color: ${r.profile.color};">
          <img src="src/assets/images/svg/${r.profile.avatar}.svg" alt="" class="result-avatar" />
          <h3 class="result-player-name">${this.escapeHtml(r.profile.name)}</h3>
          <span class="result-rank-badge" style="background-color: ${r.profile.color};">${r.rank}</span>
        </div>
        <div class="result-stats-body">
          <div class="result-stat-row">
            <span class="stat-name">PUNTOS</span>
            <span class="stat-number">${r.score.toLocaleString()}</span>
          </div>
          <div class="result-stat-row">
            <span class="stat-name">PRECISIÓN</span>
            <span class="stat-number">${r.accuracy}%</span>
          </div>
          <div class="result-stat-row">
            <span class="stat-name">MAX COMBO</span>
            <span class="stat-number">${r.maxCombo}</span>
          </div>
        </div>
      </div>
    `).join('');

    this.viewResults.classList.remove('hidden');
  }

  exitToLibrary() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.player) this.player.stop();
    if (this.detector) this.detector.stop();

    this.engine = null;
    this.viewGame.classList.add('hidden');
    this.viewResults.classList.add('hidden');
    this.viewLibrary.classList.remove('hidden');
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
