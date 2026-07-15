'use strict';

const deepFreeze = require('../../../../utils/ObjectFreeze');
const { VISUAL_QUERY_VERSION } = require('./VisualQueryContracts');

function freezeList(value) {
  return Array.isArray(value) ? value.map(item => ({ ...item })) : [];
}

class VisualQueryResult {
  constructor(input = {}) {
    this.active = input.active === true;
    this.intent = input.intent || null;
    this.media = input.media || null;
    this.owner = input.owner || null;
    this.constraints = {
      media: freezeList(input.constraints?.media),
      owner: freezeList(input.constraints?.owner),
      people: freezeList(input.constraints?.people),
      relationships: freezeList(input.constraints?.relationships),
      time: freezeList(input.constraints?.time),
      locations: freezeList(input.constraints?.locations),
      scenes: freezeList(input.constraints?.scenes),
      events: freezeList(input.constraints?.events),
      photoTypes: freezeList(input.constraints?.photoTypes),
      personCount: freezeList(input.constraints?.personCount),
      sourceApps: freezeList(input.constraints?.sourceApps),
      documentTypes: freezeList(input.constraints?.documentTypes),
      queryText: freezeList(input.constraints?.queryText)
    };
    this.confidence = Math.max(0, Math.min(1, Number(input.confidence || 0)));
    this.validation = input.validation || { valid: true, warnings: [], errors: [], needsClarification: false };
    this.needsClarification = Boolean(input.needsClarification || this.validation.needsClarification);
    this.diagnostics = Array.isArray(input.diagnostics) ? input.diagnostics.slice() : [];
    this.source = input.source || 'visual-query';
    this.rawInput = String(input.rawInput || '');
    this.normalizedInput = String(input.normalizedInput || '');
    this.timing = { ...(input.timing || {}) };
    this.version = VISUAL_QUERY_VERSION;
    deepFreeze(this);
  }

  toJSON() {
    return {
      active: this.active,
      intent: this.intent,
      media: this.media,
      owner: this.owner,
      constraints: this.constraints,
      confidence: this.confidence,
      validation: this.validation,
      needsClarification: this.needsClarification,
      diagnostics: this.diagnostics,
      source: this.source,
      rawInput: this.rawInput,
      normalizedInput: this.normalizedInput,
      timing: this.timing,
      version: this.version
    };
  }
}

module.exports = VisualQueryResult;
