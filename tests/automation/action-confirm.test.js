const assert = require('assert');
const ActionConfirmation = require('../../core/automation/common/action-confirm');

describe('Action Confirmation Summary', function() {
  it('should summarize verified reversible actions', function() {
    const confirmation = new ActionConfirmation().confirm({
      success: true,
      data: {
        operation: 'volume.set',
        value: 40,
        verification: { status: 'passed', check: 'volume-set' }
      }
    });

    assert.equal(confirmation.confirmed, true);
    assert.equal(confirmation.operation, 'volume.set');
    assert.equal(confirmation.risk, 'low');
    assert.equal(confirmation.reversible, true);
    assert.equal(confirmation.verificationStatus, 'passed');
    assert.equal(confirmation.requiresReview, false);
    assert.match(confirmation.message, /Completed and verified/);
  });

  it('should flag destructive actions for review even after success', function() {
    const confirmation = new ActionConfirmation().confirm({
      success: true,
      intent: 'file.delete',
      data: {
        filename: 'report.txt',
        verification: { status: 'passed', check: 'file-removed' }
      }
    });

    assert.equal(confirmation.risk, 'high');
    assert.equal(confirmation.reversible, false);
    assert.equal(confirmation.requiresReview, true);
    assert.equal(confirmation.target, 'report.txt');
  });

  it('should expose failed verification as requiring review', function() {
    const confirmation = new ActionConfirmation().confirm({
      success: true,
      data: {
        operation: 'app.close',
        app: 'Instagram',
        verification: { status: 'failed', check: 'app-closed' }
      }
    });

    assert.equal(confirmation.success, true);
    assert.equal(confirmation.risk, 'medium');
    assert.equal(confirmation.verificationStatus, 'failed');
    assert.equal(confirmation.requiresReview, true);
  });

  it('should sanitize control characters in targets and errors', function() {
    const confirmation = new ActionConfirmation().confirm({
      success: false,
      error: 'Could not close\u0000app',
      data: {
        operation: 'app.close',
        app: 'Chrome\u0007Window'
      }
    });

    assert.equal(confirmation.confirmed, false);
    assert.equal(confirmation.error, 'Could not close app');
    assert.equal(confirmation.target, 'Chrome Window');
    assert.equal(confirmation.requiresReview, true);
  });

  it('should reject invalid action results', function() {
    const confirmation = new ActionConfirmation().confirm(null);
    assert.equal(confirmation.success, false);
    assert.equal(confirmation.verificationStatus, 'failed');
    assert.equal(confirmation.requiresReview, true);
  });
});
