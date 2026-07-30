const {
  HOME_ACTIONS,
  HOME_DEVICE_TYPES,
  HOME_ROOM_WORDS
} = require('../constants/HomeActions');
const {
  canonicalId,
  displayNameFromTarget,
  normalizeHomeText
} = require('../utilities/HomeText');
const { createHomeCommand } = require('../models/HomeCommand');

const ACTION_PATTERNS = Object.freeze([
  [HOME_ACTIONS.TURN_ON, /\b(?:turn|switch|power)\s+on\b|\b(?:start|enable)\b/],
  [HOME_ACTIONS.TURN_OFF, /\b(?:turn|switch|power)\s+off\b|\b(?:stop|disable)\b/],
  [HOME_ACTIONS.TOGGLE, /\b(?:toggle)\b/],
  [HOME_ACTIONS.OPEN, /\b(?:open)\b/],
  [HOME_ACTIONS.CLOSE, /\b(?:close|shut)\b/],
  [HOME_ACTIONS.SET_LEVEL, /\b(?:set|dim|brighten|increase|decrease|raise|lower)\b/]
]);

const NON_HOME_TARGET_WORDS = /\b(?:chrome|youtube|instagram|whatsapp|chatgpt|browser|file|folder|document|ppt|powerpoint|music|song|video|volume|brightness|alarm|reminder|timer)\b/;

class HomeCommandParser {
  parse(input, options = {}) {
    const rawText = String(input || '').trim();
    const text = normalizeHomeText(rawText);
    if (!text) {
      return null;
    }

    const action = this._extractAction(text);
    if (!action) {
      return null;
    }

    const targetText = this._extractTarget(text, action);
    if (!this._looksLikeHomeTarget(targetText, text, action)) {
      return null;
    }

    const target = canonicalId(targetText);
    if (!target) {
      return null;
    }

    return createHomeCommand({
      intent: 'home.device_control',
      target,
      action,
      displayTarget: displayNameFromTarget(targetText),
      value: this._extractLevel(text),
      rawText,
      source: options.source || 'assistant'
    });
  }

  _extractAction(text) {
    for (const [action, pattern] of ACTION_PATTERNS) {
      if (pattern.test(text)) {
        return action;
      }
    }
    return null;
  }

  _extractTarget(text, action) {
    let target = String(text || '')
      .replace(/\b(?:please|kindly|can you|could you|would you|will you)\b/g, ' ')
      .replace(/\b(?:turn|switch|power)\s+(?:on|off)\b/g, ' ')
      .replace(/\b(?:start|enable|stop|disable|toggle|open|close|shut)\b/g, ' ')
      .replace(/\b(?:set|dim|brighten|increase|decrease|raise|lower)\b/g, ' ')
      .replace(/\b(?:to|at)\s+\d{1,3}\s*(?:percent|%)?\b/g, ' ')
      .replace(/\b(?:the|a|an|my|now|device|home)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (action === HOME_ACTIONS.OPEN || action === HOME_ACTIONS.CLOSE) {
      target = target.replace(/\b(?:app|application|program|window|tab)\b/g, ' ').replace(/\s+/g, ' ').trim();
    }

    return target;
  }

  _looksLikeHomeTarget(targetText, fullText, action) {
    const target = normalizeHomeText(targetText);
    const text = normalizeHomeText(fullText);
    if (!target || target.length < 2) {
      return false;
    }

    const hasHomeDevice = HOME_DEVICE_TYPES.some(device => new RegExp(`\\b${device.replace(/\s+/g, '\\s+')}\\b`, 'i').test(target));
    const hasRoom = HOME_ROOM_WORDS.some(room => new RegExp(`\\b${room.replace(/\s+/g, '\\s+')}\\b`, 'i').test(target));
    const hasHomeCue = /\b(?:home|room|bedroom|kitchen|living|hall|garage|balcony|bathroom|light|fan|lamp|bulb|curtain|door|gate|heater|ac|switch|plug|socket)\b/.test(text);
    const openingHomeObject = (action === HOME_ACTIONS.OPEN || action === HOME_ACTIONS.CLOSE) &&
      /\b(?:curtain|curtains|door|gate|garage)\b/.test(target);

    if ((hasHomeDevice || openingHomeObject) && hasHomeCue) {
      return !NON_HOME_TARGET_WORDS.test(target) || /\b(?:light|fan|lamp|curtain|door|gate|heater|ac|switch|plug|socket)\b/.test(target);
    }

    return hasRoom && hasHomeDevice;
  }

  _extractLevel(text) {
    const match = String(text || '').match(/\b(?:to|at)\s+(\d{1,3})\s*(?:percent|%)?\b/);
    if (!match?.[1]) {
      return null;
    }
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  }
}

module.exports = HomeCommandParser;
