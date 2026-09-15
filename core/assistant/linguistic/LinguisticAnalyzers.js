'use strict';

class BaseAnalyzer {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports() {
    return this.enabled;
  }

  analyze(context) {
    return context;
  }

  validate(context) {
    return !!context;
  }

  cleanup() {
    return true;
  }

  text(context) {
    return String(context?.normalizedSentence || context?.originalSentence || '').trim();
  }

  tokens(context) {
    return Array.isArray(context?.tokens) ? context.tokens : [];
  }

  tokenText(tokens = []) {
    return tokens.map(token => token.value).join(' ').replace(/\s+([,.!?;:])/g, '$1').trim();
  }

  spanText(context, startToken, endToken) {
    const tokens = this.tokens(context).slice(startToken, endToken + 1)
      .filter(token => !['punctuation', 'sentence-punctuation'].includes(token.type));
    return this.tokenText(tokens);
  }

  isActionToken(value) {
    return /^(?:open|launch|start|run|close|quit|exit|terminate|minimize|maximize|switch|focus|search|google|look|find|remind|remember|notify|alert|set|turn|send|share|transfer|copy|move|message|text|ask|tell|play|stream|listen|watch|queue|pause|resume|stop|skip|jump|next|previous|create|delete|rename|save|show|list|call|dial|wake)$/i.test(String(value || ''));
  }

