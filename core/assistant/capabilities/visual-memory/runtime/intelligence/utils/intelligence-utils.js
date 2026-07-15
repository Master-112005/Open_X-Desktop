'use strict';

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function constraintValues(visualQuery, keys = []) {
  const constraints = visualQuery?.constraints || {};
  return keys.flatMap(key => Array.isArray(constraints[key]) ? constraints[key] : [])
    .map(item => String(item.value || '').trim())
    .filter(Boolean);
}

function includesAny(text, values = []) {
  const haystack = normalize(text);
  return values.some(value => haystack.includes(normalize(value)));
}

function candidateEvidence(candidate = {}, vision = {}) {
  const photo = candidate.photo || {};
  const metadata = candidate.metadata || {};
  const folder = candidate.folder || {};
  const textParts = [
    candidate.path,
    photo.fileName,
    photo.filePath,
    metadata.fileName,
    metadata.filePath,
    metadata.sourceApp,
    metadata.photoType,
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
  return {
    text: textParts.concat(visionParts).filter(Boolean).join(' '),
    vision,
    metadata,
    photo
  };
}

function dateMs(candidate = {}) {
  return Date.parse(candidate.metadata?.createdAt || candidate.photo?.createdAt || candidate.metadata?.modifiedAt || candidate.photo?.modifiedAt || '') || 0;
}

module.exports = {
  candidateEvidence,
  constraintValues,
  dateMs,
  includesAny,
  normalize
};
