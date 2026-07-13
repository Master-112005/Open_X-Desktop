const assert = require('assert');

function blueprint(input = {}) {
  return {
    tasks: [{
      id: 'open.application',
      label: 'open application',
      action: 'OPEN_APPLICATION',
      metadata: { entities: { appName: 'chrome' } }
    }],
    workflow: { id: 'workflow.application', type: 'application', tasks: ['open.application'] },
    dependencies: [],
    ordering: [{ taskId: 'open.application', index: 0 }],
    metadata: {},
    ...input
  };
}

describe('Assistant Validation Layer', function() {
  it('validates a normal executable command with default chat source', async function() {
    const { createDefaultValidationManager, ValidationResult } = require('../../core/assistant/validation');
    const result = await createDefaultValidationManager().validate(blueprint(), {
      status: 'EXECUTE',
      confirmationRequired: []
    });

    assert.ok(result instanceof ValidationResult);
    assert.equal(result.valid, true);
    assert.equal(result.summary.taskCount, 1);
    assert.equal(result.summary.actionCounts.OPEN_APPLICATION, 1);
  });

  it('rejects missing required entities and source permission denial', async function() {
    const { createDefaultValidationManager } = require('../../core/assistant/validation');
    const manager = createDefaultValidationManager({
      configuration: { permissions: { phone: false } }
    });
    const result = await manager.validate(blueprint({
      tasks: [{ id: 'open.application', label: 'open application', action: 'OPEN_APPLICATION', metadata: {} }]
    }), { status: 'EXECUTE', confirmationRequired: [] }, {
      metadata: { source: 'phone' }
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.id === 'validation.permission'));
    assert.ok(result.errors.some(error => error.id === 'validation.entity'));
  });

  it('checks duplicate task ids, bad ordering, and dependency cycles', async function() {
    const { createDefaultValidationManager } = require('../../core/assistant/validation');
    const result = await createDefaultValidationManager().validate(blueprint({
      tasks: [
        { id: 'a', label: 'a', action: 'OPEN_APPLICATION', metadata: { entities: { appName: 'chrome' } } },
        { id: 'a', label: 'b', action: 'OPEN_APPLICATION', metadata: { entities: { appName: 'edge' } } }
      ],
      dependencies: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
      ordering: [{ taskId: 'missing', index: 0 }]
    }), { status: 'EXECUTE', confirmationRequired: [] });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.message === 'task ids are unique'));
    assert.ok(result.errors.some(error => error.message === 'ordering task exists'));
    assert.ok(result.errors.some(error => error.message === 'dependency graph has cycle'));
  });

  it('supports registry lifecycle helpers and configuration serialization', function() {
    const {
      BaseValidator,
      ValidationConfiguration,
      ValidationRegistry,
      VALIDATION_VERSION
    } = require('../../core/assistant/validation');
    const registry = new ValidationRegistry();
    const validator = new BaseValidator({ id: 'validation.custom' });
    const configuration = new ValidationConfiguration({
      allowedActions: ['OPEN_APPLICATION'],
      deniedActions: ['DELETE_FILE']
    });

    registry.register(validator);
    assert.equal(VALIDATION_VERSION, '10.1.0');
    assert.equal(registry.get('validation.custom'), validator);
    assert.equal(registry.count(), 1);
    assert.equal(registry.unregister('validation.custom'), true);
    assert.equal(registry.clear(), 0);
    assert.deepEqual(configuration.toJSON().allowedActions, ['OPEN_APPLICATION']);
    assert.deepEqual(configuration.toJSON().deniedActions, ['DELETE_FILE']);
  });
});
