/**
 * Vocaluxe-Style Application Controller.
 * Handles Multi-Player Game Lifecycle, Audio Sync, Canvas Rendering, and Results.
 */

import { LibraryUI } from './ui/libraryUI.js';
import { PitchDetector } from './audio/pitchDetector.js';
import { SoundPlayer } from './audio/soundPlayer.js';
import { GameEngine } from './engine/gameEngine.js';
import { GameRenderer } from './render/gameRenderer.js';

class App {
  constructor() {
    this.viewLibrary = document.getElementById('view-library');
    this.viewGame = document.getElementById('view-game');
    this.viewResults = document.getElementById('view-results');
    this.gameCanvas = document.getElementById('game-canvas');
    this.bgVideo = document.getElementById('bg-video');

    // Multi-Player HUD Elements
    this.p1Box = document.getElementById('hud-p1-box');
    this.p1Avatar = document.getElementById('hud-p1-avatar');
    this.p1Name = document.getElementById('hud-p1-name');
    this.p1Score = document.getElementById('hud-p1-score');
    this.p1Combo = document.getElementById('hud-p1-combo');
    this.p1Feedback = document.getElementById('hud-p1-feedback');

    this.p2Box = document.getElementById('hud-p2-box');
    this.p2Avatar = document.getElementById('hud-p2-avatar');
    this.p2Name = document.getElementById('hud-p2-name');
    this.p2Score = document.getElementById('hud-p2-score');
    this.p2Combo = document.getElementById('hud-p2-combo');
    this.p2Feedback = document.getElementById('hud-p2-feedback');

    this.hudSongTitle = document.getElementById('hud-song-title');
    this.hudSongArtist = document.getElementById('hud-song-artist');
    this.btnBack = document.getElementById('btn-back');
    this.btnPause = document.getElementById('btn-pause');

    // Results elements
    this.resWinnerTitle = document.getElementById('res-winner-title');
    this.resultsContainer = document.getElementById('results-players-container');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnExitResults = document.getElementById('btn-exit-results');

    // Modules
    this.detector = new PitchDetector();
    this.player = new SoundPlayer();
    this.player.setVideoElement(this.bgVideo);
    this.renderer = new GameRenderer(this.gameCanvas);
    this.engine = null;

    this.currentSong = null;
    this.currentAudioUrl = null;
    this.currentVideoUrl = null;
    this.activeProfiles = [];

    this.animationFrameId = null;

    this.init();
  }

  init() {
    new LibraryUI(this.viewLibrary, (song, audioUrl, videoUrl, profiles) => {
      this.startGame(song, audioUrl, videoUrl, profiles);
    });

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

  async startGame(song, audioUrl, videoUrl, profiles = []) {
    this.currentSong = song;
    this.currentAudioUrl = audioUrl;
    this.currentVideoUrl = videoUrl;
    this.activeProfiles = profiles;

    try {
      await this.detector.start();
    } catch (err) {
      alert(`No se pudo acceder al micrófono: ${err.message}`);
      return;
    }

    if (audioUrl) {
      await this.player.loadSource(audioUrl, videoUrl);
    }

    this.engine = new GameEngine(song, this.player, this.detector, profiles);

    // Setup HUD for 1 or 2 players
    this.setupHUD(profiles);

    this.engine.onScoreUpdate = (playersStats) => {
      // P1
      if (playersStats[0]) {
        const s1 = playersStats[0];
        this.p1Score.textContent = s1.score.toString().padStart(5, '0');
        this.p1Combo.textContent = s1.combo > 1 ? `x${s1.combo}` : '';
        this.p1Feedback.textContent = s1.feedback;
        this.p1Feedback.className = 'pill-feedback ' + (s1.feedback === 'PERFECTO' ? 'hit' : '');
      }

      // P2
      if (playersStats[1]) {
        const s2 = playersStats[1];
        this.p2Score.textContent = s2.score.toString().padStart(5, '0');
        this.p2Combo.textContent = s2.combo > 1 ? `x${s2.combo}` : '';
        this.p2Feedback.textContent = s2.feedback;
        this.p2Feedback.className = 'pill-feedback ' + (s2.feedback === 'PERFECTO' ? 'hit' : '');
      }
    };

    this.engine.onStateChange = (state) => {
      if (state === 'finished') {
        this.showResults();
      }
    };

    // Metadata
    this.hudSongTitle.textContent = song.title;
    this.hudSongArtist.textContent = song.artist;

    // View switch
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
    const p1 = profiles[0];
    this.p1Name.textContent = p1 ? p1.name : 'P1';
    this.p1Avatar.src = `src/assets/images/svg/${p1 ? p1.avatar : 'avatar-1'}.svg`;
    this.p1Score.textContent = '00000';
    this.p1Combo.textContent = '';
    this.p1Feedback.textContent = '';

    if (profiles.length > 1) {
      const p2 = profiles[1];
      this.p2Box.classList.remove('hidden');
      this.p2Name.textContent = p2.name;
      this.p2Avatar.src = `src/assets/images/svg/${p2.avatar}.svg`;
      this.p2Score.textContent = '00000';
      this.p2Combo.textContent = '';
      this.p2Feedback.textContent = '';
    } else {
      this.p2Box.classList.add('hidden');
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

    // Determine winner if 2 players
    if (results.length > 1) {
      if (results[0].score > results[1].score) {
        this.resWinnerTitle.textContent = `¡GANADOR: ${results[0].profile.name.toUpperCase()}!`;
      } else if (results[1].score > results[0].score) {
        this.resWinnerTitle.textContent = `¡GANADOR: ${results[1].profile.name.toUpperCase()}!`;
      } else {
        this.resWinnerTitle.textContent = '¡EMPATE!';
      }
    } else {
      this.resWinnerTitle.textContent = '¡CANCION COMPLETADA!';
    }

    this.resultsContainer.innerHTML = results.map((r, idx) => `
      <div class="result-player-card ${idx === 0 && results.length > 1 && r.score >= (results[1]?.score || 0) ? 'winner' : ''}">
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
