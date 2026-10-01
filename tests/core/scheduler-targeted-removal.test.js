const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SchedulerController = require('../../core/automation/scheduler');

describe('Scheduler Targeted Reminder Removal', function() {
  function createScheduler(dataDir) {
    return new SchedulerController({
      app: { dataDir, cleanupLegacySchedules: false },
      eventBus: { publish: () => {} }
    });
  }

  it('should find and remove a single reminder by matching text', async function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-schedule-remove-'));
    const scheduler = createScheduler(dataDir);

    try {
      await scheduler.setReminder('drink water', { duration: 30 });
      await scheduler.setReminder('call mom', { duration: 45 });
      await scheduler.setReminder('team meeting', { duration: 60 });

      const found = scheduler.findSchedules('Reminder', 'water');
      assert.equal(found.success, true);
      assert.equal(found.data.count, 1);
      assert.equal(found.data.entries[0].message, 'drink water');

      const result = await scheduler.removeMatchingSchedules('Reminder', 'water');
      assert.equal(result.success, true);
      assert.equal(result.data.message, 'drink water');

      const remaining = scheduler.listSchedules('Reminder', 'active');
      assert.equal(remaining.data.count, 2);
      assert.equal(remaining.data.entries.some(entry => entry.message === 'drink water'), false);
    } finally {
      scheduler.destroy();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('should resolve a reminder by its numbered position', async function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-schedule-index-'));
    const scheduler = createScheduler(dataDir);

    try {
      await scheduler.setReminder('first task', { duration: 30 });
      await scheduler.setReminder('second task', { duration: 45 });
      await scheduler.setReminder('third task', { duration: 60 });

      const found = scheduler.findSchedules('Reminder', '2');
      assert.equal(found.data.count, 1);
      assert.equal(found.data.entries[0].message, 'second task');

      const result = await scheduler.removeMatchingSchedules('Reminder', '2');
      assert.equal(result.success, true);
      assert.equal(result.data.message, 'second task');
    } finally {
      scheduler.destroy();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('should request disambiguation when multiple reminders match', async function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-schedule-ambiguous-'));
    const scheduler = createScheduler(dataDir);

    try {
      await scheduler.setReminder('water the plants', { duration: 30 });
      await scheduler.setReminder('drink water', { duration: 45 });

      const result = await scheduler.removeMatchingSchedules('Reminder', 'water');
      assert.equal(result.success, false);
      assert.equal(result.data.clarificationType, 'schedule.remove');
      assert.equal(result.data.count, 2);
      assert.equal(Array.isArray(result.data.choices), true);
      assert.equal(result.data.choices.length, 2);
      assert.equal(typeof result.data.choices[0].entities.scheduleId, 'string');

      const remaining = scheduler.listSchedules('Reminder', 'active');
      assert.equal(remaining.data.count, 2);
    } finally {
      scheduler.destroy();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('should report when no reminder matches the requested target', async function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-schedule-nomatch-'));
    const scheduler = createScheduler(dataDir);

    try {
      await scheduler.setReminder('drink water', { duration: 30 });

      const result = await scheduler.removeMatchingSchedules('Reminder', 'groceries');
      assert.equal(result.success, false);
      assert.equal(result.data.count, 0);
      assert.match(result.error, /groceries/);
      assert.equal(scheduler.listSchedules('Reminder', 'active').data.count, 1);
    } finally {
      scheduler.destroy();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('should keep reminders of other kinds untouched when removing', async function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-schedule-kinds-'));
    const scheduler = createScheduler(dataDir);

    try {
      await scheduler.setReminder('drink water', { duration: 30 });
      await scheduler.setAlarm('noon', 'drink water alarm');

      const result = await scheduler.removeMatchingSchedules('Reminder', 'water');
      assert.equal(result.success, true);
      assert.equal(result.data.kind, 'Reminder');
      assert.equal(scheduler.listSchedules('Reminder', 'active').data.count, 0);
      assert.equal(scheduler.listSchedules('Alarm', 'active').data.count, 1);
    } finally {
      scheduler.destroy();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
