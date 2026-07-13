'use strict';

const REFERENCE_PATTERN = /\b(?:it|that|this|them|those|these|they|same|same\s+one|previous\s+one|last\s+file|current\s+app|selected\s+folder|one|ones|there)\b/i;
const CONTINUATION_PATTERN = /^(?:and|also|then|what\s+about|how\s+about|same\s+(?:thing\s+)?(?:with|for)|do\s+(?:the\s+)?same\s+(?:with|for))\b/i;
const CORRECTION_PATTERN = /^(?:no(?:\s+no)?|nah|actually|instead|rather|sorry)\b|\b(?:set|change|make|use)\s+(?:it|that|this|same|one)?\s*(?:to|as)\b/i;
const CLAUSE_CONNECTOR_PATTERN = /\s*(?:;|,|\b(?:and then|then|after that|afterwards|and|also|plus)\b)\s*/i;
const HARD_CLAUSE_CONNECTOR_PATTERN = /\b(?:and then|then|after that|afterwards|also|plus)\b|[;,]/i;
const CLAUSE_ACTION_START_PATTERN = /^(?:open|launch|start|run|close|quit|exit|terminate|minimize|maximize|switch|focus|search|google|look\s+up|find|what|who|when|where|why|how|which|remind|remember|notify|alert|set|turn|send|share|transfer|copy|move|message|text|ask|tell|play|stream|listen|watch|queue|put|pause|resume|unpause|stop|skip|next|previous|create|delete|rename|save|show|list|click|select|choose|pick)\b/i;
const SINGLE_TARGET_ACTION_PATTERN = /^(?:play|stream|listen\s+to|watch|queue|put\s+on|start\s+playing|search|google|look\s+up|find|tell\s+me\s+about|explain|remind|remember|notify|alert|set\s+(?:an?\s+)?(?:reminder|alarm|timer)|open)\b/i;

const PREPOSITIONS = new Set(['at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'onto', 'to', 'with', 'using', 'via']);
const CONNECTORS = new Set(['and', 'then', 'also', 'plus']);
const FILLERS = new Set(['a', 'an', 'me', 'my', 'please', 'the', 'you']);
const REFERENCES = new Set(['it', 'that', 'this', 'them', 'those', 'these', 'they', 'same', 'one', 'ones', 'there']);

function extractDiscourseReferences(input) {
  const normalized = String(input || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) return [];

  const references = [];
  const pattern = /\b(?:same\s+one|previous\s+one|last\s+file|current\s+app|selected\s+folder|it|that|this|them|those|these|they|same|ones|one|there)\b/g;
  let match;
  while ((match = pattern.exec(normalized))) {
    const value = match[0];
    if (value === 'one' && /\b(?:one|1)\s+(?:second|minute|hour|day|week|month|year|am|pm|percent|hundred)\b/.test(normalized)) {
      continue;
    }
    if (!references.includes(value)) references.push(value);
  }
  return references;
}

function analyzeDiscourse(input) {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  const normalized = text.toLowerCase();
  const references = extractDiscourseReferences(normalized);
  const continuation = normalized.match(CONTINUATION_PATTERN)?.[0] || '';
  const isCorrection = CORRECTION_PATTERN.test(normalized);
  return {
    isFollowUp: Boolean(continuation || references.length > 0 || isCorrection),
    isCorrection,
    continuation,
    references: [...new Set(references)],
    requiresContext: Boolean(continuation || isCorrection || REFERENCE_PATTERN.test(normalized))
  };
}

function clauseStartsWithAction(clause) {
  const text = String(clause || '').trim();
  return CLAUSE_ACTION_START_PATTERN.test(text);
}

function shouldKeepSingleClause(source, parts) {
  if (!Array.isArray(parts) || parts.length < 2) return false;
  const text = String(source || '').trim().toLowerCase();
  if (!text || HARD_CLAUSE_CONNECTOR_PATTERN.test(text)) return false;
  if (!SINGLE_TARGET_ACTION_PATTERN.test(text)) return false;
  if (!clauseStartsWithAction(parts[0])) return false;
  if (/^(?:play|stream|listen\s+to|watch|queue|put\s+on|start\s+playing)\b/.test(text)) {
    return parts.slice(1).every(part => !clauseStartsWithAction(part));
  }
  if (/^remind\b/.test(text) && /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|daily|weekly|every)\b/.test(text)) {
    return parts.slice(1).every(part => !clauseStartsWithAction(part));
  }
  return parts.slice(1).every(part => !clauseStartsWithAction(part));
}

function splitCommandClauses(input, options = {}) {
  const source = String(input || '').trim();
  if (!source) return [];
  const parts = source
    .split(CLAUSE_CONNECTOR_PATTERN)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, Number(options.limit || 8));

  if (shouldKeepSingleClause(source, parts)) {
    return [source];
  }

  return parts.length ? parts : [source];
}

