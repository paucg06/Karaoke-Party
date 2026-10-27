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
    const bottomLyricsHeight = 118;
    const topMargin = 20; // Expanded singing canvas by removing top HUD
    const availableHeight = h - topMargin - bottomLyricsHeight - 16;

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
    const rightPanelWidth = 148; // Right margin for dedicated player score & multipliers
    const staveEndX = w - rightPanelWidth - 22;

    // Stave lane background
    ctx.fillStyle = this.colors.staveBg;
    ctx.fillRect(marginX - 10, laneY + 2, staveEndX - marginX + 10, laneHeight - 4);

    // Stave vertical scaling with strict bounding inside player stave
    const pitchPadding = 2;
    const minP = sentence.minPitch - pitchPadding;
    const maxP = sentence.maxPitch + pitchPadding;
    const pitchRange = Math.max(10, maxP - minP);

    const minY = laneY + 12;
    const maxY = laneY + laneHeight - 12;

    const foldPitchToSentence = (pitch) => {
      if (pitch === null || !isFinite(pitch)) return null;
      let p = pitch;
      while (p < minP - 2) p += 12;
      while (p > maxP + 2) p -= 12;
      return p;
    };

    const pitchToY = (pitch) => {
      const normalized = (pitch - minP) / pitchRange;
      const calculatedY = maxY - (normalized * (laneHeight - 24));
      return Math.max(minY, Math.min(maxY, calculatedY));
    };

    // Viewport timing
    const viewStartTime = sentence.startTime - 0.4;
    const viewEndTime = sentence.endTime + 0.6;
    const viewDuration = Math.max(1, viewEndTime - viewStartTime);

    const timeToX = (time) => {
      const normalized = (time - viewStartTime) / viewDuration;
      return marginX + (normalized * (staveEndX - marginX - 20));
    };

    // Stave lines
    ctx.strokeStyle = this.colors.gridLine;
    ctx.lineWidth = 1;
    for (let p = Math.floor(minP); p <= Math.ceil(maxP); p++) {
      const y = pitchToY(p);
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(staveEndX, y);
      ctx.stroke();
    }

    // Player Badge on Left
    this.drawPlayerBadge(player, marginX - 95, laneY + (laneHeight / 2) - 18, laneHeight);

    // Player Dedicated Score & Dynamic Feedback Panel on Right
    this.drawPlayerScorePanel(player, staveEndX + 12, laneY + (laneHeight / 2) - 28, rightPanelWidth, laneHeight);

    // Pill-shaped Notes
    const noteHeight = Math.max(10, Math.min(18, (laneHeight / pitchRange) * 0.7));
    const pillRadius = noteHeight / 2;

    for (const note of sentence.notes) {
      const x1 = timeToX(note.startTime);
      const x2 = timeToX(note.endTime);
      const noteWidth = Math.max(noteHeight, x2 - x1);
      const rawY = pitchToY(note.pitch) - pillRadius;
      const y = Math.max(laneY + 4, Math.min(laneY + laneHeight - noteHeight - 4, rawY));

      // Unsung note capsule
      ctx.fillStyle = note.type === 'golden' ? this.colors.goldenNote : player.profile.color;
      this.drawPill(ctx, x1, y, noteWidth, noteHeight, pillRadius);
      ctx.fill();

      // Border around note
      ctx.strokeStyle = this.colors.noteBorder;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Hit fill: INDEPENDENT FOR THIS SPECIFIC PLAYER
      const playerHitSecs = player.notesHit ? (player.notesHit.get(note.index) || 0) : 0;
      if (playerHitSecs > 0) {
        const hitRatio = Math.min(1, playerHitSecs / Math.max(0.08, note.durationTime));
        const hitWidth = noteWidth * hitRatio;
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
          const yA = pitchToY(foldPitchToSentence(ptA.pitch));
          const xB = timeToX(ptB.time);
          const yB = pitchToY(foldPitchToSentence(ptB.pitch));

          // Smooth out vertical jumps when switching registers
          if (Math.abs(yA - yB) < (laneHeight * 0.7)) {
            ctx.strokeStyle = ptB.isHit ? '#10B981' : '#EF4444';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(xA, yA);
            ctx.lineTo(xB, yB);
            ctx.stroke();
          }
        }
      }
    }

    // Playback Cursor Line
    const currentX = timeToX(currentTime);
    if (currentX >= marginX && currentX <= staveEndX) {
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
          ctx.arc(currentX, pitchToY(foldPitchToSentence(latest.pitch)), 6, 0, Math.PI * 2);
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
    const badgeH = Math.min(38, laneHeight - 12);
    const badgeW = 76;

    ctx.fillStyle = player.profile.color;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y + 4, badgeW, badgeH, 6) : ctx.rect(x, y + 4, badgeW, badgeH);
    ctx.fill();

    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.profile.name.slice(0, 9), x + (badgeW / 2), y + 4 + (badgeH / 2));
  }

  drawPlayerScorePanel(player, x, y, width, laneHeight) {
    const ctx = this.ctx;
    const panelH = Math.min(60, laneHeight - 10);
    const panelW = width;
    const panelY = y;

    // Background card with player color border
    ctx.fillStyle = 'rgba(7, 11, 20, 0.92)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, panelY, panelW, panelH, 8) : ctx.rect(x, panelY, panelW, panelH);
    ctx.fill();

    ctx.strokeStyle = player.profile.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Score digits in player's color
    const scoreStr = Math.floor(player.score).toString().padStart(5, '0');
    ctx.font = '800 21px monospace, system-ui, sans-serif';
    ctx.fillStyle = player.profile.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(scoreStr, x + 10, panelY + 8);

    // Multiplier if active combo
    if (player.combo > 1) {
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillStyle = '#F59E0B'; // Vivid gold
      ctx.textAlign = 'right';
      ctx.fillText(`x${player.combo}`, x + panelW - 10, panelY + 12);
    }

    // Dynamic Pop-up Feedback (Just Dance style)
    if (player.currentFeedback && Date.now() < player.feedbackTimer) {
      const fb = player.currentFeedback;
      let badgeBg = '#10B981'; // Emerald for PERFECTO
      let badgeColor = '#FFFFFF';

      if (fb === 'GENIAL') {
        badgeBg = '#0284C7'; // Sky blue
      } else if (fb === 'BIEN') {
        badgeBg = '#6366F1'; // Indigo
      } else if (fb === 'AFINA') {
        badgeBg = '#1E293B';
        badgeColor = '#F59E0B';
      }

      const badgeX = x + 10;
      const badgeY = panelY + 34;
      const badgeW = panelW - 20;
      const badgeH = 18;

      ctx.fillStyle = badgeBg;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4) : ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fill();

      ctx.font = '800 11px system-ui, sans-serif';
      ctx.fillStyle = badgeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fb, badgeX + (badgeW / 2), badgeY + (badgeH / 2));
    } else {
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('PUNTOS', x + 10, panelY + 42);
    }
  }

  renderLyricsBanner(sentence, nextSentence, currentTime, soundPlayer, w, h, boxHeight) {
    const ctx = this.ctx;
    const boxY = h - boxHeight - 14;
    const boxW = Math.min(860, Math.max(500, w - 380));
    const boxX = (w - boxW) / 2;

    ctx.fillStyle = this.colors.lyricsBoxBg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxHeight, 10) : ctx.rect(boxX, boxY, boxW, boxHeight);
    ctx.fill();
    ctx.strokeStyle = this.colors.lyricsBoxBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Line 1: Active Sentence (Large font 30px for TV readability)
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.textAlign = 'left';
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

      ctx.fillText(note.syllable, curX, boxY + 36);
      curX += ctx.measureText(note.syllable).width;
    }

    // Line 2: Next Sentence Preview (17px)
    if (nextSentence && nextSentence.notes.length > 0) {
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillStyle = this.colors.textNextSentence;
      ctx.textAlign = 'center';
      const nextText = nextSentence.notes.map(n => n.syllable).join('');
      ctx.fillText(nextText, w / 2, boxY + 74);
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
