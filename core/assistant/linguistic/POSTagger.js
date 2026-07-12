'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const PRONOUNS = new Set(['i', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they', 'them', 'this', 'that', 'these', 'those']);
const DETERMINERS = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'each', 'every']);
const PREPOSITIONS = new Set(['in', 'on', 'at', 'to', 'from', 'for', 'with', 'without', 'about', 'after', 'before', 'over', 'under', 'into', 'through', 'between', 'beside', 'near']);
const CONJUNCTIONS = new Set(['and', 'or', 'but', 'because', 'if', 'while', 'when', 'although', 'so', 'then']);
const AUXILIARIES = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had']);
const MODALS = new Set(['can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must']);
const COMMON_VERBS = new Set(['open', 'close', 'find', 'search', 'play', 'pause', 'resume', 'set', 'send', 'show', 'tell', 'remind', 'call', 'wish', 'create', 'delete', 'move', 'copy', 'read', 'write', 'start', 'stop', 'turn', 'increase', 'decrease', 'make', 'need', 'needed']);
const ADVERBS = new Set(['quickly', 'slowly', 'now', 'then', 'very', 'really', 'clearly', 'again']);

class POSTagger extends BaseAnalyzer {
  analyze(context) {
    context.posTags = (context.tokens || []).map(token => ({
      tokenId: token.id,
      index: token.index,
      value: token.value,
      tag: this._tag(token),
      confidence: 0.72
    }));
    return context;
  }

  _tag(token) {
    if (!token) return 'unknown';
    if (token.type === 'number') return 'numeral';
    if (token.type === 'emoji') return 'symbol';
    if (token.type === 'punctuation' || token.type === 'sentence-punctuation') return 'punctuation';
    const lower = token.lower;
    if (PRONOUNS.has(lower)) return 'pronoun';
    if (DETERMINERS.has(lower)) return 'determiner';
    if (PREPOSITIONS.has(lower)) return 'preposition';
    if (CONJUNCTIONS.has(lower)) return 'conjunction';
    if (AUXILIARIES.has(lower)) return 'auxiliary';
    if (MODALS.has(lower)) return 'modal';
    if (COMMON_VERBS.has(lower) || lower.endsWith('ing') || lower.endsWith('ed')) return 'verb';
    if (ADVERBS.has(lower) || lower.endsWith('ly')) return 'adverb';
    if (lower.endsWith('ous') || lower.endsWith('ive') || lower.endsWith('al') || lower.endsWith('ful')) return 'adjective';
    return 'noun';
  }
}

module.exports = POSTagger;
