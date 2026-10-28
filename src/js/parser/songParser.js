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
   * Cleans up corrupted characters (like U+FFFD replacement characters, broken mojibake, or malformed apostrophes)
   * so players never see black diamond question marks on their screens.
   */
  static cleanLyricsText(str) {
    if (!str || typeof str !== 'string') return '';

    let res = str
      .replace(/^\uFEFF/, '') // Strip UTF-8 BOM
      .replace(/ï»¿/g, '');

    if (res.includes('\uFFFD') || res.includes('')) {
      res = res
        .replace(/I\uFFFDm/gi, "I'm")
        .replace(/It\uFFFDs/gi, "It's")
        .replace(/We\uFFFDre/gi, "We're")
        .replace(/Don\uFFFDt/gi, "Don't")
        .replace(/Can\uFFFDt/gi, "Can't")
        .replace(/Won\uFFFDt/gi, "Won't")
        .replace(/You\uFFFDre/gi, "You're")
        .replace(/They\uFFFDre/gi, "They're")
        .replace(/ci\uFFFDn/gi, 'ción')
        .replace(/si\uFFFDn/gi, 'sión')
        .replace(/z\uFFFDn/gi, 'zón')
        .replace(/m\uFFFDn/gi, 'món')
        .replace(/t\uFFFDn/gi, 'tón')
        .replace(/g\uFFFDn/gi, 'gán')
        .replace(/ni\uFFFD/gi, 'niñ')
        .replace(/a\uFFFD/gi, 'añ')
        .replace(/sue\uFFFD/gi, 'sueñ')
        .replace(/qu\uFFFD/gi, 'qué')
        .replace(/m\uFFFDs/gi, 'más')
        .replace(/est\uFFFD/gi, 'está')
        .replace(/c\uFFFD/gi, 'cí')
        .replace(/s\uFFFD/gi, 'sí')
        .replace(/d\uFFFD/gi, 'día')
        .replace(/r\uFFFD/gi, 'ría')
        .replace(/\uFFFD(?=[a-zA-ZáéíóúÁÉÍÓÚñÑ])/g, '')
        .replace(/[\uFFFD]/g, '');
    }

    // Common stripped Spanish vowels / consonants from legacy parsers
    res = res
      .replace(/\bUn clsico\b/g, 'Un clásico')
      .replace(/\bclsico\b/g, 'clásico')
      .replace(/\bclsica\b/g, 'clásica')
      .replace(/\bmontaa\b/g, 'montaña')
      .replace(/\bmontaas\b/g, 'montañas')
      .replace(/\befmero\b/g, 'efímero')
      .replace(/\bfmero\b/g, 'fímero')
      .replace(/\bingls\b/g, 'inglés')
      .replace(/\bmsica\b/g, 'música')
      .replace(/\bFasica\b/g, 'Física')
      .replace(/\bqumica\b/g, 'química')
      .replace(/\bEspaol\b/g, 'Español')
      .replace(/\bespaol\b/g, 'español');

    return res;
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

    text = SongParser.cleanLyricsText(text);

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
            song.title = SongParser.cleanLyricsText(val);
            break;
          case 'ARTIST':
            song.artist = SongParser.cleanLyricsText(val);
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
   * Skips unnecessary dead intro and gives players ~110-120 seconds of pure singing.
   */
  static createShortVersion(song, targetSeconds = 120) {
    if (!song || !song.sentences || song.sentences.length === 0) return song;

    const firstNoteTime = song.notes.length > 0 ? song.notes[0].startTime : 0;
    const lastNoteTime = song.notes.length > 0 ? song.notes[song.notes.length - 1].endTime : 0;
    const totalSingingTime = lastNoteTime - firstNoteTime;

    // If the entire song singing duration is already under ~2m 20s, keep full length
    if (totalSingingTime <= 140 && lastNoteTime <= 150) {
      return song;
    }

    // Smart Intro Skip for Short Matches:
    // If there is a long instrumental intro (> 8s), start 2.5s before the first sung note
    const startOffset = firstNoteTime > 8 ? Math.max(0, firstNoteTime - 2.5) : 0;

    // Target cutoff: ~110-125 seconds after singing begins
    const targetCutTime = startOffset + targetSeconds;

    let cutIndex = -1;
    for (let i = 0; i < song.sentences.length; i++) {
      const sent = song.sentences[i];
      const nextSent = song.sentences[i + 1];

      if (sent.endTime >= targetCutTime - 15) {
        if (!nextSent) {
          cutIndex = i;
          break;
        }
        const gap = nextSent.startTime - sent.endTime;
        // Cut at a musical pause/rest of 1.4s+ or if we reached targetCutTime + 15s
        if (gap >= 1.4 || sent.endTime >= targetCutTime + 15) {
          cutIndex = i;
          break;
        }
      }
    }

    if (cutIndex === -1 || cutIndex >= song.sentences.length - 1) {
      cutIndex = Math.min(song.sentences.length - 1, Math.floor(song.sentences.length * 0.6));
    }

    const cutSentences = song.sentences.slice(0, cutIndex + 1);
    const cutEndTime = cutSentences[cutSentences.length - 1].endTime;
    const cutNotes = song.notes.filter(n => n.endTime <= cutEndTime + 0.1);

    return {
      ...song,
      sentences: cutSentences,
      notes: cutNotes,
      isShortVersion: true,
      startOffset,
      cutOffTime: cutEndTime + 1.5
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
