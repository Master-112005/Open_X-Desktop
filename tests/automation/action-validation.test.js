const assert = require('assert');

const ActionValidation = require('../../core/automation/common/action-velidation');

function intent(id, entities = []) {
  return { id, entities };
}

describe('Action Validation Contract', function() {
  it('should keep the stable required-entity contract', function() {
    const validator = new ActionValidation();
    const result = validator.validate(intent('app.open', [
      { name: 'appName', required: true }
    ]), {});

    assert.equal(result.valid, false);
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.missing, ['appName']);
    assert.equal(result.errors[0].id, 'validation.required');
    assert.equal(result.summary.missingCount, 1);
  });

  it('should validate device percent values before execution', function() {
    const validator = new ActionValidation();
    const result = validator.validate(intent('volume.set', [
      { name: 'value', required: true }
    ]), { value: 150 });

    assert.equal(result.valid, false);
    assert.equal(result.missing.length, 0);
    assert.equal(result.errors[0].id, 'validation.percentRange');
    assert.match(result.errors[0].message, /between 0 and 100/i);
  });

  it('should reject malformed browser URLs and unsupported control characters', function() {
    const validator = new ActionValidation();
    const result = validator.validate(intent('browser.open', [
      { name: 'url', required: true }
    ]), { url: 'not a url\u0000' });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.id === 'validation.controlCharacters'));
    assert.ok(result.errors.some(error => error.id === 'validation.url'));
    assert.doesNotMatch(result.errors.map(error => error.message).join(' '), /\u0000/);
  });

  it('should warn on parent-directory traversal without replacing path safety checks', function() {
    const validator = new ActionValidation();
    const result = validator.validate(intent('file.open', [
      { name: 'filename', required: true }
    ]), { filename: '..\\secret.txt' });

    assert.equal(result.valid, true);
    assert.equal(result.status, 'passed');
    assert.ok(result.warnings.some(warning => warning.id === 'validation.pathTraversal'));
  });

  it('should reject reserved Windows device names in file-like entities', function() {
    const validator = new ActionValidation();
    const result = validator.validate(intent('file.create', [
      { name: 'filename', required: true }
    ]), { filename: 'CON.txt' });

    assert.equal(result.valid, false);
    assert.equal(result.errors[0].id, 'validation.windowsReservedName');
  });

  it('should reject command characters in local calculation expressions', function() {
    const validator = new ActionValidation();
    const result = validator.validate(intent('system.calculate', [
      { name: 'expression', required: true }
    ]), { expression: '2 + 2; shutdown /s' });

    assert.equal(result.valid, false);
    assert.equal(result.errors[0].id, 'validation.calculationExpression');
  });
});