  isConnector(value) {
    return /^(?:and|then|also|plus|but|or|because|if|when|while|after|before)$/i.test(String(value || ''));
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

const TOKEN_PATTERN = /"[^"]*"|'[^']*'|\p{Emoji_Presentation}|\d+(?:[:.]\d+)?%?|[A-Za-z]+(?:[-'][A-Za-z]+)?|[^\s]/gu;

function classifyToken(value) {
  if (/^["'].*["']$/u.test(value)) return 'quote';
  if (/^\p{Emoji_Presentation}$/u.test(value)) return 'emoji';
  if (/^\d+(?:[:.]\d+)?$/u.test(value)) return 'number';
  if (/^[A-Za-z]+(?:'[A-Za-z]+)?$/u.test(value)) return 'word';
  if (/^[.!?]$/u.test(value)) return 'sentence-punctuation';
  if (/^[,;:]$/u.test(value)) return 'punctuation';
  return 'symbol';
}

function classifyShape(value) {
  if (/^\d/.test(value)) return 'number';
  if (/^[A-Z][a-z]+$/.test(value)) return 'title';
  if (/^[A-Z]+$/.test(value)) return 'upper';
  if (/^[a-z]+$/.test(value)) return 'lower';
  return 'mixed';
}

class Tokenizer extends BaseAnalyzer {
  analyze(context) {
    const text = String(context.normalizedSentence || '');
    const tokens = [];
    let match;
    while ((match = TOKEN_PATTERN.exec(text)) !== null) {
      tokens.push({
        id: `tok_${tokens.length}`,
        index: tokens.length,
        value: match[0],
        lower: match[0].toLowerCase(),
        type: classifyToken(match[0]),
        shape: classifyShape(match[0]),
        isAction: this.isActionToken(match[0]),
        start: match.index,
        end: match.index + match[0].length
      });
    }
    const limit = Number(context.configuration?.maxTokens || 512);
    context.tokens = tokens.slice(0, limit);
    if (tokens.length > context.tokens.length) {
      context.addWarning('Input token stream truncated for linguistic analysis.', {
        originalCount: tokens.length,
        retainedCount: context.tokens.length
      });
    }
    context.addDiagnostic({ analyzerId: this.id, message: 'Tokens produced.', data: { count: context.tokens.length } });
    return context;
  }
}

class SentenceSplitter extends BaseAnalyzer {
  analyze(context) {
    const tokens = context.tokens || [];
    if (tokens.length === 0) {
      context.sentences = [];
      return context;
    }
    const sentences = [];
    let startToken = 0;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const isBoundary = token.type === 'sentence-punctuation' || index === tokens.length - 1;
      if (!isBoundary) continue;
      const endToken = index;
      const sentenceTokens = tokens.slice(startToken, endToken + 1);
      if (sentenceTokens.length > 0) {
        sentences.push({
          id: `sent_${sentences.length}`,
          index: sentences.length,
          startToken,
          endToken,
          start: sentenceTokens[0].start,
          end: sentenceTokens[sentenceTokens.length - 1].end,
          text: context.normalizedSentence.slice(sentenceTokens[0].start, sentenceTokens[sentenceTokens.length - 1].end).trim(),
          tokenCount: sentenceTokens.length,
          kind: sentenceTokens.some(item => item.value === '?') ? 'question' : 'statement'
        });
      }
      startToken = index + 1;
    }
    context.sentences = sentences.length > 0 ? sentences : [{
      id: 'sent_0',
      index: 0,
      startToken: 0,
      endToken: Math.max(0, tokens.length - 1),
      start: 0,
      end: context.normalizedSentence.length,
      text: context.normalizedSentence,
      tokenCount: tokens.length,
      kind: /\?\s*$/.test(context.normalizedSentence) ? 'question' : 'statement'
    }];
    return context;
  }
}

const SUBORDINATORS = new Set(['because', 'if', 'when', 'while', 'although', 'after', 'before', 'since', 'unless', 'whereas']);
const COORDINATORS = new Set(['and', 'but', 'or', 'nor', 'yet', 'so']);
const RELATIVE = new Set(['who', 'which', 'that', 'whose', 'whom']);

class ClauseAnalyzer extends BaseAnalyzer {
  analyze(context) {
    const clauses = [];
    for (const sentence of context.sentences || []) {
      let startToken = sentence.startToken;
      for (let index = sentence.startToken; index <= sentence.endToken; index += 1) {
        const token = context.tokens[index];
        if (!token) continue;
        const lower = token.lower;
        const boundary = index > startToken && this._isBoundary(context, sentence, startToken, index, lower);
        if (!boundary) continue;
        clauses.push(this._buildClause(context, sentence, startToken, index - 1, clauses.length, lower));
        startToken = index;
      }
      if (startToken <= sentence.endToken) {
        clauses.push(this._buildClause(context, sentence, startToken, sentence.endToken, clauses.length, 'main'));
      }
    }
    context.clauses = clauses;
    return context;
  }

  _isBoundary(context, sentence, startToken, index, lower) {
    const token = context.tokens[index];
    const nextWord = this._nextWord(context.tokens, index + 1, sentence.endToken);
    if (token?.value === ',') return true;
    if (SUBORDINATORS.has(lower) || RELATIVE.has(lower)) return true;
    if (!COORDINATORS.has(lower)) return false;
    if (['but', 'or', 'so', 'yet'].includes(lower)) return true;
    if (lower === 'and') {
      const priorAction = context.tokens
        .slice(startToken, index)
        .some(item => item?.isAction || this.isActionToken(item?.lower));
      return priorAction && Boolean(nextWord && (nextWord.isAction || this.isActionToken(nextWord.lower)));
    }
    return Boolean(nextWord && (nextWord.isAction || this.isActionToken(nextWord.lower)));
  }

  _nextWord(tokens, start, end) {
    for (let index = start; index <= end; index += 1) {
      const token = tokens[index];
      if (token?.type === 'word') return token;
    }
    return null;
  }

  _buildClause(context, sentence, startToken, endToken, index, marker) {
    const tokens = context.tokens.slice(startToken, endToken + 1).filter(token => token.type !== 'punctuation' && token.type !== 'sentence-punctuation');
    const first = tokens[0]?.lower || marker;
    const actionToken = tokens.find(token => token.isAction || this.isActionToken(token.lower));
    let type = index === 0 ? 'main' : 'independent';
    if (SUBORDINATORS.has(first)) type = 'subordinate';
    if (COORDINATORS.has(first)) type = 'coordinate';
    if (RELATIVE.has(first)) type = 'relative';
    if (first === 'if' || first === 'unless') type = 'conditional';
    return {
      id: `clause_${index}`,
      sentenceId: sentence.id,
      index,
      type,
      startToken,
      endToken,
      parentId: index === 0 ? null : `clause_${Math.max(0, index - 1)}`,
      text: this.tokenText(tokens),
      actionToken: actionToken?.lower || null,
      tokenCount: tokens.length
    };
  }
}

const DEPRP_COMMON_VERBS = new Set(['open', 'opened', 'close', 'closed', 'find', 'search', 'google', 'lookup', 'play', 'pause', 'resume', 'set', 'send', 'share', 'transfer', 'show', 'tell', 'ask', 'remind', 'call', 'wish', 'create', 'delete', 'move', 'copy', 'read', 'write', 'start', 'stop', 'turn', 'increase', 'decrease', 'make', 'need', 'needed', 'wake', 'jump']);
const DEPRP_PRONOUNS = new Set(['i', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they', 'them', 'this', 'that']);

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
      const clause = this._clauseForIndex(context, verb.index);
      const clauseTags = tokenTags.filter(tag => !clause || (tag.index >= clause.startToken && tag.index <= clause.endToken));
      const subject = [...clauseTags].reverse().find(tag => tag.index < verb.index && ['noun', 'pronoun'].includes(tag.tag));
      const object = clauseTags.find(tag => tag.index > verb.index && ['noun', 'pronoun', 'numeral'].includes(tag.tag));
      if (subject) dependencies.push({ governor: verb.tokenId, dependent: subject.tokenId, relation: 'subject', clauseId: clause?.id || null, confidence: 0.62 });
      if (object) dependencies.push({ governor: verb.tokenId, dependent: object.tokenId, relation: 'object', clauseId: clause?.id || null, confidence: 0.62 });
    }
    tokenTags.forEach(tag => {
      if (!['adjective', 'determiner'].includes(tag.tag)) return;
      const head = tokenTags.find(candidate => candidate.index > tag.index && candidate.tag === 'noun');
      if (head) dependencies.push({ governor: head.tokenId, dependent: tag.tokenId, relation: 'modifier', clauseId: this._clauseForIndex(context, tag.index)?.id || null, confidence: 0.58 });
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

  _clauseForIndex(context, index) {
    return (context.clauses || []).find(clause => index >= clause.startToken && index <= clause.endToken) || null;
  }

  _roughTag(token) {
    if (!token) return 'unknown';
    if (token.type === 'number') return 'numeral';
    if (token.type !== 'word') return 'punctuation';
    if (DEPRP_PRONOUNS.has(token.lower)) return 'pronoun';
    if (DEPRP_COMMON_VERBS.has(token.lower) || token.lower.endsWith('ed') || token.lower.endsWith('ing')) return 'verb';
    return 'noun';
  }
}

const POS_PRONOUNS = new Set(['i', 'me', 'you', 'he', 'him', 'she', 'her', 'it', 'we', 'us', 'they', 'them', 'this', 'that', 'these', 'those', 'same', 'one', 'ones', 'there']);
const DETERMINERS = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'each', 'every']);
const PREPOSITIONS = new Set(['in', 'on', 'at', 'to', 'from', 'for', 'with', 'without', 'about', 'after', 'before', 'over', 'under', 'into', 'through', 'between', 'beside', 'near', 'onto', 'via', 'using', 'until']);
const CONJUNCTIONS = new Set(['and', 'or', 'but', 'because', 'if', 'while', 'when', 'although', 'so', 'then', 'also', 'plus']);
const AUXILIARIES = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had']);
const MODALS = new Set(['can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must']);
const POS_COMMON_VERBS = new Set(['open', 'close', 'find', 'search', 'google', 'lookup', 'play', 'pause', 'resume', 'set', 'send', 'share', 'transfer', 'show', 'tell', 'ask', 'reply', 'respond', 'remind', 'alert', 'notify', 'call', 'wish', 'create', 'delete', 'move', 'copy', 'read', 'write', 'start', 'stop', 'turn', 'increase', 'decrease', 'make', 'need', 'needed', 'wake', 'snooze', 'jump']);
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
    if (POS_PRONOUNS.has(lower)) return 'pronoun';
    if (DETERMINERS.has(lower)) return 'determiner';
    if (PREPOSITIONS.has(lower)) return 'preposition';
    if (CONJUNCTIONS.has(lower)) return 'conjunction';
    if (AUXILIARIES.has(lower)) return 'auxiliary';
    if (MODALS.has(lower)) return 'modal';
    if (POS_COMMON_VERBS.has(lower) || lower.endsWith('ing') || lower.endsWith('ed')) return 'verb';
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

class VerbDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    context.verbs = tags
      .filter(tag => ['verb', 'auxiliary', 'modal'].includes(tag.tag))
      .map(tag => ({
        tokenId: tag.tokenId,
        index: tag.index,
        value: tag.value,
        lemma: tag.lemma || String(tag.value || '').toLowerCase(),
        role: tag.tag === 'verb' ? 'main' : tag.tag,
        clauseId: this._clauseForIndex(context, tag.index)?.id || null,
        polarity: this._hasNegationBefore(context, tag.index) ? 'negative' : 'positive',
        tense: /ed$/i.test(tag.value) ? 'past' : /ing$/i.test(tag.value) ? 'progressive' : 'unspecified',
        aspect: /ing$/i.test(tag.value) ? 'progressive' : 'simple',
        mood: tag.tag === 'modal' ? 'modal' : 'indicative',
        confidence: tag.confidence
      }));
    return context;
  }

  _clauseForIndex(context, index) {
    return (context.clauses || []).find(clause => index >= clause.startToken && index <= clause.endToken) || null;
  }

  _hasNegationBefore(context, index) {
    return (context.tokens || []).slice(Math.max(0, index - 3), index)
      .some(token => /^(?:not|never|no|cannot|can't|don't|doesn't|didn't|isn't|aren't)$/i.test(token.value));
  }
}

class SubjectDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    const subjects = [];
    for (const sentence of context.sentences || []) {
      const sentenceTags = tags.filter(tag => tag.index >= sentence.startToken && tag.index <= sentence.endToken);
      const firstVerb = sentenceTags.find(tag => ['verb', 'auxiliary', 'modal'].includes(tag.tag));
      const explicit = sentenceTags
        .filter(tag => firstVerb && tag.index < firstVerb.index && ['noun', 'pronoun'].includes(tag.tag))
        .slice(-1)[0];
      if (explicit) {
        subjects.push({ sentenceId: sentence.id, clauseId: this._clauseForIndex(context, explicit.index)?.id || null, tokenId: explicit.tokenId, index: explicit.index, value: explicit.value, type: 'explicit', confidence: 0.72 });
      } else if (firstVerb) {
        subjects.push({ sentenceId: sentence.id, clauseId: this._clauseForIndex(context, firstVerb.index)?.id || null, tokenId: null, index: firstVerb.index, value: 'you', type: 'implicit', confidence: 0.52 });
      }
    }
    context.subjects = subjects;
    return context;
  }

