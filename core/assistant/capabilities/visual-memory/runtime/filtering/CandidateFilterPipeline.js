'use strict';

const MetadataFilter = require('./MetadataFilter');
const DateFilter = require('./DateFilter');
const FolderFilter = require('./FolderFilter');
const GPSFilter = require('./GPSFilter');
const CameraFilter = require('./CameraFilter');
const AlbumFilter = require('./AlbumFilter');
const ScreenshotFilter = require('./ScreenshotFilter');
const PersonCountFilter = require('./PersonCountFilter');
const DuplicateFilter = require('./DuplicateFilter');
const CandidateRanker = require('./CandidateRanker');
const CandidateValidator = require('./CandidateValidator');

class CandidateFilterPipeline {
  constructor(options = {}) {
    this.filters = options.filters || [
      new MetadataFilter(options),
      new DateFilter(options),
      new FolderFilter(options),
      new GPSFilter(options),
      new CameraFilter(options),
      new AlbumFilter(options),
      new ScreenshotFilter(options),
      new PersonCountFilter(options),
      new DuplicateFilter(options)
    ];
    this.ranker = options.ranker || new CandidateRanker(options.ranking || {});
    this.validator = options.validator || new CandidateValidator();
    this.logger = options.logger || null;
  }

  run(pool, visualQuery) {
    const startedAt = Date.now();
    const initialCount = pool.size();
    for (const filter of this.filters) {
      if (typeof filter.supports === 'function' && !filter.supports(visualQuery, pool)) {
        pool.addDiagnostic({ filterId: filter.id, skipped: true, reason: 'No matching constraints.' });
        continue;
      }
      const filterStartedAt = Date.now();
      try {
        const summary = filter.apply(pool, visualQuery);
        if (summary) summary.durationMs = Date.now() - filterStartedAt;
      } catch (error) {
        pool.addDiagnostic({ filterId: filter.id, error: error.message, failed: true });
        this.logger?.warn?.('Visual candidate filter failed', { filterId: filter.id, error: error.message });
      }
    }

    this.ranker.rank(pool, visualQuery);
    const validation = this.validator.validatePool(pool);
    pool.addDiagnostic({
      filterId: 'pipeline',
      initialCount,
      finalCount: pool.size(),
      rejected: pool.rejected.length,
      durationMs: Date.now() - startedAt,
      validation
    });
    pool.validation = validation;
    return pool;
  }
}

module.exports = CandidateFilterPipeline;
