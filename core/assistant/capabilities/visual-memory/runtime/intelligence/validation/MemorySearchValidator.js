'use strict';

class MemorySearchValidator {
  validate(context) {
    const errors = [];
    const warnings = [];
    if (!context.visualQuery?.active) errors.push({ code: 'memory-search.visual-query-missing', message: 'Active VisualQuery is required.' });
    if (!context.candidatePool) warnings.push({ code: 'memory-search.candidates-missing', message: 'CandidatePool is missing; search will return no memories.' });
    if (context.getCandidates().length === 0) warnings.push({ code: 'memory-search.empty-candidates', message: 'No candidates are available for memory intelligence.' });
    return { valid: errors.length === 0, errors, warnings };
  }

  validateResults(results = []) {
    const errors = [];
    for (const result of results) {
      if (!result.id) errors.push({ code: 'memory-result.missing-id', message: 'Memory result is missing an id.' });
      if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) {
        errors.push({ code: 'memory-result.invalid-confidence', message: `Memory result ${result.id || ''} has invalid confidence.` });
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

module.exports = MemorySearchValidator;
