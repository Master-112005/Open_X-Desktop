'use strict';

const { LlamaEngine } = require('./LlamaEngine');

let engine = null;

async function handle(message = {}) {
  if (message.type === 'init') {
    engine = await LlamaEngine.create(message.options || {});
    return { status: 'ready' };
  }
  if (message.type === 'reply') {
    if (!engine) {
      throw new Error('LLM worker has not been initialized');
    }
    return engine.reply(message.userText || '', chunk => {
      process.send?.({ id: message.id, type: 'chunk', chunk });
    });
  }
  if (message.type === 'dispose') {
    if (engine?.dispose) {
      await engine.dispose();
    }
    engine = null;
    setImmediate(() => process.exit(0));
    return { status: 'disposed' };
  }
  throw new Error(`Unknown LLM worker message: ${message.type || 'missing'}`);
}

process.on('message', message => {
  Promise.resolve()
    .then(() => handle(message))
    .then(result => {
      process.send?.({ id: message.id, type: 'result', result });
    })
    .catch(error => {
      process.send?.({ id: message.id, type: 'error', error: error?.stack || error?.message || String(error) });
    });
});

process.on('disconnect', () => {
  if (engine?.dispose) {
    Promise.resolve(engine.dispose()).finally(() => process.exit(0));
  } else {
    process.exit(0);
  }
});
