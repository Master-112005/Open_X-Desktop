'use strict';

const CandidatePool = require('./CandidatePool');
const CandidateFilterPipeline = require('./CandidateFilterPipeline');
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

class CandidateFilterEngine {
  constructor(options = {}) {
    this.pipeline = options.pipeline || new CandidateFilterPipeline(options);
    this.logger = options.logger || null;
  }

  buildCandidatePool({ visualQuery, databaseSnapshot, options = {} } = {}) {
    const startedAt = Date.now();
    const safeSnapshot = databaseSnapshot || {};
    const pool = CandidatePool.fromDatabaseSnapshot(safeSnapshot, visualQuery || null);
    if (!visualQuery?.active) {
      pool.addDiagnostic({
        filterId: 'engine',
        skipped: true,
        reason: 'No active visual query.',
        durationMs: Date.now() - startedAt
      });
      return pool;
    }
    const result = this._pipelineFor(options).run(pool, visualQuery);
    this.logger?.debug?.('Visual candidate pool built', result.stats());
    return result;
  }

  getCandidateStatistics(pool) {
    return pool?.stats?.() || { total: 0, rejected: 0, filters: [] };
  }

  _pipelineFor(options = {}) {
    if (!options.only && !options.rankOnly) return this.pipeline;
    if (options.rankOnly) {
      return new CandidateFilterPipeline({
        filters: [],
        ranker: new CandidateRanker(options.ranking || {}),
        logger: this.logger
      });
    }
    const map = {
      metadata: MetadataFilter,
      date: DateFilter,
      folder: FolderFilter,
      gps: GPSFilter,
      camera: CameraFilter,
      album: AlbumFilter,
      screenshot: ScreenshotFilter,
      'person-count': PersonCountFilter,
      duplicate: DuplicateFilter
    };
    const FilterClass = map[String(options.only || '').toLowerCase()];
    return new CandidateFilterPipeline({
      filters: FilterClass ? [new FilterClass(options)] : [],
      logger: this.logger
    });
  }
}

module.exports = CandidateFilterEngine;
