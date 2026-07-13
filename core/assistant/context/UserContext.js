'use strict';

function compactText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function publicProfile(user) {
  return {
    name: compactText(user.name || user.displayName || '', 80) || null,
    role: compactText(user.role || '', 80) || null,
    company: compactText(user.company || '', 100) || null,
    country: compactText(user.country || '', 80) || null,
    locale: compactText(user.locale || '', 40) || null
  };
}

class UserContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.user');
    this.priority = Number.isFinite(options.priority) ? options.priority : 200;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const user = context.snapshots?.user || {};
    const preferences = user.preferences && typeof user.preferences === 'object'
      ? Object.fromEntries(Object.entries(user.preferences)
        .slice(0, 12)
        .map(([key, value]) => [compactText(key, 80), compactText(value, 120)]))
      : {};
    context.context.user = {
      ...publicProfile(user),
      preferences,
      assistantName: compactText(user.assistantName || '', 80) || null,
      hasProfile: Boolean(user.name || user.displayName || Object.keys(preferences).length),
      securityProfile: user.securityProfile ? {
        lockConfigured: Boolean(user.securityProfile.lockConfigured),
        encryptionEnabled: Boolean(user.securityProfile.encryptionEnabled)
      } : null
    };
    return context;
  }
}

module.exports = UserContext;
