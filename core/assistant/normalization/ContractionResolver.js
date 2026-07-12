'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const DEFAULT_CONTRACTIONS = Object.freeze({
  "aren't": 'are not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "didn't": 'did not',
  "doesn't": 'does not',
  "don't": 'do not',
  "hadn't": 'had not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "i'm": 'I am',
  "i've": 'I have',
  "isn't": 'is not',
  "it's": 'it is',
  "shouldn't": 'should not',
  "that's": 'that is',
  "there's": 'there is',
  "wasn't": 'was not',
  "we're": 'we are',
  "won't": 'will not',
  "wouldn't": 'would not',
  "you're": 'you are'
});

class ContractionResolver extends BaseNormalizer {
  constructor(options = {}) {
    super(options);
    this.dictionary = { ...DEFAULT_CONTRACTIONS, ...(options.dictionaries?.contractions || options.contractions || {}) };
  }

  normalize(context) {
    const next = String(context.workingText || '').replace(/\b[\w']+\b/g, token => {
      const replacement = this.dictionary[token.toLowerCase()];
      return replacement || token;
    });
    return context.setText(next, this.id);
  }
}

module.exports = ContractionResolver;
