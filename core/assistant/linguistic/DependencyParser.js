'use strict';

const BaseAnalyzer = require('./BaseAnalyzer');

const COMMON_VERBS = new Set(['open', 'opened', 'close', 'closed', 'find', 'search', 'play', 'pause', 'resume', 'set', 'send', 'show', 'tell', 'remind', 'call', 'wish', 'create', 'delete', 'move', 'copy', 'read', 'write', 'start', 'stop', 'turn', 'increase', 'decrease', 'make', 'need', 'needed']);
const PRONOUNS = new Set(['i', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they', 'them', 'this', 'that']);

class DependencyParser extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    const dependencies = [];
    const tokenTags = tags.length > 0 ? tags : (context.tokens || []).map(token => ({
      tokenId: token.id,
      index: token.index,
      value: token.value,
      tag: this._roughTag(token)
    }));
    const verbs = tokenTags.filter(tag => ['verb', 'auxiliary', 'modal'].includes(tag.tag));
    for (const verb of verbs) {
      const subject = [...tokenTags].reverse().find(tag => tag.index < verb.index && ['noun', 'pronoun'].includes(tag.tag));
      const object = tokenTags.find(tag => tag.index > verb.index && ['noun', 'pronoun', 'numeral'].includes(tag.tag));
      if (subject) dependencies.push({ governor: verb.tokenId, dependent: subject.tokenId, relation: 'subject', confidence: 0.62 });
      if (object) dependencies.push({ governor: verb.tokenId, dependent: object.tokenId, relation: 'object', confidence: 0.62 });
    }
    tokenTags.forEach(tag => {
      if (!['adjective', 'determiner'].includes(tag.tag)) return;
      const head = tokenTags.find(candidate => candidate.index > tag.index && candidate.tag === 'noun');
      if (head) dependencies.push({ governor: head.tokenId, dependent: tag.tokenId, relation: 'modifier', confidence: 0.58 });
    });
    context.dependencies = dependencies;
    context.grammaticalRelationships = dependencies.map(dependency => ({
      type: dependency.relation,
      from: dependency.governor,
      to: dependency.dependent,
      confidence: dependency.confidence
    }));
    return context;
  }

  _roughTag(token) {
    if (!token) return 'unknown';
    if (token.type === 'number') return 'numeral';
    if (token.type !== 'word') return 'punctuation';
    if (PRONOUNS.has(token.lower)) return 'pronoun';
    if (COMMON_VERBS.has(token.lower) || token.lower.endsWith('ed') || token.lower.endsWith('ing')) return 'verb';
    return 'noun';
  }
}

module.exports = DependencyParser;
