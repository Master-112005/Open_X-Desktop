'use strict';

const { findVisualConcepts, getVisualConceptTerms } = require('../utils/VisualConceptLexicon');

const RELATIONSHIPS = Object.freeze({
  mom: 'mother',
  mother: 'mother',
  dad: 'father',
  father: 'father',
  parents: 'parents',
  brother: 'brother',
  sister: 'sister',
  friend: 'friend',
  friends: 'friends',
  colleague: 'colleague',
  coworker: 'colleague',
  teacher: 'teacher',
  boss: 'boss',
  customer: 'customer',
  wife: 'wife',
  husband: 'husband',
  cousin: 'cousin',
  uncle: 'uncle',
  aunt: 'aunt',
  family: 'family',
  children: 'children',
  kid: 'child',
  kids: 'children'
});

const SCENES = Object.freeze([
  'beach', 'mountain', 'forest', 'temple', 'palace', 'hotel', 'airport',
  'office', 'bedroom', 'kitchen', 'car', 'road', 'restaurant', 'garden',
  'park', 'mall', 'museum', 'lake', 'home', 'college', 'school', 'indoor',
  'outdoor', ...getVisualConceptTerms()
]);

const EVENTS = Object.freeze([
  'birthday', 'wedding', 'vacation', 'trip', 'festival', 'diwali', 'christmas',
  'party', 'meeting', 'graduation', 'college function', 'office event',
  'family gathering', 'anniversary', 'holiday'
]);

const DOCUMENT_TYPES = Object.freeze([
  'receipt', 'invoice', 'id card', 'passport', 'license', 'bill', 'document'
]);

const SOURCE_APPS = Object.freeze([
  'whatsapp', 'instagram', 'facebook', 'chrome', 'edge', 'bank', 'paytm',
  'phonepe', 'google pay', 'desktop'
]);

const LOCATION_HINTS = Object.freeze([
  'goa', 'palace', 'beach', 'home', 'office', 'college', 'school', 'airport',
  'temple', 'mall', 'hotel', 'restaurant', 'park', 'museum', 'lake'
]);

const TIME_PATTERNS = Object.freeze([
  /\b(?:today|yesterday|tomorrow)\b/gi,
  /\blast\s+(?:week|month|year|night|november|december|january|february|march|april|may|june|july|august|september|october)\b/gi,
  /\bnext\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\b(?:childhood|college days|school days|summer|winter|vacation|festival period|birthday|anniversary)\b/gi,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b/gi,
  /\b\d{4}\b/g
]);

const NON_PERSON_TERMS = new Set([
  ...Object.keys(RELATIONSHIPS),
  ...SCENES,
  ...EVENTS,
  ...DOCUMENT_TYPES,
  ...SOURCE_APPS,
  ...LOCATION_HINTS,
  'all', 'any', 'camera', 'favorite', 'favorites', 'favourite', 'favourites',
  'face', 'faces', 'gallery', 'image', 'images', 'latest', 'memory', 'photo',
  'photos', 'pic', 'pics', 'picture', 'pictures', 'recent', 'screenshot',
  'screenshots', 'selfie', 'the', 'this', 'that', 'these', 'those'
].map(value => String(value).toLowerCase()));

function addUnique(target, item) {
  const value = String(item.value || '').toLowerCase();
  const key = `${item.type}:${value}:${item.source || ''}`;
  if (target.some(existing => `${existing.type}:${String(existing.value || '').toLowerCase()}:${existing.source || ''}` === key)) {
    return;
  }
  target.push(item);
}

