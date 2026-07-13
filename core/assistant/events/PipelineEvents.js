'use strict';

const PipelineEvents = Object.freeze({
  PIPELINE_STARTED: 'PipelineStarted',
  PIPELINE_FINISHED: 'PipelineFinished',
  PIPELINE_CANCELLED: 'PipelineCancelled',
  PIPELINE_ERROR: 'PipelineError',
  STAGE_STARTED: 'StageStarted',
  STAGE_COMPLETED: 'StageCompleted',
  STAGE_FAILED: 'StageFailed'
});

const EVENT_GROUPS = Object.freeze({
  lifecycle: Object.freeze([
    PipelineEvents.PIPELINE_STARTED,
    PipelineEvents.PIPELINE_FINISHED,
    PipelineEvents.PIPELINE_CANCELLED,
    PipelineEvents.PIPELINE_ERROR
  ]),
  stage: Object.freeze([
    PipelineEvents.STAGE_STARTED,
    PipelineEvents.STAGE_COMPLETED,
    PipelineEvents.STAGE_FAILED
  ]),
  terminal: Object.freeze([
    PipelineEvents.PIPELINE_FINISHED,
    PipelineEvents.PIPELINE_CANCELLED,
    PipelineEvents.PIPELINE_ERROR
  ])
});

const EVENT_TO_PHASE = Object.freeze(Object.fromEntries(
  Object.entries(EVENT_GROUPS).flatMap(([phase, events]) => events.map(event => [event, phase]))
));

function values() {
  return Object.values(PipelineEvents);
}

function isPipelineEvent(type) {
  return values().includes(String(type || ''));
}

function phaseOf(type) {
  return EVENT_TO_PHASE[String(type || '')] || 'custom';
}

module.exports = Object.freeze({
  ...PipelineEvents,
  EVENT_GROUPS,
  values,
  isPipelineEvent,
  phaseOf
});
