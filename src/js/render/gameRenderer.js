/**
 * Game Renderer for up to 4 Simultaneous Players (Lips & Vocaluxe Style).
 * Features:
 * - Dynamic 1, 2, 3 or 4 Stave Lanes with Player Badges
 * - Capsule / Pill-shaped notes with hit fill and twinkling golden star sparkles
 * - Dual-line lyrics banner (Current singing sentence + Next preview sentence)
 * - Bottom song timeline bar with elapsed and remaining countdown
 * - Flat solid design, zero gradients, zero emojis (EternoDev Standard)
 */

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    this.colors = {
      canvasClear: 'rgba(7, 11, 20, 0.45)', // Translucent so MP4 background video shines through!
      staveBg: 'rgba(15, 23, 42, 0.65)',
      gridLine: 'rgba(51, 65, 85, 0.4)',
      noteBorder: '#0F172A',
      noteHitFill: '#38BDF8',
      goldenNote: '#F59E0B',
      goldenHit: '#FDE047',
      goldenSparkle: '#FEF08A',
      lyricsBoxBg: 'rgba(7, 11, 20, 0.88)',
      lyricsBoxBorder: '#334155',
      textActive: '#38BDF8',
      textPast: '#FFFFFF',
      textFuture: '#94A3B8',
      textNextSentence: '#64748B',
      progressBarBg: '#1E293B',
      progressBarFill: '#2563EB'
    };

    this.sparkleTimer = 0;
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

  render(engine, currentTime) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    this.sparkleTimer += 0.05;

    // Clear canvas (keeps background video visible with optimal contrast overlay)
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.colors.canvasClear;
    ctx.fillRect(0, 0, w, h);

    if (!engine || !engine.song) return;

    const sentence = engine.findActiveSentence(currentTime);
    const nextSentence = engine.song.sentences[engine.currentSentenceIndex + 1] || null;

    if (!sentence || sentence.notes.length === 0) {
      this.drawWaitingState(w, h);
      return;
    }

    const numPlayers = Math.max(1, engine.players.length);
    const bottomLyricsHeight = 110;
    const topMargin = 74;
    const availableHeight = h - topMargin - bottomLyricsHeight;

    const laneHeight = availableHeight / numPlayers;

    // Render stave lane for each player
    for (let i = 0; i < numPlayers; i++) {
      const laneY = topMargin + (i * laneHeight);
      this.renderStaveLane(engine.players[i], sentence, currentTime, laneY, w, laneHeight);
    }

    // Render Dual-Line Lyrics Box & Timeline Progress Bar
    this.renderLyricsBanner(sentence, nextSentence, currentTime, engine.soundPlayer, w, h, bottomLyricsHeight);
  }

  renderStaveLane(player, sentence, currentTime, laneY, w, laneHeight) {
    const ctx = this.ctx;
    const marginX = 110; // Left margin for player badge

    // Stave lane background
    ctx.fillStyle = this.colors.staveBg;
    ctx.fillRect(marginX - 10, laneY + 2, w - marginX, laneHeight - 4);

    // Stave vertical scaling
    const pitchPadding = 2;
    const minP = sentence.minPitch - pitchPadding;
    const maxP = sentence.maxPitch + pitchPadding;
    const pitchRange = Math.max(10, maxP - minP);

    const pitchToY = (pitch) => {
      const normalized = (pitch - minP) / pitchRange;
      return (laneY + laneHeight - 12) - (normalized * (laneHeight - 24));
    };

    // Viewport timing
    const viewStartTime = sentence.startTime - 0.4;
    const viewEndTime = sentence.endTime + 0.6;
    const viewDuration = Math.max(1, viewEndTime - viewStartTime);

    const timeToX = (time) => {
      const normalized = (time - viewStartTime) / viewDuration;
      return marginX + (normalized * (w - marginX - 40));
    };

    // Stave lines
    ctx.strokeStyle = this.colors.gridLine;
    ctx.lineWidth = 1;
    for (let p = Math.floor(minP); p <= Math.ceil(maxP); p++) {
      const y = pitchToY(p);
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(w - 30, y);
      ctx.stroke();
    }

    // Player Badge on Left
    this.drawPlayerBadge(player, marginX - 95, laneY + (laneHeight / 2) - 20, laneHeight);

    // Pill-shaped Notes
    const noteHeight = Math.max(10, Math.min(18, (laneHeight / pitchRange) * 0.7));
    const pillRadius = noteHeight / 2;

    for (const note of sentence.notes) {
      const x1 = timeToX(note.startTime);
      const x2 = timeToX(note.endTime);
      const noteWidth = Math.max(noteHeight, x2 - x1);
      const y = pitchToY(note.pitch) - pillRadius;

      // Unsung note capsule
      ctx.fillStyle = note.type === 'golden' ? this.colors.goldenNote : player.profile.color;
      this.drawPill(ctx, x1, y, noteWidth, noteHeight, pillRadius);
      ctx.fill();

      // Border around note
      ctx.strokeStyle = this.colors.noteBorder;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Hit fill
      if (note.isHit) {
        const hitEndX = (currentTime >= note.endTime) ? (x1 + noteWidth) : Math.max(x1, timeToX(currentTime));
        const hitWidth = Math.min(noteWidth, Math.max(0, hitEndX - x1));
        if (hitWidth > 0) {
          ctx.save();
          this.drawPill(ctx, x1, y, noteWidth, noteHeight, pillRadius);
          ctx.clip();
          ctx.fillStyle = note.type === 'golden' ? this.colors.goldenHit : this.colors.noteHitFill;
          ctx.fillRect(x1, y, hitWidth, noteHeight);
          ctx.restore();
        }
      }

      // Golden Sparkles
      if (note.type === 'golden') {
        const count = Math.max(2, Math.floor(noteWidth / 22));
        for (let s = 0; s < count; s++) {
          const starX = x1 + (s + 0.5) * (noteWidth / count);
          const starY = y + pillRadius + Math.sin(this.sparkleTimer + s) * 2;
          this.drawSparkle(ctx, starX, starY, 4, 2);
        }
      }
    }

    // Player Voice Trail
    if (player.voiceHistory && player.voiceHistory.length > 1) {
      for (let i = 1; i < player.voiceHistory.length; i++) {
        const ptA = player.voiceHistory[i - 1];
        const ptB = player.voiceHistory[i];

        if (ptA.time >= viewStartTime && ptB.time <= viewEndTime) {
          const xA = timeToX(ptA.time);
          const yA = pitchToY(ptA.pitch);
          const xB = timeToX(ptB.time);
          const yB = pitchToY(ptB.pitch);

          ctx.strokeStyle = ptB.isHit ? '#10B981' : '#EF4444';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(xA, yA);
          ctx.lineTo(xB, yB);
          ctx.stroke();
        }
      }
    }

    // Playback Cursor Line
    const currentX = timeToX(currentTime);
    if (currentX >= marginX && currentX <= (w - 30)) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentX, laneY + 2);
      ctx.lineTo(currentX, laneY + laneHeight - 2);
      ctx.stroke();

      if (player.voiceHistory.length > 0) {
        const latest = player.voiceHistory[player.voiceHistory.length - 1];
        if (Math.abs(currentTime - latest.time) < 0.1) {
          ctx.fillStyle = latest.isHit ? '#10B981' : '#EF4444';
          ctx.beginPath();
          ctx.arc(currentX, pitchToY(latest.pitch), 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawPill(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arc(x + width - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + height);
    ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
  }

  drawSparkle(ctx, cx, cy, outerRadius, innerRadius) {
    ctx.fillStyle = this.colors.goldenSparkle;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const x1 = cx + Math.cos(angle) * outerRadius;
      const y1 = cy + Math.sin(angle) * outerRadius;
      const x2 = cx + Math.cos(angle + Math.PI / 4) * innerRadius;
      const y2 = cy + Math.sin(angle + Math.PI / 4) * innerRadius;
      if (i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawPlayerBadge(player, x, y, laneHeight) {
    const ctx = this.ctx;
    const badgeH = Math.min(42, laneHeight - 8);
    const badgeW = 74;

    ctx.fillStyle = player.profile.color;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, badgeW, badgeH, 6) : ctx.rect(x, y, badgeW, badgeH);
    ctx.fill();

    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`P${player.index + 1}`, x + 37, y + (badgeH / 2) - 2);

    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(player.profile.name.slice(0, 8), x + 37, y + (badgeH / 2) + 12);
  }

  renderLyricsBanner(sentence, nextSentence, currentTime, soundPlayer, w, h, boxHeight) {
    const ctx = this.ctx;
    const boxY = h - boxHeight - 12;
    const boxW = Math.min(1040, w - 48);
    const boxX = (w - boxW) / 2;

    ctx.fillStyle = this.colors.lyricsBoxBg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxHeight, 10) : ctx.rect(boxX, boxY, boxW, boxHeight);
    ctx.fill();
    ctx.strokeStyle = this.colors.lyricsBoxBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Line 1: Active Sentence
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    let totalText = sentence.notes.map(n => n.syllable).join('');
    let totalWidth = ctx.measureText(totalText).width;
    let startX = Math.max(boxX + 24, (w - totalWidth) / 2);

    let curX = startX;
    for (const note of sentence.notes) {
      const isCurrentlySinging = currentTime >= note.startTime && currentTime <= note.endTime;
      const isPast = currentTime > note.endTime;

      if (isCurrentlySinging) {
        ctx.fillStyle = this.colors.textActive;
      } else if (isPast) {
        ctx.fillStyle = this.colors.textPast;
      } else {
        ctx.fillStyle = this.colors.textFuture;
      }

      ctx.fillText(note.syllable, curX, boxY + 34);
      curX += ctx.measureText(note.syllable).width;
    }

    // Line 2: Next Sentence Preview
    if (nextSentence && nextSentence.notes.length > 0) {
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillStyle = this.colors.textNextSentence;
      ctx.textAlign = 'center';
      const nextText = nextSentence.notes.map(n => n.syllable).join('');
      ctx.fillText(nextText, w / 2, boxY + 68);
    }

    // Timeline Progress Bar
    const barMargin = 24;
    const barW = boxW - barMargin * 2;
    const barY = boxY + boxHeight - 16;
    const barH = 5;

    const duration = soundPlayer.getDuration() || 1;
    const progress = Math.min(1, Math.max(0, currentTime / duration));

    ctx.fillStyle = this.colors.progressBarBg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(boxX + barMargin, barY, barW, barH, 2) : ctx.rect(boxX + barMargin, barY, barW, barH);
    ctx.fill();

    ctx.fillStyle = this.colors.progressBarFill;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(boxX + barMargin, barY, barW * progress, barH, 2) : ctx.rect(boxX + barMargin, barY, barW * progress, barH);
    ctx.fill();

    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.fillText(this.formatTime(currentTime), boxX + barMargin, barY - 6);

    const remaining = Math.max(0, duration - currentTime);
    ctx.textAlign = 'right';
    ctx.fillText(`-${this.formatTime(remaining)}`, boxX + boxW - barMargin, barY - 6);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  drawWaitingState(w, h) {
    const ctx = this.ctx;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('Cargando partitura...', w / 2, h / 2);
  }
}
