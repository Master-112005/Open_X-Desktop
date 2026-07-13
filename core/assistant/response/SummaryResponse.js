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
    const status = result.executionStatus || 'UNKNOWN';
    this.addPart(context, 'summary', `Status: ${status}. Completed ${completed}, failed ${failed}, skipped ${skipped}.`, {
      completed,
      failed,
      skipped
    });
    return context;
  }
}

module.exports = SummaryResponse;
