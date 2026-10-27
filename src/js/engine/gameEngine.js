/**
 * Multi-Player Game Engine for Vocaluxe Web.
 * Supports Solo, Battle (1 vs 1), and Duet modes with independent scoring, combos and ratings.
 */

import { PitchDetector } from '../audio/pitchDetector.js';
import { ProfileManager } from './profileManager.js';

export class GameEngine {
  constructor(song, soundPlayer, detector, activeProfiles = []) {
    this.song = song;
    this.soundPlayer = soundPlayer;
    this.detector = detector;

    this.state = 'idle'; // 'idle' | 'playing' | 'paused' | 'finished'
    
    // Fallback to default single player if no profiles
    const profiles = activeProfiles.length > 0 ? activeProfiles : [ProfileManager.DEFAULT_PROFILES[0]];

    // Setup independent player states
    this.players = profiles.map((prof, index) => ({
      profile: prof,
      index,
      channel: prof.channel !== undefined ? prof.channel : index,
      score: 0,
      maxScore: 10000,
      combo: 0,
      maxCombo: 0,
      notesHit: 0,
      currentFeedback: '',
      feedbackTimer: 0,
      voiceHistory: [],
      tolerance: ProfileManager.getDifficultyTolerance(prof.difficulty)
    }));

    this.maxScore = 10000;
    this.currentSentenceIndex = 0;
    this.maxHistoryLength = 200;

    this.calculateScoreWeights();

    this.onStateChange = null;
    this.onScoreUpdate = null;
  }

  calculateScoreWeights() {
    let totalScoreUnits = 0;
    for (const note of this.song.notes) {
      const multiplier = note.type === 'golden' ? 2 : 1;
      totalScoreUnits += note.duration * multiplier;
    }

    this.noteScorePerUnit = totalScoreUnits > 0 ? (8500 / totalScoreUnits) : 0;
    this.sentenceBonus = this.song.sentences.length > 0 ? (1500 / this.song.sentences.length) : 0;
  }

  /**
   * Main game evaluation tick called 60 times per second.
   */
  update(currentTime) {
    if (this.state !== 'playing') return;

    if (currentTime >= this.soundPlayer.getDuration() && this.soundPlayer.getDuration() > 0) {
      this.finish();
      return;
    }

    const activeSentence = this.findActiveSentence(currentTime);
    let activeNote = null;
    if (activeSentence) {
      for (const note of activeSentence.notes) {
        if (currentTime >= note.startTime && currentTime <= note.endTime) {
          activeNote = note;
          break;
        }
      }
    }

    // Evaluate each player independently
    for (const p of this.players) {
      const voice = this.detector.update(p.channel);
      let isHit = false;

      if (activeNote) {
        if (voice.isSinging && voice.pitch !== null) {
          if (activeNote.type === 'freestyle') {
            isHit = true;
          } else {
            isHit = PitchDetector.isPitchMatch(voice.pitch, activeNote.pitch, p.tolerance);
          }
        }

        if (isHit) {
          const mult = activeNote.type === 'golden' ? 2 : 1;
          const frameScore = (this.noteScorePerUnit * mult) * 0.05;
          p.score = Math.min(this.maxScore, p.score + frameScore);

          activeNote.isHit = true;
          p.combo++;
          if (p.combo > p.maxCombo) p.maxCombo = p.combo;

          p.currentFeedback = 'PERFECTO';
          p.feedbackTimer = Date.now() + 600;
        } else if (voice.isSinging) {
          p.combo = 0;
          p.currentFeedback = 'AFINA';
          p.feedbackTimer = Date.now() + 400;
        }
      } else {
        if (Date.now() > p.feedbackTimer) {
          p.currentFeedback = '';
        }
      }

      if (voice.isSinging && voice.pitch !== null) {
        p.voiceHistory.push({
          time: currentTime,
          pitch: voice.pitch,
          isHit
        });
        if (p.voiceHistory.length > this.maxHistoryLength) {
          p.voiceHistory.shift();
        }
      }
    }

    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.players.map(p => ({
        index: p.index,
        name: p.profile.name,
        color: p.profile.color,
        score: Math.floor(p.score),
        combo: p.combo,
        maxCombo: p.maxCombo,
        feedback: p.currentFeedback
      })));
    }
  }

  findActiveSentence(currentTime) {
    for (let i = 0; i < this.song.sentences.length; i++) {
      const sentence = this.song.sentences[i];
      if (currentTime >= (sentence.startTime - 1.5) && currentTime <= (sentence.endTime + 0.8)) {
        this.currentSentenceIndex = i;
        return sentence;
      }
    }

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
    this.soundPlayer.pause();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  resume() {
    this.state = 'playing';
    this.soundPlayer.play();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  finish() {
    this.state = 'finished';
    this.soundPlayer.pause();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  getResults() {
    const accuracy = this.song.notes.length > 0
      ? Math.round((this.song.notes.filter(n => n.isHit).length / this.song.notes.length) * 100)
      : 0;

    return this.players.map(p => {
      let rank = 'PRINCIPIANTE';
      if (p.score >= 9000) rank = 'ESTRELLA';
      else if (p.score >= 7500) rank = 'EXCELENTE';
      else if (p.score >= 5000) rank = 'NOTABLE';
      else if (p.score >= 3000) rank = 'AFICIONADO';

      return {
        profile: p.profile,
        score: Math.floor(p.score),
        accuracy,
        maxCombo: p.maxCombo,
        rank
      };
    });
  }
}
