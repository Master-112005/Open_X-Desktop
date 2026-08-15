const fs = require('fs');
const path = require('path');

function prependPathEntry(directory) {
  if (!directory || !fs.existsSync(directory)) return null;
  const currentPath = process.env.PATH || '';
  const entries = currentPath.split(path.delimiter).filter(Boolean);
  if (!entries.some(entry => entry.toLowerCase() === directory.toLowerCase())) {
    process.env.PATH = [directory, ...entries].join(path.delimiter);
  }
  return directory;
}

function resolveOnnxRuntimeNativePath() {
  const nativeRelativePath = path.join(
    'node_modules',
    'onnxruntime-node',
    'bin',
    'napi-v6',
    process.platform,
    process.arch
  );
  const candidates = [];
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', nativeRelativePath),
      path.join(process.resourcesPath, nativeRelativePath)
    );
  }
  candidates.push(path.resolve(__dirname, '..', '..', '..', '..', nativeRelativePath));

  const nativeDirectory = candidates.find(candidate => fs.existsSync(path.join(candidate, 'onnxruntime_binding.node')));
  return nativeDirectory || null;
}

function configureOnnxRuntimeNativePath() {
  return prependPathEntry(resolveOnnxRuntimeNativePath());
}

configureOnnxRuntimeNativePath();

const { InferenceSession, Tensor } = require('onnxruntime-node');
const { LogMelFeatureExtractor, PARAKEET_SAMPLE_RATE, normalizePerFeature } = require('./fbank');
const { readOnnxMetadataProps } = require('./onnx-metadata');
const { ParakeetTokenizer } = require('./tokenizer');

const MAX_TOKENS_PER_FRAME = 5;
const INTERACTIVE_SESSION_OPTIONS = Object.freeze({
  executionMode: 'sequential',
  intraOpNumThreads: Math.max(1, Math.min(2, Math.floor((require('os').cpus()?.length || 2) / 2) || 1)),
  interOpNumThreads: 1
});

class ParakeetEngine {
  constructor(encoder, decoder, joiner, tokenizer, featureExtractor, predRnnLayers, predHidden) {
    this.encoder = encoder;
    this.decoder = decoder;
    this.joiner = joiner;
    this.tokenizer = tokenizer;
    this.featureExtractor = featureExtractor;
    this.predRnnLayers = predRnnLayers;
    this.predHidden = predHidden;
  }

  static async create(modelsDir) {
    const encoderPath = path.join(modelsDir, 'encoder.int8.onnx');
    const decoderPath = path.join(modelsDir, 'decoder.int8.onnx');
    const joinerPath = path.join(modelsDir, 'joiner.int8.onnx');
    const tokensPath = path.join(modelsDir, 'tokens.txt');
    let encoder;
    let decoder;
    let joiner;
    try {
      [encoder, decoder, joiner] = await Promise.all([
        InferenceSession.create(encoderPath, INTERACTIVE_SESSION_OPTIONS),
        InferenceSession.create(decoderPath, INTERACTIVE_SESSION_OPTIONS),
        InferenceSession.create(joinerPath, INTERACTIVE_SESSION_OPTIONS)
      ]);
    } catch (error) {
      error.code = error.code || 'voice_onnx_session_failed';
      error.details = {
        modelsDir,
        nativeRuntimeDir: resolveOnnxRuntimeNativePath(),
        encoderPath,
        decoderPath,
        joinerPath,
        tokensPath
      };
      throw error;
    }
    const meta = readOnnxMetadataProps(encoderPath);
    const predRnnLayers = Number(meta.pred_rnn_layers || '2');
    const predHidden = Number(meta.pred_hidden || '640');
    const featDim = Number(meta.feat_dim || '128');
    return new ParakeetEngine(
      encoder,
      decoder,
      joiner,
      new ParakeetTokenizer(tokensPath),
      new LogMelFeatureExtractor(featDim),
      predRnnLayers,
      predHidden
    );
  }

