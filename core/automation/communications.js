const { Logger } = require('../assistant/Data');
const { launchTarget } = require('./common/launcher');

function normalizePhoneNumber(value) {
  const source = String(value || '').trim();
  const digits = source.replace(/[^\d]/g, '');
  if (digits.length < 7) return '';
  return source.startsWith('+') ? `+${digits}` : digits;
}

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

class CommunicationsController {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config?.logging || { level: 'info' });
  }

  async composeMessage(contactName, messageText, platform) {
    if (!contactName) {
      return { success: false, error: 'No contact name provided' };
    }

    if (!messageText) {
      return { success: false, error: 'No message text provided' };
    }

    const messagePlatform = this._resolveMessagingPlatform(platform);
    return {
      success: false,
      error: messagePlatform
        ? `Messaging platform not supported: ${messagePlatform}`
        : 'Messaging is not supported by this assistant'
    };
  }

  async startCall(contactName, platform) {
    if (!contactName) {
      return { success: false, error: 'No contact name provided' };
    }

    const requestedPlatform = String(platform || '').trim().toLowerCase();
    const phone = normalizePhoneNumber(contactName);
    const callPlatform = requestedPlatform || 'phone';

    if (callPlatform !== 'phone') {
      return {
        success: false,
        error: `Calling platform not supported: ${callPlatform}`
      };
    }

    if (!phone) {
      return { success: false, error: 'Provide a phone number directly for a standard phone call' };
    }

    this._launchUri(`tel:${phone}`);
    return {
      success: true,
      data: {
        contactName: String(contactName).trim(),
        platform: 'phone',
        phone
      }
    };
  }

  async composeEmail(contactName, subject = '', body = '') {
    if (!contactName) {
      return { success: false, error: 'No contact name provided' };
    }

    const email = String(contactName).trim();
    if (!isEmailAddress(email)) {
      return { success: false, error: 'Provide an email address directly' };
    }

    const cleanSubject = String(subject || '').trim();
    const cleanBody = String(body || '').trim();
    if (!cleanSubject || !cleanBody) {
      return {
        success: true,
        error: `Email draft needs ${!cleanSubject && !cleanBody ? 'a subject and message' : !cleanSubject ? 'a subject' : 'a message'} for ${email}`,
        data: {
          contactName: email,
          email,
          subject: cleanSubject,
          body: cleanBody,
          needsDetails: true
        }
      };
    }

    const url = this._buildMailtoUrl(email, cleanSubject, cleanBody);
    this._launchUri(url);
    return {
      success: true,
      data: {
        contactName: email,
        email,
        subject: cleanSubject,
        body: cleanBody,
        url,
        delivery: 'draft',
        platform: 'email'
      }
    };
  }

  _resolveMessagingPlatform(platform) {
    const requestedPlatform = String(platform || '').trim().toLowerCase();
    if (requestedPlatform) {
      return requestedPlatform;
    }

    return '';
  }

  _buildMailtoUrl(email, subject, body) {
    const params = new URLSearchParams();
    params.set('subject', subject);
    params.set('body', body);
    return `mailto:${encodeURIComponent(email)}?${params.toString()}`;
  }

  _launchUri(uri) {
    launchTarget(uri);
  }

  async destroy() {
    return true;
  }

}

module.exports = CommunicationsController;
