/**
 * Application Main Controller (Eterno Karaoke).
 * Real Mobile Mics via WebRTC, Strict Independent Player Scoring, and Lips Grid.
 */

import { LibraryUI } from './ui/libraryUI.js';
import { PitchDetector } from './audio/pitchDetector.js';
import { SoundPlayer } from './audio/soundPlayer.js';
import { GameEngine } from './engine/gameEngine.js';
import { GameRenderer } from './render/gameRenderer.js';
import { RoomSync } from './audio/roomSync.js';

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
    this.playersModal = document.getElementById('players-modal');
    this.readyModal = document.getElementById('ready-check-modal');

    // Home buttons (3 Clean Options)
    this.btnNavSing = document.getElementById('nav-btn-sing');
    this.btnNavConnect = document.getElementById('nav-btn-connect');
    this.btnNavPlayers = document.getElementById('nav-btn-players');

    // Connect modal controls
    this.btnCloseConnect = document.getElementById('btn-close-connect');
    this.btnDoneConnect = document.getElementById('btn-done-connect');

    // Players modal controls
    this.btnClosePlayers = document.getElementById('btn-close-players');
    this.btnDonePlayers = document.getElementById('btn-done-players');
    this.playersLobbyList = document.getElementById('players-lobby-list');

    // Ready Check modal controls
    this.btnCloseReady = document.getElementById('btn-close-ready');
    this.btnCancelReady = document.getElementById('btn-cancel-ready');
    this.btnForceStart = document.getElementById('btn-force-start');
    this.readySongCover = document.getElementById('ready-song-cover');
    this.readySongTitle = document.getElementById('ready-song-title');
    this.readySongArtist = document.getElementById('ready-song-artist');
    this.readyPlayersList = document.getElementById('ready-players-list');

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

    // Core engines
    this.detector = new PitchDetector();
    this.player = new SoundPlayer();
    this.player.setVideoElement(this.bgVideo);
    this.renderer = new GameRenderer(this.gameCanvas);
    this.engine = null;

    // WebRTC Room Sync
    this.roomSync = new RoomSync(
      'karaoke-party-paucg06',
      (mic) => this.onMobileJoined(mic),
      (id) => this.onMobileLeft(id),
      (id, pitch, vol, isSinging) => this.onMobilePitch(id, pitch, vol, isSinging),
      (id) => this.onMobileReady(id)
    );

    this.localPlayerEnabled = false;
    this.currentSong = null;
    this.currentAudioUrl = null;
    this.currentVideoUrl = null;
    this.activeProfiles = [];

    // Pending game for ready check
    this.pendingGame = null;
    this.readyPlayers = new Set();
    this.readyCountdownTimer = null;

    this.animationFrameId = null;

    this.init();
  }

  init() {
    // 1. Song Library UI with dynamic connected players
    this.libraryUI = new LibraryUI(
      this.viewLibrary,
      () => this.getActivePlayersList(),
      (song, audioUrl, videoUrl, profiles, options) => this.promptReadyCheck(song, audioUrl, videoUrl, profiles, options),
      () => this.connectModal.classList.remove('hidden')
    );

    // 2. Home Navigation
    this.btnNavSing.addEventListener('click', () => {
      this.viewHome.classList.add('hidden');
      this.viewLibrary.classList.remove('hidden');
      this.libraryUI.updateConnectedPlayersDisplay();
    });

    this.btnNavConnect.addEventListener('click', () => {
      this.connectModal.classList.remove('hidden');
    });

    this.btnNavPlayers.addEventListener('click', () => {
      this.playersModal.classList.remove('hidden');
      this.renderPlayersLobby();
    });

    // Connect Modal controls
    [this.btnCloseConnect, this.btnDoneConnect].forEach(btn => {
      btn.addEventListener('click', () => {
        this.connectModal.classList.add('hidden');
      });
    });

    // Players & Calibration Modal controls
    [this.btnClosePlayers, this.btnDonePlayers].forEach(btn => {
      btn.addEventListener('click', () => {
        this.playersModal.classList.add('hidden');
      });
    });

    // Ready Check Modal controls
    if (this.btnCloseReady) {
      this.btnCloseReady.addEventListener('click', () => this.cancelReadyCheck());
    }
    if (this.btnCancelReady) {
      this.btnCancelReady.addEventListener('click', () => this.cancelReadyCheck());
    }
    if (this.btnForceStart) {
      this.btnForceStart.addEventListener('click', () => this.confirmAndStartGame());
    }

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

  getActivePlayersList() {
    const list = [];
    const mobiles = this.roomSync.getConnectedPlayers();

    mobiles.slice(0, 4).forEach((m, idx) => {
      list.push({
        id: m.id,
        name: m.name,
        difficulty: 'normal',
        avatar: m.avatar,
        color: m.color,
        channel: idx,
        isMobile: true,
        mobileRef: m
      });
    });

    if (this.localPlayerEnabled && list.length < 4) {
      list.push({
        id: 'local_pc',
        name: 'Jugador PC',
        difficulty: 'normal',
        avatar: 'avatar-1',
        color: '#2563EB',
        channel: 0,
        isMobile: false
      });
    }

    return list;
  }

  onMobileJoined(mic) {
    console.log('[App] Jugador móvil conectado:', mic);
    this.renderPlayersLobby();
    if (this.libraryUI) this.libraryUI.updateConnectedPlayersDisplay();
  }

  onMobileLeft(id) {
    this.renderPlayersLobby();
    if (this.libraryUI) this.libraryUI.updateConnectedPlayersDisplay();
  }

  onMobilePitch(id, pitch, vol, isSinging) {
    if (!this.playersModal.classList.contains('hidden')) {
      const vu = document.getElementById(`lobby-vu-${id}`);
      const txt = document.getElementById(`lobby-txt-${id}`);
      if (vu) vu.style.width = Math.round(vol * 100) + '%';
      if (txt) {
        txt.textContent = isSinging && pitch !== null 
          ? `Nota: ${Math.round(pitch)} semitonos` 
          : 'Silencio...';
      }
    }
  }

  renderPlayersLobby() {
    const players = this.getActivePlayersList();
    
    if (players.length === 0) {
      this.playersLobbyList.innerHTML = `
        <div style="text-align: center; color: #94A3B8; font-size: 13px; padding: 24px;">
          Ningún móvil conectado todavía.<br>
          Pulsa en <strong>"Conectar"</strong> en el menú para escanear el código QR con el móvil.
        </div>
      `;
      return;
    }

    let html = '';
    players.forEach((p, idx) => {
      html += `
        <div style="background-color: #070B14; border: 2px solid ${p.color}; border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 14px;">
          <img src="src/assets/images/svg/${p.avatar}.svg" alt="" style="width: 40px; height: 40px; border-radius: 6px;" />
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 800; font-size: 14px; color: #F8FAFC;">P${idx + 1}: ${this.escapeHtml(p.name)} ${p.isMobile ? '(Móvil)' : '(PC)'}</span>
              <span id="lobby-txt-${p.id}" style="font-size: 12px; font-weight: 700; color: #38BDF8;">Esperando voz...</span>
            </div>
            <div style="width: 100%; height: 10px; background-color: #1E293B; border-radius: 5px; overflow: hidden;">
              <div id="lobby-vu-${p.id}" style="width: 0%; height: 100%; background-color: ${p.color}; transition: width 0.05s ease;"></div>
            </div>
          </div>
        </div>
      `;
    });

    this.playersLobbyList.innerHTML = html;
  }

  promptReadyCheck(song, audioUrl, videoUrl, profiles = [], options = {}) {
    const effectiveProfiles = profiles.length > 0 ? profiles : this.getActivePlayersList();

    if (effectiveProfiles.length === 0) {
      this.connectModal.classList.remove('hidden');
      alert('Debes conectar al menos un micrófono (móvil) escaneando el código QR antes de empezar a cantar.');
      return;
    }

    this.pendingGame = { song, audioUrl, videoUrl, profiles: effectiveProfiles, options };
    this.readyPlayers.clear();

    if (this.readyCountdownTimer) {
      clearTimeout(this.readyCountdownTimer);
      this.readyCountdownTimer = null;
    }

    // Set song info in ready check modal
    if (this.readySongTitle) this.readySongTitle.textContent = song.title;
    if (this.readySongArtist) this.readySongArtist.textContent = song.artist;
    if (this.readySongCover) {
      if (song.cover || song.coverUrl) {
        this.readySongCover.src = encodeURI(song.cover || song.coverUrl);
      } else {
        this.readySongCover.src = 'src/assets/images/svg/music.svg';
      }
    }

    // Broadcast ready_check_start to all connected mobile microphones
    this.roomSync.broadcastToMics({
      type: 'ready_check_start',
      songTitle: song.title
    });

    this.renderReadyModal();
    this.readyModal.classList.remove('hidden');
  }

  renderReadyModal() {
    if (!this.pendingGame || !this.readyPlayersList) return;

    const profiles = this.pendingGame.profiles;
    this.readyPlayersList.innerHTML = profiles.map((p, idx) => {
      const isReady = this.readyPlayers.has(p.id);
      return `
        <div style="background-color: #070B14; border: 2px solid ${isReady ? '#10B981' : p.color}; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s ease;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="src/assets/images/svg/${p.avatar}.svg" alt="" style="width: 38px; height: 38px; border-radius: 6px;" />
            <div style="text-align: left;">
              <span style="display: block; font-weight: 800; font-size: 14px; color: #F8FAFC;">P${idx + 1}: ${this.escapeHtml(p.name)}</span>
              <span style="font-size: 11px; color: #94A3B8;">Micrófono Móvil</span>
            </div>
          </div>
          <span style="font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 6px; background-color: ${isReady ? '#10B981' : '#1E293B'}; color: ${isReady ? '#FFFFFF' : '#94A3B8'};">
            ${isReady ? '✓ ¡LISTO!' : 'Esperando...'}
          </span>
        </div>
      `;
    }).join('');
  }

  onMobileReady(id) {
    if (!this.pendingGame) return;
    this.readyPlayers.add(id);
    this.renderReadyModal();

    // Check if all players in pendingGame are ready
    const allReady = this.pendingGame.profiles.every(p => this.readyPlayers.has(p.id));
    if (allReady) {
      if (this.btnForceStart) {
        this.btnForceStart.textContent = '¡Todos Listos! Iniciando...';
        this.btnForceStart.style.backgroundColor = '#10B981';
      }
      this.readyCountdownTimer = setTimeout(() => {
        this.confirmAndStartGame();
      }, 700);
    }
  }

  confirmAndStartGame() {
    if (this.readyCountdownTimer) {
      clearTimeout(this.readyCountdownTimer);
      this.readyCountdownTimer = null;
    }

    if (!this.pendingGame) return;

    const game = this.pendingGame;
    this.pendingGame = null;
    this.readyModal.classList.add('hidden');

    if (this.btnForceStart) {
      this.btnForceStart.textContent = 'Empezar Canción';
      this.btnForceStart.style.backgroundColor = '';
    }

    // Broadcast game_started to mobile phones to hide ready overlay
    this.roomSync.broadcastToMics({ type: 'game_started' });

    this.startGame(game.song, game.audioUrl, game.videoUrl, game.profiles);
  }

  cancelReadyCheck() {
    if (this.readyCountdownTimer) {
      clearTimeout(this.readyCountdownTimer);
      this.readyCountdownTimer = null;
    }

    this.pendingGame = null;
    this.readyModal.classList.add('hidden');

    if (this.btnForceStart) {
      this.btnForceStart.textContent = 'Empezar Canción';
      this.btnForceStart.style.backgroundColor = '';
    }

    // Broadcast ready_check_cancel to phones
    this.roomSync.broadcastToMics({ type: 'ready_check_cancel' });
  }

  async startGame(song, audioUrl, videoUrl, profiles = []) {
    this.currentSong = song;
    this.currentAudioUrl = audioUrl;
    this.currentVideoUrl = videoUrl;

    // Use the actual connected players
    const effectiveProfiles = profiles.length > 0 ? profiles : this.getActivePlayersList();

    if (effectiveProfiles.length === 0) {
      alert('Debes conectar al menos un micrófono (móvil o PC) para cantar.');
      return;
    }

    this.activeProfiles = effectiveProfiles;

    // Start PC mic if any player uses it
    const hasLocalPlayer = effectiveProfiles.some(p => !p.isMobile);
    if (hasLocalPlayer) {
      try {
        await this.detector.start();
      } catch (err) {
        alert(`No se pudo acceder al micrófono del PC: ${err.message}`);
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
    if (this.libraryUI) this.libraryUI.updateConnectedPlayersDisplay();
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
