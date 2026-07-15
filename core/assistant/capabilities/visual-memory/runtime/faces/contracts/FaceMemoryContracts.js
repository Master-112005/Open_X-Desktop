'use strict';

const FACE_MEMORY_VERSION = '6.0.0';

const FACE_MEMORY_STATES = Object.freeze({
  CREATED: 'created',
  READY: 'ready',
  PAUSED: 'paused',
  SHUTDOWN: 'shutdown',
  ERROR: 'error'
});

const CONSENT_STATES = Object.freeze({
  UNKNOWN: 'unknown',
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  REVOKED: 'revoked'
});

const FACE_MEMORY_OUT_OF_SCOPE = Object.freeze([
  'new-nlp',
  'face-detection',
  'face-embedding-generation',
  'automatic-naming',
  'identity-prediction',
  'emotion-recognition',
  'age-estimation',
  'gender-classification',
  'surveillance',
  'biometric-authentication',
  'access-control',
  'cloud-sync'
]);

const FaceMemoryContract = Object.freeze({
  disabledByDefault: true,
  localOnlyByDefault: true,
  identityCreation: 'explicit-user-confirmation-only',
  consumes: Object.freeze(['aiVision.faces', 'aiVision.faceEmbeddings', 'assistant.people', 'assistant.relationships']),
  forbidden: FACE_MEMORY_OUT_OF_SCOPE
});

const EnrollmentContract = Object.freeze({
  allowedActions: Object.freeze(['name-person', 'ignore', 'never-ask-again', 'delete-face-data', 'later']),
  automaticIdentityCreation: false
});

const IdentityContract = Object.freeze({
  lifecycle: Object.freeze(['create', 'update', 'merge', 'split', 'delete']),
  requiredUserAction: Object.freeze(['create', 'merge', 'split', 'delete'])
});

const MatchingContract = Object.freeze({
  input: Object.freeze(['embedding']),
  output: Object.freeze(['identityId', 'profileId', 'confidence', 'ambiguous']),
  noModelExecution: true
});

const GroupingContract = Object.freeze({
  input: Object.freeze(['embedding', 'photoId', 'faceId']),
  output: Object.freeze(['clusterId', 'confidence', 'photoCount']),
  noIdentityAssignment: true
});

const ConsentContract = Object.freeze({
  controls: Object.freeze(['enable', 'disable', 'export', 'delete-data', 'delete-embeddings', 'delete-identities', 'reset', 'review']),
  requiredBeforeEnrollment: true
});

const PrivacyContract = Object.freeze({
  localOnly: true,
  cloudSyncDefault: false,
  controls: Object.freeze(['disable-matching', 'disable-grouping', 'disable-enrollment', 'disable-suggestions', 'delete-everything'])
});

module.exports = Object.freeze({
  FACE_MEMORY_VERSION,
  FACE_MEMORY_STATES,
  CONSENT_STATES,
  FACE_MEMORY_OUT_OF_SCOPE,
  FaceMemoryContract,
  EnrollmentContract,
  IdentityContract,
  MatchingContract,
  GroupingContract,
  ConsentContract,
  PrivacyContract,
  ProfileContract: Object.freeze({ fields: Object.freeze(['name', 'relationship', 'embeddingCount', 'photoCount', 'firstSeenAt', 'lastSeenAt', 'confidence', 'notes']) }),
  RelationshipContract: Object.freeze({ source: 'assistant-relationships', noDuplication: true }),
  TimelineContract: Object.freeze({ tracks: Object.freeze(['firstSeenAt', 'lastSeenAt', 'frequency', 'photoCount']) }),
  ConfigurationContract: Object.freeze({ sections: Object.freeze(['enabled', 'thresholds', 'privacy', 'enrollment', 'performance']) }),
  DiagnosticsContract: Object.freeze({ tracks: Object.freeze(['enrollment', 'grouping', 'matching', 'identity-create', 'merge', 'split', 'delete', 'confidence', 'errors', 'statistics']) })
});
