/**
 * McLeod Pitch Method / YIN First-Peak Autocorrelation Test.
 */

function detectFrequency(buf, sampleRate) {
  const size = buf.length;
  const maxLag = Math.floor(sampleRate / 70);   // ~630 samples (70 Hz)
  const minLag = Math.floor(sampleRate / 1100); // ~40 samples (1100 Hz)

  // 1. Calculate Normalized Square Difference / Autocorrelation
  const nsdf = new Float32Array(maxLag + 2);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum1 = 0;
    let sum2 = 0;
    let corr = 0;
    for (let i = 0; i < size - lag; i++) {
      corr += buf[i] * buf[i + lag];
      sum1 += buf[i] * buf[i];
      sum2 += buf[i + lag] * buf[i + lag];
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

  // 3. Find highest peak value
  let maxPeakVal = 0;
  for (const p of peaks) {
    if (p.value > maxPeakVal) maxPeakVal = p.value;
  }

  if (maxPeakVal < 0.45) return -1;

  // 4. FIRST PEAK PICKING (MPM standard):
  // Pick the FIRST peak that has at least 80% of the maximum peak amplitude.
  // This eliminates octave halving / subharmonic detection!
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

  // 5. Parabolic Interpolation on chosen peak
  const prev = nsdf[bestLag - 1];
  const curr = nsdf[bestLag];
  const next = nsdf[bestLag + 1];

  const denom = 2 * (2 * curr - prev - next);
  const delta = denom !== 0 ? (next - prev) / denom : 0;
  const trueLag = bestLag + (isFinite(delta) && Math.abs(delta) < 1 ? delta : 0);

  return sampleRate / trueLag;
}

function freqToSemitone(freq) {
  if (freq <= 0) return null;
  return 69 + 12 * Math.log2(freq / 440) - 60;
}

function generateSine(freq, sampleRate = 44100, length = 2048) {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

console.log('=== TEST SUITE: MPM FIRST-PEAK DETECTION ===\n');

const testCases = [
  { name: 'A4 (Standard 440 Hz -> Pitch 9)', freq: 440, expectedPitch: 9 },
  { name: 'C4 (Middle C 261.63 Hz -> Pitch 0)', freq: 261.63, expectedPitch: 0 },
  { name: 'E4 (329.63 Hz -> Pitch 4)', freq: 329.63, expectedPitch: 4 },
  { name: 'B4 (493.88 Hz -> Pitch 11)', freq: 493.88, expectedPitch: 11 },
  { name: 'A3 (220 Hz -> Pitch -3, Octave lower)', freq: 220, expectedPitch: -3 },
  { name: 'C3 (130.81 Hz -> Pitch -12, Male Low)', freq: 130.81, expectedPitch: -12 },
  { name: 'E3 (164.81 Hz -> Pitch -8)', freq: 164.81, expectedPitch: -8 },
  { name: 'G4 (392.00 Hz -> Pitch 7)', freq: 392.00, expectedPitch: 7 },
  { name: 'F5 (698.46 Hz -> Pitch 17, Female High)', freq: 698.46, expectedPitch: 17 }
];

let allPassed = true;

for (const tc of testCases) {
  const buf = generateSine(tc.freq);
  const detectedFreq = detectFrequency(buf, 44100);
  const detectedPitch = freqToSemitone(detectedFreq);
  const pitchErr = Math.abs(detectedPitch - tc.expectedPitch);
  const freqErr = Math.abs(detectedFreq - tc.freq);

  const passed = pitchErr < 0.15;
  if (!passed) allPassed = false;

  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${tc.name}`);
  console.log(`  -> Frecuencia detectada: ${detectedFreq.toFixed(2)} Hz (Error: ${freqErr.toFixed(2)} Hz)`);
  console.log(`  -> Tono semitono: ${detectedPitch.toFixed(2)} (Esperado: ${tc.expectedPitch})\n`);
}

console.log(`Resultado final: ${allPassed ? 'TODOS LOS TESTS HAN PASADO CON ÉXITO (100% PRECISIÓN)' : 'FALLOS DETECTADOS'}`);
