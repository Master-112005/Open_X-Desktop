'use strict';

const VISUAL_CONCEPTS = Object.freeze({
  beach: Object.freeze([
    'beach', 'beaches', 'betch', 'betchs', 'shore', 'seashore', 'sea shore',
    'coast', 'coastal', 'sand', 'sea', 'ocean', 'waves'
  ]),
  mountain: Object.freeze([
    'mountain', 'mountains', 'moanitain', 'moanitains', 'hill', 'hills',
    'hilly', 'hill station', 'hillstation', 'peak', 'peaks', 'valley',
    'cliff', 'ghat', 'trek', 'trekking'
  ]),
  forest: Object.freeze([
    'forest', 'forests', 'woods', 'jungle', 'trees', 'tree', 'greenery',
    'wildlife', 'trail'
  ]),
  nature: Object.freeze([
    'nature', 'natural', 'landscape', 'scenery', 'scenic', 'outdoor',
    'outside', 'garden', 'park', 'plants', 'plant', 'flowers', 'flower'
  ]),
  water: Object.freeze([
    'lake', 'lakes', 'river', 'rivers', 'waterfall', 'waterfalls', 'falls',
    'stream', 'pond', 'backwater', 'water'
  ]),
  sky: Object.freeze([
    'sky', 'cloud', 'clouds', 'sunset', 'sunrise', 'moon', 'stars', 'night sky'
  ]),
  snow: Object.freeze(['snow', 'snowy', 'ice', 'winter landscape']),
  city: Object.freeze(['city', 'street', 'streets', 'building', 'buildings', 'skyline', 'urban']),
  food: Object.freeze(['food', 'meal', 'lunch', 'dinner', 'breakfast', 'restaurant', 'snack']),
  vehicle: Object.freeze(['car', 'bike', 'motorcycle', 'scooter', 'vehicle', 'vehicles'])
});

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function getVisualConceptTerms() {
  return Array.from(new Set(Object.entries(VISUAL_CONCEPTS).flatMap(([concept, aliases]) => [concept, ...aliases])));
}

function findVisualConcepts(value = '') {
  const text = ` ${normalize(value)} `;
  const matches = [];
  for (const [concept, aliases] of Object.entries(VISUAL_CONCEPTS)) {
    const matchedAlias = [concept, ...aliases].find(alias => {
      const normalized = normalize(alias);
      return normalized && text.includes(` ${normalized} `);
    });
    if (matchedAlias) matches.push({ value: concept, matchedAlias });
  }
  return matches;
}

function expandVisualConceptValues(values = []) {
  const output = new Set();
  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized) continue;
    output.add(normalized);
    const concepts = findVisualConcepts(normalized);
    for (const concept of concepts) {
      output.add(concept.value);
      for (const alias of VISUAL_CONCEPTS[concept.value] || []) output.add(normalize(alias));
    }
  }
  return Array.from(output).filter(Boolean);
}

module.exports = {
  VISUAL_CONCEPTS,
  expandVisualConceptValues,
  findVisualConcepts,
  getVisualConceptTerms,
  normalizeVisualConcept: normalize
};
