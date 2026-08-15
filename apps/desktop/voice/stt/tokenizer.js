const fs = require('fs');

class ParakeetTokenizer {
  constructor(tokensPath) {
    const lines = fs.readFileSync(tokensPath, 'utf8').trim().split('\n');
    this.idToToken = new Map();
    for (const line of lines) {
      const spaceIdx = line.lastIndexOf(' ');
      const token = line.slice(0, spaceIdx);
      const id = Number(line.slice(spaceIdx + 1));
      this.idToToken.set(id, token);
    }
    this.vocabSize = lines.length;
    this.blankId = this.vocabSize - 1;
  }

  decode(tokenIds) {
    const text = tokenIds
      .map(id => this.idToToken.get(id) || '')
      .filter(token => !token.startsWith('<|') && token !== '<unk>' && token !== '<pad>')
      .join('');
    return text.replace(/\u2581/g, ' ').trim();
  }
}

module.exports = { ParakeetTokenizer };
