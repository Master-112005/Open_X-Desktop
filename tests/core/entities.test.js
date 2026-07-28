const assert = require('assert');

describe('Entity Extractor', function() {
  let EntityExtractor;

  before(function() {
    EntityExtractor = require('../../core/assistant/entities/EntityExtractor');
  });

  it('should extract numeric value', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'value', type: 'number', required: true }] };
    const entities = extractor.extract(intent, 'set volume to 70 percent');
    assert.equal(entities.value, 70);
  });

  it('should clamp values above 100', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'value', type: 'number', required: true }] };
    const entities = extractor.extract(intent, 'set volume to 150');
    assert.equal(entities.value, 100);
  });

  it('should extract app name from command', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'appName', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'open chrome');
    assert.equal(entities.appName, 'chrome');
  });

  it('should preserve strict user-facing app names', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'appName', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'open visual studio code');
    assert.equal(entities.appName, 'visual studio code');
  });

  it('should resolve misspelled app names', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'appName', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'opne chrmoe');
    assert.equal(entities.appName, 'chrome');
  });

  it('should resolve multi-word app aliases', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'appName', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'open apple music');
    assert.equal(entities.appName, 'apple music');
  });

  it('should resolve Windows utility and settings app aliases', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'appName', type: 'string', required: true }] };

    assert.equal(extractor.extract(intent, 'open voice recorder').appName, 'soundrecorder');
    assert.equal(extractor.extract(intent, 'open microsoft store').appName, 'microsoft store');
    assert.equal(extractor.extract(intent, 'open device manager').appName, 'devmgmt.msc');
    assert.equal(extractor.extract(intent, 'open update settings').appName, 'ms-settings:windowsupdate');
    assert.equal(extractor.extract(intent, 'open firewall settings').appName, 'windowsdefender://network');
  });

  it('should keep unknown app names for Start menu resolution', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'appName', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'open google chat');
    assert.equal(entities.appName, 'google chat');
  });

  it('should resolve common PowerPoint speech variations', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'appName', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'close power paint');
    assert.equal(entities.appName, 'powerpoint');
  });

  it('should not extract an app name from prepositional close phrases', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'appName', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'close to terminal');
    assert.equal(entities.appName, null);
  });

  it('should extract filename', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'filename', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'delete file report.pdf');
    assert.equal(entities.filename, 'report.pdf');
  });

  it('should remove conversational noise from existing file references', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'filename', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'open my resume file');
    assert.equal(entities.filename, 'resume');
  });

  it('should extract filename and path for file creation', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'filename', type: 'string', required: true },
        { name: 'path', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'Create file report.pdf on desktop');
    assert.equal(entities.filename, 'report.pdf');
    assert.equal(entities.path, 'desktop');
  });

  it('should extract spoken extension filenames for file creation', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'filename', type: 'string', required: true },
        { name: 'path', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'create a report pdf file on desktop');
    assert.equal(entities.filename, 'report.pdf');
    assert.equal(entities.path, 'desktop');
  });

  it('should extract filename and path for file deletion', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'filename', type: 'string', required: true },
        { name: 'path', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'delete practice.java file from desktop');
    assert.equal(entities.filename, 'practice.java');
    assert.equal(entities.path, 'desktop');
  });

  it('should extract folder name and path', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'folderName', type: 'string', required: true },
        { name: 'path', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'create folder Projects on desktop');
    assert.equal(entities.folderName, 'Projects');
    assert.equal(entities.path, 'desktop');
  });

  it('should extract suffix folder names from open commands', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'folderName', type: 'string', required: true }] };
    const entities = extractor.extract(intent, 'open rakesh folder');
    assert.equal(entities.folderName, 'rakesh');
  });

  it('should extract suffix folder names from create and delete commands', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'folderName', type: 'string', required: true }] };

    assert.equal(extractor.extract(intent, 'create Projects folder').folderName, 'Projects');
    assert.equal(extractor.extract(intent, 'create a study folder').folderName, 'study');
    assert.equal(extractor.extract(intent, 'delete screenshots folder').folderName, 'screenshots');
  });

  it('should extract file move source and destination', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'source', type: 'string', required: true },
        { name: 'destination', type: 'string', required: true }
      ]
    };
    const entities = extractor.extract(intent, 'move notes.txt from desktop to downloads');
    assert.equal(entities.source, 'notes.txt from desktop');
    assert.equal(entities.destination, 'downloads');
  });

  it('should return null for missing value', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'value', type: 'number', required: true }] };
    const entities = extractor.extract(intent, 'set volume');
    assert.strictEqual(entities.value, null);
  });

  it('should extract spoken maximum and minimum values', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'value', type: 'number', required: true }] };

    assert.equal(extractor.extract(intent, 'set brightness to maximum').value, 100);
    assert.equal(extractor.extract(intent, 'set volume to minimum').value, 0);
  });

  it('should extract timer duration in minutes', function() {
    const extractor = new EntityExtractor({});
    const intent = { entities: [{ name: 'duration', type: 'number', required: true }] };
    const entities = extractor.extract(intent, 'set timer for 5 min');
    assert.equal(entities.duration, 5);
  });

  it('should extract reminder time and message', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'timeExpression', type: 'string', required: false },
        { name: 'reminderText', type: 'string', required: true }
      ]
    };
    const entities = extractor.extract(intent, 'remind at 1 pm to eat lunch');
    assert.equal(entities.timeExpression, '1 pm');
    assert.equal(entities.reminderText, 'eat lunch');
  });

  it('should extract loose spoken clock reminders without swallowing the message', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'timeExpression', type: 'string', required: false },
        { name: 'reminderText', type: 'string', required: true }
      ]
    };

    const spaced = extractor.extract(intent, 'remind me at 12 21 to call mummy');
    const spacedMeridiem = extractor.extract(intent, 'remind me at 1 8 am to call mummy');

    assert.equal(spaced.timeExpression, '12:21');
    assert.equal(spaced.reminderText, 'call mummy');
    assert.equal(spacedMeridiem.timeExpression, '1:08 am');
    assert.equal(spacedMeridiem.reminderText, 'call mummy');
  });

  it('should extract reminder time when the time appears after the reminder text', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'timeExpression', type: 'string', required: false },
        { name: 'reminderText', type: 'string', required: true }
      ]
    };
    const entities = extractor.extract(intent, 'remind me to sleep at 12 am');
    assert.equal(entities.timeExpression, '12 am');
    assert.equal(entities.reminderText, 'sleep');
  });

  it('should extract time-first multi-time recurring reminders without swallowing the message', function() {
    const extractor = new EntityExtractor({});
    const parts = extractor.extractReminderParts('daily remind me at 9 30pm and 9 55 pm to mark attendance');
    const typoTailParts = extractor.extractReminderParts('evry day remind me to mark attendance at 9 30 and 9 55 pm');

    assert.equal(parts.timeExpression, '9:30 pm');
    assert.deepEqual(parts.timeExpressions, ['9:30 pm', '9:55 pm']);
    assert.equal(parts.reminderText, 'mark attendance');
    assert.equal(parts.recurrence, 'daily');
    assert.equal(typoTailParts.timeExpression, '9:30 pm');
    assert.deepEqual(typoTailParts.timeExpressions, ['9:30 pm', '9:55 pm']);
    assert.equal(typoTailParts.reminderText, 'mark attendance');
    assert.equal(typoTailParts.recurrence, 'daily');
  });

  it('should separate a date-only reminder time from missing content', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'timeExpression', type: 'string', required: false },
        { name: 'reminderText', type: 'string', required: true }
      ]
    };

    const remind = extractor.extract(intent, 'remind me tomorrow morning');
    const create = extractor.extract(intent, 'create a reminder for tomorrow');

    assert.equal(remind.timeExpression, 'tomorrow morning');
    assert.equal(remind.reminderText, null);
    assert.equal(create.timeExpression, 'tomorrow');
    assert.equal(create.reminderText, null);
  });

  it('should extract day-of-month reminder dates and spoken message text', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'timeExpression', type: 'string', required: false },
        { name: 'reminderText', type: 'string', required: true }
      ]
    };

    const thisMonth = extractor.extract(intent, 'remind me 12 of this month say birthday wish to charan');
    const nextMonth = extractor.extract(intent, 'remind me 12 next month to wish charan happy birthday');

    assert.equal(thisMonth.timeExpression, '12 of this month');
    assert.equal(thisMonth.reminderText, 'birthday wish to charan');
    assert.equal(nextMonth.timeExpression, '12 next month');
    assert.equal(nextMonth.reminderText, 'wish charan happy birthday');
  });

  it('should extract flexible reminder dates without swallowing the message', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'timeExpression', type: 'string', required: false },
        { name: 'reminderText', type: 'string', required: true }
      ]
    };

    const nextMonth = extractor.extract(intent, 'remind me next month 7 say wishes to mohit');
    const slashDate = extractor.extract(intent, 'remind me on 01/12/26 at five pm to call mummy');
    const monthName = extractor.extract(intent, 'remind me december 1 of this year say wishes to charan');
    const durationOnly = extractor.extract(intent, 'remind me in 5 min');

    assert.equal(nextMonth.timeExpression, 'next month 7');
    assert.equal(nextMonth.reminderText, 'wishes to mohit');
    assert.equal(slashDate.timeExpression, '01/12/26 at five pm');
    assert.equal(slashDate.reminderText, 'call mummy');
    assert.equal(monthName.timeExpression, 'december 1 of this year');
    assert.equal(monthName.reminderText, 'wishes to charan');
    assert.equal(durationOnly.timeExpression, '5 min');
    assert.equal(durationOnly.reminderText, null);
  });

  it('should extract scheduled remember phrases with common speech typos', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'timeExpression', type: 'string', required: false },
        { name: 'reminderText', type: 'string', required: true }
      ]
    };

    const entities = extractor.extract(intent, 'remember i have lcass on mondy morning 9');

    assert.equal(entities.timeExpression, 'monday 9');
    assert.equal(entities.reminderText, 'class');
  });

  it('should extract message details with an explicit chat platform', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'contactName', type: 'string', required: true },
        { name: 'messageText', type: 'string', required: true },
        { name: 'platform', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'say hi to daddy on telegram');
    assert.equal(entities.contactName, 'daddy');
    assert.equal(entities.messageText, 'hi');
    assert.equal(entities.platform, 'telegram');
  });

  it('should treat in platform wording as a platform, not part of the contact', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'contactName', type: 'string', required: true },
        { name: 'messageText', type: 'string', required: true },
        { name: 'platform', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'say hi to mummy in telegram');
    assert.equal(entities.contactName, 'mummy');
    assert.equal(entities.messageText, 'hi');
    assert.equal(entities.platform, 'telegram');
  });

  it('should extract platform-first Indian English messages', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'contactName', type: 'string', required: true },
        { name: 'messageText', type: 'string', required: true },
        { name: 'platform', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'send on telegram to Rahul hello bro');
    assert.equal(entities.contactName, 'Rahul');
    assert.equal(entities.messageText, 'hello bro');
    assert.equal(entities.platform, 'telegram');
  });

  it('should extract file-send message details cleanly', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'contactName', type: 'string', required: true },
        { name: 'messageText', type: 'string', required: true },
        { name: 'platform', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'send the report.pdf file to mummy on telegram');
    assert.equal(entities.contactName, 'mummy');
    assert.equal(entities.messageText, 'file report.pdf');
    assert.equal(entities.platform, 'telegram');
  });

  it('should extract call details', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'contactName', type: 'string', required: true },
        { name: 'platform', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'call bunty on phone');
    assert.equal(entities.contactName, 'bunty');
    assert.equal(entities.platform, 'phone');
  });

  it('should extract ask-style messages', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'contactName', type: 'string', required: true },
        { name: 'messageText', type: 'string', required: true },
        { name: 'platform', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'ask daddy to call me');
    assert.equal(entities.contactName, 'daddy');
    assert.equal(entities.messageText, 'call me');
  });

  it('should recover common typo in message verbs', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'contactName', type: 'string', required: true },
        { name: 'messageText', type: 'string', required: true },
        { name: 'platform', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'massage daddy to call me');
    assert.equal(entities.contactName, 'daddy');
    assert.equal(entities.messageText, 'call me');
  });

  it('should extract media details from natural playback phrasing', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [
        { name: 'mediaQuery', type: 'string', required: true },
        { name: 'mediaPlatform', type: 'string', required: false }
      ]
    };
    const entities = extractor.extract(intent, 'put on the playdate song on youtube');
    assert.equal(entities.mediaQuery, 'playdate');
    assert.equal(entities.mediaPlatform, 'youtube');
  });

  it('should extract window names from maximize commands', function() {
    const extractor = new EntityExtractor({});
    const intent = {
      entities: [{ name: 'windowName', type: 'string', required: false }]
    };
    const entities = extractor.extract(intent, 'maximize the youtube window please');
    assert.equal(entities.windowName, 'youtube');
  });
});
