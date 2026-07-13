'use strict';

const events = Object.freeze([
    'PipelineStarted',
    'PipelineFinished',
    'StageStarted',
    'StageCompleted',
    'StageFailed',
    'PipelineCancelled',
    'PipelineError'
  ]);

function validate(eventName) {
  const event = String(eventName || '');
  return Object.freeze({
    valid: events.includes(event),
    event,
    events
  });
}

module.exports = Object.freeze({
  name: 'PipelineEventsContract',
  version: '1.1.0',
  events,
  hasEvent: event => events.includes(String(event || '')),
  validate
});
