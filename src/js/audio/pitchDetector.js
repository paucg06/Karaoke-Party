/**
 * Multi-Player Real-time Microphone Pitch Detector.
 * Supports stereo channel splitting (e.g., dual SingStar USB mics / dual channel karaoke mics)
 * and independent pitch analysis per player with octave folding and noise gate.
 */

export class PitchDetector {
  constructor(options = {}) {
    this.audioContext = null;
    this.mediaStream = null;
    this.source = null;
    this.splitter = null;
    this.analysers = [];
    this.buffers = [];
    this.isRunning = false;

    // Configuration thresholds
    this.sampleRate = 44100;
    this.fftSize = 2048;
    this.minVolumeRms = options.minVolumeRms || 0.015;
    this.minFrequency = options.minFrequency || 70;
    this.maxFrequency = options.maxFrequency || 1100;

    // Multi-player state array (up to 2 audio channels)
    this.playersState = [
      { frequency: 0, pitch: null, volume: 0, isSinging: false },
      { frequency: 0, pitch: null, volume: 0, isSinging: false }
    ];
  }

  /**
   * Request microphone permission and initialize stereo multi-channel audio pipeline.
   */
  async start() {
    if (this.isRunning) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 2, // Request stereo if available (SingStar dual mics)
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.sampleRate = this.audioContext.sampleRate;
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Stereo channel splitter
      this.splitter = this.audioContext.createChannelSplitter(2);
      this.source.connect(this.splitter);

      // Create 2 analysers (one for Channel 0 / Left, one for Channel 1 / Right)
      this.analysers = [
        this.audioContext.createAnalyser(),
        this.audioContext.createAnalyser()
      ];
      this.analysers[0].fftSize = this.fftSize;
      this.analysers[1].fftSize = this.fftSize;

      this.splitter.connect(this.analysers[0], 0);
      
      // If mic has 2 physical channels, connect channel 1 to analyser 1; otherwise connect channel 0 to both
      const channelCount = this.source.channelCount || 1;
      if (channelCount >= 2) {
        this.splitter.connect(this.analysers[1], 1);
      } else {
        this.splitter.connect(this.analysers[1], 0);
      }

      this.buffers = [
        new Float32Array(this.fftSize),
        new Float32Array(this.fftSize)
      ];

      this.isRunning = true;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (err) {
      this.isRunning = false;
      throw new Error(`Error al acceder al micrófono: ${err.message}`);
    }
  }

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
   * Update and return pitch analysis for a specific audio channel (0 or 1).
   */
  update(channelIndex = 0) {
    const idx = channelIndex % 2;
    if (!this.isRunning || !this.analysers[idx]) {
      return { frequency: 0, pitch: null, volume: 0, isSinging: false };
    }

    const analyser = this.analysers[idx];
    const buffer = this.buffers[idx];
    analyser.getFloatTimeDomainData(buffer);

    // 1. RMS Volume
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSquares / buffer.length);
    const volume = Math.min(1, rms * 8);

    if (rms < this.minVolumeRms) {
      this.playersState[idx] = { frequency: 0, pitch: null, volume, isSinging: false };
      return this.playersState[idx];
    }

    // 2. Autocorrelation Pitch Detection
    const frequency = this.detectPitchAutocorrelation(buffer, this.sampleRate);

    if (frequency >= this.minFrequency && frequency <= this.maxFrequency) {
      const pitch = PitchDetector.frequencyToSemitone(frequency);
      this.playersState[idx] = { frequency, pitch, volume, isSinging: true };
    } else {
      this.playersState[idx] = { frequency: 0, pitch: null, volume, isSinging: false };
    }

    return this.playersState[idx];
  }

  detectPitchAutocorrelation(buffer, sampleRate) {
    const size = buffer.length;
    const maxLag = Math.floor(sampleRate / this.minFrequency);
    const minLag = Math.floor(sampleRate / this.maxFrequency);

    // 1. Normalized Square Difference Function (NSDF)
    const nsdf = new Float32Array(maxLag + 2);

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum1 = 0;
      let sum2 = 0;
      let corr = 0;
      for (let i = 0; i < size - lag; i++) {
        corr += buffer[i] * buffer[i + lag];
        sum1 += buffer[i] * buffer[i];
        sum2 += buffer[i + lag] * buffer[i + lag];
      }
      const norm = Math.sqrt(sum1 * sum2);
      if (norm > 0.0001) {
        nsdf[lag] = (2 * corr) / (sum1 + sum2);
      } else {
        nsdf[lag] = 0;
      }
    }

    // 2. Find local maxima (peaks)
    const peaks = [];
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1] && nsdf[lag] > 0.4) {
        peaks.push({ lag, value: nsdf[lag] });
      }
    }

    if (peaks.length === 0) return -1;

    // 3. Find global maximum peak
    let maxPeakVal = 0;
    for (const p of peaks) {
      if (p.value > maxPeakVal) maxPeakVal = p.value;
    }

    if (maxPeakVal < 0.45) return -1;

    // 4. MPM First-Peak Picking: eliminates octave doubling/halving
    const threshold = maxPeakVal * 0.80;
    let chosenPeak = null;
    for (const p of peaks) {
      if (p.value >= threshold) {
        chosenPeak = p;
        break;
      }
    }

    if (!chosenPeak) chosenPeak = peaks[0];

    const bestLag = chosenPeak.lag;

    // 5. 3-point parabolic interpolation for sub-cent precision
    const prev = nsdf[bestLag - 1];
    const curr = nsdf[bestLag];
    const next = nsdf[bestLag + 1];

    const denom = 2 * (2 * curr - prev - next);
    const delta = denom !== 0 ? (next - prev) / denom : 0;
    const trueLag = bestLag + (isFinite(delta) && Math.abs(delta) < 1 ? delta : 0);

    return sampleRate / trueLag;
  }

  computeCorrelationAtLag(buffer, lag, sumSq) {
    if (lag <= 0 || lag >= buffer.length) return 0;
    let correlation = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      correlation += buffer[i] * buffer[i + lag];
    }
    return correlation / sumSq;
  }

  static frequencyToSemitone(frequency) {
    if (!frequency || frequency <= 0) return 0;
    const midiNote = 69 + 12 * (Math.log2(frequency / 440));
    return midiNote - 60;
  }

  static getPitchDifference(sungPitch, targetPitch) {
    if (sungPitch === null || targetPitch === null) return Infinity;
    // Circular semitone difference across all octaves (modulo 12)
    let diff = Math.abs(sungPitch - targetPitch) % 12;
    if (diff > 6) diff = 12 - diff;
    return diff;
  }

  static isPitchMatch(sungPitch, targetPitch, tolerance = 1.5) {
    const diff = PitchDetector.getPitchDifference(sungPitch, targetPitch);
    return diff <= tolerance;
  }
}
