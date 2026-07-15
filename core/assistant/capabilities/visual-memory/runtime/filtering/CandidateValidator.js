'use strict';

class CandidateValidator {
  validatePool(pool) {
    const warnings = [];
    const errors = [];
    const seen = new Set();
    for (const candidate of pool.candidates) {
      if (!candidate.photoId) errors.push({ code: 'candidate.missing-id', message: 'Candidate is missing a photo id.' });
      if (!candidate.path) warnings.push({ code: 'candidate.missing-path', message: `Candidate ${candidate.photoId || 'unknown'} has no path.` });
      if (seen.has(candidate.photoId)) warnings.push({ code: 'candidate.duplicate-id', message: `Duplicate candidate id ${candidate.photoId}.` });
      seen.add(candidate.photoId);
      if (!Number.isFinite(candidate.rankingScore)) errors.push({ code: 'candidate.invalid-score', message: `Candidate ${candidate.photoId} has an invalid ranking score.` });
    }
    if (pool.candidates.length === 0) warnings.push({ code: 'candidate.empty-pool', message: 'No candidates remain after filtering.' });
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      candidateCount: pool.candidates.length,
      rejectedCount: pool.rejected.length
    };
  }
}

module.exports = CandidateValidator;
