'use strict';

const MIN_RUN_ON_ALPHA_LENGTH = 9;
const UNKNOWN_BASE_COST = 10;
const UNKNOWN_CHAR_COST = 3;
const KNOWN_LENGTH_BONUS = 150;
const LENGTH_SQUARE_BONUS = 10;
const MIN_KNOWN_TO_ACCEPT = 2;
const MAX_UNKNOWN_TOKEN_LENGTH = 4;
const MAX_LLM_TEXT_LENGTH = 300;
const MIN_LLM_OVERLAP_RATIO = 0.6;

const HIGH_FREQUENCY_WORDS = [
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'too', 'very', 'just', 'not', 'no', 'yes',
  'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'into', 'about', 'as',
  'be', 'been', 'being', 'is', 'am', 'are', 'was', 'were', 'do', 'does', 'did', 'done',
  'have', 'has', 'had', 'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'must',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'us', 'him', 'her', 'them',
  'my', 'your', 'his', 'our', 'their', 'its', 'mine', 'yours', 'ours', 'theirs',
  'this', 'that', 'these', 'those', 'there', 'here',
  'who', 'what', 'when', 'where', 'why', 'which', 'how', 'whose',
  'all', 'each', 'any', 'some', 'both', 'few', 'more', 'most', 'other', 'such',
  'only', 'own', 'same', 'than', 'then', 'now', 'up', 'down', 'out', 'off', 'over', 'under',
  'before', 'after', 'during', 'between', 'among', 'through', 'around', 'again', 'also',
  'doesnt', 'dont', 'cant', 'wont', 'isnt', 'wasnt', 'didnt', 'hasnt', 'havent', 'im', 'youre', 'weve', 'theyre',
  'go', 'goes', 'went', 'gone', 'come', 'came', 'get', 'got', 'give', 'gave', 'taken',
  'take', 'took', 'make', 'made', 'know', 'knew', 'think', 'thought', 'say', 'said',
  'see', 'saw', 'seen', 'use', 'used', 'need', 'needed', 'want', 'wanted', 'like', 'liked',
  'help', 'helped', 'open', 'opened', 'close', 'closed', 'write', 'wrote', 'written', 'type', 'played',
  'play', 'send', 'sent', 'read', 'find', 'found', 'look', 'looked', 'work', 'worked',
  'tell', 'told', 'talk', 'called', 'call', 'run', 'start', 'starts', 'stop', 'let', 'put',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'
];

const MEDIUM_FREQUENCY_WORDS = [
  'hello', 'hi', 'hey', 'thanks', 'thank', 'please', 'okay', 'ok', 'welcome', 'sorry',
  'time', 'people', 'house', 'home', 'name', 'day', 'night', 'week', 'month', 'year',
  'today', 'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'night', 'tonight',
  'big', 'small', 'large', 'little', 'good', 'bad', 'great', 'new', 'old', 'long', 'short',
  'high', 'low', 'hard', 'easy', 'fast', 'slow', 'first', 'second', 'last', 'next',
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown',
  'color', 'colour', 'number', 'letter', 'word', 'sentence', 'text', 'email', 'mail',
  'message', 'phone', 'call', 'video', 'music', 'film', 'movie', 'song', 'game', 'book',
  'page', 'screen', 'window', 'notepad', 'wordpad', 'excel', 'file', 'folder', 'document',
  'note', 'notes', 'paper', 'pen', 'pencil', 'keyboard', 'mouse', 'laptop', 'computer',
  'desktop', 'wallpaper', 'clock', 'alarm', 'calendar', 'date', 'weather', 'news', 'photo',
  'image', 'picture', 'camera', 'video', 'record', 'recorded', 'voice', 'speak', 'speech',
  'woman', 'man', 'boy', 'girl', 'friend', 'friends', 'family', 'mother', 'father', 'brother',
  'sister', 'water', 'food', 'bread', 'milk', 'coffee', 'tea', 'juice', 'lunch', 'dinner',
  'eat', 'ate', 'drink', 'sleep', 'slept', 'walk', 'ran', 'run', 'sit', 'sat', 'stand',
  'city', 'country', 'world', 'school', 'college', 'work', 'office', 'job', 'doctor',
  'money', 'price', 'shop', 'store', 'market', 'buy', 'bought', 'sell', 'sold', 'watch',
  'listen', 'listened', 'hear', 'heard', 'feel', 'felt', 'smell', 'touch', 'hold', 'held',
  'bring', 'brought', 'carry', 'carried', 'push', 'pull', 'turn', 'turned', 'move', 'moved',
  'clean', 'cleaned', 'wash', 'washed', 'cook', 'cooked', 'book', 'reserve', 'travel', 'left', 'right',
  'hundred', 'thousand', 'million', 'zero', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty',
  'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
];

