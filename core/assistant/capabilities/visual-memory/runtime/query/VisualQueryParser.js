'use strict';

const { VISUAL_QUERY_INTENTS } = require('./VisualQueryContracts');
const { getVisualConceptTerms } = require('../utils/VisualConceptLexicon');

const VISUAL_TERMS = [
  'photo', 'photos', 'picture', 'pictures', 'pic', 'pics', 'image', 'images',
  'screenshot', 'screenshots', 'wallpaper', 'wallpapers', 'selfie', 'selfies',
  'receipt', 'receipts', 'invoice', 'invoices', 'document', 'documents',
  'passport', 'license', 'id card', 'album', 'gallery', 'memories',
  'camera photo', 'vacation pictures', 'holiday photos', 'family photos',
  'birthday photos', 'wedding photos', 'college memories',
  ...getVisualConceptTerms()
];

const VISUAL_ACTIONS = [
  'find', 'show', 'open', 'search', 'look for', 'get', 'bring', 'display',
  'where is', 'where are', 'do i have', 'can you find', 'can you show'
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class VisualQueryParser {
  constructor({ normalizer } = {}) {
    this.normalizer = normalizer;
    this.visualTermPattern = new RegExp(`\\b(?:${VISUAL_TERMS.map(escapeRegExp).join('|')})\\b`, 'i');
    this.actionPattern = new RegExp(`^(?:${VISUAL_ACTIONS.map(escapeRegExp).join('|')})\\b|\\b(?:${VISUAL_ACTIONS.map(escapeRegExp).join('|')})\\b`, 'i');
  }

  parse(context) {
    const text = this.normalizer.normalizeText(context.getText());
    if (this._isGalleryOpenOnly(text)) {
      return {
        active: false,
        intent: null,
        normalizedText: text,
        mediaHint: 'gallery',
        actionHint: 'open',
        confidence: 0
      };
    }
    const hasVisualTerm = this.visualTermPattern.test(text);
    const hasVisualIntent = /^photo\.|^visual\.|^gallery\.|^image\./i.test(String(context.intent || ''));
    const hasMemoryPhrase = /\b(?:memories|memory|remember\s+when|from\s+(?:childhood|college|school|vacation|trip))\b/i.test(text);
    const active = Boolean(hasVisualIntent || hasVisualTerm || hasMemoryPhrase);
    if (!active) {
      return {
        active: false,
        intent: null,
        normalizedText: text,
        mediaHint: null,
        actionHint: null,
        confidence: 0
      };
    }

    const actionHint = this._actionHint(text);
    const mediaHint = this._mediaHint(text);
    const intent = actionHint === 'show'
      ? VISUAL_QUERY_INTENTS.SHOW
      : actionHint === 'find'
        ? VISUAL_QUERY_INTENTS.FIND
        : VISUAL_QUERY_INTENTS.SEARCH;

    return {
      active: true,
      intent,
      normalizedText: text,
      mediaHint,
      actionHint,
      confidence: Math.max(0.72, Math.min(0.98, (hasVisualIntent ? 0.18 : 0) + (hasVisualTerm ? 0.58 : 0.34) + (actionHint ? 0.16 : 0.08)))
    };
  }

  _actionHint(text) {
    if (/\b(?:show|display|open|bring)\b/.test(text)) return 'show';
    if (/\b(?:find|look\s+for|get|where\s+(?:is|are)|do\s+i\s+have|search)\b/.test(text)) return 'find';
    return '';
  }

  _mediaHint(text) {
    const match = text.match(this.visualTermPattern);
    return match ? this.normalizer.normalizeMedia(match[0]) : 'photo';
  }

  _isGalleryOpenOnly(text) {
    return /^(?:open|show|view|launch|display)\s+(?:my\s+)?(?:openx\s+)?(?:gallery|gallary|photos?|pictures?|photo\s+library|memories)$/.test(text);
  }
}

module.exports = VisualQueryParser;
