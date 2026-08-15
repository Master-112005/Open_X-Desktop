'use strict';

const assert = require('assert');

const {
  ACQUISITION_VERSION,
  AcquisitionSanitizer,
  AttachmentResolver,
  ChatAdapter,
  InputAdapterRegistry,
  InputDiagnostics,
  InputSourceManager,
  LanguageDetector,
  SourceNormalizer,
  SourceConfidenceCalculator,
  createDefaultInputSourceManager
} = require('../../core/assistant/acquisition');

describe('Assistant Acquisition Layer', function() {
  it('exports a versioned acquisition surface', function() {
    assert.match(ACQUISITION_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('acquires commands through aliases without changing raw text', function() {
    const manager = createDefaultInputSourceManager();
    const raw = manager.acquire('Open Chrome exactly', 'desktop', {
      metadata: { confidence: 0.88 }
    });

    assert.equal(raw.source, 'chat');
    assert.equal(raw.rawText, 'Open Chrome exactly');
    assert.equal(raw.metadata.confidence, 0.88);
  });

  it('normalizes source aliases through the shared source normalizer', function() {
    const normalizer = new SourceNormalizer();
    assert.equal(normalizer.normalize('desktop'), 'chat');
    assert.equal(normalizer.normalize('screen-text'), 'ocr');
    assert.equal(normalizer.normalize('desktop'), 'chat');
  });

  it('sanitizes and compacts acquisition data through shared helpers', function() {
    assert.equal(AcquisitionSanitizer.normalizeSourceName('Input'), 'input');
    assert.equal(AcquisitionSanitizer.clampConfidence(2), 1);
    assert.equal(AcquisitionSanitizer.sanitizeAcquisitionData({ token: 'hidden' }).token, '[redacted]');
  });

  it('redacts metadata and bounds attachments', function() {
    const resolver = new AttachmentResolver({ maxAttachments: 2 });
    const attachments = resolver.resolve([
      { id: 'a1', name: 'one.txt', metadata: { token: 'hidden', visible: 'ok' } },
      { id: 'a2', name: 'two.txt' },
      { id: 'a3', name: 'three.txt' }
    ], 'chat');

    assert.equal(attachments.length, 2);
    assert.equal(attachments[0].metadata.token, '[redacted]');
    assert.equal(attachments[0].metadata.visible, 'ok');
  });

  it('rejects oversized input at the adapter boundary', function() {
    const adapter = new ChatAdapter({ maxInputLength: 5 });
    assert.throws(() => adapter.acquire('too long'), /Input text is too long/);
  });

  it('supports registry helpers and duplicate protection', function() {
    const registry = new InputAdapterRegistry();
    const adapter = new ChatAdapter();

    registry.register(adapter);
    assert.equal(registry.get('chat'), adapter);
    assert.equal(registry.count(), 1);
    assert.throws(() => registry.register(adapter), /already registered/);
    assert.equal(registry.unregister('chat'), true);
    assert.equal(registry.clear(), 0);
  });

  it('detects broader Indic scripts and mixed-script text', function() {
    const detector = new LanguageDetector();
    const tamil = detector.detect('வணக்கம்');
    const mixed = detector.detect('open ఫైల్');

    assert.equal(tamil.language, 'ta');
    assert.equal(mixed.language, 'te');
    assert.equal(mixed.mixedScript, true);
  });

  it('adjusts confidence for encrypted, disconnected, and partial sources', function() {
    const calculator = new SourceConfidenceCalculator();
    const encrypted = calculator.calculate({ source: 'cloud', metadata: { encrypted: true } });
    const weak = calculator.calculate({ source: 'cloud', metadata: { connected: false, partial: true } });

    assert.ok(encrypted > weak);
    assert.ok(weak >= 0 && weak <= 1);
  });

  it('records sanitized diagnostics and clears resources on destroy', function() {
    const manager = new InputSourceManager({ maxDiagnostics: 1 });
    manager.register(new ChatAdapter());
    manager.acquire('hello', 'chat', { metadata: { password: 'hidden' } });
    manager.recordDiagnostic('warn', 'manual', { apiKey: 'hidden' });

    const status = manager.getStatus();
    assert.equal(status.adapterCount, 1);
    assert.equal(status.diagnostics.length, 1);
    assert.equal(status.diagnostics[0].data.apiKey, '[redacted]');

    manager.destroy();
    assert.equal(manager.getStatus().adapterCount, 0);
  });

  it('bounds standalone input diagnostics', function() {
    const diagnostics = new InputDiagnostics({ maxDiagnostics: 1 });
    diagnostics.record('info', 'one', { password: 'hidden' });
    diagnostics.record('info', 'two', { visible: 'ok' });

    assert.equal(diagnostics.list(10).length, 1);
    assert.equal(diagnostics.list(10)[0].data.visible, 'ok');
    assert.equal(diagnostics.clear(), 1);
  });
});
