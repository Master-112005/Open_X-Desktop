'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');
const { candidateText, containsAny, getConstraintValues } = require('./filter-utils');

class FolderFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.FOLDER });
  }

  supports(visualQuery) {
    return getConstraintValues(visualQuery, ['scenes', 'events', 'sourceApps', 'photoTypes']).length > 0;
  }

  apply(pool, visualQuery) {
    const values = getConstraintValues(visualQuery, ['scenes', 'events', 'sourceApps', 'photoTypes']);
    if (values.length === 0) return null;
    return pool.applyFilter(this.id, candidate => {
      const text = candidateText(candidate, ['folder', 'fileName', 'albums', 'filePath']);
      const matched = containsAny(text, values);
      return { passed: matched || !candidate.folder, confidence: matched ? 0.78 : 0.36, reason: matched ? 'folder/path matched constraints' : 'folder did not match, metadata may still match later' };
    });
  }
}

module.exports = FolderFilter;
