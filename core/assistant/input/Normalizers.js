'use strict';

const BaseNormalizer = require('./BaseNormalizer');
const { TOKEN_CORRECTIONS } = require('./CommandPreprocessor');
const {
  ASSISTANT_TOKEN_CORRECTIONS,
  correctTokenWithLexicon,
  repairRepeatedLetters
} = require('./AssistantLexicon');

const DEFAULT_ABBREVIATIONS = Object.freeze({
  appt: 'appointment',
  bt: 'bluetooth',
  cmd: 'command',
  dl: 'download',
  doc: 'document',
  docs: 'documents',
  img: 'image',
  imgs: 'images',
  mins: 'minutes',
  msgg: 'message',
  msg: 'message',
  mon: 'monday',
  sat: 'saturday',
  sun: 'sunday',
  pc: 'computer',
  pls: 'please',
  plz: 'please',
  rem: 'reminder',
  ss: 'screenshot',
  tmrw: 'tomorrow',
  txt: 'text',
  vid: 'video',
  vol: 'volume',
  wifi: 'wifi'
});

class AbbreviationExpander extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = { ...DEFAULT_ABBREVIATIONS, ...(options.dictionaries?.abbreviations || options.abbreviations || {}) };
  }

  normalize(context) {
    const expansions = [];
    const next = String(context.workingText || '').replace(/\b[a-zA-Z]{2,}\b/g, token => {
      const replacement = this.dictionary[token.toLowerCase()];
      if (replacement && replacement !== token) expansions.push({ from: token, to: replacement });
      return replacement || token;
    });
    return context.setText(next, this.id, { expansions });
  }
}

const DEFAULT_CONTRACTIONS = Object.freeze({
  "aren't": 'are not',
  "ain't": 'is not',
  "can't": 'cannot',
  "could've": 'could have',
  "couldn't": 'could not',
  "didn't": 'did not',
  "doesn't": 'does not',
  "don't": 'do not',
  "hadn't": 'had not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "i'm": 'I am',
  "i've": 'I have',
  "i'll": 'I will',
  "i'd": 'I would',
  "isn't": 'is not',
  "it's": 'it is',
  "shouldn't": 'should not',
  "that's": 'that is',
  "there's": 'there is',
  "wasn't": 'was not',
  "we're": 'we are',
  "we'll": 'we will',
  "won't": 'will not',
  "wouldn't": 'would not',
  "you're": 'you are',
  "you'll": 'you will',
  "y'all": 'you all'
});

class ContractionResolver extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = { ...DEFAULT_CONTRACTIONS, ...(options.dictionaries?.contractions || options.contractions || {}) };
  }

  normalize(context) {
    const contractions = [];
    const next = String(context.workingText || '').replace(/\b[\w']+\b/g, token => {
      const replacement = this.dictionary[token.toLowerCase()];
      if (replacement) contractions.push({ from: token, to: replacement });
      return replacement || token;
    });
    return context.setText(next, this.id, { contractions });
  }
}

const MONTHS = Object.freeze({
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12'
});

const WEEKDAYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]);

class DateNormalizer extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const lower = text.toLowerCase();
    const expressions = [];
    let match;
    ['today', 'tomorrow', 'yesterday', 'tonight', 'this weekend', 'next week', 'next month', 'every day', 'daily', 'weekly', 'every weekday', 'every weekend'].forEach(expression => {
      if (lower.includes(expression)) expressions.push({ original: expression, type: 'relative' });
    });
    const weekdayMatches = lower.match(/\b(?:next|this|every)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || [];
    weekdayMatches.forEach(original => expressions.push({ original, type: 'weekday' }));
    const compactWeekdayMatches = lower.match(/\b(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/g) || [];
    compactWeekdayMatches.forEach(original => {
      const weekday = WEEKDAYS.find(day => original.startsWith(day.slice(0, -1)) || original.startsWith(day));
      expressions.push({ original, type: 'weekday', weekday });
    });
    const weekdayRange = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+to\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (weekdayRange) {
      expressions.push({ original: weekdayRange[0], type: 'weekday-range', start: weekdayRange[1], end: weekdayRange[2] });
    }
    const weekdayListPattern = /\b(?:every\s+)?((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:,|and|&)\s*|\s+)+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:(?:\s*(?:,|and|&)\s*|\s+)(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)\b/g;
    while ((match = weekdayListPattern.exec(lower)) !== null) {
      const weekdays = match[1].match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/g) || [];
      if (weekdays.length > 1) expressions.push({ original: match[0], type: 'weekday-list', weekdays: [...new Set(weekdays)] });
    }
    const monthPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
    while ((match = monthPattern.exec(text)) !== null) {
      expressions.push({ original: match[0], type: 'calendar', day: Number(match[1]), month: MONTHS[match[2].toLowerCase()] });
    }
    const thisMonthPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:this|next)\s+month\b/gi;
    while ((match = thisMonthPattern.exec(text)) !== null) {
      expressions.push({ original: match[0], type: 'relative-month-day', day: Number(match[1]) });
    }
    expressions.forEach(expression => context.addObservation('dates', expression));
    return context.setText(text, this.id, { expressionsCount: expressions.length });
  }
}