  _clauseForIndex(context, index) {
    return (context.clauses || []).find(clause => index >= clause.startToken && index <= clause.endToken) || null;
  }
}

class ObjectDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    const objects = [];
    for (const verb of context.verbs || []) {
      const clause = this._clauseForIndex(context, verb.index);
      const after = tags.filter(tag => tag.index > verb.index && (!clause || tag.index <= clause.endToken));
      const direct = this._findDirectObjectPhrase(context, after);
      if (direct) {
        objects.push({
          verbTokenId: verb.tokenId,
          clauseId: clause?.id || null,
          tokenId: direct.head.tokenId,
          index: direct.head.index,
          startToken: direct.startToken,
          endToken: direct.endToken,
          value: direct.text,
          headValue: direct.head.value,
          type: 'direct',
          confidence: direct.text === direct.head.value ? 0.64 : 0.72
        });
      }
      after.forEach((tag, offset) => {
        if (tag.tag !== 'preposition') return;
        const prepObject = after.slice(offset + 1).find(candidate => ['noun', 'pronoun', 'numeral'].includes(candidate.tag));
        if (prepObject) {
          objects.push({
            verbTokenId: verb.tokenId,
            clauseId: clause?.id || null,
            prepositionTokenId: tag.tokenId,
            tokenId: prepObject.tokenId,
            index: prepObject.index,
            value: prepObject.value,
            type: 'prepositional',
            preposition: tag.value,
            confidence: 0.58
          });
        }
      });
    }
    context.objects = objects;
    return context;
  }

  _findDirectObjectPhrase(context, afterTags) {
    const contentTags = afterTags.filter(tag => !['punctuation', 'preposition'].includes(tag.tag));
    const head = contentTags.find(tag => ['noun', 'pronoun', 'numeral', 'quote'].includes(tag.tag));
    if (!head) return null;
    const source = context.posTags || [];
    let start = head.index;
    let end = head.index;
    for (let index = head.index - 1; index >= 0; index -= 1) {
      const tag = source.find(item => item.index === index);
      if (!tag || !['adjective', 'determiner', 'noun', 'numeral'].includes(tag.tag)) break;
      start = index;
    }
    for (let index = head.index + 1; index < source.length; index += 1) {
      const tag = source.find(item => item.index === index);
      if (!tag) break;
      if (['noun', 'adjective', 'determiner', 'numeral', 'quote'].includes(tag.tag)) {
        end = index;
        continue;
      }
      if (tag.tag === 'conjunction') {
        const next = source.find(item => item.index === index + 1);
        if (next && ['noun', 'adjective', 'numeral', 'quote'].includes(next.tag)) {
          end = index;
          continue;
        }
      }
      break;
    }
    return {
      head,
      startToken: start,
      endToken: end,
      text: this.spanText(context, start, end)
    };
  }

  _clauseForIndex(context, index) {
    return (context.clauses || []).find(clause => index >= clause.startToken && index <= clause.endToken) || null;
  }
}

class ModifierDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    context.modifiers = tags
      .filter(tag => ['adjective', 'adverb', 'determiner'].includes(tag.tag))
      .map(tag => {
        const head = tag.tag === 'adverb'
          ? tags.find(candidate => candidate.index > tag.index && candidate.tag === 'verb')
          : tags.find(candidate => candidate.index > tag.index && candidate.tag === 'noun');
        return {
          tokenId: tag.tokenId,
          index: tag.index,
          value: tag.value,
          type: tag.tag,
          headTokenId: head?.tokenId || null,
          scope: this._clauseForIndex(context, tag.index)?.id || 'sentence',
          confidence: tag.confidence
        };
      });
    return context;
  }

  _clauseForIndex(context, index) {
    return (context.clauses || []).find(clause => index >= clause.startToken && index <= clause.endToken) || null;
  }
}

const WH_WORDS = new Set(['what', 'who', 'when', 'where', 'why', 'how', 'which', 'whom', 'whose']);
const AUXILIARY_STARTERS = new Set(['am', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should', 'may', 'might']);

class QuestionDetector extends BaseAnalyzer {
  analyze(context) {
    context.questions = (context.sentences || []).map(sentence => {
      const sentenceTokens = context.tokens.slice(sentence.startToken, sentence.endToken + 1);
      const firstWord = sentenceTokens.find(token => token.type === 'word')?.lower || '';
      const hasQuestionMark = sentenceTokens.some(token => token.value === '?');
      let type = 'none';
      if (WH_WORDS.has(firstWord)) type = 'wh';
      else if (AUXILIARY_STARTERS.has(firstWord)) type = 'yes-no';
      else if (hasQuestionMark) type = 'question';
      else if (/^(?:tell|show|explain|define)\s+(?:me\s+)?(?:what|who|when|where|why|how|which)\b/i.test(sentence.text)) type = 'embedded-wh';
      else if (/\b(?:do|does|did|can|could|will|would|should)\s+you\s+(?:know|think|tell|show)\b/i.test(sentence.text)) type = 'assistant-question';
      const tagQuestion = /,\s*(isn't|is it|right|okay|ok)\??$/i.test(sentence.text);
      if (tagQuestion) type = 'tag';
      return {
        sentenceId: sentence.id,
        type,
        isQuestion: type !== 'none',
        hasQuestionMark,
        confidence: type === 'none' ? 0.6 : 0.82
      };
    }).filter(item => item.isQuestion);
    return context;
  }
}

const NEGATIONS = new Set(['not', 'never', 'no', 'cannot', "can't", "don't", "doesn't", "didn't", "isn't", "aren't", 'without']);
const CORRECTIONS = new Set(['actually', 'instead']);

class NegationDetector extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    context.negations = (context.tokens || [])
      .filter(token => NEGATIONS.has(token.lower) || CORRECTIONS.has(token.lower))
      .map(token => {
        const scopedVerb = tags.find(tag => tag.index > token.index && ['verb', 'auxiliary', 'modal'].includes(tag.tag));
        const next = context.tokens[token.index + 1];
        const text = String(context.normalizedSentence || '').toLowerCase();
        const correction = CORRECTIONS.has(token.lower) ||
          (token.lower === 'no' && next?.lower === 'no') ||
          (token.lower === 'no' && /^no\s+(?:set|change|make|use|put)\b/.test(text));
        return {
          tokenId: token.id,
          index: token.index,
          value: token.value,
          kind: correction ? 'correction' : 'negation',
          scopeStartToken: token.index,
          scopeEndToken: scopedVerb ? Math.min(scopedVerb.index + 3, (context.tokens.length || 1) - 1) : token.index,
          scopedVerbTokenId: scopedVerb?.tokenId || null,
          confidence: 0.78
        };
      });
    return context;
  }
}

const RESOLVER_PRONOUNS = new Set(['he', 'him', 'she', 'her', 'it', 'they', 'them', 'this', 'that', 'these', 'those', 'same', 'one', 'ones', 'there']);

class PronounResolver extends BaseAnalyzer {
  analyze(context) {
    const tags = context.posTags || [];
    const pronouns = [];
    for (const sentence of context.sentences || []) {
      const sentenceTags = tags.filter(tag => tag.index >= sentence.startToken && tag.index <= sentence.endToken);
      sentenceTags.forEach(tag => {
        if (tag.tag !== 'pronoun' || !RESOLVER_PRONOUNS.has(String(tag.value).toLowerCase())) return;
        const priorNouns = sentenceTags.filter(candidate => candidate.index < tag.index && candidate.tag === 'noun');
        const lower = String(tag.value || '').toLowerCase();
        const antecedent = ['he', 'him', 'she', 'her', 'they', 'them'].includes(lower)
          ? priorNouns[0]
          : priorNouns[priorNouns.length - 1];
        pronouns.push({
          tokenId: tag.tokenId,
          index: tag.index,
          value: tag.value,
          kind: this._kind(lower),
          antecedentTokenId: antecedent?.tokenId || null,
          antecedent: antecedent?.value || null,
          scope: 'sentence',
          confidence: antecedent ? 0.55 : 0.2
        });
      });
    }
    context.pronouns = pronouns;
    return context;
  }

  _kind(value) {
    if (['this', 'that', 'these', 'those', 'there'].includes(value)) return 'demonstrative';
    if (['same', 'one', 'ones'].includes(value)) return 'reference';
    return 'personal';
  }
}

module.exports = {
  BaseAnalyzer,
  Tokenizer,
  SentenceSplitter,
  ClauseAnalyzer,
  DependencyParser,
  POSTagger,
  VerbDetector,
  SubjectDetector,
  ObjectDetector,
  ModifierDetector,
  QuestionDetector,
  NegationDetector,
  PronounResolver
};