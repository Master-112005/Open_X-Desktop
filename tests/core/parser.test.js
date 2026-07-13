const assert = require('assert');

describe('Input Parser', function() {
  let InputParser;

  before(function() {
    InputParser = require('../../core/assistant/linguistic/InputParser');
  });

  it('should parse a simple command', function() {
    const parser = new InputParser({});
    const result = parser.parse('open chrome');
    assert.ok(result.hasCommand);
    assert.equal(result.normalized, 'open chrome');
    assert.equal(result.raw, 'open chrome');
  });

  it('should preserve raw command text for entity extraction', function() {
    const parser = new InputParser({});
    const result = parser.parse('create file report.pdf on desktop');
    assert.equal(result.commandText, 'create file report pdf on desktop');
    assert.equal(result.rawCommandText, 'create file report.pdf on desktop');
    assert.equal(result.wakeWordDetected, false);
  });

  it('should handle empty input', function() {
    const parser = new InputParser({});
    const result = parser.parse('');
    assert.equal(result.hasCommand, false);
    assert.equal(result.normalized, '');
  });

  it('should handle null input', function() {
    const parser = new InputParser({});
    const result = parser.parse(null);
    assert.equal(result.hasCommand, false);
  });

  it('should normalize input text', function() {
    const parser = new InputParser({});
    const result = parser.parse('  OPEN  CHROME  ');
    assert.equal(result.normalized, 'open chrome');
  });

  it('should never treat input text as a wake-word activation', function() {
    const parser = new InputParser({});
    assert.equal(parser.isActivation('jarvis'), false);
    assert.equal(parser.isActivation('hey jarvis'), false);
    assert.equal(parser.isActivation('alt space'), false);
  });

  it('should strip polite lead in phrases from commands', function() {
    const parser = new InputParser({});
    const result = parser.parse('could you please open chrome');
    assert.equal(result.commandText, 'open chrome');
    assert.equal(result.rawCommandText, 'open chrome');
  });

  it('should expose word relations and command clauses for multi-step commands', function() {
    const parser = new InputParser({});
    const result = parser.parse('open chrome and search for latest news in chrome');

    assert.deepEqual(result.commandTokens, [
      'open',
      'chrome',
      'and',
      'search',
      'for',
      'latest',
      'news',
      'in',
      'chrome'
    ]);
    assert.equal(result.commandClauses.length, 2);
    assert.equal(result.commandClauses[0].text, 'open chrome');
    assert.equal(result.commandClauses[1].text, 'search for latest news in chrome');
    assert.equal(
      result.wordRelations.some(relation =>
        relation.type === 'sequence' &&
        relation.marker === 'and' &&
        relation.from === 'chrome' &&
        relation.to === 'search'
      ),
      true
    );
    assert.equal(
      result.wordRelations.some(relation =>
        relation.type === 'prepositional-link' &&
        relation.marker === 'in' &&
        relation.from === 'news' &&
        relation.to === 'chrome'
      ),
      true
    );
  });

  it('should keep connector words inside one command target', function() {
    const parser = new InputParser({});
    const result = parser.parse('search for cats and dogs');

    assert.equal(result.commandClauses.length, 1);
    assert.equal(result.commandClauses[0].text, 'search for cats and dogs');
    assert.deepEqual(result.commandClauses[0].tokens, ['search', 'for', 'cats', 'and', 'dogs']);
  });

  it('should preserve media titles that contain connector words', function() {
    const parser = new InputParser({});
    const result = parser.parse('play Stars and Stripes Forever song');

    assert.equal(result.commandClauses.length, 1);
    assert.equal(result.commandClauses[0].text, 'play stars and stripes forever song');
    assert.equal(result.commandClauses[0].actionToken, 'play');
  });

  it('should flag correction follow-ups for context-aware routing', function() {
    const parser = new InputParser({});
    const result = parser.parse('no no set it to 40');

    assert.equal(result.isCorrection, true);
    assert.equal(result.discourse.requiresContext, true);
    assert.equal(result.commandClauses[0].actionToken, 'set');
  });

  it('should classify reminder and alarm frames as schedule work', function() {
    const { CommandFrameParser } = require('../../core/assistant/linguistic/InputParser');
    const frame = new CommandFrameParser().parse('remind me every saturday and monday to eat lunch at 8 pm');

    assert.equal(frame.domain, 'schedule');
    assert.equal(frame.clauses.length, 1);
    assert.equal(frame.isCorrection, false);
  });

  it('should classify phone transfer command frames with natural aliases', function() {
    const { CommandFrameParser } = require('../../core/assistant/linguistic/InputParser');
    const frame = new CommandFrameParser().parse('copy latest screenshot onto my mobile');

    assert.equal(frame.action, 'send');
    assert.equal(frame.domain, 'phone-transfer');
    assert.equal(frame.appRouteAllowed, true);
    assert.equal(frame.relations.some(relation =>
      relation.type === 'action-target' &&
      relation.from === 'copy' &&
      relation.to === 'latest'
    ), true);
  });

  it('should let explicit app-domain wording override file words', function() {
    const { CommandFrameParser } = require('../../core/assistant/linguistic/InputParser');
    const frame = new CommandFrameParser().parse('open resume app not file');

    assert.equal(frame.action, 'open');
    assert.equal(frame.domain, 'app');
    assert.equal(frame.appRouteAllowed, true);
  });
});