const EMOJI_MEANINGS = Object.freeze({
  '\u{1F4E7}': 'email',
  '\u{1F4E8}': 'message',
  '\u{1F4C1}': 'folder',
  '\u{1F4C2}': 'folder',
  '\u{1F4DD}': 'note',
  '\u{1F4F1}': 'phone',
  '\u{1F50A}': 'volume',
  '\u{1F507}': 'mute',
  '\u{23F0}': 'alarm',
  '\u{23F2}': 'timer',
  '\u{1F50D}': 'search',
  '\u{1F642}': 'happy',
  '\u{1F60A}': 'happy'
});

class EmojiInterpreter extends BaseNormalizer {
  normalize(context) {
    let next = String(context.workingText || '');
    Object.keys(EMOJI_MEANINGS).forEach(emoji => {
      if (!next.includes(emoji)) return;
      const meaning = EMOJI_MEANINGS[emoji];
      context.addObservation('emojis', { emoji, meaning });
      next = next.split(emoji).join(` ${emoji} ${meaning} `);
    });
    return context.setText(next.replace(/[ \t]{2,}/g, ' ').trim(), this.id);
  }
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE_CHARACTERS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

class InputCleaner extends BaseNormalizer {
  normalize(context) {
    const cleaned = String(context.workingText || '')
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL_CHARACTERS, '')
      .replace(INVISIBLE_CHARACTERS, '');
    const maxLength = Math.max(1, Number(context.configuration?.maxInputLength) || cleaned.length || 1);
    const truncated = cleaned.length > maxLength;
    const next = truncated ? cleaned.slice(0, maxLength) : cleaned;
    if (truncated) {
      context.addWarning('Input was truncated by normalization maxInputLength.', {
        maxInputLength: maxLength,
        originalLength: cleaned.length
      });
    }
    return context.setText(next, this.id, {
      removedUnsupportedCharacters: context.workingText.length - cleaned.length,
      truncated,
      maxInputLength: maxLength
    });
  }
}

function detectScript(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  return 'en';
}

function detectSegments(text) {
  const segments = [];
  let current = null;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const language = detectScript(char);
    if (!current || current.language !== language) {
      if (current) segments.push(current);
      current = { language, start: index, end: index + 1, text: char };
    } else {
      current.end = index + 1;
      current.text += char;
    }
  }
  if (current) segments.push(current);
  return segments.filter(segment => segment.text.trim().length > 0);
}

class LanguageSwitcher extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const language = detectScript(text);
    const segments = detectSegments(text);
    context.language = {
      code: language,
      confidence: language === 'en' && segments.length <= 1 ? 0.7 : 0.85,
      detector: 'normalization.languageSwitcher'
    };
    segments.forEach(segment => context.addObservation('languageSegments', segment));
    if (segments.length === 0) {
      context.addObservation('languageSegments', { language, start: 0, end: text.length, text });
    }
    return context.setText(text, this.id, { language, segmentCount: Math.max(segments.length, 1) });
  }
}

const SMALL = Object.freeze({
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
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
});

const TENS = Object.freeze({
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
});

const MAGNITUDES = Object.freeze({
  hundred: 100,
  thousand: 1000
});

const ORDINALS = Object.freeze({
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20
});

const MULTIPLIERS = Object.freeze({
  half: 0.5,
  quarter: 0.25,
  double: 2,
  triple: 3
});

const ROMAN = Object.freeze({
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10
});

function parseNumberWords(words) {
  if (!words.length) return null;
  const filtered = words.filter(word => word && word !== 'and');
  if (filtered.length !== words.length) return parseNumberWords(filtered);
  if (words.length === 1) {
    return SMALL[words[0]] ?? TENS[words[0]] ?? ORDINALS[words[0]] ?? MULTIPLIERS[words[0]] ?? null;
  }
  if (words.length === 2 && SMALL[words[0]] !== undefined && MAGNITUDES[words[1]]) {
    return SMALL[words[0]] * MAGNITUDES[words[1]];
  }
  if (words.length === 3 && SMALL[words[0]] !== undefined && MAGNITUDES[words[1]] && SMALL[words[2]] !== undefined) {
    return (SMALL[words[0]] * MAGNITUDES[words[1]]) + SMALL[words[2]];
  }
  if (words.length === 2 && TENS[words[0]] && SMALL[words[1]] !== undefined) {
    return TENS[words[0]] + SMALL[words[1]];
  }
  return null;
}

