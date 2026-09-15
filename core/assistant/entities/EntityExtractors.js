'use strict';

const { BaseEntityExtractor } = require('./EntityCore');
const {
  findRelationshipMentions,
  findSelfReferences,
  isRelationshipTerm,
  isSelfReference,
  normalizePersonReference
} = require('./EntityCore');
const { APP_ALIASES, FOLDER_ALIASES } = require('./EntityExtractor');

class ApplicationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addAliasMatches(context, 'application', APP_ALIASES, { confidence: 0.82 });
    this.addRegexMatches(context, 'application', /\b(?:open|launch|start|run|close|quit|switch\s+to|focus)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9 .+-]{1,60}?)(?=\s+(?:app|application|program|window)\b|$)/gi, { confidence: 0.64 });
    return context;
  }
}

const BROWSERS = Object.freeze({
  chrome: 'Google Chrome',
  'google chrome': 'Google Chrome',
  edge: 'Microsoft Edge',
  'microsoft edge': 'Microsoft Edge',
  firefox: 'Mozilla Firefox',
  browser: 'browser'
});

class BrowserExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addAliasMatches(context, 'browser', BROWSERS, { confidence: 0.86 });
    if (/\b(?:open|launch|start|search|browse)\s+(?:the\s+)?(?:web|internet|browser)\b/i.test(this.text(context))) {
      this.addEntity(context, 'browser', 'browser', { rawValue: 'browser', confidence: 0.6 });
    }
    return context;
  }
}

const SITES = Object.freeze({
  yt: 'YouTube',
  youtube: 'YouTube',
  google: 'Google',
  github: 'GitHub',
  gmail: 'Gmail',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  amazon: 'Amazon',
  netflix: 'Netflix'
});

class WebsiteExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'website', /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?/g, { confidence: 0.9 });
    this.addAliasMatches(context, 'website', SITES, { confidence: 0.8 });
    this.addRegexMatches(context, 'website', /\b(?:open|search|browse|go\s+to)\s+([A-Za-z0-9.-]+\.[A-Za-z]{2,})(?:\s|$)/gi, { confidence: 0.86 });
    return context;
  }
}

class FileExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'file', /(?:^|[\s"])([^\s"\\/]+\.[A-Za-z0-9]{1,10})(?=$|[\s"])/g, { confidence: 0.88, metadata: { kind: 'explicit-extension' } });
    this.addRegexMatches(context, 'file', /\b(?:file|document|pdf|spreadsheet|presentation|note|resume)\s+(?:called|named)?\s*([^,.;]+?)(?=\s+(?:in|on|at|to|from|into|with|using)\b|$)/gi, { confidence: 0.66 });
    this.addRegexMatches(context, 'file', /\b(?:open|show|delete|remove|move|copy|send|share|transfer|rename|backup|compress|extract)\s+(?:my\s+|the\s+|a\s+|an\s+|latest\s+|newest\s+|recent\s+)?([^,.;]+?)\s+(?:file|document|pdf|spreadsheet|presentation|note|resume)\b/gi, { confidence: 0.7 });
    this.addRegexMatches(context, 'file', /\b(?:latest|newest|recent|last)\s+((?:downloaded|created|modified)?\s*(?:file|document|pdf|screenshot|recording|image|video|audio))\b/gi, { confidence: 0.64, metadata: { relative: true } });
    return context;
  }
}

class FolderExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addAliasMatches(context, 'folder', FOLDER_ALIASES, { confidence: 0.86 });
    this.addRegexMatches(context, 'folder', /\b(?:folder|directory)\s+(?:called|named)?\s*([^,.;]+?)(?=\s+(?:in|on|at|to|from)\b|$)/gi, { confidence: 0.62 });
    this.addRegexMatches(context, 'folder', /\b(?:open|show|create|make|delete|move|copy|backup|compress|extract|organize|clean)\s+(?:my\s+|the\s+|a\s+|an\s+)?([^,.;]+?)\s+(?:folder|directory|workspace)\b/gi, { confidence: 0.68 });
    this.addRegexMatches(context, 'folder', /\b(downloads|documents|desktop|pictures|videos|music|screenshots|recordings|projects|work|study|coding)\s+(?:folder|directory|workspace)\b/gi, { confidence: 0.72 });
    return context;
  }
}

class PathExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'path', /([A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*)/g, { confidence: 0.92 });
    this.addRegexMatches(context, 'path', /(["'])([A-Za-z]:\\[^"']+)\1/g, { group: 2, confidence: 0.94 });
    this.addRegexMatches(context, 'path', /(\\\\[^\s"]+)/g, { confidence: 0.9 });
    this.addRegexMatches(context, 'path', /(?:^|\s)(~\/[^\s"]+|\/[^\s"]+)/g, { confidence: 0.78 });
    this.addRegexMatches(context, 'path', /\b(?:in|from|to|into|under)\s+(desktop|downloads|documents|pictures|videos|music|home)\b/gi, { confidence: 0.68, metadata: { kind: 'known-folder-path' } });
    return context;
  }
}

class MediaExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\b(?:play|stream|listen to|watch|queue|start playing)\s+(.+?)(?:\s+(?:on|in|via)\s+(?:youtube|spotify|soundcloud|apple music|amazon music|jiosaavn|gaana))?$/i);
    if (match?.[1]) {
      const value = match[1]
        .replace(/\b(?:song|songs|music|track|tracks|video|videos)\b\s*$/i, '')
        .trim();
      this.addEntity(context, 'media', value || match[1], { confidence: 0.74, metadata: { kind: 'media-query' } });
    }
    this.addRegexMatches(context, 'media', /\b(?:playlist|album|artist|podcast|audiobook)\s+(?:called|named)?\s*([^,.;]+)$/gi, { confidence: 0.66 });
    return context;
  }
}

class ContactExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'contact', /\b(?:call|message|text|reply\s+(?:to|for)|send(?:\s+\w+)?\s+to)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s+(?:on|via|using|saying|that|with|about|to)\b|$)/gi, { confidence: 0.74 });
    this.addRegexMatches(context, 'contact', /\b(?:to|for)\s+([A-Z][A-Za-z .'-]{1,60}?)(?=\s+(?:saying|that|message|reply)\b|$)/g, { confidence: 0.62 });
    return context;
  }
}

const NON_PERSON_TERMS = new Set([
  'all', 'any', 'camera', 'favorite', 'favorites', 'favourite', 'favourites',
  'face', 'faces', 'image', 'images', 'latest', 'memory', 'photo',
  'photos', 'pic', 'pics', 'picture', 'pictures', 'recent', 'screenshot',
  'screenshots', 'selfie', 'the', 'this', 'that', 'these', 'those', 'where',
  'which', 'who', 'what', 'when', 'from', 'with', 'and', 'near', 'inside',
  'outside', 'birthday', 'trip', 'vacation', 'beach', 'mountain', 'hill',
  'forest', 'nature', 'document', 'receipt', 'invoice'
]);

const VISUAL_PERSON_QUERY = /\b(?:find|show|get|search|display|open|look\s+for)\b.*\b(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces)\b|\b(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces)\b.*\b(?:of|with)\b/i;

function cleanCandidate(value) {
  return String(value || '')
    .replace(/\b(?:with|and|at|in|on|near|inside|outside|my|our|the|a|an|photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces|where|was|were|is|are|that|this|those|these)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9 .'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNames(value) {
  return String(value || '')
    .split(/\s+(?:and|with|plus)\s+|[,/&]+/i)
    .map(cleanCandidate)
    .filter(Boolean);
}

class PersonExtractor extends BaseEntityExtractor {
  extract(context) {
    const matches = this.text(context).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
    for (const value of matches) {
      if (!/^(OpenX|Chrome|Google|Microsoft|Windows|Desktop|Downloads|Documents|Pictures|Videos|Music|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(value)) {
        this.addEntity(context, 'person', value, { confidence: 0.52, metadata: { kind: 'capitalized-name' } });
      }
    }
    this._extractVisualPeople(context);
    return context;
  }

  _extractVisualPeople(context) {
    const text = this.text(context);
    if (!VISUAL_PERSON_QUERY.test(text)) return;

    for (const self of findSelfReferences(text)) {
      this.addEntity(context, 'person', 'me', {
        canonical: normalizePersonReference(self.value),
        confidence: 0.93,
        metadata: { kind: 'self-reference', raw: self.raw, index: self.index }
      });
    }

    for (const relationship of findRelationshipMentions(text)) {
      context.addRelationship({
        type: 'person-relationship-reference',
        source: 'user',
        target: relationship.value,
        confidence: 0.88,
        metadata: {
          raw: relationship.raw,
          alias: relationship.alias,
          extractor: this.id
        }
      });
    }

    const patterns = [
      /\b(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces)\s+(?:of|with)\s+([a-z][a-z .'-]{1,70})(?=\s+(?:at|in|on|near|inside|outside|last|from|during|where|that|which|who|photo|picture|image|screenshot)\b|$)/gi,
      /\b(?:find|show|get|search|display|open|look\s+for)\s+(?:me\s+)?(?:a\s+|the\s+|my\s+)?([a-z][a-z .'-]{1,50})\s+(?:photo|photos|picture|pictures|pic|pics|image|images|selfie|portrait|face|faces)\b/gi,
      /\b(?:me|myself|i)\s+(?:and|with)\s+(?:my\s+)?([a-z][a-z .'-]{1,50})(?=\s+(?:in|inside|at|near|on|from|photo|pic|picture|image|$))/gi
    ];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text))) {
        this._addNameCandidates(context, match[1]);
      }
    }
  }

  _addNameCandidates(context, value) {
    for (const name of splitNames(value)) {
      if (!this._isNameCandidate(name)) continue;
      this.addEntity(context, 'person', name, {
        confidence: 0.76,
        metadata: { kind: 'visual-person-reference' }
      });
    }
  }

  _isNameCandidate(value) {
    const cleaned = cleanCandidate(value);
    const normalized = cleaned.toLowerCase();
    if (!normalized || normalized.length < 2 || /^\d+$/.test(normalized)) return false;
    if (NON_PERSON_TERMS.has(normalized) || isRelationshipTerm(normalized) || isSelfReference(normalized)) return false;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length > 4) return false;
    return !tokens.some(token => NON_PERSON_TERMS.has(token) || isRelationshipTerm(token));
  }
}

class DeviceExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'device', /\b(phone|mobile|iphone|android|tablet|laptop|desktop|computer|pc|speaker|camera|printer|headphones?|earbuds?|keyboard|mouse)\b/gi, { confidence: 0.78 });
    this.addRegexMatches(context, 'device', /\b(?:my|this|that|connected)\s+(device|phone|laptop|computer|pc)\b/gi, { confidence: 0.7 });
    return context;
  }
}

class LocationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'location', /\b(?:at|in|near|when\s+i\s+(?:reach|arrive\s+at|leave))\s+(home|office|school|college|work|campus|airport|station|store|gym|library)\b/gi, { confidence: 0.68 });
    this.addRegexMatches(context, 'location', /\b(?:nearby|near\s+me|around\s+me)\b/gi, { confidence: 0.64, metadata: { relative: true } });
    return context;
  }
}

class DateExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'date', /\b(today|tomorrow|tonight|next week|next month|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, { confidence: 0.82 });
    this.addRegexMatches(context, 'date', /\b(?:every|on)\s+((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:,|and)?\s*)?)+)\b/gi, { confidence: 0.76, metadata: { recurring: true } });
    this.addRegexMatches(context, 'date', /\b(weekdays?|weekends?|daily|weekly|monthly)\b/gi, { confidence: 0.72, metadata: { recurring: true } });
    this.addRegexMatches(context, 'date', /\b(?:this|next)\s+month\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, { confidence: 0.8 });
    this.addRegexMatches(context, 'date', /\b\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:this|next)\s+month|\s+(?:this|next)\s+month)\b/gi, { confidence: 0.8 });
    this.addRegexMatches(context, 'date', /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/gi, { confidence: 0.78 });
    this.addRegexMatches(context, 'date', /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+(?:\d{2,4}|(?:of\s+)?(?:this|next)\s+year))?\b/gi, { confidence: 0.78 });
    this.addRegexMatches(context, 'date', /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+(?:\d{2,4}|(?:of\s+)?(?:this|next)\s+year))?\b/gi, { confidence: 0.78 });
    return context;
  }
}

class TimeExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'time', /\b(?:at\s+)?(\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm))\b/gi, { confidence: 0.86 });
    this.addRegexMatches(context, 'time', /\b(?:at|by)\s+(\d{1,2}:\d{2})\b/gi, { confidence: 0.8 });
    this.addRegexMatches(context, 'time', /\b(?:at|by)\s+(\d{1,2})\s+(?:today|tomorrow|tonight|morning|afternoon|evening|night)\b/gi, { confidence: 0.66 });
    this.addRegexMatches(context, 'time', /\b(?:at\s+)?((?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:am|pm))\b/gi, { confidence: 0.82 });
    this.addRegexMatches(context, 'time', /\b((?:half|quarter)\s+(?:past|to)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))\b/gi, { confidence: 0.76 });
    this.addRegexMatches(context, 'time', /\b(noon|midnight|morning|afternoon|evening|night)\b/gi, { confidence: 0.62 });
    return context;
  }
}

class DurationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'duration', /\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\s*five)?|sixty)\s*(?:seconds?|minutes?|hours?|secs?|mins?|minits?|hrs?))\b/gi, { confidence: 0.84 });
    this.addRegexMatches(context, 'duration', /\b(half\s+an?\s+hour|quarter\s+hour|one\s+and\s+a\s+half\s+hours?)\b/gi, { confidence: 0.78 });
    this.addRegexMatches(context, 'duration', /\b(?:for|in|after)\s+(\d{1,3})\s*(?:m|h|s)\b/gi, { confidence: 0.66 });
    return context;
  }
}

const SCHEDULE_FRAGMENT = /\b(?:today|tomorrow|tonight|next\s+week|next\s+month|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:morning|afternoon|evening|night)|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|this|next)\s+(?:month|year)?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm)|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:am|pm)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\s*five)?|sixty)\s*(?:seconds?|secs?|minutes?|mins?|minits?|hours?|hrs?))\b/gi;

class ReminderExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.text(context);
    const match = text.match(/\b(?:remind|reminder|notify|alert)\b(?:.+?\b(?:to|say|about|that)\s+(.+))?/i);
    if (!match) return context;
    const recurrence = text.match(/\bevery\s+((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|day|morning|evening|night|hour|week|month)(?:\s*(?:,|and)?\s*)?)+)\b/i);
    const candidate = match[1] || text
      .replace(/^.*?\b(?:remind|reminder|notify|alert)(?:\s+me)?\b/i, '');
    const value = String(candidate || '')
      .replace(/\bevery\s+((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|day|morning|evening|night|hour|week|month)(?:\s*(?:,|and)?\s*)?)+)\b/gi, ' ')
      .replace(SCHEDULE_FRAGMENT, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^(?:at|on|in|after|for|by|to|that|about|say)\b\s*/i, '')
      .replace(/\s+(?:at|on|in|after|for|by|to|that|about|say)\s*$/i, '')
      .replace(/[.?!]+$/g, '')
      .trim();
    if (value) {
      this.addEntity(context, 'reminder', value, {
        confidence: match[1] ? 0.8 : 0.72,
        metadata: recurrence?.[1] ? { recurrence: recurrence[1].replace(/\s+/g, ' ').trim() } : {}
      });
    }
    return context;
  }
}

class AlarmExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\b(?:set|create|add)?\s*(?:an?\s+)?alarm\b(?:\s+(?:for|at|called|named|label(?:\s+it)?)\s+([^,.;]+))?/i)
      || this.text(context).match(/\bwake\s+me\s+(?:up\s+)?(?:at|by|before)\s+([^,.;]+)/i);
    if (match) this.addEntity(context, 'alarm', match[1] || match[0], { confidence: 0.74, metadata: { kind: 'alarm' } });
    return context;
  }
}

class TimerExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\b(?:set|start|create|begin|run)?\s*(?:a\s+)?(?:timer|countdown|pomodoro)\b(?:\s+(?:for|at|called|named)\s+([^,.;]+))?/i);
    if (match) this.addEntity(context, 'timer', match[1] || match[0], { confidence: 0.74, metadata: { kind: /\bpomodoro\b/i.test(match[0]) ? 'pomodoro' : 'timer' } });
    return context;
  }
}

class WindowExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'window', /\b(current window|active window|this window|that window|window)\b/gi, { confidence: 0.62 });
    this.addRegexMatches(context, 'window', /\b(?:close|minimize|maximize|restore|focus|switch\s+to)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9 .'-]{1,60}?)(?:\s+window)?(?=$|[.?!])/gi, { confidence: 0.66 });
    return context;
  }
}

class NetworkExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'network', /\b(wifi|wi-fi|wi fi|bluetooth|vpn|network|hotspot|ethernet|internet)\b/gi, { confidence: 0.75 });
    this.addRegexMatches(context, 'network', /\b(?:connect\s+to|disconnect\s+from|forget)\s+([A-Za-z0-9 _.-]{2,64})\s+(?:wifi|wi-fi|network|hotspot)\b/gi, { confidence: 0.68, metadata: { kind: 'network-name' } });
    return context;
  }
}

class VolumeExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.text(context);
    const match = text.match(/\b(?:volume|sound|vol)\b.*?\b(\d{1,3})\s*%?\b/i)
      || text.match(/\b(?:set\s+it\s+to|set\s+to|to)\s*(\d{1,3})\s*%?\b/i)
      || text.match(/\b(\d{1,3})\s*%?\s+(?:volume|sound|vol)\b/i);
    if (match) this.addEntity(context, 'volumeLevel', Math.min(100, Number(match[1])), { confidence: 0.86, metadata: { control: 'volume' } });
    if (/\b(?:max|maximum|full)\s+(?:volume|sound|vol)\b/i.test(text)) this.addEntity(context, 'volumeLevel', 100, { confidence: 0.82, metadata: { control: 'volume' } });
    if (/\b(?:mute|minimum|zero)\s+(?:volume|sound|vol)?\b/i.test(text)) this.addEntity(context, 'volumeLevel', 0, { confidence: 0.78, metadata: { control: 'volume' } });
    return context;
  }
}

class BrightnessExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.text(context);
    const match = text.match(/\b(?:brightness|screen|display)\b.*?\b(\d{1,3})\s*%?\b/i) || text.match(/\b(\d{1,3})\s*%?\s+(?:brightness|screen|display)\b/i);
    if (match) this.addEntity(context, 'brightnessLevel', Math.min(100, Number(match[1])), { confidence: 0.86, metadata: { control: 'brightness' } });
    if (/\b(?:max|maximum|full)\s+(?:brightness|screen|display)\b/i.test(text)) this.addEntity(context, 'brightnessLevel', 100, { confidence: 0.82, metadata: { control: 'brightness' } });
    if (/\b(?:minimum|zero|dim)\s+(?:brightness|screen|display)?\b/i.test(text)) this.addEntity(context, 'brightnessLevel', 0, { confidence: 0.72, metadata: { control: 'brightness' } });
    return context;
  }
}

module.exports = {
  ApplicationExtractor,
  BrowserExtractor,
  WebsiteExtractor,
  FileExtractor,
  FolderExtractor,
  PathExtractor,
  MediaExtractor,
  ContactExtractor,
  PersonExtractor,
  DeviceExtractor,
  LocationExtractor,
  DateExtractor,
  TimeExtractor,
  DurationExtractor,
  ReminderExtractor,
  AlarmExtractor,
  TimerExtractor,
  WindowExtractor,
  NetworkExtractor,
  VolumeExtractor,
  BrightnessExtractor
};