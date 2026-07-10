const assert = require('assert');

const ContextManager = require('../../core/assistant/context/ContextManager');
const ReasoningDiagnostics = require('../../core/assistant/reasoning/ReasoningDiagnostics');

describe('Performance Memory Guards', function() {
  it('should store compact command history instead of full result payloads', function() {
    const context = new ContextManager({ logging: { console: false, file: false } });
    const largeResults = Array.from({ length: 20 }, (_, index) => ({
      name: `File ${index}`,
      path: `C:\\Temp\\File-${index}.txt`,
      contents: 'x'.repeat(1000)
    }));

    context.record('find report', { query: 'report' }, {
      success: true,
      intent: 'file.search',
      entities: { query: 'report' },
      data: {
        query: 'report',
        results: largeResults,
        validation: { status: 'passed', check: 'search' },
        hugePayload: 'y'.repeat(5000)
      },
      languageUnderstanding: { status: 'passed', intent: 'file.search', tokens: largeResults },
      verification: { status: 'passed', check: 'file-exists', evidence: largeResults }
    });

    const entry = context.getHistory(1)[0];
    assert.equal(entry.data.results.length, 3);
    assert.equal(entry.data.hugePayload, undefined);
    assert.deepEqual(entry.languageUnderstanding, { status: 'passed', intent: 'file.search' });
    assert.deepEqual(entry.verification, { status: 'passed', check: 'file-exists' });
  });

  it('should bound diagnostic warning and error arrays', function() {
    const diagnostics = new ReasoningDiagnostics();
    for (let index = 0; index < 150; index += 1) {
      diagnostics.warn(`warn-${index}`);
      diagnostics.error(new Error(`error-${index}`));
    }

    const snapshot = diagnostics.toJSON();
    assert.equal(snapshot.warnings.length, 100);
    assert.equal(snapshot.errors.length, 100);
    assert.equal(snapshot.warnings[0].message, 'warn-50');
    assert.equal(snapshot.errors[0].message, 'error-50');
  });
});
