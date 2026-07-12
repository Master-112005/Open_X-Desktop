const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ActionRouter = require('../../core/assistant/automation/ActionRouter');
const EntityExtractor = require('../../core/assistant/entities/EntityExtractor');
const SchedulerController = require('../../core/automation/scheduler');

describe('Reminder Extraction', function() {
  const extractor = new EntityExtractor({ logging: { console: false, file: false } });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-reminder-extraction-'));
  const scheduler = new SchedulerController({
    app: { dataDir: tempDir, cleanupLegacySchedules: false },
    logging: { console: false, file: false }
  });
  const router = new ActionRouter({ logging: { console: false, file: false } }, {});

  after(function() {
    scheduler.destroy();
  });

  const cases = [
    {
      input: 'remind me to wish my brother on 01/12/26 at five pm',
      text: 'wish my brother',
      time: '01/12/26 at five pm'
    },
    {
      input: 'remind me on 1 december of this year at five pm to wish my brother',
      text: 'wish my brother',
      time: '1 december of this year at five pm'
    },
    {
      input: 'set a reminder for tomorrow 10pm to submit the report',
      text: 'submit the report',
      time: 'tomorrow 10pm'
    },
    {
      input: 'notify me to drink water after thirty minutes',
      text: 'drink water',
      time: 'thirty minutes',
      duration: 30
    },
    {
      input: 'alert me next sunday at 6:30 pm about calling mom',
      text: 'calling mom',
      time: 'next sunday at 6:30 pm'
    },
    {
      input: 'remind me after forty five minutes to stretch',
      text: 'stretch',
      time: 'forty five minutes',
      duration: 45
    },
    {
      input: 'notify me in ten minits to sign the sheet',
      text: 'sign the sheet',
      time: 'ten minits',
      duration: 10
    },
    {
      input: 'set a reminder on 12/12/2026 at 5 30 pm to call the office',
      text: 'call the office',
      time: '12/12/2026 at 5 30 pm'
    },
    {
      input: 'remind me every saturday monday to eat lunch at 8pm',
      text: 'eat lunch',
      time: '8pm',
      recurrence: 'weekly:saturday,monday'
    },
    {
      input: 'remind me daily to drink water at 8pm',
      text: 'drink water',
      time: '8pm',
      recurrence: 'daily'
    }
  ];

  for (const testCase of cases) {
    it(`should extract reminder parts from "${testCase.input}"`, function() {
      const parts = extractor.extractReminderParts(testCase.input);
      assert.equal(parts.reminderText, testCase.text);
      assert.equal(parts.timeExpression, testCase.time);
      if (testCase.duration) assert.equal(parts.duration, testCase.duration);
      if (testCase.recurrence) assert.equal(parts.recurrence, testCase.recurrence);
      assert.ok(scheduler._parseTimeExpression(parts.timeExpression) instanceof Date);
    });
  }

  it('should route varied reminder sentences with complete entities', function() {
    const result = router._resolveExplicitReminderIntent(
      'remind me to wish my brother on 01/12/26 at five pm',
      { correctedText: 'remind me to wish my brother on 01/12/26 at five pm' }
    );

    assert.equal(result.intent.id, 'reminder.set');
    assert.equal(result.entities.reminderText, 'wish my brother');
    assert.equal(result.entities.timeExpression, '01/12/26 at five pm');
  });

  it('should route recurring weekday reminder sentences with separate text, time, and repeat rule', function() {
    const result = router._resolveExplicitReminderIntent(
      'remind me every saturday monday to eat lunch at 8pm',
      { correctedText: 'remind me every saturday monday to eat lunch at 8pm' }
    );

    assert.equal(result.intent.id, 'reminder.set');
    assert.equal(result.entities.reminderText, 'eat lunch');
    assert.equal(result.entities.timeExpression, '8pm');
    assert.equal(result.entities.recurrence, 'weekly:saturday,monday');
  });
});
