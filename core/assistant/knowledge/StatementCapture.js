'use strict';

const RELATION_SYNONYMS = {
  mother: ['mother', 'mom', 'mum', 'mummy', 'mamma', 'maa', 'amma'],
  father: ['father', 'dad', 'daddy', 'papa', 'abba'],
  sister: ['sister'],
  brother: ['brother'],
  wife: ['wife'],
  husband: ['husband'],
  daughter: ['daughter'],
  son: ['son'],
  grandmother: ['grandmother', 'grandma', 'granny'],
  grandfather: ['grandfather', 'grandpa'],
  aunt: ['aunt', 'aunty', 'auntie'],
  uncle: ['uncle'],
  cousin: ['cousin'],
  niece: ['niece'],
  nephew: ['nephew']
};

const RELATION_PATTERN = Object.keys(RELATION_SYNONYMS)
  .map(canonical => RELATION_SYNONYMS[canonical])
  .reduce((all, list) => all.concat(list), [])
  .sort((a, b) => b.length - a.length)
  .join('|');

const HAS_A_RELATIONS = 'brother|sister|son|daughter|cousin|niece|nephew|uncle|aunt';


const ADJECTIVE_NON_NAMES = new Set([
  'fine', 'good', 'great', 'well', 'okay', 'ok', 'awesome', 'nice', 'tired',
  'happy', 'sad', 'bored', 'busy', 'hungry', 'sleepy', 'excited', 'ready',
  'here', 'back', 'home', 'alone', 'boring', 'amazing', 'fine', 'super'
]);

const COMMAND_WORDS = /\b(?:open|close|launch|play|pause|stop|write|send|create|delete|make|set|remind|schedule|install|uninstall|search|find|add|run|open|start|turn\s+(?:on|off))\b/i;

function truncateAtConjunction(text) {
  return String(text || '')
    .replace(/\s+(?:and|but|or|also|with|while|who|which)\b.*$/i, '')
    .trim();
}