function cleanName(value) {
  return String(value || '')
    .replace(/\b(?:with|and|at|in|on|near|inside|outside|my|the|a|an|photo|photos|picture|pictures|pic|pics|image|images|screenshot|screenshots|where|was|were|is|are|that|this|those|these|i|me)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9 .'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPersonNames(value) {
  return String(value || '')
    .split(/\s+(?:and|with|plus)\s+|[,/&]+/i)
    .map(cleanName)
    .filter(Boolean);
}

class VisualConstraintExtractor {
  constructor({ normalizer } = {}) {
    this.normalizer = normalizer;
  }

  extract(context, parsed) {
    const text = parsed.normalizedText || this.normalizer.normalizeText(context.getText());
    const constraints = this._empty();
    const diagnostics = [];

    this._addMedia(constraints, parsed);
    this._addOwner(constraints, text);
    this._addPeople(constraints, context, text);
    this._addRelationships(constraints, text);
    this._addTimes(constraints, context, text);
    this._addLocations(constraints, context, text);
    this._addLexiconMatches(constraints.scenes, text, SCENES, 'scene', 0.82);
    this._addVisualConcepts(constraints, text);
    this._addLexiconMatches(constraints.events, text, EVENTS, 'event', 0.84);
    this._addPhotoTypes(constraints, text, parsed);
    this._addPersonCount(constraints, text);
    this._addLexiconMatches(constraints.sourceApps, text, SOURCE_APPS, 'sourceApp', 0.8);
    this._addLexiconMatches(constraints.documentTypes, text, DOCUMENT_TYPES, 'documentType', 0.86);
    this._addQueryText(constraints, context, text);

    const confidence = this._overallConfidence(parsed, constraints);
    diagnostics.push({
      level: 'info',
      message: 'Visual constraints extracted.',
      data: { active: parsed.active, confidence, constraintCount: this._count(constraints) }
    });

    return { constraints, confidence, diagnostics };
  }

  _empty() {
    return {
      media: [],
      owner: [],
      people: [],
      relationships: [],
      time: [],
      locations: [],
      scenes: [],
      events: [],
      photoTypes: [],
      personCount: [],
      sourceApps: [],
      documentTypes: [],
      queryText: []
    };
  }

  _constraint(type, value, confidence, source = 'visual-query', metadata = {}) {
    return {
      type,
      value,
      confidence: this.normalizer.confidence(confidence, metadata),
      source,
      metadata
    };
  }

  _addMedia(constraints, parsed) {
    addUnique(constraints.media, this._constraint('media', parsed.mediaHint || 'photo', 0.9, 'visual-query.parser'));
  }

  _addOwner(constraints, text) {
    const ownerMatch = text.match(/\b(me|my|mine|myself|our|ours|us|family|friends|his|her|their|theirs)\b/i);
    const owner = ownerMatch ? this.normalizer.normalizeOwner(ownerMatch[1]) : 'user';
    addUnique(constraints.owner, this._constraint('owner', owner, ownerMatch ? 0.88 : 0.72, 'visual-query.owner'));
  }

  _addPeople(constraints, context, text) {
    for (const entity of [...context.getEntities('people'), ...context.getEntities('contacts')]) {
      const value = entity.canonical || entity.value || entity.name || '';
      if (value) addUnique(constraints.people, this._constraint('person', value, entity.confidence || 0.9, 'assistant.entities', { fromEntity: true }));
    }

    const withPattern = /\b(?:with|and)\s+([a-z][a-z .'-]{1,40})(?=\s+(?:at|in|on|near|inside|outside|last|from|during|where|photo|picture|image|screenshot)\b|$)/gi;
    let match;
    while ((match = withPattern.exec(text))) {
      this._addPersonCandidates(constraints, match[1], 0.78, 'visual-query.person-pattern');
    }

    const photoOfPatterns = [
      /\b(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait)\s+(?:of|with)\s+([a-z][a-z .'-]{1,60})(?=\s+(?:at|in|on|near|inside|outside|last|from|during|where|that|which|who|photo|picture|image|screenshot)\b|$)/gi,
      /\b(?:find|show|get|search|display)\s+(?:me\s+)?(?:a\s+|the\s+|my\s+)?([a-z][a-z .'-]{1,40})\s+(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait)\b/gi,
      /\b(?:me|myself|i)\s+(?:and|with)\s+(?:my\s+)?([a-z][a-z .'-]{1,40})(?=\s+(?:in|inside|at|near|on|from|photo|pic|picture|image|$))/gi
    ];

    for (const pattern of photoOfPatterns) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text))) {
        this._addPersonCandidates(constraints, match[1], 0.82, 'visual-query.person-photo-pattern');
      }
    }
  }

  _addPersonCandidates(constraints, value, confidence, source) {
    for (const name of splitPersonNames(value)) {
      if (!this._isPersonCandidate(name)) continue;
      addUnique(constraints.people, this._constraint('person', this.normalizer.normalizeLabel(name), confidence, source));
    }
  }

  _isPersonCandidate(value) {
    const name = cleanName(value);
    const normalized = name.toLowerCase();
    if (!normalized || normalized.length < 2 || /^\d+$/.test(normalized)) return false;
    if (NON_PERSON_TERMS.has(normalized)) return false;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length > 4) return false;
    if (tokens.some(token => NON_PERSON_TERMS.has(token) || NON_PERSON_TERMS.has(token.replace(/s$/, '')))) return false;
    if (findVisualConcepts(normalized).length > 0) return false;
    return true;
  }

  _addRelationships(constraints, text) {
    for (const [term, relationship] of Object.entries(RELATIONSHIPS)) {
      const pattern = new RegExp(`\\b(?:my\\s+)?${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(text)) {
        addUnique(constraints.relationships, this._constraint('relationship', relationship, 0.86, 'visual-query.relationship'));
      }
    }
  }

  _addTimes(constraints, context, text) {
    for (const entity of [...context.getEntities('dates'), ...context.getEntities('times')]) {
      const value = entity.canonical || entity.value || entity.text || '';
      if (value) addUnique(constraints.time, this._constraint('time', value, entity.confidence || 0.9, 'assistant.entities', { fromEntity: true }));
    }
    for (const pattern of TIME_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text))) {
        addUnique(constraints.time, this._constraint('time', match[0], 0.82, 'visual-query.time-pattern'));
      }
    }
  }

  _addLocations(constraints, context, text) {
    for (const entity of context.getEntities('locations')) {
      const value = entity.canonical || entity.value || entity.text || '';
      if (value) addUnique(constraints.locations, this._constraint('location', value, entity.confidence || 0.9, 'assistant.entities', { fromEntity: true }));
    }
    this._addLexiconMatches(constraints.locations, text, LOCATION_HINTS, 'location', 0.84);
    const relative = text.match(/\b(?:at|near|inside|outside|in)\s+([a-z][a-z .'-]{2,40})(?=\s+(?:last|with|where|photo|picture|image|screenshot|from|during)\b|$)/i);
    if (relative?.[1]) {
      const value = cleanName(relative[1]);
      if (value) addUnique(constraints.locations, this._constraint('location', this.normalizer.normalizeLabel(value), 0.72, 'visual-query.location-pattern', { ambiguous: true }));
    }
  }

  _addPhotoTypes(constraints, text, parsed) {
    const types = [
      ['selfie', /\bselfie\b/i],
      ['group photo', /\bgroup\s+(?:photo|picture|image)\b/i],
      ['portrait', /\bportrait\b/i],
      ['landscape', /\blandscape\b/i],
      ['screenshot', /\bscreenshot\b/i],
      ['document', /\b(?:document|receipt|invoice|passport|license|id card|bill)\b/i],
      ['wallpaper', /\bwallpaper\b/i],
      ['camera image', /\bcamera\s+(?:photo|image|picture)\b/i]
    ];
    for (const [type, pattern] of types) {
      if (pattern.test(text)) addUnique(constraints.photoTypes, this._constraint('photoType', type, 0.88, 'visual-query.photo-type'));
    }
    if (parsed.mediaHint && constraints.photoTypes.length === 0) {
      addUnique(constraints.photoTypes, this._constraint('photoType', parsed.mediaHint, 0.76, 'visual-query.media-hint'));
    }
  }

  _addPersonCount(constraints, text) {
    const countMap = [
      ['1', /\b(?:me\s+alone|alone|only\s+me|only\s+[a-z]+|just\s+me)\b/i],
      ['2', /\b(?:two\s+people|both\s+of\s+us|just\s+us|we\s+two)\b/i],
      ['3', /\bthree\s+people\b/i],
      ['group', /\b(?:group\s+photo|everyone|crowd|large\s+group|family\s+photo)\b/i]
    ];
    for (const [value, pattern] of countMap) {
      if (pattern.test(text)) addUnique(constraints.personCount, this._constraint('personCount', value, 0.84, 'visual-query.person-count'));
    }
  }

  _addLexiconMatches(target, text, values, type, confidence) {
    for (const value of values) {
      const pattern = new RegExp(`\\b${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(text)) {
        addUnique(target, this._constraint(type, this.normalizer.normalizeLabel(value), confidence, `visual-query.${type}`));
      }
    }
  }

  _addVisualConcepts(constraints, text) {
    for (const concept of findVisualConcepts(text)) {
      addUnique(constraints.scenes, this._constraint('scene', this.normalizer.normalizeLabel(concept.value), 0.88, 'visual-query.visual-concept', {
        matchedAlias: concept.matchedAlias
      }));
    }
  }

  _addQueryText(constraints, context, text) {
    addUnique(constraints.queryText, this._constraint('queryText', context.rawInput || text, 0.99, 'assistant.input'));
  }

  _overallConfidence(parsed, constraints) {
    const values = Object.values(constraints).flat().map(item => item.confidence).filter(Number.isFinite);
    if (values.length === 0) return parsed.confidence || 0;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.max(0, Math.min(0.99, Number(((average * 0.7) + ((parsed.confidence || 0) * 0.3)).toFixed(3))));
  }

  _count(constraints) {
    return Object.values(constraints).reduce((sum, list) => sum + list.length, 0);
  }
}

module.exports = VisualConstraintExtractor;