class NumberNormalizer extends BaseNormalizer {
  normalize(context) {
    const tokens = String(context.workingText || '').replace(/([a-z]+)-([a-z]+)/gi, '$1 $2').split(/(\s+)/);
    const output = [];
    const rewriteText = this.options.rewriteText === true;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (/^\s+$/.test(token)) {
        output.push(token);
        continue;
      }
      const word = token.toLowerCase().replace(/[^a-z]/g, '');
      const nextWord = String(tokens[index + 2] || '').toLowerCase().replace(/[^a-z]/g, '');
      const thirdWord = String(tokens[index + 4] || '').toLowerCase().replace(/[^a-z]/g, '');
      const fourthWord = String(tokens[index + 6] || '').toLowerCase().replace(/[^a-z]/g, '');
      const numeric = token.match(/^(\d+(?:\.\d+)?)(st|nd|rd|th|%)?$/i);
      if (numeric) {
        context.addObservation('numbers', {
          original: token,
          value: Number(numeric[1]),
          type: numeric[2] === '%' ? 'percentage' : numeric[2] ? 'ordinal' : 'numeric'
        });
        output.push(token);
        continue;
      }
      if (/^[IVX]{2,}$/u.test(token)) {
        const romanValue = ROMAN[token.toLowerCase()] ?? null;
        if (romanValue !== null) {
          context.addObservation('numbers', { original: token, value: romanValue, type: 'roman' });
          output.push(rewriteText ? String(romanValue) : token);
          continue;
        }
      }
      const four = parseNumberWords([word, nextWord, thirdWord, fourthWord]);
      if (four !== null && nextWord && thirdWord && fourthWord) {
        context.addObservation('numbers', { original: `${token} ${tokens[index + 2]} ${tokens[index + 4]} ${tokens[index + 6]}`, value: four });
        if (rewriteText) {
          output.push(String(four));
          index += 6;
        } else {
          output.push(token);
        }
        continue;
      }
      const three = parseNumberWords([word, nextWord, thirdWord]);
      if (three !== null && nextWord && thirdWord) {
        context.addObservation('numbers', { original: `${token} ${tokens[index + 2]} ${tokens[index + 4]}`, value: three });
        if (rewriteText) {
          output.push(String(three));
          index += 4;
        } else {
          output.push(token);
        }
        continue;
      }
      const two = parseNumberWords([word, nextWord]);
      if (two !== null && nextWord) {
        context.addObservation('numbers', { original: `${token} ${tokens[index + 2]}`, value: two });
        if (rewriteText) {
          output.push(String(two));
          index += 2;
        } else {
          output.push(token);
        }
        continue;
      }
      const one = parseNumberWords([word]);
      if (one !== null) {
        context.addObservation('numbers', { original: token, value: one });
        output.push(rewriteText ? String(one) : token);
        continue;
      }
      output.push(token);
    }
    return context.setText(output.join(''), this.id, { rewriteText });
  }
}

class PunctuationNormalizer extends BaseNormalizer {
  normalize(context) {
    const next = String(context.workingText || '')
      .replace(/\.{3,}/g, '...')
      .replace(/\?{2,}/g, '?')
      .replace(/!{2,}/g, '!')
      .replace(/([!?]){2,}/g, '$1')
      .replace(/\s+([,.;:?!])/g, '$1')
      .replace(/([,;?!])([^\s,.;:?!])/g, '$1 $2')
      .trim();
    return context.setText(next, this.id, { normalizedPunctuation: next !== String(context.workingText || '') });
  }
}

const PRESERVE_REPEATED = new Set(['no', 'yes', 'ok', 'okay', 'stop', 'wait']);

class RepeatedWordCleaner extends BaseNormalizer {
  normalize(context) {
    const collapsed = [];
    const tokens = String(context.workingText || '').split(/(\s+)/);
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const previousWord = collapsed.slice().reverse().find(item => !/^\s+$/.test(item));
      const isWord = /^[a-zA-Z][\w'-]*$/.test(token);
      if (isWord && previousWord && previousWord.toLowerCase() === token.toLowerCase() && !PRESERVE_REPEATED.has(token.toLowerCase())) {
        continue;
      }
      collapsed.push(token);
    }
    const next = collapsed.join('');
    return context.setText(next, this.id, { preservedRepeatedWords: [...PRESERVE_REPEATED] });
  }
}

