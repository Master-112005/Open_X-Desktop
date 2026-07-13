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

module.exports = BaseAnalyzer;
