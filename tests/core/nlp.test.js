const assert = require('assert');

describe('NLP Processor', function() {
  let NlpProcessor, IntentRegistry;

  before(function() {
    NlpProcessor = require('../../core/assistant/linguistic/NlpProcessor');
    IntentRegistry = require('../../core/assistant/reasoning/IntentRegistry').IntentRegistry;
  });

  it('should normalize compact sports year tokens and classify knowledge questions', function() {
    const nlp = new NlpProcessor(new IntentRegistry());
    const prepared = nlp.prepare('who is the winner of ipl2020');

    assert.equal(prepared.correctedText, 'who is the winner of ipl 2020');
    assert.equal(prepared.query.type, 'knowledge-question');
  });

  it('should classify local file-type questions', function() {
    const nlp = new NlpProcessor(new IntentRegistry());
    const prepared = nlp.prepare('what are the pdfs on the desktop');

    assert.equal(prepared.query.type, 'local-file-question');
    assert.equal(prepared.query.localLocation, 'desktop');
    assert.equal(prepared.query.requestedFileType, 'pdf');
  });

  it('should correct common domain typos before search routing', function() {
    const nlp = new NlpProcessor(new IntentRegistry());
    const prepared = nlp.prepare('who is the capatin of indian cricket team in 2026');

    assert.equal(prepared.correctedText, 'who is the captain of indian cricket team in 2026');
    assert.equal(prepared.query.type, 'knowledge-question');
  });

  it('should repair assistant UI and command spelling mistakes from the shared lexicon', function() {
    const nlp = new NlpProcessor(new IntentRegistry());
    const prepared = nlp.prepare('plese open settngs and show server detials');

    assert.equal(prepared.correctedText, 'please open settings and show server details');
    assert.deepEqual(prepared.tokens, ['please', 'open', 'settings', 'and', 'show', 'server', 'details']);
  });

  it('should protect names, media titles, and local search targets while correcting command typos', function() {
    const nlp = new NlpProcessor(new IntentRegistry());

    assert.equal(
      nlp.prepare('play eymakoo song with 50 vol').correctedText,
      'play eymakoo song with 50 volume'
    );
    assert.equal(
      nlp.prepare('find photes of rishi and charan').correctedText,
      'find photos of rishi and charan'
    );
    assert.equal(
      nlp.prepare('serch for my quaterly reprt file').correctedText,
      'search for my quaterly reprt file'
    );
    assert.equal(
      nlp.prepare('cancle the remindee').correctedText,
      'cancel the reminder'
    );
  });

  it('should recover common missing-space speech and chat commands', function() {
    const nlp = new NlpProcessor(new IntentRegistry());

    assert.equal(nlp.prepare('hi howare you ok').correctedText, 'hi how are you ok');
    assert.equal(nlp.prepare('openchrome').correctedText, 'open chrome');
    assert.equal(nlp.prepare('openyoutub').correctedText, 'open youtube');
    assert.equal(nlp.prepare('setalarm for 10 am').correctedText, 'set alarm for 10 am');
    assert.equal(nlp.prepare('remindmeat 9 pm to call mom').correctedText, 'remind me at 9 pm to call mom');
    assert.equal(nlp.prepare('whatsthe time').correctedText, 'what is the time');
  });

  it('should build semantic frames for web, local, search, and knowledge requests', function() {
    const nlp = new NlpProcessor(new IntentRegistry());

    const webOpen = nlp.prepare('please pull up google photes website');
    const localOpen = nlp.prepare('open photos on this laptop');
    const webSearch = nlp.prepare('search for google maps in chrome');
    const knowledge = nlp.prepare('who is the winner of ipl 2026');

    assert.equal(webOpen.semanticFrame.actionVerb, 'open');
    assert.equal(webOpen.semanticFrame.targetText, 'google photos website');
    assert.equal(webOpen.semanticFrame.targetType, 'web');
    assert.equal(webOpen.semanticFrame.webTarget, 'google photos');

    assert.equal(localOpen.semanticFrame.targetType, 'local-app');
    assert.equal(localOpen.semanticFrame.localScope, 'device');
    assert.equal(localOpen.semanticFrame.isLocal, true);

    assert.equal(webSearch.semanticFrame.actionVerb, 'search');
    assert.equal(webSearch.semanticFrame.targetText, 'google maps');
    assert.equal(webSearch.semanticFrame.webTarget, 'google maps');

    assert.equal(knowledge.semanticFrame.targetType, 'knowledge');
    assert.equal(knowledge.semanticFrame.requiresWeb, true);
  });

  it('should not corrupt valid knowledge and developer terms during correction', function() {
    const nlp = new NlpProcessor(new IntentRegistry());

    assert.equal(
      nlp.prepare('what is the meaning of following').correctedText,
      'what is the meaning of following'
    );
    assert.equal(
      nlp.prepare('search node js tutorial').correctedText,
      'search node js tutorial'
    );
    assert.equal(
      nlp.prepare('what is your anme').correctedText,
      'what is your name'
    );
  });

  it('should normalize Indian English command phrasing without corrupting targets', function() {
    const nlp = new NlpProcessor(new IntentRegistry());

    assert.equal(
      nlp.prepare('do one thing open chrome only').correctedText,
      'open chrome only'
    );
    assert.equal(
      nlp.prepare('tell about indian cricket team').correctedText,
      'search for indian cricket team'
    );
    assert.equal(
      nlp.prepare('put net off').correctedText,
      'turn off wifi'
    );
    assert.equal(
      nlp.prepare('put net on').correctedText,
      'turn on wifi'
    );
  });

  it('should normalize native new-tab phrasing as a browser-tab action', function() {
    const nlp = new NlpProcessor(new IntentRegistry());
    const prepared = nlp.prepare('open another chrome tab');

    assert.equal(prepared.correctedText, 'open new chrome tab');
    assert.equal(prepared.semanticFrame.actionVerb, 'open');
    assert.equal(prepared.semanticFrame.domain, 'browser-tab');
    assert.equal(prepared.semanticFrame.targetType, 'browser-tab');
  });
});