const DEFAULT_SLANG = Object.freeze({
  bro: '',
  bruh: '',
  cuz: 'because',
  gonna: 'going to',
  gotta: 'got to',
  wanna: 'want to',
  kinda: 'kind of',
  lemme: 'let me',
  msg: 'message',
  pls: 'please',
  plz: 'please',
  rn: 'right now',
  ya: 'you'
});

class SlangNormalizer extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = { ...DEFAULT_SLANG, ...(options.dictionaries?.slang || options.slang || {}) };
  }

  normalize(context) {
    const replacements = [];
    const next = String(context.workingText || '').replace(/\b[a-zA-Z']+\b/g, token => {
      const key = token.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(this.dictionary, key)) return token;
      replacements.push({ from: token, to: this.dictionary[key] });
      return this.dictionary[key];
    }).replace(/[ \t]{2,}/g, ' ').trim();
    return context.setText(next, this.id, { replacements });
  }
}

const DEFAULT_REPAIRS = Object.freeze({
  alram: 'alarm',
  alaram: 'alarm',
  assitent: 'assistant',
  assistent: 'assistant',
  calander: 'calendar',
  calender: 'calendar',
  cancle: 'cancel',
  chromee: 'chrome',
  chromme: 'chrome',
  crome: 'chrome',
  clander: 'calendar',
  clsoe: 'close',
  documants: 'documents',
  downolads: 'downloads',
  downolodes: 'downloads',
  encreption: 'encryption',
  floder: 'folder',
  inteligence: 'intelligence',
  minit: 'minute',
  minuts: 'minutes',
  opne: 'open',
  remeinder: 'reminder',
  remider: 'reminder',
  remionder: 'reminder',
  sink: 'sync',
  sinkble: 'syncable',
  snooz: 'snooze',
  stopwhatch: 'stopwatch',
  tommrow: 'tomorrow',
  transver: 'transfer',
  tansver: 'transfer',
  tansfer: 'transfer',
  whatch: 'watch'
});

class SpellRepair extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = {
      ...DEFAULT_REPAIRS,
      ...ASSISTANT_TOKEN_CORRECTIONS,
      ...TOKEN_CORRECTIONS,
      ...(options.dictionaries?.spellings || options.spellings || {})
    };
  }

  _repairRepeatedLetters(token) {
    return repairRepeatedLetters(token);
  }

  normalize(context) {
    const repairs = [];
    const next = String(context.workingText || '').replace(/\b[a-zA-Z]{2,}\b/g, token => {
      const lower = token.toLowerCase();
      const compact = this._repairRepeatedLetters(lower);
      const replacement = this.dictionary[lower] ||
        this.dictionary[compact] ||
        correctTokenWithLexicon(lower, { explicitOnly: false }) ||
        token;
      if (replacement !== token && replacement !== lower) repairs.push({ from: token, to: replacement });
      return replacement;
    });
    repairs.forEach(repair => context.addObservation('spellRepairs', repair));
    return context.setText(next, this.id, { repairs });
  }
}

