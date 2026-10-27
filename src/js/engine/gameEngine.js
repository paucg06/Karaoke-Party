/**
 * Core Game Engine for Vocaluxe Web.
 * Controls game states, scoring, real-time evaluation, and feedback.
 */

import { PitchDetector } from '../audio/pitchDetector.js';

export class GameEngine {
  constructor(song, player, detector) {
    this.song = song;
    this.player = player;
    this.detector = detector;

    this.state = 'idle'; // 'idle' | 'countdown' | 'playing' | 'paused' | 'finished'
    
    // Scoring metrics (UltraStar 10,000 max score standard)
    this.score = 0;
    this.maxScore = 10000;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalNotesHit = 0;
    this.totalNotesEvaluated = 0;
    this.currentFeedback = '';
    this.feedbackTimer = 0;

    // Weight per beat for score distribution
    this.scorePerBeat = 0;
    this.calculateScoreWeights();

    // Sentence index tracker
    this.currentSentenceIndex = 0;

    // Pitch history for visual trail
    this.voiceHistory = []; // { time, pitch, isHit }
    this.maxHistoryLength = 200;

    this.onStateChange = null;
    this.onScoreUpdate = null;
  }

  /**
   * Pre-calculates score weights to guarantee fair 10,000 max score.
   */
  calculateScoreWeights() {
    let totalScoreUnits = 0;
    for (const note of this.song.notes) {
      const multiplier = note.type === 'golden' ? 2 : 1;
      totalScoreUnits += note.duration * multiplier;
    }

    // 8,500 points for note singing + 1,500 points for sentence completion bonus
    this.noteScorePerUnit = totalScoreUnits > 0 ? (8500 / totalScoreUnits) : 0;
    this.sentenceBonus = this.song.sentences.length > 0 ? (1500 / this.song.sentences.length) : 0;
  }

  /**
   * Main game evaluation tick, executed every animation frame.
   * @param {number} currentTime Current song time in seconds
   */
  update(currentTime) {
    if (this.state !== 'playing') return;

    // 1. Check if song finished
    if (currentTime >= this.player.getDuration() && this.player.getDuration() > 0) {
      this.finish();
      return;
    }

    // 2. Fetch mic detection
    const voice = this.detector.update();

    // 3. Find active sentence
    const activeSentence = this.findActiveSentence(currentTime);

    // 4. Evaluate active note at this millisecond
    let activeNote = null;
    if (activeSentence) {
      for (const note of activeSentence.notes) {
        if (currentTime >= note.startTime && currentTime <= note.endTime) {
          activeNote = note;
          break;
        }
      }
    }

    let isHit = false;

    if (activeNote) {
      if (voice.isSinging && voice.pitch !== null) {
        if (activeNote.type === 'freestyle') {
          isHit = true;
        } else {
          isHit = PitchDetector.isPitchMatch(voice.pitch, activeNote.pitch);
        }
      }

      if (isHit) {
        // Increment score proportional to frame duration
        const mult = activeNote.type === 'golden' ? 2 : 1;
        const frameScore = (this.noteScorePerUnit * mult) * 0.05;
        this.score = Math.min(this.maxScore, this.score + frameScore);
        
        activeNote.isHit = true;
        activeNote.hitScore += frameScore;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        this.setFeedback('PERFECTO');
      } else if (voice.isSinging) {
        this.combo = 0;
        this.setFeedback('AFINA');
      }
    } else {
      if (!voice.isSinging) {
        // Reset feedback when quiet
        if (Date.now() > this.feedbackTimer) {
          this.currentFeedback = '';
        }
      }
    }

    // 5. Store trail for rendering player voice line
    if (voice.isSinging && voice.pitch !== null) {
      this.voiceHistory.push({
        time: currentTime,
        pitch: voice.pitch,
        isHit
      });
      if (this.voiceHistory.length > this.maxHistoryLength) {
        this.voiceHistory.shift();
      }
    }

    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: Math.floor(this.score),
        combo: this.combo,
        maxCombo: this.maxCombo,
        feedback: this.currentFeedback
      });
    }
  }

  setFeedback(text) {
    this.currentFeedback = text;
    this.feedbackTimer = Date.now() + 600;
  }

  findActiveSentence(currentTime) {
    // Current sentence or next upcoming sentence
    for (let i = 0; i < this.song.sentences.length; i++) {
      const sentence = this.song.sentences[i];
      // Keep sentence visible slightly before it starts and slightly after it finishes
      if (currentTime >= (sentence.startTime - 1.5) && currentTime <= (sentence.endTime + 0.8)) {
        this.currentSentenceIndex = i;
        return sentence;
      }
    }

    // If between sentences, show the upcoming one
    for (let i = 0; i < this.song.sentences.length; i++) {
      if (currentTime < this.song.sentences[i].startTime) {
        this.currentSentenceIndex = i;
        return this.song.sentences[i];
      }
    }

    return this.song.sentences[this.song.sentences.length - 1] || null;
  }

  start() {
    this.state = 'playing';
    if (this.onStateChange) this.onStateChange(this.state);
  }

  pause() {
    this.state = 'paused';
    this.player.pause();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  resume() {
    this.state = 'playing';
    this.player.play();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  finish() {
    this.state = 'finished';
    this.player.pause();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  getResults() {
    const accuracy = this.song.notes.length > 0
      ? Math.round((this.song.notes.filter(n => n.isHit).length / this.song.notes.length) * 100)
      : 0;

    let rank = 'PRINCIPIANTE';
    if (this.score >= 9000) rank = 'ESTRELLA';
    else if (this.score >= 7500) rank = 'EXCELENTE';
    else if (this.score >= 5000) rank = 'NOTABLE';
    else if (this.score >= 3000) rank = 'AFICIONADO';

    return {
      score: Math.floor(this.score),
      maxScore: this.maxScore,
      accuracy,
      maxCombo: this.maxCombo,
      rank
    };
  }
}
