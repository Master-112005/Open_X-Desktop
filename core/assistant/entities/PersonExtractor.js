'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');
const {
  findRelationshipMentions,
  findSelfReferences,
  isRelationshipTerm,
  isSelfReference,
  normalizePersonReference
} = require('./PersonLexicon');

const NON_PERSON_TERMS = new Set([
  'all', 'any', 'camera', 'favorite', 'favorites', 'favourite', 'favourites',
  'face', 'faces', 'gallery', 'image', 'images', 'latest', 'memory', 'photo',
  'photos', 'pic', 'pics', 'picture', 'pictures', 'recent', 'screenshot',
  'screenshots', 'selfie', 'the', 'this', 'that', 'these', 'those', 'where',
  'which', 'who', 'what', 'when', 'from', 'with', 'and', 'near', 'inside',
  'outside', 'birthday', 'trip', 'vacation', 'beach', 'mountain', 'hill',
  'forest', 'nature', 'document', 'receipt', 'invoice'
]);

const VISUAL_PERSON_QUERY = /\b(?:find|show|get|search|display|open|look\s+for)\b.*\b(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces)\b|\b(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces)\b.*\b(?:of|with)\b/i;

function cleanCandidate(value) {
  return String(value || '')
    .replace(/\b(?:with|and|at|in|on|near|inside|outside|my|our|the|a|an|photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces|where|was|were|is|are|that|this|those|these)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9 .'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNames(value) {
  return String(value || '')
    .split(/\s+(?:and|with|plus)\s+|[,/&]+/i)
    .map(cleanCandidate)
    .filter(Boolean);
}

class PersonExtractor extends BaseEntityExtractor {
  extract(context) {
    const matches = this.text(context).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
    for (const value of matches) {
      if (!/^(OpenX|Chrome|Google|Microsoft|Windows|Desktop|Downloads|Documents|Pictures|Videos|Music|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(value)) {
        this.addEntity(context, 'person', value, { confidence: 0.52, metadata: { kind: 'capitalized-name' } });
      }
    }
    this._extractVisualPeople(context);
    return context;
  }

  _extractVisualPeople(context) {
    const text = this.text(context);
    if (!VISUAL_PERSON_QUERY.test(text)) return;

    for (const self of findSelfReferences(text)) {
      this.addEntity(context, 'person', 'me', {
        canonical: normalizePersonReference(self.value),
        confidence: 0.93,
        metadata: { kind: 'self-reference', raw: self.raw, index: self.index }
      });
    }

    for (const relationship of findRelationshipMentions(text)) {
      context.addRelationship({
        type: 'person-relationship-reference',
        source: 'user',
        target: relationship.value,
        confidence: 0.88,
        metadata: {
          raw: relationship.raw,
          alias: relationship.alias,
          extractor: this.id
        }
      });
    }

    const patterns = [
      /\b(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces)\s+(?:of|with)\s+([a-z][a-z .'-]{1,70})(?=\s+(?:at|in|on|near|inside|outside|last|from|during|where|that|which|who|photo|picture|image|screenshot)\b|$)/gi,
      /\b(?:find|show|get|search|display|open|look\s+for)\s+(?:me\s+)?(?:a\s+|the\s+|my\s+)?([a-z][a-z .'-]{1,50})\s+(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces)\b/gi,
      /\b(?:me|myself|i)\s+(?:and|with)\s+(?:my\s+)?([a-z][a-z .'-]{1,50})(?=\s+(?:in|inside|at|near|on|from|photo|pic|picture|image|$))/gi
    ];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text))) {
        this._addNameCandidates(context, match[1]);
      }
    }
  }

  _addNameCandidates(context, value) {
    for (const name of splitNames(value)) {
      if (!this._isNameCandidate(name)) continue;
      this.addEntity(context, 'person', name, {
        confidence: 0.76,
        metadata: { kind: 'visual-person-reference' }
      });
    }
  }

  _isNameCandidate(value) {
    const cleaned = cleanCandidate(value);
    const normalized = cleaned.toLowerCase();
    if (!normalized || normalized.length < 2 || /^\d+$/.test(normalized)) return false;
    if (NON_PERSON_TERMS.has(normalized) || isRelationshipTerm(normalized) || isSelfReference(normalized)) return false;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length > 4) return false;
    return !tokens.some(token => NON_PERSON_TERMS.has(token) || isRelationshipTerm(token));
  }
}

module.exports = PersonExtractor;
