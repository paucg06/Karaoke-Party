/**
 * Real-time Microphone Pitch Detector using Web Audio API and Autocorrelation.
 * Converts human voice pitch into UltraStar semitone values (-24 to +36 relative to C4).
 */

export class PitchDetector {
  constructor(options = {}) {
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.source = null;
    this.buffer = null;
    this.isRunning = false;

    // Configuration thresholds
    this.sampleRate = 44100;
    this.fftSize = 2048;
    this.minVolumeRms = options.minVolumeRms || 0.015; // Noise gate
    this.minFrequency = options.minFrequency || 70;    // ~D2 (Bass voice)
    this.maxFrequency = options.maxFrequency || 1100;  // ~C6 (High soprano)

    // Current detection frame state
    this.currentFrequency = 0;
    this.currentPitch = null;
    this.currentVolume = 0;
    this.isSinging = false;
  }

  /**
   * Request microphone permission and initialize audio pipeline.
   */
  async start() {
    if (this.isRunning) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.sampleRate = this.audioContext.sampleRate;
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;

      this.source.connect(this.analyser);
      this.buffer = new Float32Array(this.analyser.fftSize);
      this.isRunning = true;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (err) {
      this.isRunning = false;
      throw new Error(`Error al acceder al micrófono: ${err.message}`);
    }
  }

  /**
   * Stop microphone stream and close audio context.
   */
  stop() {
    this.isRunning = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Update detection for current frame. Call inside requestAnimationFrame loop.
   * @returns {Object} { frequency, pitch, volume, isSinging }
   */
  update() {
    if (!this.isRunning || !this.analyser) {
      return { frequency: 0, pitch: null, volume: 0, isSinging: false };
    }

    this.analyser.getFloatTimeDomainData(this.buffer);

    // 1. Calculate Root-Mean-Square (RMS) volume for noise gate
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSquares += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sumSquares / this.buffer.length);
    this.currentVolume = Math.min(1, rms * 8);

    if (rms < this.minVolumeRms) {
      this.currentFrequency = 0;
      this.currentPitch = null;
      this.isSinging = false;
      return { frequency: 0, pitch: null, volume: this.currentVolume, isSinging: false };
    }

    // 2. Autocorrelation algorithm with parabolic interpolation
    const frequency = this.detectPitchAutocorrelation(this.buffer, this.sampleRate);

    if (frequency >= this.minFrequency && frequency <= this.maxFrequency) {
      this.currentFrequency = frequency;
      this.currentPitch = PitchDetector.frequencyToSemitone(frequency);
      this.isSinging = true;
    } else {
      this.currentFrequency = 0;
      this.currentPitch = null;
      this.isSinging = false;
    }

    return {
      frequency: this.currentFrequency,
      pitch: this.currentPitch,
      volume: this.currentVolume,
      isSinging: this.isSinging
    };
  }

  /**
   * Autocorrelation with peak finding.
   */
  detectPitchAutocorrelation(buffer, sampleRate) {
    const size = buffer.length;
    const maxLag = Math.floor(sampleRate / this.minFrequency);
    const minLag = Math.floor(sampleRate / this.maxFrequency);

    let maxCorrelation = 0;
    let bestLag = -1;

    // Normalizing factor
    let sumSq = 0;
    for (let i = 0; i < size; i++) {
      sumSq += buffer[i] * buffer[i];
    }
    if (sumSq < 0.0001) return -1;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < size - lag; i++) {
        correlation += buffer[i] * buffer[i + lag];
      }
      correlation = correlation / sumSq;

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestLag = lag;
      }
    }

    // Correlation threshold to filter out random unvoiced noise
    if (maxCorrelation > 0.45 && bestLag > 0) {
      // Parabolic interpolation around peak for microtonal precision
      const prev = this.computeCorrelationAtLag(buffer, bestLag - 1, sumSq);
      const next = this.computeCorrelationAtLag(buffer, bestLag + 1, sumSq);
      const delta = (next - prev) / (2 * (2 * maxCorrelation - prev - next));
      const trueLag = bestLag + (isFinite(delta) ? delta : 0);

      return sampleRate / trueLag;
    }

    return -1;
  }

  computeCorrelationAtLag(buffer, lag, sumSq) {
    if (lag <= 0 || lag >= buffer.length) return 0;
    let correlation = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      correlation += buffer[i] * buffer[i + lag];
    }
    return correlation / sumSq;
  }

  /**
   * Convert frequency in Hz to UltraStar semitone relative to C4 (MIDI 60).
   * C4 = 261.6256 Hz -> semitone = 0.
   */
  static frequencyToSemitone(frequency) {
    if (!frequency || frequency <= 0) return 0;
    // MIDI Note = 69 + 12 * log2(freq / 440)
    const midiNote = 69 + 12 * (Math.log2(frequency / 440));
    // UltraStar pitch = MIDI Note - 60 (Middle C)
    return midiNote - 60;
  }

  /**
   * Check if a sung pitch matches a target note, with octave tolerance.
   * In Vocaluxe, singing 1 octave higher or lower is accepted with full or high score.
   */
  static isPitchMatch(sungPitch, targetPitch, tolerance = 1.2) {
    if (sungPitch === null || targetPitch === null) return false;

    const diff = Math.abs(sungPitch - targetPitch);
    if (diff <= tolerance) return true;

    // Check octave transposition (-1, +1, -2, +2 octaves)
    for (let octave of [-12, 12, -24, 24]) {
      if (Math.abs(sungPitch - (targetPitch + octave)) <= tolerance) {
        return true;
      }
    }

    return false;
  }
}
