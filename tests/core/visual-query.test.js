'use strict';

const assert = require('assert');
const {
  VisualQueryEngine,
  VisualQueryUnderstandingStage,
  VISUAL_QUERY_INTENTS,
  OUT_OF_SCOPE
} = require('../../core/assistant/capabilities/visual-memory/runtime/query');
const { PipelineManager } = require('../../core/assistant/pipeline');

describe('Visual Query Understanding', () => {
  it('converts a natural photo request into structured constraints without searching', () => {
    const engine = new VisualQueryEngine();
    const result = engine.understand({
      rawInput: 'Find the photo where I was with Rahul at the palace last November.',
      normalizedInput: 'find the photo where i was with rahul at the palace last november',
      structuredEntities: {
        people: [{ value: 'Rahul', confidence: 0.96 }],
        locations: [{ value: 'Palace', confidence: 0.93 }],
        dates: [{ value: 'last November', confidence: 0.94 }]
      },
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    assert.strictEqual(result.active, true);
    assert.strictEqual(result.intent, VISUAL_QUERY_INTENTS.FIND);
    assert.strictEqual(result.media, 'photo');
    assert.strictEqual(result.owner, 'user');
    assert(result.constraints.people.some(item => item.value === 'Rahul'));
    assert(result.constraints.locations.some(item => String(item.value).toLowerCase() === 'palace'));
    assert(result.constraints.time.some(item => String(item.value).toLowerCase() === 'last november'));
    assert(result.confidence > 0.8);
    assert.strictEqual(result.validation.valid, true);
  });

  it('understands screenshots, source apps, document types, and events as constraints only', () => {
    const engine = new VisualQueryEngine();
    const result = engine.understand({
      rawInput: 'show my WhatsApp payment screenshot from yesterday',
      normalizedInput: 'show my whatsapp payment screenshot from yesterday',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    assert.strictEqual(result.active, true);
    assert.strictEqual(result.media, 'screenshot');
    assert(result.constraints.photoTypes.some(item => item.value === 'screenshot'));
    assert(result.constraints.sourceApps.some(item => item.value === 'Whatsapp'));
    assert(result.constraints.time.some(item => item.value === 'yesterday'));
    assert.strictEqual(OUT_OF_SCOPE.includes('ocr'), true);
  });

  it('understands natural scene aliases and common misspellings as visual search constraints', () => {
    const engine = new VisualQueryEngine();
    const result = engine.understand({
      rawInput: 'find moanitains and betchs images',
      normalizedInput: 'find moanitains and betchs images',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    assert.strictEqual(result.active, true);
    assert(result.constraints.scenes.some(item => String(item.value).toLowerCase() === 'mountain'));
    assert(result.constraints.scenes.some(item => String(item.value).toLowerCase() === 'beach'));
  });

  it('understands named-person photo phrasing without falling back to gallery navigation', () => {
    const engine = new VisualQueryEngine();
    const result = engine.understand({
      rawInput: 'find a pic of jithu and vivek',
      normalizedInput: 'find a pic of jithu and vivek',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    const people = result.constraints.people.map(item => String(item.value).toLowerCase());
    assert.strictEqual(result.active, true);
    assert.strictEqual(result.intent, VISUAL_QUERY_INTENTS.FIND);
    assert(people.includes('jithu'));
    assert(people.includes('vivek'));
    assert.strictEqual(result.validation.valid, true);
  });

  it('treats visible self and family aliases as people and relationship constraints', () => {
    const engine = new VisualQueryEngine();
    const result = engine.understand({
      rawInput: 'find latest photo of me and my daddy',
      normalizedInput: 'find latest photo of me and my daddy',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    const people = result.constraints.people.map(item => String(item.value).toLowerCase());
    const relationships = result.constraints.relationships.map(item => String(item.value).toLowerCase());
    assert.strictEqual(result.active, true);
    assert(people.includes('user'));
    assert(relationships.includes('father'));
    assert(!people.includes('daddy'));
  });

  it('does not treat display phrasing as a visible self constraint', () => {
    const engine = new VisualQueryEngine();
    const result = engine.understand({
      rawInput: 'show me photos from my Goa trip',
      normalizedInput: 'show me photos from my goa trip',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    const people = result.constraints.people.map(item => String(item.value).toLowerCase());
    assert.strictEqual(result.active, true);
    assert(!people.includes('user'));
    assert.strictEqual(result.owner, 'user');
  });

  it('understands direct person-pic phrasing and does not treat scenes as people', () => {
    const engine = new VisualQueryEngine();
    const person = engine.understand({
      rawInput: 'find jithu pic',
      normalizedInput: 'find jithu pic',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });
    const scene = engine.understand({
      rawInput: 'find mountain pic',
      normalizedInput: 'find mountain pic',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    assert(person.constraints.people.some(item => String(item.value).toLowerCase() === 'jithu'));
    assert(!scene.constraints.people.some(item => String(item.value).toLowerCase() === 'mountain'));
    assert(scene.constraints.scenes.some(item => String(item.value).toLowerCase() === 'mountain'));
  });

  it('skips non-visual assistant commands', () => {
    const engine = new VisualQueryEngine();
    const result = engine.understand({
      rawInput: 'open chrome and set volume to 50',
      normalizedInput: 'open chrome and set volume to 50',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    assert.strictEqual(result.active, false);
    assert.strictEqual(result.intent, null);
  });

  it('treats plain gallery navigation as UI open, not visual memory search', () => {
    const engine = new VisualQueryEngine();
    const gallery = engine.understand({
      rawInput: 'open openx gallery',
      normalizedInput: 'open openx gallery',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });
    const photos = engine.understand({
      rawInput: 'open photos',
      normalizedInput: 'open photos',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    assert.strictEqual(gallery.active, false);
    assert.strictEqual(gallery.intent, null);
    assert.strictEqual(photos.active, false);
    assert.strictEqual(photos.intent, null);
  });

  it('reports validation issues for conflicting visual constraints', () => {
    const engine = new VisualQueryEngine();
    const result = engine.understand({
      rawInput: 'find the photo from today and yesterday where I am alone in a group photo',
      normalizedInput: 'find the photo from today and yesterday where i am alone in a group photo',
      resolvedContext: { conversationMemory: {}, confidence: 0.8 }
    });

    assert.strictEqual(result.active, true);
    assert.strictEqual(result.validation.valid, false);
    assert(result.validation.errors.some(error => error.code === 'visual-query.conflicting-time'));
    assert(result.validation.errors.some(error => error.code === 'visual-query.conflicting-person-count'));
  });

  it('integrates into the assistant pipeline between memory and reasoning', async () => {
    const manager = new PipelineManager({
      commandExecutor: null,
      logger: { debug() {}, info() {}, warn() {}, error() {} }
    });

    const stageIds = manager.builder.registry.list({ includeDisabled: true }).map(stage => stage.id);
    const memoryIndex = stageIds.indexOf('assistant.memory.context');
    const visualIndex = stageIds.indexOf('assistant.visualQuery.understanding');
    const reasoningIndex = stageIds.indexOf('assistant.goalIntent.reasoning');
    assert(memoryIndex >= 0);
    assert(visualIndex > memoryIndex);
    assert(reasoningIndex > visualIndex);

    const pipelineResult = await manager.process({
      input: 'Find the photo where I was with Rahul at the palace last November',
      source: 'chat'
    });

    const visualStage = pipelineResult.stageResults.find(stage => stage.stageId === 'assistant.visualQuery.understanding');
    assert(visualStage);
    assert.strictEqual(visualStage.skipped, false);
    assert.strictEqual(visualStage.output.active, true);
    assert.strictEqual(pipelineResult.context.shared['assistant.visualQuery.active'], true);
    assert.strictEqual(pipelineResult.context.shared['assistant.visualQuery'].active, true);

    await manager.destroy();
  });

  it('can be constructed as a standalone pipeline stage for custom builders', () => {
    const stage = new VisualQueryUnderstandingStage();
    assert.strictEqual(stage.id, 'assistant.visualQuery.understanding');
    assert.strictEqual(stage.order, -3);
  });
});
