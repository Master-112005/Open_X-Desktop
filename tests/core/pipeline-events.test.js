const assert = require('assert');

describe('Pipeline Events', function() {
  it('dispatches immutable events with history and wildcard subscribers', function() {
    const { PipelineEventDispatcher, PipelineEvents } = require('../../core/assistant/events');
    const dispatcher = new PipelineEventDispatcher({ historyLimit: 2 });
    const received = [];
    const wildcard = [];

    const unsubscribe = dispatcher.subscribe(PipelineEvents.PIPELINE_STARTED, event => received.push(event));
    dispatcher.subscribe('*', event => wildcard.push(event.type));

    const event = dispatcher.dispatch(PipelineEvents.PIPELINE_STARTED, { requestId: 'req-1' });
    dispatcher.dispatch(PipelineEvents.STAGE_STARTED, { requestId: 'req-1', stageId: 'stage-a' });
    dispatcher.dispatch(PipelineEvents.STAGE_COMPLETED, { requestId: 'req-1', stageId: 'stage-a' });
    unsubscribe();

    assert.equal(event.type, PipelineEvents.PIPELINE_STARTED);
    assert.equal(event.known, true);
    assert.equal(event.phase, 'lifecycle');
    assert.equal(Object.isFrozen(event), true);
    assert.equal(Object.isFrozen(event.payload), true);
    assert.equal(received.length, 1);
    assert.deepEqual(wildcard, [
      PipelineEvents.PIPELINE_STARTED,
      PipelineEvents.STAGE_STARTED,
      PipelineEvents.STAGE_COMPLETED
    ]);
    assert.deepEqual(
      dispatcher.getRecentEvents(5).map(item => item.type),
      [PipelineEvents.STAGE_STARTED, PipelineEvents.STAGE_COMPLETED]
    );
  });

  it('serializes errors and keeps listener failures from breaking dispatch', function() {
    const { PipelineEventDispatcher, PipelineEvents } = require('../../core/assistant/events');
    const dispatcher = new PipelineEventDispatcher();
    let delivered = false;

    dispatcher.subscribe(PipelineEvents.PIPELINE_ERROR, () => {
      throw new Error('listener failed');
    });
    dispatcher.subscribe(PipelineEvents.PIPELINE_ERROR, event => {
      delivered = event.payload.error.message === 'pipeline failed';
    });

    const event = dispatcher.dispatch(PipelineEvents.PIPELINE_ERROR, {
      error: new Error('pipeline failed')
    });

    assert.equal(delivered, true);
    assert.equal(event.payload.error.message, 'pipeline failed');
    assert.equal(dispatcher.getHandlerErrors().length, 1);
    assert.equal(dispatcher.getHandlerErrors()[0].error.message, 'listener failed');
  });

  it('exports event validation helpers', function() {
    const { PipelineEvents, createPipelineEventDispatcher, isPipelineEvent } = require('../../core/assistant/events');
    const dispatcher = createPipelineEventDispatcher();

    assert.equal(isPipelineEvent(PipelineEvents.STAGE_FAILED), true);
    assert.equal(PipelineEvents.isPipelineEvent('NotReal'), false);
    assert.ok(PipelineEvents.values().includes(PipelineEvents.PIPELINE_FINISHED));
    assert.equal(typeof dispatcher.dispatch, 'function');
  });
});
