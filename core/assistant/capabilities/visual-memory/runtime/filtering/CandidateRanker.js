'use strict';

const { FILTER_IDS } = require('./CandidateContracts');
const { candidateText, getConstraintValues } = require('./filter-utils');
const { expandVisualConceptValues, findVisualConcepts } = require('../utils/VisualConceptLexicon');

class CandidateRanker {
  constructor(options = {}) {
    this.id = FILTER_IDS.RANKING;
    this.limit = Number(options.limit || 300);
  }

  rank(pool, visualQuery = null) {
    for (const candidate of pool.candidates) {
      const passedFilters = candidate.filterHistory.filter(item => item.passed).length;
      const confidence = Number(candidate.confidence || 0.5);
      const metadataQuality = this._metadataQuality(candidate);
      const recentBoost = this._recentBoost(candidate);
      const semanticBoost = this._semanticBoost(candidate, visualQuery);
      candidate.rankingScore = Number((
        (passedFilters * 10) +
        (confidence * 40) +
        (metadataQuality * 30) +
        (recentBoost * 10) +
        (semanticBoost * 25)
      ).toFixed(3));
      candidate.validationStatus = 'valid';
      candidate.filterHistory.push({
        filterId: this.id,
        passed: true,
        reason: 'deterministic metadata ranking',
        confidence: Math.max(confidence, semanticBoost),
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

  _semanticBoost(candidate, visualQuery) {
    const requested = expandVisualConceptValues(getConstraintValues(visualQuery, ['scenes', 'locations', 'events']));
    if (requested.length === 0) return 0;
    const text = [
      candidateText(candidate, ['folder', 'fileName', 'filePath', 'albums']),
      ...(Array.isArray(candidate.metadata?.semanticTags) ? candidate.metadata.semanticTags : []),
      ...(Array.isArray(candidate.metadata?.visualConcepts) ? candidate.metadata.visualConcepts : []),
      ...(Array.isArray(candidate.metadata?.scenes) ? candidate.metadata.scenes.map(item => item.label || item.name || item) : []),
      ...(Array.isArray(candidate.metadata?.objects) ? candidate.metadata.objects.map(item => item.label || item.name || item) : [])
    ].filter(Boolean).join(' ');
    const candidateConcepts = findVisualConcepts(text).map(item => item.value);
    const evidence = expandVisualConceptValues([text, ...candidateConcepts]);
    return requested.some(value => evidence.includes(value)) ? 1 : 0;
  }
}

module.exports = CandidateRanker;
