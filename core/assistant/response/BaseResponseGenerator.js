'use strict';

class BaseResponseGenerator {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() { this.initialized = true; return true; }
  supports(context) { return this.enabled && !!context; }
  generate(context) { return context; }
  cleanup() { return true; }
  destroy() { this.initialized = false; return true; }

  text(value, maxLength = 500) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
  }

  ensureSentence(value, maxLength = 500) {
    const text = this.text(value, maxLength);
    if (!text) return '';
    return /[.!?]$/.test(text) ? text : `${text}.`;
  }

  sentences(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);
  }

  firstSentence(value, maxLength = 220) {
    const first = this.sentences(value)[0] || this.text(value, maxLength);
    return this.text(first, maxLength);
  }

  formatList(items, { maxItems = 5, empty = '' } = {}) {
    const values = (Array.isArray(items) ? items : [])
      .map(item => String(item || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (values.length === 0) return empty;
    const shown = values.slice(0, Math.max(1, maxItems));
    const extra = values.length - shown.length;
    if (shown.length === 1) return extra > 0 ? `${shown[0]}, plus ${extra} more` : shown[0];
    const joined = shown.length === 2
      ? `${shown[0]} and ${shown[1]}`
      : `${shown.slice(0, -1).join(', ')}, and ${shown[shown.length - 1]}`;
    return extra > 0 ? `${joined}, plus ${extra} more` : joined;
  }

  stripStatusPrefix(value) {
    return String(value || '')
      .replace(/^\s*Status:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanForChannel(value, { channel = 'chat', maxLength = 500 } = {}) {
    let text = this.stripStatusPrefix(value);
    if (channel === 'voice') {
      text = text
        .replace(/\bSource:\s*[^.]+\.?/gi, '')
        .replace(/\bhttps?:\/\/\S+/gi, '')
        .replace(/\s*;\s*/g, ', ');
    }
    if (channel === 'notification') {
      text = this.firstSentence(text, maxLength);
    }
    return this.text(text, maxLength);
  }

  addPart(context, type, text, data = {}) {
    if (!context || typeof context.addPart !== 'function') return null;
    return context.addPart(type, this.text(text), data);
  }
}

module.exports = BaseResponseGenerator;
