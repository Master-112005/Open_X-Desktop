'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');
const { ASSISTANT_TOKEN_CORRECTIONS, repairKnownTokenText } = require('../normalization/AssistantLexicon');

const DEFAULT_CONCEPTS = Object.freeze({
  OPEN: ['open', 'launch', 'fire up', 'start', 'bring up'],
  START: ['begin', 'start'],
  CLOSE: ['close', 'terminate', 'shut', 'exit', 'stop'],
  DISABLE: ['disable', 'switch off', 'turn off'],
  ENABLE: ['enable', 'switch on', 'turn on'],
  REDUCE: ['reduce', 'decrease', 'lower', 'down'],
  INCREASE: ['increase', 'raise', 'up'],
  SEND: ['send', 'share', 'transfer'],
  FIND: ['find', 'search', 'look for'],
  CREATE: ['create', 'make', 'new'],
  DELETE: ['delete', 'remove'],
  MOVE: ['move'],
  STORE: ['store', 'save'],
  MEDIA: ['music', 'song', 'video', 'movie', 'media'],
  APPLICATION: ['chrome', 'notepad', 'vscode', 'code', 'spotify', 'youtube', 'app', 'application'],
  FILE: ['file', 'document', 'docx', 'pdf', 'resume'],
  FOLDER: ['folder', 'directory'],
  EMAIL: ['email', 'mail'],
  TIMER: ['timer', 'alarm', 'reminder', 'stopwatch']
});

class SemanticDictionary extends BaseSemanticAnalyzer {
  constructor(options = {}) {
    super(options);
    this.concepts = this._buildConcepts(options.dictionaries || options.dictionary || {});
  }

  _buildConcepts(custom = {}) {
    const merged = { ...DEFAULT_CONCEPTS };
    const typoConcepts = {
      OPEN: ['opne', 'ope', 'lauch', 'lnauch'],
      CLOSE: ['cloe', 'clsoe', 'cancle'],
      FIND: ['seach', 'serch', 'saerch', 'photes', 'phots'],
      DELETE: ['dlete', 'delte'],
      TIMER: ['alram', 'alaram', 'remindee', 'remider', 'remeinder'],
      APPLICATION: ['crome', 'chrom', 'chrmoe', 'youtub', 'yotube', 'settngs'],
      MEDIA: ['musc', 'musci', 'sony'],
      SEND: ['transver', 'sende']
    };
    Object.entries(typoConcepts).forEach(([concept, values]) => {
      merged[concept] = Array.from(new Set([
        ...(merged[concept] || []),
        ...values,
        ...values.map(value => ASSISTANT_TOKEN_CORRECTIONS[value]).filter(Boolean)
      ]));
    });
    Object.entries(custom || {}).forEach(([concept, values]) => {
      merged[String(concept).toUpperCase()] = Array.from(new Set([
        ...(merged[String(concept).toUpperCase()] || []),
        ...(Array.isArray(values) ? values : [values]).filter(Boolean)
      ]));
    });
    return merged;
  }

  lookup(value) {
    const text = repairKnownTokenText(String(value || '').toLowerCase());
    const matches = [];
    Object.entries(this.concepts).forEach(([concept, terms]) => {
      terms.forEach(term => {
        const normalizedTerm = String(term).toLowerCase();
        if (text === normalizedTerm) {
          matches.push({ concept, term, confidence: 1, source: 'exact' });
        } else if (text.includes(normalizedTerm) || normalizedTerm.includes(text)) {
          matches.push({ concept, term, confidence: 0.72, source: 'partial' });
        }
      });
    });
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  analyze(context) {
    context.dictionary = this;
    context.dictionaryLookups = (context.dictionaryLookups || []).concat(
      (context.linguisticGraph?.tokens || []).map(token => ({
        tokenId: token.id,
        value: token.value,
        matches: this.lookup(token.value).slice(0, 3)
      })).filter(item => item.matches.length > 0)
    );
    return context;
  }
}

module.exports = SemanticDictionary;
