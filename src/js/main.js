/**
 * Application Main Entry Point.
 * Coordinates Library, Game Engine, Pitch Detection, Audio, and Canvas Renderer.
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

    // In-game HUD elements
    this.hudScore = document.getElementById('hud-score');
    this.hudCombo = document.getElementById('hud-combo');
    this.hudFeedback = document.getElementById('hud-feedback');
    this.hudSongTitle = document.getElementById('hud-song-title');
    this.hudSongArtist = document.getElementById('hud-song-artist');
    this.btnBack = document.getElementById('btn-back');
    this.btnPause = document.getElementById('btn-pause');

    // Results modal elements
    this.resScore = document.getElementById('res-score');
    this.resRank = document.getElementById('res-rank');
    this.resAccuracy = document.getElementById('res-accuracy');
    this.resCombo = document.getElementById('res-combo');
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

    this.animationFrameId = null;

    this.init();
  }

  init() {
    // Initialize Song Library UI
    new LibraryUI(this.viewLibrary, (song, audioUrl, videoUrl) => {
      this.startGame(song, audioUrl, videoUrl);
    });

    // Control buttons
    this.btnBack.addEventListener('click', () => this.exitToLibrary());
    this.btnPause.addEventListener('click', () => this.togglePause());

    this.btnRetry.addEventListener('click', () => {
      this.viewResults.classList.add('hidden');
      this.startGame(this.currentSong, this.currentAudioUrl, this.currentVideoUrl);
    });

    this.btnExitResults.addEventListener('click', () => {
      this.viewResults.classList.add('hidden');
      this.exitToLibrary();
    });

    // Handle end of audio
    this.player.onEnded(() => {
      if (this.engine) {
        this.engine.finish();
      }
    });
  }

  async startGame(song, audioUrl, videoUrl) {
    this.currentSong = song;
    this.currentAudioUrl = audioUrl;
    this.currentVideoUrl = videoUrl;

    try {
      // 1. Request microphone access
      await this.detector.start();
    } catch (err) {
      alert(`No se pudo inicializar el micrófono: ${err.message}`);
      return;
    }

    // 2. Prepare audio player
    if (audioUrl) {
      await this.player.loadSource(audioUrl, videoUrl);
    }

    // 3. Setup game engine
    this.engine = new GameEngine(song, this.player, this.detector);

    this.engine.onScoreUpdate = (stats) => {
      this.hudScore.textContent = stats.score.toLocaleString();
      this.hudCombo.textContent = stats.combo > 1 ? `x${stats.combo}` : '';
      this.hudFeedback.textContent = stats.feedback;
      this.hudFeedback.className = 'hud-feedback ' + (stats.feedback === 'PERFECTO' ? 'hit' : '');
    };

    this.engine.onStateChange = (state) => {
      if (state === 'finished') {
        this.showResults();
      }
    };

    // 4. Update HUD
    this.hudSongTitle.textContent = song.title;
    this.hudSongArtist.textContent = song.artist;
    this.hudScore.textContent = '0';
    this.hudCombo.textContent = '';
    this.hudFeedback.textContent = '';

    // 5. Switch views
    this.viewLibrary.classList.add('hidden');
    this.viewResults.classList.add('hidden');
    this.viewGame.classList.remove('hidden');
    this.renderer.resize();

    // 6. Start audio and engine
    if (audioUrl) {
      try {
        await this.player.play();
      } catch (e) {
        console.warn('Auto-play bloqueado por navegador:', e);
      }
    }
    this.engine.start();

    // 7. Start render loop
    this.startLoop();
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
      this.btnPause.querySelector('span').textContent = 'Continuar';
    } else if (this.engine.state === 'paused') {
      this.engine.resume();
      this.btnPause.querySelector('span').textContent = 'Pausa';
    }
  }

  showResults() {
    if (!this.engine) return;
    const results = this.engine.getResults();

    this.resScore.textContent = results.score.toLocaleString();
    this.resRank.textContent = results.rank;
    this.resAccuracy.textContent = `${results.accuracy}%`;
    this.resCombo.textContent = results.maxCombo;

    this.viewResults.classList.remove('hidden');
  }

  exitToLibrary() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.player) {
      this.player.stop();
    }

    if (this.detector) {
      this.detector.stop();
    }

    this.engine = null;
    this.viewGame.classList.add('hidden');
    this.viewResults.classList.add('hidden');
    this.viewLibrary.classList.remove('hidden');
  }
}

// Bootstrap once DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
