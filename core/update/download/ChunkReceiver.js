class ChunkReceiver {
  constructor(options = {}) {
    this.onChunk = options.onChunk || (async () => {});
  }

  async receive(stream) {
    for await (const chunk of stream) {
      await this.onChunk(chunk);
    }
  }
}

module.exports = ChunkReceiver;
