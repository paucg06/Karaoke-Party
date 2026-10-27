/**
 * 60 FPS Canvas Game Renderer for Vocaluxe Web.
 * Complies strictly with EternoDev Design Standards:
 * - ZERO gradients (Flat solid colors only)
 * - ZERO emojis
 * - Ultra-clean minimal high-contrast visualizer
 */

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    // Palette: Flat solid colors (EternoDev Standard)
    this.colors = {
      background: '#0F172A',      // Slate 900
      gridLine: '#1E293B',        // Slate 800
      noteNormal: '#2563EB',      // Blue 600
      noteNormalHit: '#38BDF8',   // Sky 400
      noteGolden: '#F59E0B',      // Amber 500
      noteGoldenHit: '#FDE047',   // Yellow 300
      noteFreestyle: '#8B5CF6',   // Purple 500
      playerCursor: '#FFFFFF',    // White
      playerVoiceHit: '#10B981',  // Emerald 500
      playerVoiceMiss: '#EF4444', // Red 500
      textPrimary: '#F8FAFC',     // Slate 50
      textSecondary: '#94A3B8',   // Slate 400
      textHighlight: '#38BDF8'    // Sky 400
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Main render method called every animation frame.
   */
  render(engine, currentTime) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Clear background (flat solid)
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, w, h);

    if (!engine || !engine.song) return;

    const sentence = engine.findActiveSentence(currentTime);
    if (!sentence || sentence.notes.length === 0) {
      this.drawEmptyState();
      return;
    }

    // Define playing viewport margins
    const marginX = 40;
    const topMargin = 50;
    const bottomLyricsHeight = 100;
    const notesAreaHeight = h - topMargin - bottomLyricsHeight;

    // 2. Pitch vertical scaling
    // Add margin semitones for visual comfort
    const pitchPadding = 2;
    const minP = sentence.minPitch - pitchPadding;
    const maxP = sentence.maxPitch + pitchPadding;
    const pitchRange = Math.max(12, maxP - minP); // at least 1 octave view

    const pitchToY = (pitch) => {
      const normalized = (pitch - minP) / pitchRange;
      return (topMargin + notesAreaHeight) - (normalized * notesAreaHeight);
    };

    // 3. Time horizontal scaling (Fit current sentence with padding)
    const viewStartTime = sentence.startTime - 0.5;
    const viewEndTime = sentence.endTime + 0.8;
    const viewDuration = Math.max(1, viewEndTime - viewStartTime);

    const timeToX = (time) => {
      const normalized = (time - viewStartTime) / viewDuration;
      return marginX + (normalized * (w - marginX * 2));
    };

    // 4. Draw horizontal pitch grid guidelines
    ctx.strokeStyle = this.colors.gridLine;
    ctx.lineWidth = 1;
    for (let p = Math.floor(minP); p <= Math.ceil(maxP); p++) {
      const y = pitchToY(p);
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(w - marginX, y);
      ctx.stroke();
    }

    // 5. Draw target note bars
    const noteHeight = Math.max(8, Math.min(22, (notesAreaHeight / pitchRange) * 0.7));

    for (const note of sentence.notes) {
      const x1 = timeToX(note.startTime);
      const x2 = timeToX(note.endTime);
      const noteWidth = Math.max(6, x2 - x1);
      const y = pitchToY(note.pitch) - (noteHeight / 2);

      // Base bar color (solid)
      let baseColor = this.colors.noteNormal;
      let hitColor = this.colors.noteNormalHit;
      if (note.type === 'golden') {
        baseColor = this.colors.noteGolden;
        hitColor = this.colors.noteGoldenHit;
      } else if (note.type === 'freestyle') {
        baseColor = this.colors.noteFreestyle;
        hitColor = this.colors.noteNormalHit;
      }

      ctx.fillStyle = baseColor;
      ctx.fillRect(x1, y, noteWidth, noteHeight);

      // Fill hit portion
      if (note.isHit) {
        ctx.fillStyle = hitColor;
        const hitWidth = (currentTime >= note.endTime)
          ? noteWidth
          : Math.max(0, timeToX(currentTime) - x1);
        ctx.fillRect(x1, y, Math.min(noteWidth, hitWidth), noteHeight);
      }

      // Syllable text above/below note bar
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = this.colors.textPrimary;
      ctx.textAlign = 'left';
      ctx.fillText(note.syllable, x1, y - 6);
    }

    // 6. Draw player voice trajectory trail
    if (engine.voiceHistory && engine.voiceHistory.length > 1) {
      for (let i = 1; i < engine.voiceHistory.length; i++) {
        const ptA = engine.voiceHistory[i - 1];
        const ptB = engine.voiceHistory[i];

        if (ptA.time >= viewStartTime && ptB.time <= viewEndTime) {
          const xA = timeToX(ptA.time);
          const yA = pitchToY(ptA.pitch);
          const xB = timeToX(ptB.time);
          const yB = pitchToY(ptB.pitch);

          ctx.strokeStyle = ptB.isHit ? this.colors.playerVoiceHit : this.colors.playerVoiceMiss;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(xA, yA);
          ctx.lineTo(xB, yB);
          ctx.stroke();
        }
      }
    }

    // 7. Draw playback time cursor line
    const currentX = timeToX(currentTime);
    if (currentX >= marginX && currentX <= (w - marginX)) {
      ctx.strokeStyle = this.colors.playerCursor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentX, topMargin);
      ctx.lineTo(currentX, topMargin + notesAreaHeight);
      ctx.stroke();

      // Current voice indicator dot
      const voice = engine.detector;
      if (voice && voice.isSinging && voice.currentPitch !== null) {
        const voiceY = pitchToY(voice.currentPitch);
        ctx.fillStyle = engine.currentFeedback === 'PERFECTO' ? this.colors.playerVoiceHit : this.colors.playerVoiceMiss;
        ctx.beginPath();
        ctx.arc(currentX, voiceY, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 8. Draw synchronized bottom lyrics bar
    this.drawLyricsBar(sentence, currentTime, w, h);
  }

  drawLyricsBar(sentence, currentTime, w, h) {
    const ctx = this.ctx;
    const y = h - 45;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Calculate total width of syllables for centered alignment
    ctx.font = '700 24px system-ui, sans-serif';
    
    let fullSentenceText = sentence.notes.map(n => n.syllable).join('');
    let totalTextWidth = ctx.measureText(fullSentenceText).width;
    let startX = Math.max(30, (w - totalTextWidth) / 2);

    ctx.textAlign = 'left';
    let currentX = startX;

    for (const note of sentence.notes) {
      const isPastOrCurrent = currentTime >= note.startTime;
      const isCurrentlySinging = currentTime >= note.startTime && currentTime <= note.endTime;

      if (isCurrentlySinging) {
        ctx.fillStyle = this.colors.textHighlight;
      } else if (isPastOrCurrent) {
        ctx.fillStyle = this.colors.textPrimary;
      } else {
        ctx.fillStyle = this.colors.textSecondary;
      }

      ctx.fillText(note.syllable, currentX, y);
      currentX += ctx.measureText(note.syllable).width;
    }
  }

  drawEmptyState() {
    const ctx = this.ctx;
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillStyle = this.colors.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('Esperando canción...', this.width / 2, this.height / 2);
  }
}
