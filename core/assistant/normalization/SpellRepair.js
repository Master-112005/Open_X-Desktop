'use strict';

const BaseNormalizer = require('./BaseNormalizer');
const { TOKEN_CORRECTIONS } = require('./CommandPreprocessor');
const {
  ASSISTANT_TOKEN_CORRECTIONS,
  correctTokenWithLexicon,
  repairRepeatedLetters
} = require('./AssistantLexicon');

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

module.exports = SpellRepair;
