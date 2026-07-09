'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class SummaryResponse extends BaseResponseGenerator {
  generate(context) {
    const result = context.verificationResult || {};
    if (context.parts.length > 0) return context;
    const completed = result.successfulActions?.length || 0;
    const failed = result.failedActions?.length || 0;
    const skipped = result.skippedActions?.length || 0;
    context.responseType = 'summary';
    context.addPart('summary', `Status: ${result.executionStatus}. Completed ${completed}, failed ${failed}, skipped ${skipped}.`);
    return context;
  }
}

module.exports = SummaryResponse;
