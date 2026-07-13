'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const PRONOUNS = new Set(['i', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they', 'them', 'this', 'that', 'these', 'those', 'same', 'one', 'ones', 'there']);
const DETERMINERS = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'each', 'every']);
const PREPOSITIONS = new Set(['in', 'on', 'at', 'to', 'from', 'for', 'with', 'without', 'about', 'after', 'before', 'over', 'under', 'into', 'through', 'between', 'beside', 'near', 'onto', 'via', 'using', 'until']);
const CONJUNCTIONS = new Set(['and', 'or', 'but', 'because', 'if', 'while', 'when', 'although', 'so', 'then', 'also', 'plus']);
const AUXILIARIES = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had']);
const MODALS = new Set(['can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must']);
const COMMON_VERBS = new Set(['open', 'close', 'find', 'search', 'google', 'lookup', 'play', 'pause', 'resume', 'set', 'send', 'share', 'transfer', 'show', 'tell', 'ask', 'reply', 'respond', 'remind', 'alert', 'notify', 'call', 'wish', 'create', 'delete', 'move', 'copy', 'read', 'write', 'start', 'stop', 'turn', 'increase', 'decrease', 'make', 'need', 'needed', 'wake', 'snooze', 'jump']);
const ADVERBS = new Set(['quickly', 'slowly', 'now', 'then', 'very', 'really', 'clearly', 'again', 'daily', 'weekly', 'monthly', 'tomorrow', 'today']);

class POSTagger extends BaseAnalyzer {
  analyze(context) {
    context.posTags = (context.tokens || []).map(token => ({
      tokenId: token.id,
      index: token.index,
      value: token.value,
      tag: this._tag(token),
      lemma: this._lemma(token),
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

  _lemma(token) {
    const lower = String(token?.lower || '');
    if (lower.endsWith('ing') && lower.length > 5) return lower.slice(0, -3);
    if (lower.endsWith('ed') && lower.length > 4) return lower.slice(0, -2);
    return lower;
  }
}

module.exports = POSTagger;
