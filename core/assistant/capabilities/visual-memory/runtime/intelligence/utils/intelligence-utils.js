'use strict';

const {
  personValuesMatch,
  relationshipValuesMatch,
  textMentionsPerson,
  textMentionsRelationship
} = require('../../../../../entities/PersonLexicon');
const { findVisualConcepts } = require('../../utils/VisualConceptLexicon');

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function constraintValues(visualQuery, keys = []) {
  const constraints = visualQuery?.constraints || {};
  return keys.flatMap(key => Array.isArray(constraints[key]) ? constraints[key] : [])
    .map(item => String(item.value || '').trim())
    .filter(Boolean);
}

function constraintItems(visualQuery, keys = []) {
  const constraints = visualQuery?.constraints || {};
  return keys.flatMap(key => Array.isArray(constraints[key]) ? constraints[key] : []);
}

function includesAny(text, values = []) {
  const haystack = normalize(text);
  return values.some(value => haystack.includes(normalize(value)));
}

function normalizeList(values = []) {
  return values.map(value => normalize(value)).filter(Boolean);
}

function countExactMatches(values = [], requested = []) {
  const available = new Set(normalizeList(values));
  return normalizeList(requested).filter(value => available.has(value)).length;
}

function countPersonMatches(values = [], requested = []) {
  return normalizeList(requested).filter(request => values.some(value => personValuesMatch(value, request))).length;
}

function countRelationshipMatches(values = [], requested = []) {
  return normalizeList(requested).filter(request => values.some(value => relationshipValuesMatch(value, request))).length;
}

function includesPersonMention(text, requested = []) {
  return normalizeList(requested).some(value => textMentionsPerson(text, value));
}

function includesRelationshipMention(text, requested = []) {
  return normalizeList(requested).some(value => textMentionsRelationship(text, value));
}

function candidateEvidence(candidate = {}, vision = {}) {
  const photo = candidate.photo || {};
  const metadata = candidate.metadata || {};
  const folder = candidate.folder || {};
  const faceMemory = {
    ...(candidate.faceMemory || {}),
    search: candidate.faceMemorySearch || candidate.faceMemory?.search || null
  };
  const peopleNames = [
    ...(Array.isArray(metadata.peopleNames) ? metadata.peopleNames : []),
    ...(Array.isArray(faceMemory.peopleNames) ? faceMemory.peopleNames : [])
  ].filter(Boolean);
  const relationships = [
    ...(Array.isArray(metadata.faceRelationships) ? metadata.faceRelationships : []),
    ...(Array.isArray(faceMemory.relationships) ? faceMemory.relationships : [])
  ].filter(Boolean);
  const textParts = [
    candidate.path,
    photo.fileName,
    photo.filePath,
    metadata.fileName,
    metadata.filePath,
    metadata.sourceApp,
    metadata.photoType,
    ...peopleNames,
    ...relationships,
    ...(Array.isArray(metadata.semanticTags) ? metadata.semanticTags : []),
    ...(Array.isArray(metadata.visualConcepts) ? metadata.visualConcepts : []),
    ...(Array.isArray(metadata.tags) ? metadata.tags : []),
    ...(Array.isArray(metadata.labels) ? metadata.labels : []),
    ...(Array.isArray(metadata.objects) ? metadata.objects.map(item => item.label || item.name || item) : []),
    ...(Array.isArray(metadata.scenes) ? metadata.scenes.map(item => item.label || item.name || item) : []),
    ...((Number(faceMemory.faceCount) || 0) > 0 ? ['face', 'faces', 'person', 'people'] : []),
    ...((Number(faceMemory.unknownFaceCount) || 0) > 0 ? ['unknown face', 'unnamed person', 'unidentified person'] : []),
    folder.label,
    folder.path,
    ...(candidate.albums || []).flatMap(album => [album.title, album.name, album.path])
  ];
  const visionParts = [
    ...(vision.objects || []).map(item => item.label || item.name),
    ...(vision.scenes || []).map(item => item.label || item.name),
    ...(vision.ocr || []).map(item => item.text),
    ...(vision.faces || []).map(() => 'person')
  ];
  const conceptParts = findVisualConcepts(textParts.concat(visionParts).filter(Boolean).join(' '))
    .map(item => item.value);
  return {
    text: textParts.concat(visionParts, conceptParts).filter(Boolean).join(' '),
    vision,
    metadata,
    photo,
    faceMemory,
    peopleNames,
    relationships,
    faceCount: Number(faceMemory.faceCount || metadata.personCount || 0) || 0,
    namedFaceCount: Number(faceMemory.namedFaceCount || 0) || 0,
    unknownFaceCount: Number(faceMemory.unknownFaceCount || 0) || 0
  };
}

function dateMs(candidate = {}) {
  return Date.parse(candidate.metadata?.createdAt || candidate.photo?.createdAt || candidate.metadata?.modifiedAt || candidate.photo?.modifiedAt || '') || 0;
}

module.exports = {
  candidateEvidence,
  constraintItems,
  constraintValues,
  countExactMatches,
  countPersonMatches,
  countRelationshipMatches,
  dateMs,
  includesPersonMention,
  includesRelationshipMention,
  includesAny,
  normalize,
  normalizeList
};