function normalizeObject(value, maxWords = 4) {
  const cleaned = truncateAtConjunction(String(value || ''))
    .replace(/\s+/g, ' ')
    .replace(/[.!?\s]+$/, '')
    .replace(/\s+[.!?]+$/, '')
    .trim();
  if (!cleaned) {
    return null;
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    return null;
  }
  if (/\d/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function cleanRelationshipName(value) {
  const cleaned = truncateAtConjunction(String(value || ''))
    .replace(/\s+(?:is|are)\s+.*$/i, '')
    .replace(/[.!?\s]+$/, '')
    .replace(/\s+[.!?]+$/, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 3) {
    return null;
  }
  if (/\d/.test(cleaned) || COMMAND_WORDS.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function looksLikeQuestion(text) {
  return /[?]/.test(text);
}

function containsNegation(text) {
  return /\b(?:not|n't|never|hardly)\b/.test(text);
}

function isShortSelfStatement(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return words >= 2 && words <= 8;
}

function resolveRelation(word) {
  const lower = String(word || '').toLowerCase().replace(/['']$/, '');
  for (const canonical of Object.keys(RELATION_SYNONYMS)) {
    if (RELATION_SYNONYMS[canonical].includes(lower)) {
      return canonical;
    }
  }
  return null;
}

class StatementCapture {
  extract(input) {
    const text = String(input || '');
    if (!text || text.trim().length < 6) {
      return [];
    }
    if (looksLikeQuestion(text)) {
      return [];
    }
    const candidates = [];
    const trimmed = text.replace(/\s+/g, ' ').trim();
    const matchLower = trimmed.toLowerCase();

    if (containsNegation(trimmed)) {
      return [];
    }

    const identityName = this._matchIdentityName(trimmed, matchLower);
    if (identityName) {
      candidates.push(identityName);
    }

    const relationship = this._matchRelationship(trimmed, matchLower);
    if (relationship) {
      candidates.push(relationship);
    }

    const location = this._matchLocation(trimmed, matchLower);
    if (location) {
      candidates.push(location);
    }

    const birthday = this._matchBirthday(trimmed, matchLower);
    if (birthday) {
      candidates.push(birthday);
    }

    return candidates;
  }

  _matchIdentityName(text, lowered) {
    const patterns = [
      /^my name is (.+)$/i,
      /\bmy name(?:'s|s| is)\s+(.+)$/i,
      /\bi(?:'m| am) called (.+)$/i,
      /\bcall me (.+)$/i
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (!match) {
        continue;
      }
      const object = normalizeObject(match[1]);
      if (!object || COMMAND_WORDS.test(object) || ADJECTIVE_NON_NAMES.has(object.toLowerCase())) {
        continue;
      }
      return {
        domain: 'identity',
        subject: 'user',
        predicate: 'has_name',
        object,
        attributes: {},
        source: 'explicit_statement'
      };
    }

    if (isShortSelfStatement(text)) {
      const match = /^i(?:'m| am)\s+(.+)$/i.exec(text);
      if (match) {
        const object = normalizeObject(match[1], 1);
        if (object &&
            !/^(?:from|in|at)\s/i.test(object) &&
            !COMMAND_WORDS.test(object) &&
            !ADJECTIVE_NON_NAMES.has(object.toLowerCase()) &&
            !/-ing$/i.test(object)) {
          return {
            domain: 'identity',
            subject: 'user',
            predicate: 'has_name',
            object,
            attributes: {},
            source: 'explicit_statement'
          };
        }
      }
    }
    return null;
  }

  _matchRelationship(text, lowered) {
    const possessive = new RegExp(
      `\\bmy\\s+(${RELATION_PATTERN})(?:'s|s|’s|c'?s)\\s+name\\s+is\\s+(.+)$`,
      'i'
    );
    const direct = new RegExp(
      `\\bmy\\s+(${RELATION_PATTERN})\\s+is\\s+(.+)$`,
      'i'
    );
    const haveA = new RegExp(
      `\\bi\\s+have\\s+a\\s+(${HAS_A_RELATIONS})(?:\\s+(?:named|called))?\\s+(.+)$`,
      'i'
    );

    const match = possessive.exec(text) || direct.exec(text) || haveA.exec(text);
    if (!match) {
      return null;
    }
    const canonicalRelation = resolveRelation(match[1]);
    if (!canonicalRelation) {
      return null;
    }
    let object;
    if (direct.exec(text)) {
      object = cleanRelationshipName(match[2]).replace(/^(?:name|the)\s+(?:is|are)\s*/, '');
    } else {
      object = cleanRelationshipName(match[2]);
    }
    if (!object || object.length < 2) {
      return null;
    }
    return {
      domain: 'relationship',
      subject: canonicalRelation,
      predicate: 'has_name',
      object,
      attributes: {
        relation: canonicalRelation,
        discoveredFrom: 'explicit_statement'
      },
      source: 'explicit_statement'
    };
  }

  _matchLocation(text, lowered) {
    const patterns = [
      /\bi live in (.+)$/i,
      /\bmy hometown is (.+)$/i,
      /\bmy home town is (.+)$/i,
      /\bi(?:'m| am) from (.+)$/i
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (!match) {
        continue;
      }
      const object = normalizeObject(match[1]);
      if (!object || COMMAND_WORDS.test(object)) {
        continue;
      }
      return {
        domain: 'identity',
        subject: 'user',
        predicate: 'has_location',
        object,
        attributes: {},
        source: 'explicit_statement'
      };
    }
    return null;
  }

  _matchBirthday(text, lowered) {
    const patterns = [
      /\bmy birthday is (.+)$/i,
      /\bi(?:'m| was) born on (.+)$/i,
      /\bi(?:'m| was) born in (.+)$/i
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (!match) {
        continue;
      }
      const raw = String(match[1] || '')
        .replace(/\s+/g, ' ')
        .replace(/[.!?\s]+$/, '')
        .trim();
      const datePattern = /^(?:\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:[,]?\s+\d{2,4})?|[A-Za-z]{3,9}\s+\d{1,2}(?:[,]?\s+\d{2,4})?)$/;
      if (!datePattern.test(raw)) {
        continue;
      }
      return {
        domain: 'identity',
        subject: 'user',
        predicate: 'date_of_birth',
        object: raw,
        attributes: {},
        source: 'explicit_statement'
      };
    }
    return null;
  }

  static buildQuestion(candidate, existingObject = null) {
    if (!candidate) {
      return '';
    }
    const object = String(candidate.object || '').trim();
    if (candidate.domain === 'identity' && candidate.predicate === 'has_name') {
      return existingObject
        ? `I already have your name as "${existingObject}". Should I update it to "${object}"?`
        : `Should I remember your name as "${object}"? I only store facts you confirm.`;
    }
    if (candidate.domain === 'identity' && candidate.predicate === 'has_location') {
      return existingObject
        ? `I already have your hometown as "${existingObject}". Should I update it to "${object}"?`
        : `Should I remember that you live in "${object}"? I only store facts you confirm.`;
    }
    if (candidate.domain === 'identity' && candidate.predicate === 'date_of_birth') {
      return `Should I remember your birthday as "${object}"? I only store facts you confirm.`;
    }
    if (candidate.domain === 'relationship' && candidate.subject) {
      return existingObject
        ? `I already have your ${candidate.subject}'s name as "${existingObject}". Should I update it to "${object}"?`
        : `Should I remember that your ${candidate.subject} is named "${object}"? I only store facts you confirm.`;
    }
    return `Should I remember "${object}"? I only store facts you confirm.`;
  }
}

module.exports = StatementCapture;
module.exports.RELATION_SYNONYMS = RELATION_SYNONYMS;