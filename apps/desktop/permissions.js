const Logger = require('../../core/assistant/Data').Logger;

const LEVEL_HIERARCHY = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

const CLOSE_CONFIRMATION_OPTIONAL_SOURCES = new Set(['chat', 'phone']);
const CLOSE_INTENTS = new Set([
  'app.close',
  'browser.closeTab',
  'file.close',
  'folder.close',
  'window.close'
]);

const RISK_BY_PERMISSION = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical'
});

function cleanLabel(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

class PermissionValidator {
  constructor(config) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.config = config;
    this.settings = config?.permissions || {
      levels: {
        low: { requiresConfirmation: false, requiresAuth: false },
        medium: { requiresConfirmation: true, requiresAuth: false },
        high: { requiresConfirmation: true, requiresAuth: true },
        critical: { requiresConfirmation: true, requiresAuth: true }
      }
    };
    this.userLevel = config?.permissions?.userLevel || 'medium';
    this.failedAttempts = 0;
    this.maxFailedAttempts = config?.permissions?.maxFailedAttempts || 3;
    this.isAuthenticated = Boolean(config?.auth?.preAuthenticated);
    this.blockchainPermissionProvider = typeof config?.permissions?.blockchainProvider === 'function'
      ? config.permissions.blockchainProvider
      : null;
  }

  validate(intent, entities, source) {
    const level = intent.permissionLevel || 'low';
    const levelConfig = this.settings.levels[level];

    if (!levelConfig) {
      return { allowed: false, reason: 'Unknown permission level' };
    }

    const levelValue = LEVEL_HIERARCHY[level] || 0;
    const userLevelValue = LEVEL_HIERARCHY[this.userLevel] || 0;

    if (levelValue > userLevelValue) {
      return {
        allowed: false,
        reason: `Action requires ${level} permission level, current: ${this.userLevel}`,
        requiresConfirmation: false
      };
    }

    if (!this.isAuthenticated && levelConfig.requiresAuth) {
      return {
        allowed: false,
        reason: 'Authentication required for this action',
        requiresConfirmation: true,
        requiresAuth: true
      };
    }

    const blockchainCheck = this._checkBlockchainPermission(intent, source, entities);
    if (!blockchainCheck.allowed) return blockchainCheck;

    const confirmationMessage = this._buildConfirmationMessage(intent, entities);

    const requiresConfirmation = Boolean(levelConfig.requiresConfirmation) &&
      !this._canSkipCloseConfirmation(intent, source);

    return {
      allowed: true,
      requiresConfirmation,
      confirmationMessage,
      risk: this._riskFor(intent),
      consequence: this._consequenceFor(intent)
    };
  }

  _canSkipCloseConfirmation(intent, source) {
    const normalizedSource = String(source || '').trim().toLowerCase();
    if (!CLOSE_CONFIRMATION_OPTIONAL_SOURCES.has(normalizedSource)) return false;
    const intentId = String(intent?.id || intent?.action || '').trim();
    return CLOSE_INTENTS.has(intentId);
  }

  _checkBlockchainPermission(intent = {}, source = 'chat', entities = {}) {
    if (!this.blockchainPermissionProvider) return { allowed: true };
    const permissionName = permissionNameForIntent(intent, source);
    try {
      const result = this.blockchainPermissionProvider({
        permissionName,
        operation: intent.id || intent.action || permissionName,
        intent,
        entities,
        source
      });
      if (result?.allowed === false) {
        return {
          allowed: false,
          reason: result.reason || 'Blockchain permission denied',
          response: 'Permission denied.',
          requiresConfirmation: false,
          permissionDecision: result.decision,
          permissionStatus: result.permissionStatus || result.status
        };
      }
    } catch (error) {
      this.logger.warn('Blockchain permission check failed', { error: error.message });
    }
    return { allowed: true };
  }

  _buildConfirmationMessage(intent, entities) {
    const parts = [cleanLabel(intent.description || 'Perform action')];
    if (entities) {
      for (const [key, value] of Object.entries(entities)) {
        if (value) parts.push(`${cleanLabel(key)}: ${cleanLabel(value)}`);
      }
    }
    return parts.join(' - ');
  }

  _riskFor(intent = {}) {
    const level = String(intent.permissionLevel || 'low').toLowerCase();
    if (intent.id === 'system.shutdown' || intent.id === 'system.restart') return 'critical';
    if (/\b(?:delete|remove|clear|format|permanent)\b/i.test(`${intent.id || ''} ${intent.description || ''}`)) return 'high';
    return RISK_BY_PERMISSION[level] || 'low';
  }

  _consequenceFor(intent = {}) {
    const id = String(intent.id || intent.action || '').toLowerCase();
    if (id === 'system.shutdown') return 'Open apps may close and unsaved work can be lost.';
    if (id === 'system.restart') return 'The computer will restart and unsaved work can be lost.';
    if (id === 'file.delete' || id === 'folder.delete') return 'Deleted items may not be recoverable from OpenX.';
    if (id === 'app.close' || id === 'window.close') return 'Unsaved changes in that window may be lost.';
    return '';
  }

  authenticate(password) {
    if (this.config?.auth?.password && password === this.config.auth.password) {
      this.isAuthenticated = true;
      this.failedAttempts = 0;
      return true;
    }
    this.failedAttempts++;
    if (this.failedAttempts >= this.maxFailedAttempts) {
      this.logger.warn('Maximum authentication attempts exceeded');
    }
    return false;
  }

  setUserLevel(level) {
    if (LEVEL_HIERARCHY[level] !== undefined) {
      this.userLevel = level;
      return true;
    }
    return false;
  }

  getUserLevel() {
    return this.userLevel;
  }

  isActionAllowed(intentId, entities) {
    return Boolean(intentId);
  }

  getLevels() {
    return Object.keys(LEVEL_HIERARCHY);
  }
}

function permissionNameForIntent(intent = {}, source = 'chat') {
  const normalizedSource = String(source || '').toLowerCase();
  const id = String(intent.id || intent.action || '').toLowerCase();
  if (normalizedSource === 'voice') return 'voiceCommands';
  if (id.includes('clipboard')) return 'clipboard';
  if (id.includes('notification')) return 'notifications';
  if (id.includes('file.') || id.includes('folder.')) return 'desktopAutomation';
  if (id.includes('media') || id.includes('camera') || id.includes('photo')) return 'gallery';
  if (id.includes('system.') || id.includes('app.') || id.includes('browser.') || id.includes('window.')) return 'desktopAutomation';
  return 'remoteCommands';
}

module.exports = PermissionValidator;