const LOW_FREQUENCY_WORDS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'apple', 'banana', 'mango', 'orange', 'grape', 'lemon', 'potato', 'tomato', 'onion',
  'random', 'letter', 'alphabet', 'spelling', 'grammar', 'paragraph', 'title', 'heading',
  'chat', 'whatsapp', 'instagram', 'youtube', 'facebook', 'google', 'chrome', 'browser',
  'python', 'javascript', 'code', 'coding', 'program', 'software', 'app', 'application',
  'quick', 'ready', 'done', 'finish', 'finished', 'started', 'stopped', 'paused', 'resume',
  'select', 'selected', 'choose', 'chose', 'copy', 'copied', 'paste', 'pasted', 'delete',
  'deleted', 'remove', 'removed', 'add', 'added', 'save', 'saved', 'print', 'printed',
  'search', 'searched', 'send', 'reply', 'replied', 'forward', 'received', 'download',
  'upload', 'install', 'update', 'updated', 'restart', 'reboot', 'shutdown', 'volume',
  'brightness', 'mute', 'unmute', 'fullscreen', 'minimize', 'maximize', 'close', 'zoom'
];

const WEIGHTS = { high: 90, medium: 70, low: 50 };

function buildWordFrequencies() {
  const frequencies = {};
  HIGH_FREQUENCY_WORDS.forEach(word => { frequencies[word] = WEIGHTS.high; });
  MEDIUM_FREQUENCY_WORDS.forEach(word => { frequencies[word] = WEIGHTS.medium; });
  LOW_FREQUENCY_WORDS.forEach(word => { frequencies[word] = WEIGHTS.low; });
  return frequencies;
}

const WORD_FREQUENCIES = buildWordFrequencies();

const CONTRACTIONS = {
  whats: "what's",
  wont: "won't",
  cant: "can't",
  dont: "don't",
  didnt: "didn't",
  doesnt: "doesn't",
  isnt: "isn't",
  wasnt: "wasn't",
  werent: "weren't",
  hasnt: "hasn't",
  havent: "haven't",
  hadnt: "hadn't",
  couldve: "could've",
  wouldve: "would've",
  shouldve: "should've",
  im: "I'm",
  youve: "you've",
  weve: "we've",
  theyre: "they're",
  youll: "you'll",
  well: "we'll",
  theyll: "they'll",
  hell: "he'll",
  shell: "she'll"
};

class TextRepair {
  constructor(options = {}) {
    const frequencies = options.wordFrequencies || WORD_FREQUENCIES;
    this.wordFrequencies = new Map(
      Object.keys(frequencies).map(word => [word, Number(frequencies[word]) || 0])
    );
    this.minRunOnAlphaLength = Number(options.minRunOnAlphaLength || MIN_RUN_ON_ALPHA_LENGTH);
    this.maxLlmTextLength = Number(options.maxLlmTextLength || MAX_LLM_TEXT_LENGTH);
    this.llm = typeof options.llm === 'function' ? options.llm : null;
  }

  setLlm(provider) {
    if (typeof provider === 'function') {
      this.llm = provider;
    }
  }

  needsRepair(text) {
    const original = String(text || '');
    const cleaned = original.replace(/\s+/g, ' ').trim();
    if (!cleaned) return false;
    if (/\n/.test(original)) return false;
    if (/(?:https?:\/\/|www\.|@)/i.test(original)) return false;
    if (/\s{2,}/.test(cleaned)) return true;
    if (/ [,.!?;:]/.test(cleaned)) return true;
    const punctuationCandidates = cleaned.replace(/[0-9][.,][0-9]/g, match => match[0] + match[2]);
    if (/[,.!?;:](?=[A-Za-z0-9])/.test(punctuationCandidates)) return true;
    const alphaOnly = cleaned.replace(/[^A-Za-z]/g, '');
    if (alphaOnly.length >= this.minRunOnAlphaLength && !/[\s]/.test(cleaned)) {
      return true;
    }
    return false;
  }

