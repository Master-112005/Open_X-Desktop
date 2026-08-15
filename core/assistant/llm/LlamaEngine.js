'use strict';

const { buildSystemPrompt } = require('./prompt');

const MIN_CONTEXT_SIZE = 2048;
const MAX_CONTEXT_SIZE = 8192;
const MAX_REPLY_TOKENS = 180;

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

class LlamaEngine {
  constructor(model, context, session, options = {}) {
    this.model = model;
    this.context = context;
    this.session = session;
    this.maxReplyTokens = clampNumber(options.maxReplyTokens, 32, 1024, MAX_REPLY_TOKENS);
  }

  static async create(options = {}) {
    const modelPath = String(options.modelPath || '').trim();
    if (!modelPath) {
      throw new Error('Llama model path is required');
    }

    const llamaCpp = await import('node-llama-cpp');
    const llama = await llamaCpp.getLlama();
    const model = await llama.loadModel({ modelPath });
    const context = await model.createContext({
      contextSize: {
        min: clampNumber(options.contextMin, 512, MAX_CONTEXT_SIZE, MIN_CONTEXT_SIZE),
        max: clampNumber(options.contextMax, MIN_CONTEXT_SIZE, 32768, MAX_CONTEXT_SIZE)
      },
      performanceTracking: true
    });
    const session = new llamaCpp.LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: buildSystemPrompt(
        options.memorySummary || '',
        options.assistantName || 'OpenX',
        options.responseStyle || 'concise',
        options.language || 'system'
      )
    });

    return new LlamaEngine(model, context, session, options);
  }

  async reply(userText, onToken) {
    const startedAt = Date.now();
    const chunks = [];
    const response = await this.session.prompt(String(userText || '').trim(), {
      maxTokens: this.maxReplyTokens,
      onTextChunk: chunk => {
        const text = String(chunk || '');
        if (!text) return;
        chunks.push(text);
        if (typeof onToken === 'function') {
          onToken(text);
        }
      }
    });

    return {
      text: String(response || chunks.join('')).trim(),
      timings: {
        totalMs: Date.now() - startedAt
      }
    };
  }

  async dispose() {
    await Promise.resolve(this.session?.dispose?.());
    await Promise.resolve(this.context?.dispose?.());
    await Promise.resolve(this.model?.dispose?.());
    this.session = null;
    this.context = null;
    this.model = null;
  }
}

module.exports = {
  LlamaEngine,
  MAX_CONTEXT_SIZE,
  MAX_REPLY_TOKENS,
  MIN_CONTEXT_SIZE
};
