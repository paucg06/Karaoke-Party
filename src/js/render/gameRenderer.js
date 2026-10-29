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

    // Detect leader in multi-player matches (minimum 500 points required)
    let leaderIdx = -1;
    let maxScore = 500;
    if (numPlayers > 1) {
      for (let i = 0; i < numPlayers; i++) {
        if (engine.players[i].score > maxScore) {
          maxScore = engine.players[i].score;
          leaderIdx = i;
        }
      }
    }

    // Render stave lane for each player
    for (let i = 0; i < numPlayers; i++) {
      const laneY = topMargin + (i * laneHeight);
      const isLeader = (i === leaderIdx);
      this.renderStaveLane(engine.players[i], sentence, currentTime, laneY, w, laneHeight, isLeader);
    }

    // Render Dual-Line Lyrics Box & Timeline Progress Bar
    this.renderLyricsBanner(engine, sentence, nextSentence, currentTime, engine.soundPlayer, w, h, bottomLyricsHeight);
  }

  renderStaveLane(player, sentence, currentTime, laneY, w, laneHeight, isLeader = false) {
    const ctx = this.ctx;
    const marginX = 110; // Left margin for player badge
    const rightPanelWidth = 220; // Dedicated area for large Just Dance style score & feedback
    const staveEndX = w - rightPanelWidth - 25;

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

    // Player Dedicated Score & Dynamic Feedback Panel on Right (Vertically Centered)
    this.drawPlayerScorePanel(player, staveEndX + 10, laneY, rightPanelWidth, laneHeight, isLeader);

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

  drawCrown(ctx, cx, cy, size) {
    ctx.save();
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const w = size;
    const h = size * 0.65;
    const left = cx - w / 2;
    const bottom = cy + h / 2;
    const top = cy - h / 2;
    ctx.moveTo(left, bottom);
    ctx.lineTo(left + w, bottom);
    ctx.lineTo(left + w * 0.95, top + h * 0.25);
    ctx.lineTo(left + w * 0.72, top + h * 0.65);
    ctx.lineTo(left + w * 0.5, top);
    ctx.lineTo(left + w * 0.28, top + h * 0.65);
    ctx.lineTo(left + w * 0.05, top + h * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3 Jewels on crown tips
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(left + w * 0.5, top + 2, 2, 0, Math.PI * 2);
    ctx.arc(left + w * 0.05, top + h * 0.25 + 1, 1.8, 0, Math.PI * 2);
    ctx.arc(left + w * 0.95, top + h * 0.25 + 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayerScorePanel(player, x, laneY, width, laneHeight, isLeader = false) {
    const ctx = this.ctx;
    const centerX = x + (width / 2);
    const centerY = laneY + (laneHeight / 2);

    // Responsive scaling based on lane height (adapts gracefully from 1 to 4 players)
    const scale = Math.min(1.15, Math.max(0.65, laneHeight / 240));
    const scoreFontSize = Math.round(52 * scale);
    const ratingFontSize = Math.round(36 * scale);
    const comboFontSize = Math.round(28 * scale);

    // 1. Dynamic Pop-up Animation with Spring Bounce Curve
    const isFeedbackActive = player.currentFeedback && Date.now() < player.feedbackTimer;
    let popScale = 1.0;
    let floatY = 0;

    if (isFeedbackActive) {
      const timeLeft = Math.max(0, player.feedbackTimer - Date.now());
      const progress = 1 - (timeLeft / 600); // 0 (start) to 1 (end)

      // Spring bounce / squash & stretch curve
      if (progress < 0.25) {
        popScale = 1.0 + Math.sin((progress / 0.25) * Math.PI) * 0.28;
      } else {
        popScale = 1.0 + Math.sin(progress * Math.PI) * 0.08;
      }
      floatY = -Math.sin(progress * Math.PI * 0.5) * 6 * scale;

      // Floating dynamic star sparkles on PERFECT or SUPER
      if (player.currentFeedback === 'PERFECT' || player.currentFeedback === 'SUPER') {
        const sparkleDist = 48 * scale * (0.6 + progress * 0.7);
        for (let s = 0; s < 4; s++) {
          const angle = (s * Math.PI / 2) + (Date.now() / 900);
          const sx = centerX + Math.cos(angle) * sparkleDist;
          const sy = centerY + (8 * scale) + floatY + Math.sin(angle) * (sparkleDist * 0.6);
          this.drawSparkle(ctx, sx, sy, 4.5 * scale, 2.2 * scale);
        }
      }
    }

    // 2. Leader Floating Crown (for 1st place in multi-player matches)
    if (isLeader) {
      const crownY = centerY - (58 * scale) + Math.sin(this.sparkleTimer * 2) * 2;
      this.drawCrown(ctx, centerX, crownY, 26 * scale);
    }

    // 3. Large Score Numbers: Clean, crisp, solid player color (NO black stroke outline)
    const scoreStr = Math.floor(player.score).toString().padStart(6, '0');
    ctx.font = `900 ${scoreFontSize}px monospace, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = player.profile.color;
    ctx.fillText(scoreStr, centerX, centerY - (32 * scale));

    // 4. Just Dance 5-Star Energy Bar (1 star per 20,000 pts)
    const starsCount = Math.min(5, Math.floor(player.score / 20000));
    const starSpacing = 16 * scale;
    const startX = centerX - (2 * starSpacing);
    const starY = centerY - (8 * scale);

    for (let s = 0; s < 5; s++) {
      const isFilled = s < starsCount;
      ctx.fillStyle = isFilled ? '#FACC15' : '#1E293B';
      this.drawSparkle(ctx, startX + s * starSpacing, starY, 6 * scale, 3 * scale);
    }

    // 5. Just Dance Rating Banner (PERFECT, SUPER, GOOD, OK) with animated pop-up
    if (isFeedbackActive) {
      const fb = player.currentFeedback;
      let ratingFill = '#00F0FF';
      let ratingStroke = '#083344';

      if (fb === 'SUPER') {
        ratingFill = '#38BDF8';
        ratingStroke = '#0C4A6E';
      } else if (fb === 'GOOD') {
        ratingFill = '#FACC15';
        ratingStroke = '#713F12';
      } else if (fb === 'OK') {
        ratingFill = '#FB923C';
        ratingStroke = '#431407';
      }

      ctx.save();
      ctx.translate(centerX, centerY + (16 * scale) + floatY);
      ctx.scale(popScale, popScale);

      ctx.font = `900 ${ratingFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = ratingStroke;
      ctx.lineWidth = 4 * scale;
      ctx.lineJoin = 'round';
      ctx.strokeText(fb, 0, 0);

      ctx.fillStyle = ratingFill;
      ctx.fillText(fb, 0, 0);
      ctx.restore();
    }

    // 6. Large Multiplier with Cross (e.g. x64)
    if (player.combo > 1) {
      ctx.font = `900 ${comboFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#070B14';
      ctx.lineWidth = 4 * scale;
      ctx.lineJoin = 'round';
      ctx.strokeText('x' + player.combo, centerX, centerY + (48 * scale));

      ctx.fillStyle = '#F59E0B'; // Vivid Gold
      ctx.fillText('x' + player.combo, centerX, centerY + (48 * scale));
    }
  }

  renderLyricsBanner(engine, sentence, nextSentence, currentTime, soundPlayer, w, h, boxHeight) {
    const ctx = this.ctx;
    const boxY = h - boxHeight - 14;
    // Extended +20% horizontally to fit longer lyrics comfortably
    const boxW = Math.min(1100, Math.max(640, w - 240));
    const boxX = (w - boxW) / 2;

    ctx.fillStyle = this.colors.lyricsBoxBg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxHeight, 10) : ctx.rect(boxX, boxY, boxW, boxHeight);
    ctx.fill();
    ctx.strokeStyle = this.colors.lyricsBoxBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Line 1: Active Sentence with auto-fit prevention of text overflow
    let totalText = sentence.notes.map(n => n.syllable).join('');
    const maxTextWidth = boxW - 56;
    let activeFontSize = 28;
    ctx.font = `800 ${activeFontSize}px system-ui, sans-serif`;
    let totalWidth = ctx.measureText(totalText).width;

    if (totalWidth > maxTextWidth) {
      activeFontSize = Math.max(18, Math.floor(activeFontSize * (maxTextWidth / totalWidth)));
      ctx.font = `800 ${activeFontSize}px system-ui, sans-serif`;
      totalWidth = ctx.measureText(totalText).width;
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let startX = Math.max(boxX + 28, (w - totalWidth) / 2);

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

    // Line 2: Next Sentence Preview with auto-fit
    if (nextSentence && nextSentence.notes.length > 0) {
      let nextText = nextSentence.notes.map(n => n.syllable).join('');
      let nextFontSize = 16;
      ctx.font = `600 ${nextFontSize}px system-ui, sans-serif`;
      let nextWidth = ctx.measureText(nextText).width;

      if (nextWidth > maxTextWidth) {
        nextFontSize = Math.max(13, Math.floor(nextFontSize * (maxTextWidth / nextWidth)));
        ctx.font = `600 ${nextFontSize}px system-ui, sans-serif`;
      }

      ctx.fillStyle = this.colors.textNextSentence;
      ctx.textAlign = 'center';
      ctx.fillText(nextText, w / 2, boxY + 74);
    }

    // Timeline Progress Bar
    const barMargin = 24;
    const barW = boxW - barMargin * 2;
    const barY = boxY + boxHeight - 16;
    const barH = 5;

    // Strict duration calculation:
    // When playing short/rapid version, duration is strictly cutOffTime so the bar completes at 100% when the song finishes.
    let duration = 0;
    if (engine?.song?.isShortVersion && engine?.song?.cutOffTime > 0) {
      duration = engine.song.cutOffTime;
    } else {
      duration = soundPlayer?.getDuration() || engine?.song?.durationSecs || 0;
      if (!duration && engine?.song?.notes?.length > 0) {
        duration = engine.song.notes[engine.song.notes.length - 1].endTime + 3;
      }
    }
    if (!duration || duration <= 0) duration = 1;

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

    ctx.textAlign = 'right';
    ctx.fillText(this.formatTime(duration), boxX + boxW - barMargin, barY - 6);
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
