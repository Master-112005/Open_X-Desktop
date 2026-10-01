const assert = require('assert');

describe('Text Repair (NLP + LLM write repair)', function() {
  let TextRepair;

  before(function() {
    TextRepair = require('../../core/automation/common/text-repair');
  });

  describe('needsRepair', function() {
    it('should flag a missing space after punctuation', function() {
      const r = new TextRepair();
      assert.strictEqual(r.needsRepair('hello,world'), true);
    });

    it('should flag a run-on alphabetic sequence at least 9 chars', function() {
      const r = new TextRepair();
      assert.strictEqual(r.needsRepair('helloworld'), true);
      assert.strictEqual(r.needsRepair('howareyou'), true);
    });

    it('should not flag multiline content', function() {
      const r = new TextRepair();
      assert.strictEqual(r.needsRepair('hello world\nsecond line'), false);
    });

    it('should not flag short single words', function() {
      const r = new TextRepair();
      assert.strictEqual(r.needsRepair('Rakesh'), false);
      assert.strictEqual(r.needsRepair('hello world'), false);
    });
  });

  describe('repair - punctuation', function() {
    it('should add a space after a comma', async function() {
      const r = new TextRepair();
      const result = await r.repair('hello,world');
      assert.strictEqual(result.changed, true);
      assert.strictEqual(result.method, 'punctuation');
      assert.strictEqual(result.text, 'hello, world');
    });
  });

  describe('repair - NLP segmentation', function() {
    it('should split a run-on phrase into words', async function() {
      const r = new TextRepair();
      const result = await r.repair('helloworld');
      assert.strictEqual(result.changed, true);
      assert.strictEqual(result.method, 'nlp');
      assert.strictEqual(result.text, 'hello world');
    });

    it('should split a longer known phrase', async function() {
      const r = new TextRepair();
      const result = await r.repair('howareyoutoday');
      assert.strictEqual(result.changed, true);
      assert.strictEqual(result.method, 'nlp');
      assert.strictEqual(result.text, 'how are you today');
    });

    it('should use the LLM when the segmentation is uncertain', async function() {
      let called = false;
      const r = new TextRepair({
        llm: async (text) => {
          called = true;
          assert.strictEqual(text, 'rakeshishere');
          return 'rakesh is here';
        }
      });
      const result = await r.repair('rakeshishere');
      assert.strictEqual(called, true);
      assert.strictEqual(result.method, 'llm');
      assert.strictEqual(result.text, 'rakesh is here');
    });

    it('should fall back to unchanged when the LLM is unavailable', async function() {
      const r = new TextRepair({ llm: null });
      const result = await r.repair('rakeshishere');
      assert.strictEqual(result.changed, false);
      assert.strictEqual(result.method, 'unchanged');
      assert.strictEqual(result.text, 'rakeshishere');
    });

    it('should keep a known single word as-is', async function() {
      const r = new TextRepair();
      const result = await r.repair('memorandum');
      assert.strictEqual(result.changed, false);
    });
  });

  describe('repair - plural handling', function() {
    it('should split a phrase containing an unknown plural via base form', async function() {
      const r = new TextRepair();
      const result = await r.repair('randomwords');
      assert.strictEqual(result.changed, true);
      assert.strictEqual(result.method, 'nlp');
      assert.strictEqual(result.text, 'random words');
    });
  });

  describe('repair - LLM output sanity', function() {
    it('should reject an LLM reply that does not resemble the input', async function() {
      const r = new TextRepair({
        llm: async () => 'unrelated gibberish output'
      });
      const result = await r.repair('rakeshishere');
      assert.strictEqual(result.changed, false);
      assert.strictEqual(result.method, 'unchanged');
    });

    it('should strip a "Corrected:" style prefix from the LLM reply', async function() {
      const r = new TextRepair({
        llm: async () => 'Corrected: rakesh is here'
      });
      const result = await r.repair('rakeshishere');
      assert.strictEqual(result.method, 'llm');
      assert.strictEqual(result.text, 'rakesh is here');
    });
  });

  describe('TextController wiring', function() {
    it('should use the repaired text when writing to a window', async function() {
      const AutomationEngine = require('../../core/automation/index');
      const written = [];
      const engine = new AutomationEngine({}, {
        llm: null
      });
      const windowsStub = {
        listWindows: () => [],
        findWindow: () => [],
        pasteText: (windowName, content) => {
          written.push({ windowName, content });
          return { success: true, data: {} };
        },
        closeWindow: async () => ({ success: false })
      };
      engine.text.windows = windowsStub;
      const result = await engine.text.write('helloworld', {});
      assert.strictEqual(result.success, true);
      assert.strictEqual(written[0].content, 'hello world');
      assert.strictEqual(result.data.repairMethod, 'nlp');
    });
  });
});