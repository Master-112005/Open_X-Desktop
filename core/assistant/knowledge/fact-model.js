'use strict';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CONFIDENCE_FLOOR = 0.2;
const MAX_CONFIDENCE = 0.99;
const REINFORCE_STEP = 0.2;

const SOURCES = ['explicit_statement', 'inferred', 'corrected', 'imported'];
const SENSITIVITIES = ['low', 'medium', 'high'];

const DOMAIN_CONFIG = {
  identity: { decayPerWeek: 0, sensitivity: 'high', defaultConfidence: 0.9, expires: false },
  relationship: { decayPerWeek: 0, sensitivity: 'high', defaultConfidence: 0.9, expires: false },
  routine: { decayPerWeek: 0.05, sensitivity: 'medium', defaultConfidence: 0.4, expires: false },
  preference: { decayPerWeek: 0.02, sensitivity: 'low', defaultConfidence: 0.5, expires: false },
  context: { decayPerWeek: 0.2, sensitivity: 'low', defaultConfidence: 0.5, expires: true },
  behavioral: { decayPerWeek: 0.05, sensitivity: 'low', defaultConfidence: 0.4, expires: false }
};

const MODELING_DOMAINS = ['routine', 'preference', 'context', 'behavioral'];

function isKnownDomain(domain) {
  return Object.prototype.hasOwnProperty.call(DOMAIN_CONFIG, domain);
}

function domainConfig(domain) {
  return isKnownDomain(domain) ? DOMAIN_CONFIG[domain] : DOMAIN_CONFIG.context;
}

function confidenceForSource(source) {
  switch (source) {
    case 'explicit_statement': return 0.9;
    case 'corrected': return 0.95;
    case 'imported': return 0.7;
    default: return 0.5;
  }
}

function normalizeSensitivity(domain, subject, requested) {
  if (domain === 'identity' || domain === 'relationship') {
    return 'high';
  }
  if (requested && SENSITIVITIES.includes(requested)) {
    return requested;
  }
  return domainConfig(domain).sensitivity;
}

function makeFactId(index) {
  return `fact_${String(index).padStart(4, '0')}`;
}

function roundConfidence(value) {
  const clamped = Math.min(Math.max(Number(value) || 0, CONFIDENCE_FLOOR), 1);
  return Math.round(Math.min(clamped, MAX_CONFIDENCE) * 1000) / 1000;
}

function createFact(input = {}) {
  const domain = String(input.domain || '').trim();
  if (!isKnownDomain(domain)) {
    throw new Error(`Unknown learning domain: ${domain}`);
  }
  const predicate = String(input.predicate || '').trim();
  if (!predicate) {
    throw new Error('Predicate is required for a learning fact');
  }
  const object = input.object;
  if (object === undefined || object === null || object === '') {
    throw new Error('Object is required for a learning fact');
  }
  const source = SOURCES.includes(input.source) ? input.source : 'explicit_statement';
  const requestedConfidence = Number.isFinite(input.confidence)
    ? input.confidence
    : confidenceForSource(source);
  if (!(requestedConfidence >= CONFIDENCE_FLOOR && requestedConfidence <= 1)) {
    throw new RangeError(`Confidence must be within [${CONFIDENCE_FLOOR}, 1]`);
  }
  const now = input.now ? new Date(input.now) : new Date();
  const subject = String(input.subject && input.subject !== 'null' ? input.subject : 'user').trim();
  const sensitivity = normalizeSensitivity(domain, subject, input.sensitivity);

  return {
    id: input.id || makeFactId(Number(input.index) || 0),
    domain,
    subject,
    predicate,
    object,
    attributes: { ...(input.attributes || {}) },
    confidence: roundConfidence(requestedConfidence),
    source,
    evidence_count: Math.max(0, Number(input.evidence_count) || 0),
    first_seen: input.first_seen || now.toISOString(),
    last_reinforced: input.last_reinforced || now.toISOString(),
    user_confirmed: Boolean(input.userConfirmed),
    sensitivity,
    editable: true,
    deleted: false,
    history: Array.isArray(input.history) ? input.history.slice() : []
  };
}

function applyReinforcement(record, options = {}) {
  const strength = Number(options.strength) > 0 ? Number(options.strength) : 1;
  const at = options.at ? new Date(options.at) : new Date();
  const increase = (1 - record.confidence) * REINFORCE_STEP * strength;
  return {
    ...record,
    confidence: roundConfidence(record.confidence + increase),
    evidence_count: (Number(record.evidence_count) || 0) + 1,
    last_reinforced: at.toISOString(),
    user_confirmed: Boolean(record.user_confirmed) || options.confirmed === true
  };
}

function applyDecay(record, options = {}) {
  const config = domainConfig(record.domain);
  if (!config.decayPerWeek) {
    return { confidence: record.confidence, expired: false };
  }
  const at = options.at ? new Date(options.at) : new Date();
  const lastReinforced = Date.parse(record.last_reinforced) || at.getTime();
  const weeks = Math.max(0, (at.getTime() - lastReinforced) / WEEK_MS);
  const decayed = (Number(record.confidence) || 0) * Math.pow(1 - config.decayPerWeek, weeks);
  return {
    confidence: Math.round(Math.max(decayed, CONFIDENCE_FLOOR) * 1000) / 1000,
    expired: decayed < CONFIDENCE_FLOOR
  };
}

function supersedeRecord(record, options = {}) {
  const at = options.at ? new Date(options.at) : new Date();
  const changedAt = at.toISOString();
  const history = Array.isArray(record.history) ? record.history.slice() : [];
  history.push({
    object: record.object,
    changed_at: changedAt,
    reason: String(options.reason || 'correction')
  });
  const correctedConfidence = Math.max(Number(record.confidence) || 0, confidenceForSource('corrected'));
  return {
    ...record,
    object: options.object,
    attributes: { ...(options.attributes || {}) },
    confidence: roundConfidence(correctedConfidence),
    evidence_count: (Number(record.evidence_count) || 0) + 1,
    last_reinforced: changedAt,
    user_confirmed: Boolean(record.user_confirmed) || options.confirmed === true,
    history
  };
}

function validateStoredRecord(record) {
  if (!record || typeof record !== 'object') {
    return ['not an object'];
  }
  const problems = [];
  if (!isKnownDomain(record.domain)) problems.push('domain');
  if (!String(record.predicate || '').trim()) problems.push('predicate');
  if (record.object === undefined || record.object === null || record.object === '') problems.push('object');
  if (!SOURCES.includes(record.source)) problems.push('source');
  if (!Number.isFinite(record.confidence) || record.confidence < CONFIDENCE_FLOOR || record.confidence > 1) {
    problems.push('confidence');
  }
  if (record.sensitivity && !SENSITIVITIES.includes(record.sensitivity)) problems.push('sensitivity');
  return problems.length > 0 ? problems : null;
}

module.exports = {
  DOMAIN_CONFIG,
  SENSITIVITIES,
  SOURCES,
  MODELING_DOMAINS,
  WEEK_MS,
  CONFIDENCE_FLOOR,
  MAX_CONFIDENCE,
  REINFORCE_STEP,
  isKnownDomain,
  domainConfig,
  confidenceForSource,
  normalizeSensitivity,
  makeFactId,
  createFact,
  applyReinforcement,
  applyDecay,
  supersedeRecord,
  validateStoredRecord,
  roundConfidence
};