  baseClean(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([,.!?;:])\s*/g, '$1 ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .trim();
  }

  _segmentScore(word) {
    if (!word) return 0;
    if (this.wordFrequencies.has(word)) {
      return this.wordFrequencies.get(word) + KNOWN_LENGTH_BONUS * word.length + LENGTH_SQUARE_BONUS * word.length * word.length;
    }
    if (word.length >= 3 && word.endsWith('s')) {
      const base = word.slice(0, -1);
      if (this.wordFrequencies.has(base)) {
        return this.wordFrequencies.get(base) - 3 + KNOWN_LENGTH_BONUS * word.length + LENGTH_SQUARE_BONUS * word.length * word.length;
      }
    }
    return -(UNKNOWN_BASE_COST + UNKNOWN_CHAR_COST * word.length);
  }

  _isDerivedWord(word) {
    if (!word || word.length < 3) return false;
    const base = word.endsWith('s') ? word.slice(0, -1) : null;
    return Boolean(base && this.wordFrequencies.has(base));
  }

  _segmentRun(word) {
    const lower = String(word || '').toLowerCase();
    if (!lower || !/^[a-z]+$/.test(lower)) {
      return { changed: false };
    }
    if (lower.length < this.minRunOnAlphaLength) {
      return { changed: false };
    }

    const n = lower.length;
    const bestScore = new Array(n + 1).fill(-Infinity);
    const bestPrev = new Array(n + 1).fill(-1);
    bestScore[0] = 0;

    for (let end = 1; end <= n; end += 1) {
      let best = -Infinity;
      let bestStart = -1;
      for (let start = 0; start < end; start += 1) {
        if (bestScore[start] === -Infinity) continue;
        const candidate = lower.slice(start, end);
        const score = this._segmentScore(candidate);
        const total = bestScore[start] + score;
        if (total > best) {
          best = total;
          bestStart = start;
        }
      }
      bestScore[end] = best;
      bestPrev[end] = bestStart;
    }

    const tokens = [];
    let position = n;
    while (position > 0) {
      const start = bestPrev[position];
      if (start < 0) break;
      const word = lower.slice(start, position);
      tokens.unshift({
        word,
        known: this.wordFrequencies.has(word) || this._isDerivedWord(word)
      });
      position = start;
    }
    if (tokens.length < 2) {
      return { changed: false };
    }

    const knownCount = tokens.filter(token => token.known).length;
    const unknownCount = tokens.length - knownCount;
    const hasSmallUnknown = tokens.some(token => !token.known && token.word.length <= MAX_UNKNOWN_TOKEN_LENGTH);
    const accepted = knownCount >= MIN_KNOWN_TO_ACCEPT && (unknownCount === 0 || !hasSmallUnknown);
    const confidence = tokens.length > 0 ? knownCount / tokens.length : 0;

    return {
      changed: true,
      accepted,
      confidence,
      tokens,
      knownCount,
      unknownCount
    };
  }

  _applySegmentation(cleaned, segmentation) {
    const { tokens } = segmentation;
    let offset = 0;
    let output = '';
    const original = String(cleaned || '');
    tokens.forEach((token, index) => {
      const slice = original.slice(offset, offset + token.word.length);
      offset += token.word.length;
      const contraction = CONTRACTIONS[token.word];
      output += (index > 0 ? ' ' : '') + String(contraction !== undefined ? contraction : slice);
    });
    output += original.slice(offset);
    return output;
  }