  async transcribe(samples) {
    const pcm = samples instanceof Float32Array ? samples : Float32Array.from(samples || []);
    const { features, numFrames } = this.featureExtractor.compute(pcm);
    if (numFrames === 0) return '';
    const featDim = this.featureExtractor.featureDim;
    const normalized = normalizePerFeature(features, numFrames, featDim);
    const audioSignal = new Float32Array(featDim * numFrames);
    for (let t = 0; t < numFrames; t += 1) {
      for (let c = 0; c < featDim; c += 1) {
        audioSignal[c * numFrames + t] = normalized[t * featDim + c];
      }
    }

    const { data: encoderOut, encoderDim, encoderLen } = await this.runEncoder(audioSignal, featDim, numFrames);
    let state = this.initialState();
    let decoderStep = await this.runDecoder(this.tokenizer.blankId, state);
    state = decoderStep.state;
    const tokens = [];
    const blankId = this.tokenizer.blankId;
    const vocabSize = this.tokenizer.vocabSize;
    let tokensThisFrame = 0;
    let t = 0;
    while (t < encoderLen) {
      const encFrame = encoderOut.subarray(t * encoderDim, (t + 1) * encoderDim);
      const logits = await this.runJoiner(encFrame, encoderDim, decoderStep.output);
      let bestToken = 0;
      let bestTokenScore = -Infinity;
      for (let i = 0; i < vocabSize; i += 1) {
        if (logits[i] > bestTokenScore) {
          bestTokenScore = logits[i];
          bestToken = i;
        }
      }
      let skip = 0;
      let bestDurationScore = -Infinity;
      for (let i = vocabSize; i < logits.length; i += 1) {
        if (logits[i] > bestDurationScore) {
          bestDurationScore = logits[i];
          skip = i - vocabSize;
        }
      }
      if (bestToken !== blankId) {
        tokens.push(bestToken);
        decoderStep = await this.runDecoder(bestToken, state);
        state = decoderStep.state;
        tokensThisFrame += 1;
      }
      if (skip > 0) tokensThisFrame = 0;
      if (tokensThisFrame >= MAX_TOKENS_PER_FRAME) {
        tokensThisFrame = 0;
        skip = 1;
      }
      if (bestToken === blankId && skip === 0) {
        tokensThisFrame = 0;
        skip = 1;
      }
      t += skip;
    }
    return this.tokenizer.decode(tokens);
  }

  initialState() {
    const shape = [this.predRnnLayers, 1, this.predHidden];
    const size = this.predRnnLayers * this.predHidden;
    return {
      h: new Tensor('float32', new Float32Array(size), shape),
      c: new Tensor('float32', new Float32Array(size), shape)
    };
  }

  async runEncoder(audioSignal, featDim, numFrames) {
    const audioTensor = new Tensor('float32', audioSignal, [1, featDim, numFrames]);
    const lengthTensor = new Tensor('int64', BigInt64Array.from([BigInt(numFrames)]), [1]);
    const [audioName, lengthName] = this.encoder.inputNames;
    const [outName, lenName] = this.encoder.outputNames;
    const result = await this.encoder.run({ [audioName]: audioTensor, [lengthName]: lengthTensor });
    const outTensor = result[outName];
    const lenTensor = result[lenName];
    const encoderDim = Number(outTensor.dims[1]);
    const encoderT = Number(outTensor.dims[2]);
    const encoderLen = Number(lenTensor.data[0]);
    const raw = outTensor.data;
    const data = new Float32Array(encoderDim * encoderT);
    for (let t = 0; t < encoderT; t += 1) {
      for (let c = 0; c < encoderDim; c += 1) {
        data[t * encoderDim + c] = raw[c * encoderT + t];
      }
    }
    return { data, encoderDim, encoderLen: Math.min(encoderLen, encoderT) };
  }

  async runDecoder(token, state) {
    const [targetsName, targetLengthName, stateHName, stateCName] = this.decoder.inputNames;
    const [outName, , newStateHName, newStateCName] = this.decoder.outputNames;
    const result = await this.decoder.run({
      [targetsName]: new Tensor('int32', Int32Array.from([token]), [1, 1]),
      [targetLengthName]: new Tensor('int32', Int32Array.from([1]), [1]),
      [stateHName]: state.h,
      [stateCName]: state.c
    });
    return {
      output: result[outName],
      state: { h: result[newStateHName], c: result[newStateCName] }
    };
  }

  async runJoiner(encFrame, encoderDim, decoderOut) {
    const [encoderInputName, decoderInputName] = this.joiner.inputNames;
    const [outName] = this.joiner.outputNames;
    const result = await this.joiner.run({
      [encoderInputName]: new Tensor('float32', encFrame, [1, encoderDim, 1]),
      [decoderInputName]: decoderOut
    });
    return result[outName].data;
  }
}

module.exports = {
  configureOnnxRuntimeNativePath,
  INTERACTIVE_SESSION_OPTIONS,
  PARAKEET_SAMPLE_RATE,
  ParakeetEngine,
  resolveOnnxRuntimeNativePath
};
