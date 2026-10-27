/**
 * Multi-Player Game Engine with Strict Per-Player Hit Tracking.
 * Guarantees that score, notes hit and voice feedback are 100% independent per player.
 */

import { PitchDetector } from '../audio/pitchDetector.js';
import { ProfileManager } from './profileManager.js';

export class GameEngine {
  constructor(song, soundPlayer, detector, activeProfiles = []) {
    this.song = song;
    this.soundPlayer = soundPlayer;
    this.detector = detector;

    this.state = 'idle'; // 'idle' | 'playing' | 'paused' | 'finished'
    this.lastTime = 0;

    // Active profiles must be the real players
    this.players = activeProfiles.map((prof, index) => ({
      profile: prof,
      index,
      channel: prof.channel !== undefined ? prof.channel : index,
      score: 0,
      maxScore: 10000,
      combo: 0,
      maxCombo: 0,
      notesHit: new Map(), // Note index -> hit duration in seconds
      currentFeedback: '',
      feedbackTimer: 0,
      voiceHistory: [],
      tolerance: prof.tolerance || ProfileManager.getDifficultyTolerance(prof.difficulty || 'normal')
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

    const dt = Math.max(0.001, Math.min(0.05, currentTime - this.lastTime));
    this.lastTime = currentTime;

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

    // Evaluate each player with 100% independent state and audio stream
    for (const p of this.players) {
      let voice = null;
      if (p.profile.isMobile && p.profile.mobileRef) {
        // Read directly from this specific mobile device
        const ref = p.profile.mobileRef;
        voice = {
          pitch: ref.pitch,
          volume: ref.volume || 0,
          isSinging: !!ref.isSinging
        };
      } else {
        // Read from local PC microphone channel
        voice = this.detector.update(p.channel);
      }

      let isHit = false;
      let pitchDiff = Infinity;

      if (voice.isSinging && voice.pitch !== null) {
        if (activeNote) {
          if (activeNote.type === 'freestyle') {
            isHit = true;
            pitchDiff = 0;
          } else {
            pitchDiff = PitchDetector.getPitchDifference(voice.pitch, activeNote.pitch);
            isHit = pitchDiff <= p.tolerance;
          }
        }

        if (isHit && activeNote) {
          const mult = activeNote.type === 'golden' ? 2 : 1;
          const noteWeight = this.noteScorePerUnit * mult;
          const frameScore = noteWeight * (dt / Math.max(0.08, activeNote.durationTime));
          p.score = Math.min(this.maxScore, p.score + frameScore);

          // Track hit progress specifically for this player
          const prevHit = p.notesHit.get(activeNote.index) || 0;
          p.notesHit.set(activeNote.index, prevHit + dt);

          p.combo++;
          if (p.combo > p.maxCombo) p.maxCombo = p.combo;

          // Just Dance feedback tiers: PERFECT, SUPER, GOOD, OK
          if (activeNote.type === 'freestyle' || pitchDiff <= 0.45) {
            p.currentFeedback = 'PERFECT';
          } else if (pitchDiff <= 0.95) {
            p.currentFeedback = 'SUPER';
          } else {
            p.currentFeedback = 'GOOD';
          }
          p.feedbackTimer = Date.now() + 600;
        } else if (activeNote) {
          p.combo = 0;
          p.currentFeedback = 'OK';
          p.feedbackTimer = Date.now() + 450;
        }

        // Store voice trail specifically for this player
        p.voiceHistory.push({
          time: currentTime,
          pitch: voice.pitch,
          isHit
        });
        if (p.voiceHistory.length > this.maxHistoryLength) {
          p.voiceHistory.shift();
        }
      } else {
        // Muted or silent: do not increment score, reset feedback
        if (Date.now() > p.feedbackTimer) {
          p.currentFeedback = '';
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
    this.lastTime = this.soundPlayer.getCurrentTime();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  pause() {
    this.state = 'paused';
    this.soundPlayer.pause();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  resume() {
    this.state = 'playing';
    this.lastTime = this.soundPlayer.getCurrentTime();
    this.soundPlayer.play();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  finish() {
    this.state = 'finished';
    this.soundPlayer.pause();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  getResults() {
    const totalNotes = this.song.notes.length;

    return this.players.map(p => {
      // Calculate precision based on how many notes this player actually hit
      let hits = 0;
      for (const [_, hitSecs] of p.notesHit.entries()) {
        if (hitSecs > 0.05) hits++;
      }
      const accuracy = totalNotes > 0 ? Math.round((hits / totalNotes) * 100) : 0;

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
