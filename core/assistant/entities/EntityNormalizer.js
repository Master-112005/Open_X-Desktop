'use strict';

const { repairKnownTokenText } = require('../normalization/AssistantLexicon');

const CANONICAL = Object.freeze({
  application: {
    chrome: 'Google Chrome',
    msedge: 'Microsoft Edge',
    edge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox',
    vscode: 'Visual Studio Code',
    'vs code': 'Visual Studio Code',
    notepad: 'Notepad',
    calc: 'Calculator',
    calculator: 'Calculator',
    instagram: 'Instagram',
    telegram: 'Telegram',
    spotify: 'Spotify',
    youtube: 'YouTube'
  },
  browser: {
    chrome: 'Google Chrome',
    edge: 'Microsoft Edge',
    msedge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox'
  },
  website: {
    yt: 'YouTube',
    youtube: 'YouTube',
    github: 'GitHub',
    google: 'Google',
    gmail: 'Gmail'
  },
  folder: {
    docs: 'Documents',
    documents: 'Documents',
    desktop: 'Desktop Folder',
    downloads: 'Downloads',
    pictures: 'Pictures',
    videos: 'Videos',
    music: 'Music'
  },
  device: {
    mobile: 'Phone',
    cellphone: 'Phone',
    smartphone: 'Phone',
    iphone: 'iPhone',
    android: 'Android Phone',
    pc: 'Computer'
  },
  network: {
    wifi: 'Wi-Fi',
    'wi-fi': 'Wi-Fi'
  }
});

const NUMBER_WORDS = Object.freeze({
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  sixty: 60
});

class EntityNormalizer {
  constructor(options = {}) {
    this.id = options.id || 'entity.normalizer';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1000;
    this.maps = { ...CANONICAL, ...(options.maps || {}) };
  }

  process(context) {
    for (const entity of context.allEntities()) {
      const key = String(entity.value || '').toLowerCase().trim();
      const rawKey = String(entity.rawValue || '').toLowerCase().trim();
      const repairedKey = repairKnownTokenText(key);
      const repairedRawKey = repairKnownTokenText(rawKey);
      entity.canonical = this.maps[entity.type]?.[key] ||
        this.maps[entity.type]?.[rawKey] ||
        this.maps[entity.type]?.[repairedKey] ||
        this.maps[entity.type]?.[repairedRawKey] ||
        entity.canonical ||
        entity.value;
      if (entity.type === 'duration') entity.metadata.durationSeconds = this._durationSeconds(entity.value);
      if (entity.type === 'volumeLevel' || entity.type === 'brightnessLevel') {
        entity.value = String(Math.max(0, Math.min(100, Number(entity.value) || 0)));
        entity.canonical = entity.value;
      }
    }
    return context;
  }

  _durationSeconds(value) {
    const match = String(value || '').toLowerCase().match(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)\s*(seconds?|secs?|minutes?|mins?|minits?|hours?|hrs?)\b/);
    if (!match) return null;
    const amount = Number.isFinite(Number(match[1])) ? Number(match[1]) : NUMBER_WORDS[match[1]];
    if (!Number.isFinite(amount)) return null;
    if (/hour|hr/.test(match[2])) return amount * 3600;
    if (/min/.test(match[2])) return amount * 60;
    return amount;
  }
}

module.exports = EntityNormalizer;
