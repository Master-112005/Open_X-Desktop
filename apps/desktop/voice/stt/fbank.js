const SAMPLE_RATE = 16000;
const FRAME_LENGTH_MS = 25;
const FRAME_SHIFT_MS = 10;
const PREEMPH_COEFF = 0.97;
const LOG_FLOOR = 1e-10;

const FRAME_LENGTH = Math.round((SAMPLE_RATE * FRAME_LENGTH_MS) / 1000);
const FRAME_SHIFT = Math.round((SAMPLE_RATE * FRAME_SHIFT_MS) / 1000);
const FFT_SIZE = nextPowerOfTwo(FRAME_LENGTH);

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function hzToMel(hz) {
  const fMin = 0;
  const fSp = 200 / 3;
  const minLogHz = 1000;
  const minLogMel = (minLogHz - fMin) / fSp;
  const logstep = Math.log(6.4) / 27;
  if (hz >= minLogHz) return minLogMel + Math.log(hz / minLogHz) / logstep;
  return (hz - fMin) / fSp;
}

function melToHz(mel) {
  const fMin = 0;
  const fSp = 200 / 3;
  const minLogHz = 1000;
  const minLogMel = (minLogHz - fMin) / fSp;
  const logstep = Math.log(6.4) / 27;
  if (mel >= minLogMel) return minLogHz * Math.exp(logstep * (mel - minLogMel));
  return fMin + fSp * mel;
}

function buildMelFilterbank(numBins, fftSize, sampleRate) {
  const numFftBins = fftSize / 2 + 1;
  const melMin = hzToMel(0);
  const melMax = hzToMel(sampleRate / 2);
  const melPoints = new Float64Array(numBins + 2);
  for (let i = 0; i < melPoints.length; i += 1) {
    melPoints[i] = melMin + ((melMax - melMin) * i) / (numBins + 1);
  }
  const hzPoints = Float64Array.from(melPoints, melToHz);
  const fftFreqs = new Float64Array(numFftBins);
  for (let i = 0; i < numFftBins; i += 1) fftFreqs[i] = (i * sampleRate) / fftSize;

  const filters = [];
  for (let i = 0; i < numBins; i += 1) {
    const left = hzPoints[i];
    const center = hzPoints[i + 1];
    const right = hzPoints[i + 2];
    const enorm = 2.0 / (right - left);
    const filter = new Float64Array(numFftBins);
    for (let j = 0; j < numFftBins; j += 1) {
      const frequency = fftFreqs[j];
      let weight = 0;
      if (frequency >= left && frequency <= center && center > left) {
        weight = (frequency - left) / (center - left);
      } else if (frequency > center && frequency <= right && right > center) {
        weight = (right - frequency) / (right - center);
      }
      filter[j] = weight * enorm;
    }
    filters.push(filter);
  }
  return filters;
}

function hannWindow(length) {
  const window = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
  }
  return window;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const nextRe = re[i];
      const nextIm = im[i];
      re[i] = re[j];
      im[i] = im[j];
      re[j] = nextRe;
      im[j] = nextIm;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

class LogMelFeatureExtractor {
  constructor(numBins = 128) {
    this.numBins = numBins;
    this.window = hannWindow(FRAME_LENGTH);
    this.filterbank = buildMelFilterbank(numBins, FFT_SIZE, SAMPLE_RATE);
  }

  get featureDim() {
    return this.numBins;
  }

  compute(samples) {
    const numFrames = samples.length >= FRAME_LENGTH
      ? 1 + Math.floor((samples.length - FRAME_LENGTH) / FRAME_SHIFT)
      : 0;
    const features = new Float32Array(numFrames * this.numBins);
    const re = new Float64Array(FFT_SIZE);
    const im = new Float64Array(FFT_SIZE);

    for (let t = 0; t < numFrames; t += 1) {
      const start = t * FRAME_SHIFT;
      re.fill(0);
      im.fill(0);
      for (let i = 0; i < FRAME_LENGTH; i += 1) {
        const sampleIdx = start + i;
        const prev = sampleIdx === 0 ? samples[0] : samples[sampleIdx - 1];
        re[i] = (samples[sampleIdx] - PREEMPH_COEFF * prev) * this.window[i];
      }
      fft(re, im);
      const numFftBins = FFT_SIZE / 2 + 1;
      const power = new Float64Array(numFftBins);
      for (let i = 0; i < numFftBins; i += 1) power[i] = re[i] * re[i] + im[i] * im[i];
      for (let bin = 0; bin < this.numBins; bin += 1) {
        const filter = this.filterbank[bin];
        let energy = 0;
        for (let i = 0; i < numFftBins; i += 1) energy += filter[i] * power[i];
        features[t * this.numBins + bin] = Math.log(Math.max(energy, LOG_FLOOR));
      }
    }

    return { features, numFrames };
  }
}

function normalizePerFeature(features, numFrames, numBins) {
  if (numFrames === 0) return features;
  const mean = new Float64Array(numBins);
  for (let t = 0; t < numFrames; t += 1) {
    for (let b = 0; b < numBins; b += 1) mean[b] += features[t * numBins + b];
  }
  for (let b = 0; b < numBins; b += 1) mean[b] /= numFrames;

  const variance = new Float64Array(numBins);
  for (let t = 0; t < numFrames; t += 1) {
    for (let b = 0; b < numBins; b += 1) {
      const delta = features[t * numBins + b] - mean[b];
      variance[b] += delta * delta;
    }
  }

  const normalized = new Float32Array(features.length);
  for (let b = 0; b < numBins; b += 1) {
    const std = Math.sqrt(variance[b] / numFrames) + 1e-5;
    for (let t = 0; t < numFrames; t += 1) {
      const idx = t * numBins + b;
      normalized[idx] = (features[idx] - mean[b]) / std;
    }
  }
  return normalized;
}

module.exports = {
  LogMelFeatureExtractor,
  PARAKEET_SAMPLE_RATE: SAMPLE_RATE,
  normalizePerFeature
};
