'use strict';

const MemorySearchContext = require('../context/MemorySearchContext');

class MemorySearchEngine {
  constructor({ reasoningEngine, rankingEngine, validator, sessionManager, diagnostics = null } = {}) {
    this.reasoningEngine = reasoningEngine;
    this.rankingEngine = rankingEngine;
    this.validator = validator;
    this.sessionManager = sessionManager;
    this.diagnostics = diagnostics;
  }

  async search(input = {}) {
    const context = input instanceof MemorySearchContext ? input : new MemorySearchContext(input);
    const session = this.sessionManager.start(context);
    try {
      const validation = this.validator.validate(context);
      if (!validation.valid) {
        const error = new Error(validation.errors.map(item => item.message).join('; '));
        error.validation = validation;
        throw error;
      }
      const reasoning = this.reasoningEngine.reason(context);
      const results = this.rankingEngine.rank(context, reasoning);
      if (this.sessionManager.isCancelled(session.id)) {
        return {
          success: false,
          session,
          reasoning,
          validation,
          results: [],
          total: 0,
          error: 'Search was cancelled.'
        };
      }
      if (this.sessionManager.isTimedOut(session.id)) {
        const error = new Error('Memory search timed out.');
        error.code = 'memory-search.timeout';
        throw error;
      }
      const resultValidation = this.validator.validateResults(results);
      const completedSession = this.sessionManager.complete(session.id, results);
      const page = this.sessionManager.paginate(session.id, results, context.options);
      const output = {
        success: resultValidation.valid,
        session: completedSession || session,
        reasoning,
        validation: { request: validation, results: resultValidation },
        results: page.items,
        allResults: context.options.includeAllResults === true ? results : undefined,
        total: results.length,
        page: page.page,
        pageSize: page.pageSize,
        hasMore: page.hasMore,
        continuationToken: page.continuationToken,
        diagnostics: {
          candidateCount: context.getCandidates().length,
          strategyCount: reasoning.strategies.length
        }
      };
      this.diagnostics?.record?.('memory-search-completed', { sessionId: session.id, total: results.length });
      return output;
    } catch (error) {
      this.sessionManager.fail(session.id, error);
      this.diagnostics?.error?.('memory-search-failed', error);
      return {
        success: false,
        session,
        reasoning: null,
        validation: error.validation || null,
        results: [],
        total: 0,
        error: error.message
      };
    }
  }
}

module.exports = MemorySearchEngine;
