'use strict';

module.exports = {
  CandidateFilterEngine: require('./CandidateFilterEngine'),
  CandidateFilterPipeline: require('./CandidateFilterPipeline'),
  CandidatePool: require('./CandidatePool'),
  CandidateRanker: require('./CandidateRanker'),
  MetadataFilter: require('./MetadataFilter'),
  DateFilter: require('./DateFilter'),
  FolderFilter: require('./FolderFilter'),
  GPSFilter: require('./GPSFilter'),
  CameraFilter: require('./CameraFilter'),
  AlbumFilter: require('./AlbumFilter'),
  PersonCountFilter: require('./PersonCountFilter'),
  ScreenshotFilter: require('./ScreenshotFilter'),
  DuplicateFilter: require('./DuplicateFilter'),
  CandidateValidator: require('./CandidateValidator'),
  CandidateFilteringStage: require('./CandidateFilteringStage'),
  contracts: require('./CandidateContracts'),
  ...require('./CandidateContracts')
};