  _lcsLength(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = new Uint32Array((m + 1) * (n + 1));
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const cell = i * (n + 1) + j;
        if (a[i - 1] === b[j - 1]) {
          dp[cell] = dp[(i - 1) * (n + 1) + j - 1] + 1;
        } else {
          dp[cell] = Math.max(dp[(i - 1) * (n + 1) + j], dp[i * (n + 1) + j - 1]);
        }
      }
    }
    return dp[m * (n + 1) + n];
  }

  async _applyLlm(original, cleaned) {
    if (!this.llm || String(original || '').length > this.maxLlmTextLength) {
      return null;
    }
    try {
      const result = await this.llm(original);
      const response = String(result || '').trim();
      if (!response || response.length > String(original).length * 2 + 40) {
        return null;
      }
      let cleanedResponse = response
        .replace(/^["'`]+/, '')
        .replace(/["'`]+$/, '')
        .replace(/^(?:corrected|fixed|repaired|updated|result|answer)\b\s*[:\-]?\s*/i, '')
        .replace(/^[^:]{0,24}:\s*/, '')
        .trim();
      if (!cleanedResponse || /^\W+$/.test(cleanedResponse)) {
        return null;
      }
      const responseLetters = cleanedResponse.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      const originalLetters = String(original || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      if (!originalLetters || responseLetters.length < Math.round(originalLetters.length * 0.5)) {
        return null;
      }
      const overlap = this._lcsLength(originalLetters, responseLetters);
      if (overlap < Math.round(originalLetters.length * MIN_LLM_OVERLAP_RATIO)) {
        return null;
      }
      if (cleanedResponse.toLowerCase() === String(original || '').trim().toLowerCase()) {
        return null;
      }
      return cleanedResponse;
    } catch (error) {
      return null;
    }
  }

  _finalizeFallback(originalText, cleaned) {
    const changed = cleaned !== originalText;
    const hasPunctuation = /[,.!?;:]/.test(originalText.replace(/\s/g, ''));
    const method = hasPunctuation && changed ? 'punctuation' : (changed ? 'spacing' : 'unchanged');
    return { text: cleaned, changed, method, confidence: null };
  }

  async repair(text, options = {}) {
    const originalText = String(text || '');
    if (!this.needsRepair(originalText)) {
      return {
        text: originalText,
        changed: false,
        method: 'none',
        confidence: 1
      };
    }

    const cleaned = this.baseClean(originalText);
    const runSegments = cleaned.split(/\s+/).filter(Boolean).length <= 1;
    let segmentation = null;
    if (runSegments) {
      segmentation = this._segmentRun(cleaned);
    } else {
      const allSegments = [];
      const pieces = cleaned.split(/\s+/).filter(Boolean);
      for (const piece of pieces) {
        const pieceSegmentation = this._segmentRun(piece);
        if (pieceSegmentation && pieceSegmentation.changed) {
          pieceSegmentation._piece = piece;
          allSegments.push(pieceSegmentation);
        }
      }
      if (allSegments.length > 0) {
        const segmentedPieces = pieces.map(piece => {
          const match = allSegments.find(seg => seg._piece === piece);
          return match ? this._applySegmentation(piece, match) : piece;
        });
        segmentation = {
          changed: true,
          accepted: allSegments.every(seg => seg.accepted),
          confidence: allSegments.reduce((sum, seg) => sum + seg.confidence, 0) / allSegments.length,
          isMultiPiece: true,
          text: segmentedPieces.join(' ')
        };
      }
    }

    if (!segmentation || !segmentation.changed) {
      const llmText = await this._applyLlm(originalText, cleaned);
      if (llmText) {
        return { text: llmText, changed: true, method: 'llm', confidence: null };
      }
      return this._finalizeFallback(originalText, cleaned);
    }

    if (segmentation.isMultiPiece) {
      if (segmentation.accepted) {
        return { text: segmentation.text, changed: true, method: 'nlp', confidence: segmentation.confidence };
      }
      const llmText = await this._applyLlm(originalText, cleaned);
      if (llmText) {
        return { text: llmText, changed: true, method: 'llm', confidence: null };
      }
      return this._finalizeFallback(originalText, cleaned);
    }

    if (segmentation.accepted) {
      return {
        text: this._applySegmentation(cleaned, segmentation),
        changed: true,
        method: 'nlp',
        confidence: segmentation.confidence,
        tokens: segmentation.tokens.map(token => ({ word: token.word, known: token.known }))
      };
    }

    const llmText = await this._applyLlm(originalText, cleaned);
    if (llmText) {
      return { text: llmText, changed: true, method: 'llm', confidence: null };
    }
    return this._finalizeFallback(originalText, cleaned);
  }

  static getLexiconSize() {
    return Object.keys(WORD_FREQUENCIES).length;
  }
}

module.exports = TextRepair;