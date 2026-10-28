/**
 * Application Main Controller (HitSing).
 * Real Mobile Mics via WebRTC, Strict Independent Player Scoring, and Lips Grid.
 */

import { LibraryUI } from './ui/libraryUI.js';
import { PitchDetector } from './audio/pitchDetector.js';
import { SoundPlayer } from './audio/soundPlayer.js';
import { GameEngine } from './engine/gameEngine.js';
import { GameRenderer } from './render/gameRenderer.js';
import { RoomSync } from './audio/roomSync.js';
import { LeaderboardManager } from './engine/leaderboardManager.js';

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
    this.leaderboardModal = document.getElementById('leaderboard-modal');

    // Home buttons (Vocaluxe Bar)
    this.btnNavSing = document.getElementById('nav-btn-sing');
    this.btnNavConnect = document.getElementById('nav-btn-connect');
    this.btnNavPlayers = document.getElementById('nav-btn-players');
    this.btnNavLeaderboard = document.getElementById('nav-btn-leaderboard');

    // Leaderboard controls
    this.btnCloseLeaderboard = document.getElementById('btn-close-leaderboard');
    this.btnDoneLeaderboard = document.getElementById('btn-done-leaderboard');
    this.btnResetLeaderboard = document.getElementById('btn-reset-leaderboard');
    this.leaderboardList = document.getElementById('leaderboard-list');

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
    this.btnFinish = document.getElementById('btn-finish');
    this.btnSkipIntro = document.getElementById('btn-skip-intro');

    // Results modal
    this.resWinnerTitle = document.getElementById('res-winner-title');
    this.resultsContainer = document.getElementById('results-players-container');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnExitResults = document.getElementById('btn-exit-results');
    this.btnResultsLeaderboard = document.getElementById('btn-results-leaderboard');

    // Core engines
    this.detector = new PitchDetector();
    this.player = new SoundPlayer();
    this.player.setVideoElement(this.bgVideo);
    this.renderer = new GameRenderer(this.gameCanvas);
    this.engine = null;

    // Dynamic Unique Room (Supports infinite simultaneous independent rooms without collisions)
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room') || sessionStorage.getItem('karaoke_room_id');
    if (!roomId) {
      roomId = 'karaoke-' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('karaoke_room_id', roomId);
    }
    this.roomId = roomId;

    // WebRTC Room Sync
    this.roomSync = new RoomSync(
      this.roomId,
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
      this.libraryUI.scheduleSongPreview();
    });

    this.btnNavConnect.addEventListener('click', () => {
      this.connectModal.classList.remove('hidden');
    });

    this.btnNavPlayers.addEventListener('click', () => {
      this.playersModal.classList.remove('hidden');
      this.renderPlayersLobby();
    });

    if (this.btnNavLeaderboard) {
      this.btnNavLeaderboard.addEventListener('click', () => {
        this.leaderboardModal.classList.remove('hidden');
        this.renderLeaderboard();
      });
    }

    // Connect Modal controls
    [this.btnCloseConnect, this.btnDoneConnect].forEach(btn => {
      btn.addEventListener('click', () => {
        this.connectModal.classList.add('hidden');
      });
    });

    this.setupRoomQR();

    // Players & Calibration Modal controls
    [this.btnClosePlayers, this.btnDonePlayers].forEach(btn => {
      btn.addEventListener('click', () => {
        this.playersModal.classList.add('hidden');
      });
    });

    // Leaderboard Modal controls
    [this.btnCloseLeaderboard, this.btnDoneLeaderboard].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.leaderboardModal.classList.add('hidden');
        });
      }
    });

    if (this.btnResetLeaderboard) {
      this.btnResetLeaderboard.addEventListener('click', () => {
        if (confirm('¿Seguro que deseas reiniciar el podio y las puntuaciones históricas locales?')) {
          LeaderboardManager.resetLeaderboard();
          this.renderLeaderboard();
        }
      });
    }

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

    // Calibration settings
    this.pitchTolerance = 1.5; // Default tolerance (1.5 semitones for smooth accessible party singing)
    this.noiseGateThreshold = 0.015;

    const tolButtons = document.querySelectorAll('#calib-tolerance-group .calib-btn');
    tolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.pitchTolerance = parseFloat(btn.dataset.tol) || 1.5;
      });
    });

    const noiseSlider = document.getElementById('calib-noise-slider');
    const noiseLabel = document.getElementById('calib-noise-label');
    if (noiseSlider && noiseLabel) {
      noiseSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val === 1) {
          noiseLabel.textContent = 'Mínimo (Muy Sensible)';
          this.noiseGateThreshold = 0.008;
        } else if (val === 2) {
          noiseLabel.textContent = 'Bajo';
          this.noiseGateThreshold = 0.012;
        } else if (val === 3) {
          noiseLabel.textContent = 'Normal';
          this.noiseGateThreshold = 0.015;
        } else if (val === 4) {
          noiseLabel.textContent = 'Medio';
          this.noiseGateThreshold = 0.022;
        } else {
          noiseLabel.textContent = 'Alto (Entornos Ruidosos)';
          this.noiseGateThreshold = 0.035;
        }
      });
    }

    // Game HUD controls
    this.btnBack.addEventListener('click', () => this.exitToLibrary());
    this.btnPause.addEventListener('click', () => this.togglePause());
    if (this.btnFinish) {
      this.btnFinish.addEventListener('click', () => {
        if (this.engine) this.engine.finish();
      });
    }

    if (this.btnSkipIntro) {
      this.btnSkipIntro.addEventListener('click', () => {
        this.skipSongIntro();
      });
    }

    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Space' || e.key.toLowerCase() === 's') && this.viewGame && !this.viewGame.classList.contains('hidden')) {
        if (this.btnSkipIntro && !this.btnSkipIntro.classList.contains('hidden')) {
          e.preventDefault();
          this.skipSongIntro();
        }
      }
    });

    this.btnRetry.addEventListener('click', () => {
      this.viewResults.classList.add('hidden');
      this.startGame(this.currentSong, this.currentAudioUrl, this.currentVideoUrl, this.activeProfiles);
    });

    this.btnExitResults.addEventListener('click', () => {
      this.viewResults.classList.add('hidden');
      this.exitToLibrary();
    });

    if (this.btnResultsLeaderboard) {
      this.btnResultsLeaderboard.addEventListener('click', () => {
        this.leaderboardModal.classList.remove('hidden');
        this.renderLeaderboard();
      });
    }

    this.player.onEnded(() => {
      if (this.engine) this.engine.finish();
    });

    // Notify connected phones if the host closes or reloads the browser
    window.addEventListener('beforeunload', () => {
      if (this.roomSync) {
        this.roomSync.broadcastToMics({ type: 'host_disconnected' });
      }
    });
  }

  setupRoomQR() {
    const linkEl = document.getElementById('connect-direct-link');
    const qrCanvas = document.getElementById('connect-qr-canvas');

    const baseUrl = window.location.href.split('?')[0].replace(/index\.html$/, '');
    const mobileUrl = `${baseUrl}mic.html?room=${this.roomId}`;

    if (linkEl) {
      linkEl.href = mobileUrl;
    }

    if (qrCanvas && window.QRCode) {
      window.QRCode.toCanvas(qrCanvas, mobileUrl, {
        width: 190,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, (err) => {
        if (err) console.warn('[QR] Error generating canvas:', err);
      });
    }
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
    console.log('[App] Jugador conectado:', mic);
    this.renderPlayersLobby();
    if (this.libraryUI) this.libraryUI.updateConnectedPlayersDisplay();
    this.broadcastRoomState();
  }

  onMobileLeft(id) {
    this.renderPlayersLobby();
    if (this.libraryUI) this.libraryUI.updateConnectedPlayersDisplay();
    this.broadcastRoomState();
  }

  broadcastRoomState() {
    this.roomSync.broadcastToMics(this.roomSync.getRoomState());
  }

  onMobilePitch(id, pitch, vol, isSinging) {
    if (!this.playersModal.classList.contains('hidden')) {
      // 1. Update individual player card
      const vu = document.getElementById(`lobby-vu-${id}`);
      const txt = document.getElementById(`lobby-txt-${id}`);
      if (vu) vu.style.width = Math.round(vol * 100) + '%';
      if (txt) {
        if (isSinging && pitch !== null) {
          const noteInfo = this.pitchToNoteInfo(pitch);
          txt.textContent = `${noteInfo.name} (${Math.round(noteInfo.freq)} Hz)`;
        } else {
          txt.textContent = 'Silencio...';
        }
      }

      // 2. Update central Chromatic Tuner ONLY for the selected player being calibrated
      if (this.selectedCalibPlayerId === id || !this.selectedCalibPlayerId) {
        const calibNote = document.getElementById('calib-detected-note');
        const tunerNeedle = document.getElementById('calib-tuner-needle');

        if (isSinging && pitch !== null) {
          const noteInfo = this.pitchToNoteInfo(pitch);
          if (calibNote) calibNote.textContent = `${noteInfo.name} (${Math.round(noteInfo.freq)} Hz) • AFINADO`;
          if (tunerNeedle) {
            const pct = Math.max(0, Math.min(100, (noteInfo.semitoneInOctave / 11) * 100));
            tunerNeedle.style.left = `${pct}%`;
          }
        } else {
          if (calibNote) calibNote.textContent = 'En espera...';
        }
      }
    }
  }

  pitchToNoteInfo(pitch) {
    const NOTE_NAMES = ['Do (C)', 'Do#', 'Re (D)', 'Re#', 'Mi (E)', 'Fa (F)', 'Fa#', 'Sol (G)', 'Sol#', 'La (A)', 'La#', 'Si (B)'];
    const midi = Math.round(pitch + 60);
    const semitoneInOctave = ((midi % 12) + 12) % 12;
    const noteName = NOTE_NAMES[semitoneInOctave];
    const octave = Math.floor(midi / 12) - 1;
    const freq = 440 * Math.pow(2, (pitch - 9) / 12);
    return { name: `${noteName}${octave}`, semitoneInOctave, freq };
  }

  renderPlayersLobby() {
    const players = this.getActivePlayersList();
    
    if (players.length === 0) {
      this.selectedCalibPlayerId = null;
      this.playersLobbyList.innerHTML = `
        <div style="text-align: center; color: #94A3B8; font-size: 13px; padding: 20px;">
          Ningún móvil conectado todavía.<br>
          Pulsa en <strong>"Conectar"</strong> en el menú para escanear el código QR con el móvil.
        </div>
      `;
      return;
    }

    if (!this.selectedCalibPlayerId || !players.find(p => p.id === this.selectedCalibPlayerId)) {
      this.selectedCalibPlayerId = players[0].id;
    }

    const currentCalibPlayer = players.find(p => p.id === this.selectedCalibPlayerId) || players[0];
    const calibTargetEl = document.getElementById('calib-detected-note');
    if (calibTargetEl) {
      calibTargetEl.textContent = `Afinando: ${currentCalibPlayer.name}`;
    }

    let html = '';
    players.forEach((p) => {
      const isSelected = p.id === this.selectedCalibPlayerId;
      html += `
        <div style="background-color: #070B14; border: 2px solid ${isSelected ? '#38BDF8' : p.color}; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; transition: all 0.15s ease;">
          <img src="src/assets/images/svg/${p.avatar}.svg" alt="" style="width: 42px; height: 42px; border-radius: 6px;" />
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 800; font-size: 15px; color: #F8FAFC;">${this.escapeHtml(p.name)}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span id="lobby-txt-${p.id}" style="font-size: 12px; font-weight: 700; color: #38BDF8;">Esperando voz...</span>
                <button class="btn-calib-select" data-id="${p.id}" style="padding: 4px 10px; font-size: 11px; font-weight: 800; border-radius: 4px; border: 1px solid ${isSelected ? '#38BDF8' : '#334155'}; background-color: ${isSelected ? '#1E3A8A' : 'transparent'}; color: ${isSelected ? '#38BDF8' : '#94A3B8'}; cursor: pointer;">
                  ${isSelected ? '✓ Calibrando' : 'Probar'}
                </button>
                <button class="btn-kick-player" data-id="${p.id}" style="padding: 4px 10px; font-size: 11px; font-weight: 800; border-radius: 4px; border: 1px solid #EF4444; background-color: rgba(239, 68, 68, 0.15); color: #EF4444; cursor: pointer;" title="Expulsar de la partida">
                  Expulsar
                </button>
              </div>
            </div>
            <div style="width: 100%; height: 10px; background-color: #1E293B; border-radius: 5px; overflow: hidden;">
              <div id="lobby-vu-${p.id}" style="width: 0%; height: 100%; background-color: ${p.color}; transition: width 0.05s ease;"></div>
            </div>
          </div>
        </div>
      `;
    });

    this.playersLobbyList.innerHTML = html;

    // Bind individual player selection for calibration
    this.playersLobbyList.querySelectorAll('.btn-calib-select').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCalibPlayerId = btn.dataset.id;
        this.renderPlayersLobby();
      });
    });

    // Bind kick player action
    this.playersLobbyList.querySelectorAll('.btn-kick-player').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.dataset.id;
        this.roomSync.kickPlayer(pid);
        this.renderPlayersLobby();
        if (this.libraryUI) this.libraryUI.updateConnectedPlayersDisplay();
      });
    });
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
    this.readyPlayersList.innerHTML = profiles.map((p) => {
      const isReady = this.readyPlayers.has(p.id);
      return `
        <div style="background-color: #070B14; border: 2px solid ${isReady ? '#10B981' : p.color}; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s ease;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="src/assets/images/svg/${p.avatar}.svg" alt="" style="width: 38px; height: 38px; border-radius: 6px;" />
            <div style="text-align: left;">
              <span style="display: block; font-weight: 800; font-size: 15px; color: #F8FAFC;">${this.escapeHtml(p.name)}</span>
              <span style="font-size: 11px; color: #94A3B8;">Jugador</span>
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

    this.startGame(game.song, game.audioUrl, game.videoUrl, game.profiles, game.options);
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

  async startGame(song, audioUrl, videoUrl, profiles = [], options = {}) {
    this.currentSong = song;
    this.currentAudioUrl = audioUrl;
    this.currentVideoUrl = videoUrl;
    this.currentOptions = options || {};

    // Use the actual connected players
    const effectiveProfiles = profiles.length > 0 ? profiles : this.getActivePlayersList();

    if (effectiveProfiles.length === 0) {
      alert('Debes conectar al menos un micrófono (móvil o PC) para cantar.');
      return;
    }

    this.activeProfiles = effectiveProfiles;
    this.activeProfiles.forEach(p => {
      p.tolerance = this.pitchTolerance || 1.5;
    });

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
        if (song.isShortVersion && song.startOffset > 0) {
          this.player.seek(song.startOffset);
        }
      } catch (e) {
        console.warn('Auto-play blocked:', e);
      }
    }

    this.engine.start();
    this.startLoop();
  }

  setupHUD(profiles) {
    if (!this.hudPlayersRow) return;
    this.hudPlayersRow.innerHTML = '';
  }

  skipSongIntro() {
    if (!this.engine || !this.engine.song || this.engine.song.notes.length === 0) return;
    const firstNote = this.engine.song.notes[0];
    const target = Math.max(0, firstNote.startTime - 2.5);
    if (this.player.getCurrentTime() < target) {
      this.player.seek(target);
      if (this.btnSkipIntro) {
        this.btnSkipIntro.classList.add('hidden');
      }
    }
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

        // Show "Saltar Intro" button if current song has an intro longer than 8 seconds
        const firstNote = this.engine.song.notes.length > 0 ? this.engine.song.notes[0] : null;
        if (this.btnSkipIntro && firstNote) {
          if (firstNote.startTime > 8 && currentTime < firstNote.startTime - 2.5) {
            this.btnSkipIntro.classList.remove('hidden');
          } else {
            this.btnSkipIntro.classList.add('hidden');
          }
        }
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

    // Persist scores in local historical leaderboard
    LeaderboardManager.recordSongResults(results);

    const mode = this.currentOptions?.mode || 'batalla';
    if (mode === 'equipo' && results.length > 1) {
      const totalTeamScore = results.reduce((acc, r) => acc + (r.score || 0), 0);
      this.resWinnerTitle.textContent = `¡EQUIPO: ${totalTeamScore.toLocaleString()} PUNTOS!`;
    } else if (results.length > 1) {
      const sorted = [...results].sort((a, b) => b.score - a.score);
      if (sorted[0].score > sorted[1].score) {
        this.resWinnerTitle.textContent = `¡GANADOR: ${sorted[0].profile.name.toUpperCase()}!`;
      } else {
        this.resWinnerTitle.textContent = '¡EMPATE!';
      }
    } else {
      this.resWinnerTitle.textContent = '¡CANCIÓN COMPLETADA!';
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

  renderLeaderboard() {
    if (!this.leaderboardList) return;
    const entries = LeaderboardManager.getLeaderboard();

    if (entries.length === 0) {
      this.leaderboardList.innerHTML = `
        <div style="text-align: center; color: #94A3B8; font-size: 13px; padding: 24px;">
          Todavía no hay puntuaciones registradas.<br>
          ¡Completa canciones para registrar jugadores en el podio!
        </div>
      `;
      return;
    }

    const rankColors = ['#EAB308', '#94A3B8', '#B45309']; // Oro, Plata, Bronce

    this.leaderboardList.innerHTML = entries.map((entry, idx) => {
      const badgeColor = idx < 3 ? rankColors[idx] : '#334155';
      const rankText = idx === 0 ? '1º' : idx === 1 ? '2º' : idx === 2 ? '3º' : `${idx + 1}º`;
      return `
        <div style="background-color: #070B14; border: 1px solid #1E293B; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 14px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${badgeColor}; color: #000; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;">
            ${rankText}
          </div>
          <img src="src/assets/images/svg/${entry.avatar}.svg" alt="" style="width: 40px; height: 40px; border-radius: 6px; border: 2px solid ${entry.color};" />
          <div style="flex: 1;">
            <div style="font-weight: 800; font-size: 15px; color: #F8FAFC;">${this.escapeHtml(entry.name)}</div>
            <div style="font-size: 12px; color: #94A3B8;">${entry.songsPlayed} ${entry.songsPlayed === 1 ? 'canción cantada' : 'canciones cantadas'} • Récord: <strong style="color: #38BDF8;">${entry.highScore.toLocaleString()} pts</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 800; color: #38BDF8;">${entry.totalScore.toLocaleString()}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748B;">TOTAL ACUMULADO</div>
          </div>
        </div>
      `;
    }).join('');
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
