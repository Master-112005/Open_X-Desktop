'use strict';

module.exports = {
  FaceMemoryEngine: require('./engine/FaceMemoryEngine'),
  FaceMemoryConfiguration: require('./configuration/FaceMemoryConfiguration'),
  FaceMemoryDiagnostics: require('./diagnostics/FaceMemoryDiagnostics'),
  FaceMemoryLifecycle: require('./lifecycle/FaceMemoryLifecycle'),
  FaceMemoryValidator: require('./validation/FaceMemoryValidator'),
  ConsentManager: require('./consent/ConsentManager'),
  FacePrivacyManager: require('./privacy/FacePrivacyManager'),
  FaceEmbeddingStore: require('./embeddings/FaceEmbeddingStore'),
  FaceGroupingEngine: require('./grouping/FaceGroupingEngine'),
  FaceMatchingEngine: require('./matching/FaceMatchingEngine'),
  FaceEnrollmentManager: require('./enrollment/FaceEnrollmentManager'),
  IdentityManager: require('./identities/IdentityManager'),
  PersonProfileManager: require('./profiles/PersonProfileManager'),
  FaceRelationshipManager: require('./relationships/FaceRelationshipManager'),
  FaceTimelineManager: require('./timelines/FaceTimelineManager'),
  FaceCollectionManager: require('./collections/FaceCollectionManager'),
  ...require('./contracts/FaceMemoryContracts'),
  ...require('./events/FaceMemoryEvents')
};
