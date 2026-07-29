'use strict';

const TONE_PROFILES = Object.freeze({
  professional: {
    title: 'sir',
    sentenceLimit: 2,
    direct: true
  },
  friendly: {
    title: 'sir',
    sentenceLimit: 3,
    direct: false
  },
  concise: {
    title: 'sir',
    sentenceLimit: 1,
    direct: true
  },
  supportive: {
    title: 'sir',
    sentenceLimit: 3,
    direct: false
  }
});

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sentenceLimit(text, limit) {
  const sentences = compact(text)
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  if (sentences.length <= limit) return compact(text);
  return sentences.slice(0, limit).join(' ');
}

class Personality {
  constructor(config) {
    this.config = config;
    const displayName = String(config?.assistant?.displayName || 'OpenX').replace(/\s+/g, ' ').trim();
    const configuredStyle = String(config?.assistant?.responseStyle || config?.assistant?.personalityStyle || 'professional');
    this.persona = {
      name: displayName,
      title: 'Desktop Assistant',
      greeting: 'How may I assist you, sir?',
      farewell: 'Awaiting your next command, sir.',
      error: 'Unable to complete that request, sir.',
      style: TONE_PROFILES[configuredStyle] ? configuredStyle : 'professional'
    };

    this.titles = {
      generic: 'sir',
      professional: 'sir',
      casual: 'sir',
      friendly: 'sir',
      concise: 'sir',
      supportive: 'sir'
    };
  }

  get title() {
    return this.getToneProfile().title || this.titles[this.persona.style] || 'sir';
  }

  getToneProfile(style = this.persona.style) {
    return TONE_PROFILES[style] || TONE_PROFILES.professional;
  }

  shouldUseHonorific() {
    return this.config?.assistant?.addressing?.useHonorific !== false;
  }

  applyToResponse(response, options = {}) {
    if (!response) return '';

    const style = TONE_PROFILES[options.style] ? options.style : this.persona.style;
    const profile = this.getToneProfile(style);
    let result = sentenceLimit(response, options.sentenceLimit || profile.sentenceLimit);

    if (result.includes('{title}')) {
      result = result.replace(/{title}/g, this.title);
    }

    if (!this.shouldUseHonorific()) {
      result = result.replace(/\s*,?\s*\b(?:sir|master|boss|commander)\b(?=[.!?]?)/gi, '');
    }

    if (!result) return '';
    if (!/[.!?]$/.test(result)) result = `${result}.`;
    return result;
  }

  getPersona() {
    return {
      ...this.persona,
      toneProfile: this.getToneProfile()
    };
  }

  setStyle(style) {
    if (TONE_PROFILES[style] || this.titles[style]) {
      this.persona.style = style;
      return true;
    }
    return false;
  }

  describeStyle() {
    const profile = this.getToneProfile();
    return {
      style: this.persona.style,
      title: this.title,
      sentenceLimit: profile.sentenceLimit,
      direct: profile.direct
    };
  }
}

module.exports = Personality;
