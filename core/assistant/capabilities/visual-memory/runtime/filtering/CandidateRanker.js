'use strict';

const { FILTER_IDS } = require('./CandidateContracts');

class CandidateRanker {
  constructor(options = {}) {
    this.id = FILTER_IDS.RANKING;
    this.limit = Number(options.limit || 300);
  }

  rank(pool) {
    for (const candidate of pool.candidates) {
      const passedFilters = candidate.filterHistory.filter(item => item.passed).length;
      const confidence = Number(candidate.confidence || 0.5);
      const metadataQuality = this._metadataQuality(candidate);
      const recentBoost = this._recentBoost(candidate);
      candidate.rankingScore = Number((
        (passedFilters * 10) +
        (confidence * 40) +
        (metadataQuality * 30) +
        (recentBoost * 10)
      ).toFixed(3));
      candidate.validationStatus = 'valid';
      candidate.filterHistory.push({
        filterId: this.id,
        passed: true,
        reason: 'deterministic metadata ranking',
        confidence,
        at: new Date().toISOString()
      });
    }
    pool.sortByScore(this.limit);
    pool.addDiagnostic({
      filterId: this.id,
      before: pool.candidates.length,
      after: pool.candidates.length,
      rejected: 0,
      averageScore: pool.stats().averageScore
    });
    return pool;
  }

  _metadataQuality(candidate) {
    const keys = ['createdAt', 'modifiedAt', 'fileType', 'fileSize', 'width', 'height', 'folderId'];
    const present = keys.filter(key => candidate.metadata?.[key] || candidate.photo?.[key]).length;
    return present / keys.length;
  }

  _recentBoost(candidate) {
    const value = Date.parse(candidate.metadata?.createdAt || candidate.photo?.createdAt || candidate.metadata?.modifiedAt || '');
    if (!value) return 0;
    const ageDays = Math.max(0, (Date.now() - value) / (24 * 60 * 60 * 1000));
    return Math.max(0, 1 - Math.min(1, ageDays / 3650));
  }
}

module.exports = CandidateRanker;
