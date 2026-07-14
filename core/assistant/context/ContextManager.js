const Logger = require('../Data').Logger;

const MAX_HISTORY = 250;
const MAX_CONTEXT_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_TOPIC_MEMORY = 40;
const MAX_USER_PREFERENCES = 50;
const MAX_USER_FACTS = 100;
const MAX_HISTORY_DATA_ITEMS = 3;
const MAX_ENTITY_ARRAY_ITEMS = 6;
const MAX_ENTITY_KEYS = 40;
const MAX_SESSION_VALUE_LENGTH = 4000;
const SENSITIVE_KEY_PATTERN = /(password|passcode|token|secret|api[_-]?key|private[_-]?key|otp|pin|credential)/i;
const TOPIC_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'give', 'go', 'had', 'has', 'have',
  'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'open', 'or', 'our',
  'please', 'search', 'show', 'sir', 'that', 'the', 'them', 'then', 'there',
  'this', 'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'with', 'you', 'your'
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeTopic(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !TOPIC_STOP_WORDS.has(token));
}

function compactSentence(value, maxLength = 160) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

class ContextManager {
  constructor(config) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.history = [];
    this.sessionData = new Map();
    this.maxHistory = Math.max(1, Math.min(MAX_HISTORY, Number(config?.chat?.maxHistory) || MAX_HISTORY));
    this.maxContextAgeMs = Number(config?.chat?.maxContextAgeMs || MAX_CONTEXT_AGE_MS);
    this.maxTopicMemory = Number(config?.chat?.maxTopicMemory || MAX_TOPIC_MEMORY);
    this.maxUserPreferences = Number(config?.chat?.maxUserPreferences || MAX_USER_PREFERENCES);
    this.maxUserFacts = Number(config?.chat?.maxUserFacts || MAX_USER_FACTS);
    this.lastInteraction = null;
    this.userPreferences = new Map();
    this.userFacts = new Map();
    this.pendingTasks = [];
    this.topicMemory = new Map();
    this.contextRevision = 0;
    this.conversationDigestCache = new Map();
  }

  record(input, parsed, result) {
    const compactInput = compactSentence(input, 500);
    const compactEntities = this._compactEntities(result?.entities || parsed?.entities || {});
    const entry = {
      timestamp: Date.now(),
      input: compactInput,
      commandId: result?.commandId || null,
      intent: result?.intent || parsed?.intent || null,
      confidence: result?.confidence || 0,
      success: result?.success || false,
      requiresConfirmation: Boolean(result?.requiresConfirmation),
      needsClarification: Boolean(result?.needsClarification),
      entities: compactEntities,
      response: compactSentence(result?.response || '', 700),
      data: this._compactData(result?.data),
      languageUnderstanding: this._compactStatus(result?.languageUnderstanding, ['status', 'intent', 'domain', 'action']),
      validation: this._compactStatus(result?.validation || result?.data?.validation, ['status', 'check', 'reason']),
      verification: this._compactStatus(result?.verification || result?.data?.verification, ['status', 'check', 'reason'])
    };
    const appTargets = this._appTargetsFromResult(result);
    if (appTargets.length > 0) {
      entry.entities.appNames = appTargets.map(item => item.name);
      entry.entities.appAction = appTargets[0].intent;
      if (!entry.entities.appName && appTargets.length === 1) {
        entry.entities.appName = appTargets[0].name;
      }
    }
    entry.domain = this._domainFromIntent(entry.intent);
    entry.target = this._entryTarget(entry);
    entry.actionSummary = this._lastActionSummary(entry);

    this.history.push(entry);
    this.lastInteraction = Date.now();
    this._extractUserPreferences(input, result);
    this._trackPendingTask(input, result);
    this._updateTopicMemory(entry);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this._cleanup();
    this.contextRevision += 1;
    this.conversationDigestCache.clear();
  }

  _extractUserPreferences(input, result) {
    const text = String(input || '').toLowerCase();
    if (result?.success) {
      if (/\bprefer|preference|usually|always|normally|i like|i want|i need\b/i.test(text)) {
        const appMatch = text.match(/\b(?:chrome|edge|firefox|notepad|vs code|visual studio)\b/i);
        if (appMatch) {
          this.setUserPreference('preferredBrowser', appMatch[1].toLowerCase());
        }
      }
    }
  }

  _trackPendingTask(input, result) {
    const intent = result?.intent || '';
    const entities = result?.entities || {};

    if (intent === 'reminder.set' && entities?.reminderText) {
      this._upsertPendingTask({
        type: 'reminder',
        text: compactSentence(entities.reminderText, 160),
        category: entities.reminderCategory || result?.data?.category || 'general',
        duration: entities.duration || null,
        timeExpression: entities.timeExpression || null,
        dueAt: result?.data?.dueAt || null,
        timestamp: Date.now()
      });
    }

    if (intent === 'timer.set' && entities?.duration) {
      this._upsertPendingTask({
        type: 'timer',
        duration: entities.duration,
        dueAt: result?.data?.dueAt || null,
        timestamp: Date.now()
      });
    }

    this.pendingTasks = this.pendingTasks.filter(t => Date.now() - t.timestamp < 3600000);
  }

  _upsertPendingTask(task) {
    const key = [
      task.type,
      normalizeText(task.text || ''),
      normalizeText(task.timeExpression || ''),
      String(task.dueAt || task.duration || '')
    ].join('|');
    const existingIndex = this.pendingTasks.findIndex(item => item.key === key);
    const entry = { ...task, key };
    if (existingIndex >= 0) {
      this.pendingTasks[existingIndex] = { ...this.pendingTasks[existingIndex], ...entry };
      return;
    }
    this.pendingTasks.push(entry);
  }

  setUserPreference(key, value) {
    this.userPreferences.set(key, {
      value,
      timestamp: Date.now(),
      count: (this.userPreferences.get(key)?.count || 0) + 1
    });
    this._trimMapByTimestamp(this.userPreferences, this.maxUserPreferences);
  }

  getUserPreference(key) {
    const pref = this.userPreferences.get(key);
    if (!pref) return null;
    if (Date.now() - pref.timestamp > 86400000) {
      this.userPreferences.delete(key);
      return null;
    }
    return pref.value;
  }

  setUserFact(key, value) {
    this.userFacts.set(key, {
      value,
      timestamp: Date.now()
    });
    this._trimMapByTimestamp(this.userFacts, this.maxUserFacts);
  }

  getUserFact(key) {
    const fact = this.userFacts.get(key);
    if (!fact) return null;
    return fact.value;
  }

  getAllUserFacts() {
    const facts = {};
    for (const [key, fact] of this.userFacts.entries()) {
      facts[key] = fact.value;
    }
    return facts;
  }

  getRecentTasks() {
    return this.pendingTasks.filter(t => Date.now() - t.timestamp < 3600000);
  }

  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  getLastIntent() {
    if (this.history.length === 0) return null;
    const last = this.history[this.history.length - 1];
    return last.intent || null;
  }

  getLastEntities() {
    if (this.history.length === 0) return {};
    const last = this.history[this.history.length - 1];
    return last.entities || {};
  }

  setSessionData(key, value) {
    this.sessionData.set(key, {
      value: this._compactSessionValue(value),
      timestamp: Date.now()
    });
  }

  getSessionData(key) {
    const data = this.sessionData.get(key);
    if (!data) return null;
    if (Date.now() - data.timestamp > this.maxContextAgeMs) {
      this.sessionData.delete(key);
      return null;
    }
    return data.value;
  }

  clearSession() {
    this.sessionData.clear();
  }

  destroy() {
    this.history = [];
    this.sessionData.clear();
    this.userPreferences.clear();
    this.userFacts.clear();
    this.pendingTasks = [];
    this.topicMemory.clear();
    this.lastInteraction = null;
    this.contextRevision += 1;
    this.conversationDigestCache.clear();
  }

  getLastInteractionTime() {
    return this.lastInteraction;
  }

  getRecentCommands(count = 5) {
    return this.history.slice(-count).map(h => h.input);
  }

  getPreviousUserUtterance() {
    const previous = this.history[this.history.length - 1];
    return previous?.input || '';
  }

  getCommandsToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.history.filter(entry => entry.timestamp >= start.getTime());
  }

  getFirstCommandToday() {
    return this.getCommandsToday()[0] || null;
  }

  getLastCommand() {
    return this.history[this.history.length - 1] || null;
  }

  getLastSuccessfulCommand() {
    return this.findRecent(entry => entry?.success, this.maxHistory);
  }

  getLastDomainAction(domain, limit = 30) {
    const normalized = String(domain || '').replace(/\.$/, '');
    if (!normalized) return null;
    return this.findRecent(entry => entry?.success && entry.domain === normalized, limit);
  }

  getRecentActionTargets(limit = 8) {
    return this.history
      .slice(-Math.max(1, limit * 3))
      .reverse()
      .filter(entry => entry?.success && entry.target)
      .map(entry => ({
        intent: entry.intent,
        domain: entry.domain,
        target: entry.target,
        input: entry.input,
        timestamp: entry.timestamp
      }))
      .slice(0, limit);
  }

  findRecent(predicate, limit = 20) {
    if (typeof predicate !== 'function') {
      return null;
    }
    return this.history
      .slice(-limit)
      .reverse()
      .find(predicate) || null;
  }

  findRecentAll(predicate, limit = 20) {
    if (typeof predicate !== 'function') {
      return [];
    }
    return this.history
      .slice(-limit)
      .reverse()
      .filter(predicate);
  }

  getLastSearch() {
    return this.findRecent(entry =>
      entry?.success &&
      ['browser.search', 'browser.siteSearch', 'browser.openFirstResult'].includes(entry.intent) &&
      (entry.entities?.query || entry.data?.query)
    );
  }

  getFirstSearchToday() {
    return this.getCommandsToday().find(entry =>
      entry?.success &&
      ['browser.search', 'browser.siteSearch', 'browser.openFirstResult'].includes(entry.intent) &&
      (entry.entities?.query || entry.data?.query)
    ) || null;
  }

  getLastAppAction(intent = null) {
    return this.findRecent(entry =>
      entry?.success &&
      entry.intent &&
      entry.intent.startsWith('app.') &&
      (!intent || entry.intent === intent) &&
      entry.entities?.appName
    );
  }

  getLastAppGroup(intent = null) {
    const targetIntent = String(intent || '').trim();
    return this.findRecent(entry => {
      if (!entry?.success || entry?.requiresConfirmation || entry?.needsClarification) {
        return false;
      }
      const appNames = Array.isArray(entry.entities?.appNames) ? entry.entities.appNames : [];
      if (appNames.length === 0) {
        return false;
      }
      if (!targetIntent) {
        return true;
      }
      return entry.entities?.appAction === targetIntent ||
        (entry.intent === targetIntent && entry.entities?.appName);
    }, 30);
  }

  getPreviousAppOpen() {
    const opened = this.findRecentAll(entry =>
      entry?.success &&
      entry.intent === 'app.open' &&
      entry.entities?.appName,
    30);
    return opened[1] || null;
  }

  getLastFileReference() {
    return this.findRecent(entry => Boolean(this._fileReferenceFromEntry(entry)), 30);
  }

  getLastPhoneTransfer() {
    return this.findRecent(entry =>
      entry?.success &&
      entry.intent === 'phone.sendFile' &&
      (entry.entities?.path || entry.data?.path || entry.data?.transferredName)
    , 30);
  }

  getLastActionableCommand(limit = 12) {
    return this.history
      .slice(-limit)
      .reverse()
      .find(entry => entry?.success && entry?.input && entry?.intent &&
        /^(?:app|browser|file|folder|media|volume|brightness|window|phone|reminder|timer|alarm|calendar)\./.test(entry.intent)) || null;
  }

  resolveEllipticalFollowUp(input) {
    const normalized = normalizeText(input);
    if (!normalized || /(?:19|20)\d{2}/.test(normalized)) return '';

    const correctiveVolume = this.resolveCorrectiveFollowUp(input);
    if (correctiveVolume) return correctiveVolume;

    const match = normalized.match(/^(?:and|also|then|what about|how about)\s+(.+)$/) ||
      normalized.match(/^(?:do (?:the )?same|same(?: thing)?)\s+(?:with|for)\s+(.+)$/);
    if (!match?.[1]) return '';

    const replacement = match[1]
      .replace(/^(?:the|a|an)\s+/, '')
      .replace(/^(?:open|close|launch|start|play|search(?:\s+for)?)\s+/, '')
      .trim();
    const last = this.getLastActionableCommand();
    if (!last || !replacement) return '';
    const verbs = {
      'app.open': 'open',
      'app.close': 'close',
      'app.switch': 'switch to',
      'browser.search': 'search for',
      'browser.siteSearch': 'search for',
      'media.play': 'play',
      'file.open': 'open',
      'folder.open': 'open'
    };
    const verb = verbs[last.intent];
    if (!verb) return '';

    if (/^browser\./.test(last.intent) && /^(?:chrome|edge|firefox|browser)$/.test(replacement)) {
      const query = String(last.entities?.query || last.data?.query || '').trim();
      return query ? `search for ${query} in ${replacement}` : '';
    }
    return `${verb} ${replacement}`;
  }

  resolveCorrectiveFollowUp(input) {
    const normalized = normalizeText(input);
    if (!normalized) return '';
    const last = this.findRecent(entry =>
      entry?.success &&
      ['volume.set', 'volume.up', 'volume.down', 'volume.mute', 'volume.unmute'].includes(entry.intent)
    , 6);
    if (!last) return '';

    const valueMatch = normalized.match(
      /^(?:(?:no|nope|nah)(?:\s+no)?\s*)?(?:(?:please\s+)?(?:set|make|put|keep|change|turn)\s+(?:it|volume|vol|sound|audio)?\s*(?:to|at)?\s*)?(\d{1,3})(?:\s*%|\s+percent)?$/
    ) || normalized.match(
      /^(?:(?:no|nope|nah)(?:\s+no)?\s*)?(?:please\s+)?(?:set|make|put|keep|change|turn)\s+(?:the\s+)?(?:vol|volume|sound|audio)\s+(?:to|at)?\s*(\d{1,3})(?:\s*%|\s+percent)?$/
    );
    if (!valueMatch?.[1]) return '';
    const value = Math.max(0, Math.min(100, Number(valueMatch[1])));
    if (!Number.isFinite(value)) return '';
    return `set volume to ${value}`;
  }

  getFileReference(entry) {
    return this._fileReferenceFromEntry(entry);
  }

  getLastTopic() {
    const topics = Array.from(this.topicMemory.values())
      .sort((a, b) => b.lastSeen - a.lastSeen || b.score - a.score);
    return topics[0] || null;
  }

  getRelevantHistory(query, limit = 5) {
    const queryTokens = tokenizeTopic(query);
    if (queryTokens.length === 0) {
      return this.history.slice(-limit);
    }

    const now = Date.now();
    return this.history
      .map(entry => {
        const haystack = [
          entry.input,
          entry.response,
          entry.intent,
          entry.entities?.query,
          entry.entities?.mediaQuery,
          entry.entities?.appName,
          entry.data?.query
        ].filter(Boolean).join(' ');
        const tokens = new Set(tokenizeTopic(haystack));
        const overlap = queryTokens.filter(token => tokens.has(token)).length;
        const ageMinutes = Math.max(0, (now - entry.timestamp) / 60000);
        const recency = Math.max(0, 1 - (ageMinutes / 120));
        return { entry, score: overlap + recency };
      })
      .filter(item => item.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.entry);
  }

  buildConversationDigest(options = {}) {
    const limit = Number(options.limit || 8);
    const cacheKey = `${this.contextRevision}:${limit}`;
    const cached = this.conversationDigestCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const recent = this.history
      .slice(-limit)
      .filter(entry => entry?.input)
      .map(entry => ({
        input: compactSentence(entry.input, 120),
        intent: entry.intent || 'conversation',
        success: Boolean(entry.success),
        target: this._entryTarget(entry)
      }));
    const topics = Array.from(this.topicMemory.values())
      .sort((a, b) => b.score - a.score || b.lastSeen - a.lastSeen)
      .slice(0, 5)
      .map(topic => topic.label);
    const lines = recent.map(entry => {
      const target = entry.target ? ` (${entry.target})` : '';
      return `${entry.input}${target}`;
    });
    const digest = {
      recent,
      topics,
      summaryText: lines.length
        ? `Recent chat: ${lines.join('; ')}. ${topics.length ? `Main topics: ${topics.join(', ')}.` : ''}`.trim()
        : ''
    };
    this.conversationDigestCache.set(cacheKey, digest);
    return digest;
  }

  getConversationSummary() {
    const successful = this.history.filter(h => h.success).length;
    const total = this.history.length;
    const verified = this.history.filter(h => h.verification?.status === 'passed').length;
    const failedVerification = this.history.filter(h => h.verification?.status === 'failed').length;
    return {
      totalCommands: total,
      successfulCommands: successful,
      failedCommands: total - successful,
      verifiedCommands: verified,
      failedVerificationCommands: failedVerification,
      lastInteraction: this.lastInteraction,
      sessionKeys: Array.from(this.sessionData.keys()),
      recentTopics: Array.from(this.topicMemory.values())
        .sort((a, b) => b.score - a.score || b.lastSeen - a.lastSeen)
        .slice(0, 5)
        .map(topic => topic.label),
      recentTargets: this.getRecentActionTargets(5)
    };
  }

  getContextSnapshot(options = {}) {
    const limit = Number(options.limit || 6);
    return {
      lastInteraction: this.lastInteraction,
      lastIntent: this.getLastIntent(),
      lastEntities: this.getLastEntities(),
      lastSuccessfulCommand: this.getLastSuccessfulCommand(),
      recentCommands: this.getRecentCommands(limit),
      recentTargets: this.getRecentActionTargets(limit),
      recentTasks: this.getRecentTasks(),
      summary: this.getConversationSummary()
    };
  }

  _cleanup() {
    const cutoff = Date.now() - this.maxContextAgeMs;
    this.history = this.history.filter(h => h.timestamp >= cutoff);

    for (const [key, data] of this.sessionData) {
      if (Date.now() - data.timestamp > this.maxContextAgeMs) {
        this.sessionData.delete(key);
      }
    }

    for (const [key, topic] of this.topicMemory) {
      if (topic.lastSeen < cutoff) {
        this.topicMemory.delete(key);
      }
    }
    this._trimMapByTimestamp(this.userPreferences, this.maxUserPreferences);
    this._trimMapByTimestamp(this.userFacts, this.maxUserFacts);
    this._trimTopicMemory();
  }

  _trimMapByTimestamp(map, maxSize) {
    if (!(map instanceof Map) || !Number.isFinite(maxSize) || maxSize <= 0 || map.size <= maxSize) {
      return;
    }

    const keep = new Set(Array.from(map.entries())
      .sort((a, b) => Number(b[1]?.timestamp || 0) - Number(a[1]?.timestamp || 0))
      .slice(0, maxSize)
      .map(([key]) => key));

    for (const key of map.keys()) {
      if (!keep.has(key)) {
        map.delete(key);
      }
    }
  }

  _updateTopicMemory(entry) {
    const candidates = this._topicCandidatesFromEntry(entry);
    if (candidates.length === 0) {
      return;
    }

    const now = entry.timestamp || Date.now();
    for (const label of candidates) {
      const tokens = tokenizeTopic(label);
      if (tokens.length === 0) {
        continue;
      }
      const key = tokens.slice(0, 6).join(' ');
      const existing = this.topicMemory.get(key);
      const scoreBoost = entry.success ? 1.4 : 0.8;
      this.topicMemory.set(key, {
        key,
        label: compactSentence(label, 80),
        tokens,
        score: Number(existing?.score || 0) + scoreBoost,
        count: Number(existing?.count || 0) + 1,
        firstSeen: existing?.firstSeen || now,
        lastSeen: now,
        lastInput: entry.input,
        lastIntent: entry.intent || null
      });
    }

    this._trimTopicMemory();
  }

  _topicCandidatesFromEntry(entry) {
    const entities = entry.entities || {};
    const data = entry.data || {};
    const candidates = [
      entities.query,
      entities.mediaQuery,
      entities.appName,
      entities.windowName,
      entities.folderName,
      entities.filename,
      entities.fileName,
      entities.contactName,
      data.query,
      data.topic
    ].filter(Boolean);

    const cleanedInputTopic = this._topicFromInput(entry.input);
    if (cleanedInputTopic) {
      candidates.push(cleanedInputTopic);
    }

    return Array.from(new Set(candidates
      .map(value => compactSentence(value, 100))
      .filter(value => tokenizeTopic(value).length > 0)));
  }

  _topicFromInput(input) {
    const text = normalizeText(input)
      .replace(/^(?:can|could|would)\s+you\s+/, '')
      .replace(/^(?:please\s+)?(?:explain|tell\s+me\s+about|teach\s+me|search\s+for|find|look\s+up|play|open|show)\s+/, '')
      .replace(/\b(?:in\s+simple\s+words?|for\s+me|please|today|now)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tokens = tokenizeTopic(text);
    if (tokens.length === 0 || tokens.length > 8) {
      return '';
    }
    return text;
  }

  _trimTopicMemory() {
    if (this.topicMemory.size <= this.maxTopicMemory) {
      return;
    }

    const keep = new Set(Array.from(this.topicMemory.values())
      .sort((a, b) => b.score - a.score || b.lastSeen - a.lastSeen)
      .slice(0, this.maxTopicMemory)
      .map(topic => topic.key));

    for (const key of this.topicMemory.keys()) {
      if (!keep.has(key)) {
        this.topicMemory.delete(key);
      }
    }
  }

  _entryTarget(entry) {
    const entities = entry.entities || {};
    const data = entry.data || {};
    return [
      entities.query,
      entities.mediaQuery,
      Array.isArray(entities.appNames) ? entities.appNames.join(', ') : '',
      entities.appName,
      entities.windowName,
      entities.folderName,
      entities.filename,
      entities.fileName,
      entities.contactName,
      entities.plannerText,
      entities.reminderText,
      entities.timeExpression,
      entities.duration,
      entities.value,
      data.entry?.title,
      data.transferredName,
      data.path,
      data.query
    ].map(value => String(value || '').trim()).find(Boolean) || '';
  }

  _lastActionSummary(entry) {
    if (!entry?.intent) return null;
    const target = entry.target || this._entryTarget(entry);
    return {
      intent: entry.intent,
      domain: this._domainFromIntent(entry.intent),
      target: target ? compactSentence(target, 160) : null,
      success: Boolean(entry.success),
      timestamp: entry.timestamp
    };
  }

  _domainFromIntent(intent) {
    const text = String(intent || '');
    return text.includes('.') ? text.split('.')[0] : text || null;
  }

  _compactStatus(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value || null;
    const compact = {};
    for (const key of keys) {
      if (value[key] !== undefined && value[key] !== null) compact[key] = this._compactPrimitive(value[key]);
    }
    return Object.keys(compact).length > 0 ? compact : null;
  }

  _compactData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data || null;
    const compact = {};
    [
      'query',
      'path',
      'transferredName',
      'topic',
      'category',
      'dueAt',
      'message',
      'title',
      'url',
      'duration',
      'matchedWindow',
      'launchMethod',
      'app',
      'appId'
    ].forEach(key => {
      if (data[key] !== undefined && data[key] !== null && !SENSITIVE_KEY_PATTERN.test(key)) {
        compact[key] = this._compactPrimitive(data[key]);
      }
    });
    if (data.entry?.title) compact.entry = { title: String(data.entry.title) };
    if (data.opened) compact.opened = this._compactFileCandidate(data.opened);
    if (Array.isArray(data.entries)) compact.entries = data.entries.slice(0, MAX_HISTORY_DATA_ITEMS).map(item => this._compactFileCandidate(item));
    if (Array.isArray(data.results)) compact.results = data.results.slice(0, MAX_HISTORY_DATA_ITEMS).map(item => this._compactFileCandidate(item));
    return Object.keys(compact).length > 0 ? compact : null;
  }

  _appTargetsFromResult(result) {
    const directEntities = result?.entities || {};
    const directIntent = String(result?.intent || '');
    if (directIntent.startsWith('app.') && directEntities.appName) {
      return [{
        intent: directIntent,
        name: compactSentence(directEntities.appName, 120)
      }];
    }

    const steps = Array.isArray(result?.steps) ? result.steps : [];
    const targets = [];
    const seen = new Set();
    for (const step of steps) {
      const intent = String(step?.intent || '');
      const appName = compactSentence(step?.entities?.appName || step?.entities?.targetApp || '', 120);
      if (!step?.success || !intent.startsWith('app.') || !appName) {
        continue;
      }
      const key = `${intent}:${normalizeText(appName)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      targets.push({ intent, name: appName });
    }

    if (targets.length === 0) {
      return [];
    }

    const uniqueIntents = new Set(targets.map(item => item.intent));
    return uniqueIntents.size === 1 ? targets : [];
  }

  _compactFileCandidate(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return {};
    return {
      name: compactSentence(value.name || value.title || '', 140),
      path: compactSentence(value.path || value.location || '', 260)
    };
  }

  _compactEntities(entities) {
    if (!entities || typeof entities !== 'object' || Array.isArray(entities)) {
      return {};
    }

    const compact = {};
    for (const [key, value] of Object.entries(entities).slice(0, MAX_ENTITY_KEYS)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        continue;
      }
      compact[key] = this._compactValue(value, 0);
    }
    return compact;
  }

  _compactSessionValue(value) {
    const compact = this._compactValue(value, 0);
    const json = JSON.stringify(compact);
    if (json && json.length > MAX_SESSION_VALUE_LENGTH) {
      return { truncated: true, preview: compactSentence(json, 1000) };
    }
    return compact;
  }

  _compactValue(value, depth) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return compactSentence(value, 300);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      if (depth >= 2) return '[array]';
      return value.slice(0, MAX_ENTITY_ARRAY_ITEMS).map(item => this._compactValue(item, depth + 1));
    }
    if (typeof value === 'object') {
      if (depth >= 2) return '[object]';
      const compact = {};
      for (const [key, item] of Object.entries(value).slice(0, MAX_ENTITY_KEYS)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) continue;
        compact[key] = this._compactValue(item, depth + 1);
      }
      return compact;
    }
    return String(value);
  }

  _compactPrimitive(value) {
    if (typeof value === 'string') return compactSentence(value, 240);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object') return this._compactValue(value, 0);
    return value;
  }

  _fileReferenceFromEntry(entry) {
    if (!entry || !entry.intent || !entry.success) {
      return null;
    }

    if (!/^file\./.test(entry.intent)) {
      return null;
    }

    const entities = entry.entities || {};
    const data = entry.data || {};
    const opened = data.opened || null;
    const firstEntry = Array.isArray(data.entries) ? data.entries[0] : null;
    const firstResult = Array.isArray(data.results) ? data.results[0] : null;
    const candidate = opened || firstResult || firstEntry || {};
    const candidatePath = typeof candidate === 'string' ? candidate : candidate.path;
    const candidateName = typeof candidate === 'string' ? '' : candidate.name;
    const name = candidateName ||
      firstEntry?.name ||
      entities.filename ||
      entities.fileName ||
      entities.query ||
      entities.source ||
      '';
    const filePath = candidatePath || firstEntry?.path || entities.path || entities.selectedPath || '';
    if (!name && !filePath) {
      return null;
    }

    return {
      name: String(name || filePath).trim(),
      path: String(filePath || '').trim(),
      intent: entry.intent,
      input: entry.input
    };
  }
}

module.exports = ContextManager;
