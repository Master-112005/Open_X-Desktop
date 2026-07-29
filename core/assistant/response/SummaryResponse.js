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
    let text = `Status: ${status}. Completed ${completed}, failed ${failed}, skipped ${skipped}.`;
    if (completed === 0 && failed === 0 && skipped === 0) {
      text = result.success === false ? 'I could not complete that request.' : 'Done.';
    } else if (failed === 0 && skipped === 0) {
      text = `Completed ${completed} action${completed === 1 ? '' : 's'}.`;
    } else if (failed > 0 && completed > 0) {
      text = `Completed ${completed} action${completed === 1 ? '' : 's'}, but ${failed} failed.`;
    }
    this.addPart(context, 'summary', text, {
      completed,
      failed,
      skipped
    });
    return context;
  }
}

module.exports = SummaryResponse;