class TimeNormalizer extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const expressions = [];
    const timePattern = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\b/gi;
    let match;
    while ((match = timePattern.exec(text)) !== null) {
      let hour = Number(match[1]);
      const minute = Number(match[2] || 0);
      const meridiem = match[3].toLowerCase().replace(/[^apm]/g, '');
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      expressions.push({ original: match[0], canonical: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` });
    }
    if (/\bnoon\b/i.test(text)) expressions.push({ original: 'noon', canonical: '12:00' });
    if (/\bmidnight\b/i.test(text)) expressions.push({ original: 'midnight', canonical: '00:00' });
    if (/\bmorning\b/i.test(text)) expressions.push({ original: 'morning', canonical: '09:00', approximate: true });
    if (/\bafternoon\b/i.test(text)) expressions.push({ original: 'afternoon', canonical: '14:00', approximate: true });
    if (/\bevening\b/i.test(text)) expressions.push({ original: 'evening', canonical: '18:00', approximate: true });
    if (/\btonight\b/i.test(text)) expressions.push({ original: 'tonight', canonical: '20:00', approximate: true });
    const halfPast = /\bhalf\s+past\s+(\d{1,2})\b/gi;
    while ((match = halfPast.exec(text)) !== null) {
      expressions.push({ original: match[0], canonical: `${String(Number(match[1])).padStart(2, '0')}:30` });
    }
    const oClock = /\b(\d{1,2})\s+o'?clock\b/gi;
    while ((match = oClock.exec(text)) !== null) {
      expressions.push({ original: match[0], canonical: `${String(Number(match[1])).padStart(2, '0')}:00`, approximate: true });
    }
    const quarterPast = /\bquarter\s+past\s+(\d{1,2})\b/gi;
    while ((match = quarterPast.exec(text)) !== null) {
      expressions.push({ original: match[0], canonical: `${String(Number(match[1])).padStart(2, '0')}:15` });
    }
    const quarterTo = /\bquarter\s+to\s+(\d{1,2})\b/gi;
    while ((match = quarterTo.exec(text)) !== null) {
      const hour = Number(match[1]) - 1 || 12;
      expressions.push({ original: match[0], canonical: `${String(hour).padStart(2, '0')}:45` });
    }
    expressions.forEach(expression => context.addObservation('times', expression));
    return context.setText(text, this.id, { expressionsCount: expressions.length });
  }
}

const PUNCTUATION_MAP = Object.freeze({
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201B': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u201F': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
  '\u00A0': ' '
});

const BROKEN_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

class UnicodeNormalizer extends BaseNormalizer {
  normalize(context) {
    let next = String(context.workingText || '').normalize('NFC');
    next = next.replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2013\u2014\u2212\u00A0]/g, char => PUNCTUATION_MAP[char] || char);
    const repairedSurrogates = BROKEN_SURROGATE.test(next);
    next = next.replace(BROKEN_SURROGATE, '');
    if (repairedSurrogates) context.addWarning('Invalid unicode surrogate was removed.', { normalizerId: this.id });
    return context.setText(next, this.id, { repairedSurrogates });
  }
}

const UNITS = Object.freeze({
  percent: '%',
  percentage: '%',
  degrees: 'deg',
  degree: 'deg',
  seconds: 's',
  second: 's',
  secs: 's',
  sec: 's',
  minutes: 'min',
  minute: 'min',
  mins: 'min',
  min: 'min',
  hours: 'h',
  hour: 'h',
  hrs: 'h',
  hr: 'h',
  kilobytes: 'KB',
  megabytes: 'MB',
  gigabytes: 'GB',
  meters: 'm',
  meter: 'm',
  kilometres: 'km',
  kilometers: 'km',
  inches: 'in',
  pixels: 'px'
});

class UnitNormalizer extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const rewriteText = this.options.rewriteText === true;
    let next = text;
    text.replace(/\b(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\b/g, (match, value, unit) => {
      const canonical = UNITS[unit.toLowerCase()];
      if (!canonical) return match;
      context.addObservation('units', { original: match, value: Number(value), unit, canonical });
      return `${value} ${canonical}`;
    });
    next = next.replace(/\b(\d+(?:\.\d+)?)(sec|secs|min|mins|hr|hrs|kb|mb|gb|px|%)\b/gi, (match, value, unit) => {
      const lower = unit.toLowerCase();
      const canonical = UNITS[lower] || (lower === 'kb' ? 'KB' : lower === 'mb' ? 'MB' : lower === 'gb' ? 'GB' : lower);
      context.addObservation('units', { original: match, value: Number(value), unit, canonical });
      return rewriteText ? `${value} ${canonical}` : match;
    });
    text.replace(/\b(percent|percentage|degrees?|seconds?|secs?|minutes?|mins?|hours?|hrs?|kilobytes|megabytes|gigabytes|meters?|kilometres|kilometers|inches|pixels)\b/gi, match => {
      const canonical = UNITS[match.toLowerCase()];
      if (canonical) context.addObservation('units', { original: match, unit: match, canonical });
      return match;
    });
    return context.setText(next, this.id, { rewriteText });
  }
}

class WhitespaceNormalizer extends BaseNormalizer {
  normalize(context) {
    const next = String(context.workingText || '')
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return context.setText(next, this.id, { collapsedWhitespace: next !== String(context.workingText || '') });
  }
}

module.exports = {
  BaseNormalizer,
  AbbreviationExpander,
  ContractionResolver,
  DateNormalizer,
  EmojiInterpreter,
  InputCleaner,
  LanguageSwitcher,
  NumberNormalizer,
  PunctuationNormalizer,
  RepeatedWordCleaner,
  SlangNormalizer,
  SpellRepair,
  TimeNormalizer,
  UnicodeNormalizer,
  UnitNormalizer,
  WhitespaceNormalizer
};