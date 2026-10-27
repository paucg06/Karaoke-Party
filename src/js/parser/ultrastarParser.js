/**
 * Parser for UltraStar / Vocaluxe song files (.txt).
 * Converts text timing and pitches into absolute timestamps and notes.
 */

export class UltraStarParser {
  /**
   * Parse raw text of an UltraStar file.
   * @param {string} text Raw content of .txt
   * @returns {Object} Parsed song data structure
   */
  static parse(text) {
    if (!text || typeof text !== 'string') {
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
          currentSentence.endTime = UltraStarParser.beatToSeconds(currentSentence.endBeat, song.bpm, song.gap);
          song.sentences.push(currentSentence);
        }

        const nextStartBeat = parts[1] ? parseInt(parts[1], 10) : (parseInt(parts[0], 10) || 0);
        currentSentence = {
          startBeat: nextStartBeat,
          endBeat: nextStartBeat,
          startTime: UltraStarParser.beatToSeconds(nextStartBeat, song.bpm, song.gap),
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
        
        // Syllable can contain spaces if original line had multiple spaces
        const syllableMatch = line.match(/^[:*FRG]\s+\S+\s+\S+\s+\S+\s*(.*)$/);
        const syllable = syllableMatch ? syllableMatch[1] : (parts.slice(3).join(' ') || '');

        const startTime = UltraStarParser.beatToSeconds(startBeat, song.bpm, song.gap);
        const durationTime = UltraStarParser.durationToSeconds(duration, song.bpm);
        const endTime = startTime + durationTime;

        const note = {
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
      currentSentence.endTime = UltraStarParser.beatToSeconds(currentSentence.endBeat, song.bpm, song.gap);
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

    return song;
  }

  /**
   * Convert UltraStar beat index to song seconds.
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