function cleanTokens(tokens) {
  return Array.isArray(tokens)
    ? tokens.map(token => String(token || '').trim().toLowerCase()).filter(Boolean)
    : [];
}

function nearestContentToken(tokens, start, direction) {
  for (let index = start; index >= 0 && index < tokens.length; index += direction) {
    const token = tokens[index];
    if (!token || FILLERS.has(token) || PREPOSITIONS.has(token) || CONNECTORS.has(token)) {
      continue;
    }
    return { index, token };
  }
  return null;
}

function pushRelation(relations, relation) {
  if (!relation || relation.fromIndex === relation.toIndex) return;
  const key = `${relation.type}:${relation.fromIndex}:${relation.toIndex}:${relation.marker || ''}`;
  if (relations.some(existing => `${existing.type}:${existing.fromIndex}:${existing.toIndex}:${existing.marker || ''}` === key)) {
    return;
  }
  relations.push(relation);
}

function buildWordRelations(tokens, options = {}) {
  const safeTokens = cleanTokens(tokens);
  if (safeTokens.length === 0) return [];

  const relations = [];
  const actionIndex = Number.isInteger(options.actionIndex) ? options.actionIndex : -1;
  const targetTokens = new Set(cleanTokens(options.targetTokens));

  if (actionIndex >= 0 && actionIndex < safeTokens.length) {
    safeTokens.forEach((token, index) => {
      if (index > actionIndex && targetTokens.has(token)) {
        pushRelation(relations, {
          type: 'action-target',
          fromIndex: actionIndex,
          from: safeTokens[actionIndex],
          toIndex: index,
          to: token
        });
      }
    });
  }

  safeTokens.forEach((token, index) => {
    if (PREPOSITIONS.has(token)) {
      const from = nearestContentToken(safeTokens, index - 1, -1);
      const to = nearestContentToken(safeTokens, index + 1, 1);
      if (from && to) {
        pushRelation(relations, {
          type: 'prepositional-link',
          marker: token,
          fromIndex: from.index,
          from: from.token,
          toIndex: to.index,
          to: to.token
        });
      }
      return;
    }

    if (CONNECTORS.has(token)) {
      const from = nearestContentToken(safeTokens, index - 1, -1);
      const to = nearestContentToken(safeTokens, index + 1, 1);
      if (from && to) {
        pushRelation(relations, {
          type: 'sequence',
          marker: token,
          fromIndex: from.index,
          from: from.token,
          toIndex: to.index,
          to: to.token
        });
      }
      return;
    }

    if (/^\d+$/.test(token)) {
      const target = nearestContentToken(safeTokens, index - 1, -1) ||
        nearestContentToken(safeTokens, index + 1, 1);
      if (target) {
        pushRelation(relations, {
          type: 'value-of',
          fromIndex: index,
          from: token,
          toIndex: target.index,
          to: target.token
        });
      }
      return;
    }

    if (REFERENCES.has(token)) {
      pushRelation(relations, {
        type: 'context-reference',
        fromIndex: index,
        from: token,
        toIndex: -1,
        to: 'previous-context'
      });
    }
  });

  return relations;
}

module.exports = {
  analyzeDiscourse,
  buildWordRelations,
  extractDiscourseReferences,
  splitCommandClauses
};
