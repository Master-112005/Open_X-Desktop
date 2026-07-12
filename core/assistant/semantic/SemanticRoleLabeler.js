'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');

class SemanticRoleLabeler extends BaseSemanticAnalyzer {
  analyze(context) {
    const graph = context.linguisticGraph || {};
    const roles = [];
    (graph.subjects || []).forEach(subject => {
      roles.push({ role: 'Agent', tokenId: subject.tokenId, value: subject.value, source: 'subject', confidence: subject.confidence || 0.55 });
    });
    (graph.objects || []).forEach(object => {
      roles.push({ role: object.type === 'prepositional' ? 'Location' : 'Theme', tokenId: object.tokenId, value: object.value, source: object.type, confidence: object.confidence || 0.55 });
    });
    (graph.modifiers || []).forEach(modifier => {
      const role = modifier.type === 'adverb' ? 'Manner' : modifier.type === 'determiner' ? 'Quantity' : 'Theme';
      roles.push({ role, tokenId: modifier.tokenId, value: modifier.value, source: modifier.type, confidence: modifier.confidence || 0.5 });
    });
    (graph.tokens || []).filter(token => token.type === 'number').forEach(token => {
      roles.push({ role: 'Quantity', tokenId: token.id, value: token.value, source: 'number', confidence: 0.72 });
    });
    context.semanticRoles = roles;
    return context;
  }
}

module.exports = SemanticRoleLabeler;
