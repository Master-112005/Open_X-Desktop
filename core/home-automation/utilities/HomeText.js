const Normalizer = require('../../assistant/Data').Normalizer;

function normalizeHomeText(value) {
  return Normalizer.normalizeText(String(value || ''))
    .replace(/\b(?:lite|ligt|ligh)\b/g, 'light')
    .replace(/\b(?:ligths|lites)\b/g, 'lights')
    .replace(/\b(?:bed room)\b/g, 'bedroom')
    .replace(/\b(?:aircon|air conditioner|a c)\b/g, 'ac')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalId(value) {
  return normalizeHomeText(value)
    .replace(/\b(?:the|a|an|my|please|kindly|now)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

function displayNameFromTarget(value) {
  const text = normalizeHomeText(value).replace(/_/g, ' ');
  if (!text) return '';
  return text.replace(/\b\w/g, letter => letter.toUpperCase());
}

module.exports = {
  canonicalId,
  displayNameFromTarget,
  normalizeHomeText
};
