/**
 * Parser for Karaoke song files (.txt).
 * Converts text timing and pitches into absolute timestamps and notes.
 */

export class SongParser {
  /**
   * Decode an ArrayBuffer or Uint8Array with UTF-8 and auto-fallback to Windows-1252 (Latin-1).
   * Prevents corrupted characters on Spanish, French, and Latin songs.
   */
  static decodeTextBuffer(buffer) {
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      return utf8Decoder.decode(buffer);
    } catch (e) {
      const latinDecoder = new TextDecoder('windows-1252');
      return latinDecoder.decode(buffer);
    }
  }

  /**
   * Parse raw text or buffer of a song file.
   * @param {string|ArrayBuffer|Uint8Array} input Raw content or buffer of .txt
   * @returns {Object} Parsed song data structure
   */
  static parse(input) {
    let text = '';
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
      text = SongParser.decodeTextBuffer(input);
    } else if (typeof input === 'string') {
      text = input;
    } else {
      throw new Error('Formato de archivo inválido o vacío');
    }

    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    
    const song = {
      title: 'Desconocido',
      artist: 'Desconocido',
      mp3: '',
      audio: '',
      video: '',
      cover: '',
      background: '',
      bpm: 120,
      gap: 0,
      start: 0,
      end: 0,
      resolution: 4, // UltraStar beat resolution
      notes: [],
      sentences: [],
      minPitch: 999,
      maxPitch: -999,
      totalNotesDuration: 0,
      maxScore: 10000
    };

    let currentSentence = {
      startBeat: 0,
      endBeat: 0,
      startTime: 0,
      endTime: 0,
      notes: [],
      minPitch: 999,
      maxPitch: -999
    };

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Header tags: #TAG:VALUE
      if (line.startsWith('#')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const tag = line.slice(1, colonIdx).trim().toUpperCase();
        let val = line.slice(colonIdx + 1).trim();

        switch (tag) {
          case 'TITLE':
            song.title = val;
            break;
          case 'ARTIST':
            song.artist = val;
            break;
          case 'MP3':
          case 'AUDIO':
            song.mp3 = val;
            song.audio = val;
            break;
          case 'VIDEO':
            song.video = val;
            break;
          case 'COVER':
            song.cover = val;
            break;
          case 'BACKGROUND':
            song.background = val;
            break;
          case 'BPM':
            song.bpm = parseFloat(val.replace(',', '.')) || 120;
            break;
          case 'GAP':
            song.gap = parseFloat(val.replace(',', '.')) || 0;
            break;
          case 'START':
            song.start = parseFloat(val.replace(',', '.')) || 0;
            break;
          case 'END':
            song.end = parseFloat(val.replace(',', '.')) || 0;
            break;
        }
        continue;
      }

      const noteTypeChar = line[0];
      const parts = line.slice(1).trim().split(/\s+/);

      // Sentence separator: - [Beat]
      if (noteTypeChar === '-') {
        if (currentSentence.notes.length > 0) {
          currentSentence.endBeat = parseInt(parts[0], 10) || currentSentence.notes[currentSentence.notes.length - 1].endBeat;
          currentSentence.endTime = SongParser.beatToSeconds(currentSentence.endBeat, song.bpm, song.gap);
          song.sentences.push(currentSentence);
        }

        const nextStartBeat = parts[1] ? parseInt(parts[1], 10) : (parseInt(parts[0], 10) || 0);
        currentSentence = {
          startBeat: nextStartBeat,
          endBeat: nextStartBeat,
          startTime: SongParser.beatToSeconds(nextStartBeat, song.bpm, song.gap),
          endTime: 0,
          notes: [],
          minPitch: 999,
          maxPitch: -999
        };
        continue;
      }

      // Song End: E
      if (noteTypeChar === 'E') {
        break;
      }

      // Valid note types: : (normal), * (golden), F (freestyle), R (rap), G (golden rap)
      if ([':', '*', 'F', 'R', 'G'].includes(noteTypeChar)) {
        if (parts.length < 3) continue;

        const startBeat = parseInt(parts[0], 10);
        const duration = parseInt(parts[1], 10);
        const pitch = parseInt(parts[2], 10);
        
        // Exactly 1 space between pitch and syllable; any extra space is part of the syllable
        const syllableMatch = line.match(/^[:*FRG]\s+(\S+)\s+(\S+)\s+(\S+)(?:\s(.*))?$/);
        const syllable = syllableMatch && syllableMatch[4] !== undefined ? syllableMatch[4] : '';

        const startTime = SongParser.beatToSeconds(startBeat, song.bpm, song.gap);
        const durationTime = SongParser.durationToSeconds(duration, song.bpm);
        const endTime = startTime + durationTime;

        const note = {
          index: song.notes.length,
          type: noteTypeChar === '*' || noteTypeChar === 'G' ? 'golden' : (noteTypeChar === 'F' ? 'freestyle' : 'normal'),
          startBeat,
          duration,
          endBeat: startBeat + duration,
          pitch,
          syllable,
          startTime,
          durationTime,
          endTime,
          isHit: false,
          hitScore: 0
        };

        song.notes.push(note);
        currentSentence.notes.push(note);

        song.totalNotesDuration += duration;
        if (pitch < song.minPitch) song.minPitch = pitch;
        if (pitch > song.maxPitch) song.maxPitch = pitch;

        if (pitch < currentSentence.minPitch) currentSentence.minPitch = pitch;
        if (pitch > currentSentence.maxPitch) currentSentence.maxPitch = pitch;
      }
    }

    // Push trailing sentence if any
    if (currentSentence.notes.length > 0) {
      currentSentence.endBeat = currentSentence.notes[currentSentence.notes.length - 1].endBeat;
      currentSentence.endTime = SongParser.beatToSeconds(currentSentence.endBeat, song.bpm, song.gap);
      song.sentences.push(currentSentence);
    }

    if (song.minPitch === 999) song.minPitch = 0;
    if (song.maxPitch === -999) song.maxPitch = 12;

    // Normalize sentences timings
    for (const sent of song.sentences) {
      if (sent.notes.length > 0) {
        sent.startTime = sent.notes[0].startTime;
        sent.endTime = sent.notes[sent.notes.length - 1].endTime;
        if (sent.minPitch === 999) sent.minPitch = song.minPitch;
        if (sent.maxPitch === -999) sent.maxPitch = song.maxPitch;
      }
    }

    // Calculate objective song rhythm & lyric difficulty (1, 2 or 3 stars)
    const totalNotes = song.notes.length;
    let difficultyStars = 1;
    let difficultyLabel = 'Fácil';

    if (totalNotes > 0) {
      const firstTime = song.notes[0].startTime;
      const lastTime = song.notes[totalNotes - 1].endTime;
      const singingSpan = Math.max(10, lastTime - firstTime);
      const notesPerSec = totalNotes / singingSpan;

      if (notesPerSec >= 3.2) {
        difficultyStars = 3;
        difficultyLabel = 'Difícil';
      } else if (notesPerSec >= 1.9) {
        difficultyStars = 2;
        difficultyLabel = 'Media';
      } else {
        difficultyStars = 1;
        difficultyLabel = 'Fácil';
      }
    }

    song.difficultyStars = difficultyStars;
    song.difficultyLabel = difficultyLabel;

    return song;
  }

  /**
   * Create a shortened version (~2 min) cut at a natural musical pause/break.
   * Keeps sentences up to ~110-135s and fades/finishes smoothly.
   */
  static createShortVersion(song, targetSeconds = 120) {
    if (!song || !song.sentences || song.sentences.length === 0) return song;

    const lastNoteTime = song.notes.length > 0 ? song.notes[song.notes.length - 1].endTime : 0;
    // If the song is already short (<= 2m 20s), keep full length
    if (lastNoteTime <= 140) {
      return song;
    }

    let cutIndex = -1;
    for (let i = 0; i < song.sentences.length; i++) {
      const sent = song.sentences[i];
      const nextSent = song.sentences[i + 1];

      if (sent.endTime >= 100) {
        if (!nextSent) {
          cutIndex = i;
          break;
        }
        const gap = nextSent.startTime - sent.endTime;
        // Cut at a rest of 1.5+ seconds or if we reached 135s
        if (gap >= 1.5 || sent.endTime >= 135) {
          cutIndex = i;
          break;
        }
      }
    }

    if (cutIndex === -1 || cutIndex >= song.sentences.length - 1) {
      return song;
    }

    const cutSentences = song.sentences.slice(0, cutIndex + 1);
    const cutEndTime = cutSentences[cutSentences.length - 1].endTime;
    const cutNotes = song.notes.filter(n => n.endTime <= cutEndTime + 0.1);

    return {
      ...song,
      sentences: cutSentences,
      notes: cutNotes,
      isShortVersion: true,
      cutOffTime: cutEndTime + 2.0
    };
  }

  /**
   * Convert beat index to song seconds.
   */
  static beatToSeconds(beat, bpm, gap) {
    return ((beat / (bpm * 4)) * 60) + (gap / 1000);
  }

  /**
   * Convert beat duration to duration in seconds.
   */
  static durationToSeconds(duration, bpm) {
    return (duration / (bpm * 4)) * 60;
  }
}
