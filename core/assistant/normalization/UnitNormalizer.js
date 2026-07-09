'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const UNITS = Object.freeze({
  percent: '%',
  percentage: '%',
  degrees: 'deg',
  degree: 'deg',
  seconds: 's',
  second: 's',
  minutes: 'min',
  minute: 'min',
  hours: 'h',
  hour: 'h',
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
    text.replace(/\b(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\b/g, (match, value, unit) => {
      const canonical = UNITS[unit.toLowerCase()];
      if (!canonical) return match;
      context.addObservation('units', { original: match, value: Number(value), unit, canonical });
      return `${value} ${canonical}`;
    });
    text.replace(/\b(percent|percentage|degrees?|seconds?|minutes?|hours?|kilobytes|megabytes|gigabytes|meters?|kilometres|kilometers|inches|pixels)\b/gi, match => {
      const canonical = UNITS[match.toLowerCase()];
      if (canonical) context.addObservation('units', { original: match, unit: match, canonical });
      return match;
    });
    return context.setText(text, this.id);
  }
}

module.exports = UnitNormalizer;
