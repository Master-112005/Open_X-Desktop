const fs = require('fs');
const path = require('path');
const { ParakeetEngine } = require('./ParakeetEngine');

const REQUIRED_FILES = [
  'encoder.int8.onnx',
  'decoder.int8.onnx',
  'joiner.int8.onnx',
  'tokens.txt'
];

class ModelLoader {
  constructor(options = {}) {
    this.modelsDir = options.modelsDir || resolveDefaultModelsDir();
    this.logger = options.logger || console;
    this.instance = null;
    this.loadPromise = null;
  }

  validate() {
    const missing = REQUIRED_FILES.filter(file => !fs.existsSync(path.join(this.modelsDir, file)));
    if (missing.length > 0) {
      throw new Error(`Parakeet model files are missing: ${missing.join(', ')}`);
    }
    return { success: true, modelsDir: this.modelsDir };
  }

  async load() {
    if (this.instance) return this.instance;
    if (this.loadPromise) return this.loadPromise;
    this.validate();
    const startedAt = Date.now();
    this.logger.info?.('[VOICE] Loading Parakeet speech model', { modelsDir: this.modelsDir });
    this.loadPromise = ParakeetEngine.create(this.modelsDir)
      .then(instance => {
        this.instance = instance;
        this.logger.info?.('[VOICE] Parakeet speech model ready', { loadMs: Date.now() - startedAt });
        return instance;
      })
      .catch(error => {
        this.loadPromise = null;
        this.logger.error?.('[VOICE] Parakeet speech model failed to load', { error: error.message });
        throw error;
      });
    return this.loadPromise;
  }

  async transcribe(samples) {
    const engine = await this.load();
    return engine.transcribe(samples);
  }
}

function resolveDefaultModelsDir() {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..', 'models', 'parakeet')
  ];
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, 'models', 'parakeet'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'models', 'parakeet')
    );
  }
  return candidates.find(candidate => REQUIRED_FILES.every(file => fs.existsSync(path.join(candidate, file))))
    || candidates[0];
}

module.exports = { ModelLoader, REQUIRED_FILES, resolveDefaultModelsDir };
