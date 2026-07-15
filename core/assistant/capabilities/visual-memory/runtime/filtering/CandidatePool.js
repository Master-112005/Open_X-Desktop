'use strict';

const { CANDIDATE_FILTER_VERSION } = require('./CandidateContracts');

function clone(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function createCandidate(photo, metadata = {}, folder = null, albums = []) {
  const id = String(photo?.id || metadata?.photoId || metadata?.id || '');
  return {
    photoId: id,
    path: photo?.filePath || metadata?.filePath || '',
    photo: { ...(photo || {}) },
    metadata: { ...(metadata || {}) },
    folder: folder ? { ...folder } : null,
    albums: Array.isArray(albums) ? albums.map(album => ({ ...album })) : [],
    appliedFilters: [],
    rejectedBy: null,
    confidence: 0.5,
    rankingScore: 0,
    validationStatus: 'pending',
    filterHistory: []
  };
}

class CandidatePool {
  constructor({ candidates = [], visualQuery = null, diagnostics = [], version = CANDIDATE_FILTER_VERSION } = {}) {
    this.visualQuery = visualQuery;
    this.candidates = Array.isArray(candidates) ? candidates.map(candidate => clone(candidate)) : [];
    this.rejected = [];
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.version = version;
    this.createdAt = new Date().toISOString();
  }

  static fromDatabaseSnapshot(snapshot = {}, visualQuery = null) {
    const photos = snapshot.photos || {};
    const metadata = snapshot.metadata || {};
    const folders = snapshot.folders || {};
    const albums = snapshot.albums || {};
    const albumList = Object.values(albums);
    const candidates = Object.values(photos).map(photo => {
      const record = metadata[photo.id] || {};
      const folder = folders[photo.folderId || record.folderId] || null;
      const photoAlbums = albumList.filter(album => {
        const ids = Array.isArray(album.photoIds) ? album.photoIds : [];
        return ids.includes(photo.id);
      });
      return createCandidate(photo, record, folder, photoAlbums);
    });
    return new CandidatePool({ candidates, visualQuery });
  }

  size() {
    return this.candidates.length;
  }

  applyFilter(filterId, predicate, options = {}) {
    const before = this.candidates.length;
    const kept = [];
    for (const candidate of this.candidates) {
      const decision = predicate(candidate);
      const passed = typeof decision === 'object' ? decision.passed !== false : Boolean(decision);
      const confidence = typeof decision === 'object' ? decision.confidence : null;
      const reason = typeof decision === 'object' ? decision.reason : '';
      const history = {
        filterId,
        passed,
        reason: reason || (passed ? 'matched' : 'rejected'),
        confidence: Number.isFinite(confidence) ? confidence : null,
        at: new Date().toISOString()
      };
      candidate.filterHistory.push(history);
      candidate.appliedFilters.push(filterId);
      if (Number.isFinite(confidence)) {
        candidate.confidence = Math.max(0, Math.min(1, (candidate.confidence + confidence) / 2));
      }
      if (passed) {
        kept.push(candidate);
      } else {
        candidate.rejectedBy = filterId;
        this.rejected.push(candidate);
      }
    }
    this.candidates = kept;
    const after = this.candidates.length;
    const summary = {
      filterId,
      before,
      after,
      rejected: before - after,
      skipped: options.skipped === true,
      durationMs: Math.max(0, Number(options.durationMs) || 0)
    };
    this.diagnostics.push(summary);
    return summary;
  }

  addDiagnostic(record = {}) {
    this.diagnostics.push({ ...record, at: new Date().toISOString() });
    return this;
  }

  sortByScore(limit = 300) {
    this.candidates.sort((left, right) => {
      if (right.rankingScore !== left.rankingScore) return right.rankingScore - left.rankingScore;
      const leftDate = Date.parse(left.photo?.createdAt || left.metadata?.createdAt || 0) || 0;
      const rightDate = Date.parse(right.photo?.createdAt || right.metadata?.createdAt || 0) || 0;
      return rightDate - leftDate;
    });
    if (Number.isFinite(limit) && limit > 0 && this.candidates.length > limit) {
      this.rejected.push(...this.candidates.slice(limit).map(candidate => ({ ...candidate, rejectedBy: 'ranking-limit' })));
      this.candidates = this.candidates.slice(0, limit);
    }
    return this;
  }

  stats() {
    return {
      version: this.version,
      total: this.candidates.length,
      rejected: this.rejected.length,
      filters: this.diagnostics.slice(),
      averageScore: this.candidates.length
        ? this.candidates.reduce((sum, candidate) => sum + Number(candidate.rankingScore || 0), 0) / this.candidates.length
        : 0
    };
  }

  toJSON() {
    return {
      version: this.version,
      createdAt: this.createdAt,
      visualQuery: this.visualQuery,
      candidates: this.candidates,
      rejectedCount: this.rejected.length,
      diagnostics: this.diagnostics,
      stats: this.stats()
    };
  }
}

module.exports = CandidatePool;
