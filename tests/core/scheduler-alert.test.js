const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SchedulerController = require('../../core/automation/scheduler');
const ActionVerifier = require('../../core/automation/common/action-verification');
const { readSecureJsonFile } = require('../../core/assistant/Data');

describe('Scheduler Alert Delivery', function() {
  it('should persist schedules and publish due events without terminal scripts', async function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-scheduler-'));
    const events = [];
    const scheduler = new SchedulerController({
      app: { dataDir, cleanupLegacySchedules: false },
      eventBus: { publish: (event, payload) => events.push({ event, payload }) }
    });

    const result = scheduler._scheduleNotification({
      kind: 'Reminder',
      title: 'Reminder',
      message: 'Review the task list',
      dueAt: new Date(Date.now() + 20)
    });

    assert.equal(result.success, true);
    assert.equal(fs.existsSync(path.join(dataDir, 'schedules.json')), true);
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(events.length, 1);
    assert.equal(events[0].payload.message, 'Review the task list');
    assert.equal(scheduler.snooze(result.data.taskName, 5).success, true);
    assert.equal(scheduler.complete(result.data.taskName).success, true);
    scheduler.destroy();
  });

  it('should execute validated scheduled close actions when reminders become due', async function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-scheduled-action-'));
    const executed = [];
    const events = [];
    const scheduler = new SchedulerController({
      app: { dataDir, cleanupLegacySchedules: false },
      eventBus: { publish: (event, payload) => events.push({ event, payload }) },
      scheduledActionExecutor: async (scheduledAction, schedule) => {
        executed.push({ scheduledAction, scheduleId: schedule.id });
        return { success: true, data: { action: scheduledAction.actionId } };
      }
    });

    const result = scheduler.setReminder('close youtube', {
      duration: 0.001,
      scheduledAction: {
        actionId: 'browser.closeTab',
        entities: { browserName: 'chrome', tabQuery: 'youtube' }
      }
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.data.scheduledAction, {
      actionId: 'browser.closeTab',
      entities: { browserName: 'chrome', tabQuery: 'youtube' }
    });

    await new Promise(resolve => setTimeout(resolve, 120));
    assert.equal(executed.length, 1);
    assert.equal(executed[0].scheduledAction.actionId, 'browser.closeTab');
    assert.deepEqual(executed[0].scheduledAction.entities, { browserName: 'chrome', tabQuery: 'youtube' });
    assert.equal(scheduler.scheduledItems[0].status, 'completed');
    assert.equal(scheduler.scheduledItems[0].scheduledActionResult.success, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].payload.status, 'completed');
    assert.equal(events[0].payload.scheduledActionResult.success, true);
    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should execute validated scheduled media actions when reminders become due', async function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-scheduled-media-'));
    const executed = [];
    const scheduler = new SchedulerController({
      app: { dataDir, cleanupLegacySchedules: false },
      eventBus: { publish() {} },
      scheduledActionExecutor: async (scheduledAction, schedule) => {
        executed.push({ scheduledAction, scheduleId: schedule.id });
        return { success: true, data: { action: scheduledAction.actionId } };
      }
    });

    const result = scheduler.setReminder('play dulander song', {
      duration: 0.001,
      scheduledAction: {
        actionId: 'media.play',
        entities: { mediaQuery: 'dulander song', mediaPlatform: 'youtube' }
      }
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.data.scheduledAction, {
      actionId: 'media.play',
      entities: { mediaQuery: 'dulander song', mediaPlatform: 'youtube' }
    });

    await new Promise(resolve => setTimeout(resolve, 120));
    assert.equal(executed.length, 1);
    assert.equal(executed[0].scheduledAction.actionId, 'media.play');
    assert.deepEqual(executed[0].scheduledAction.entities, { mediaQuery: 'dulander song', mediaPlatform: 'youtube' });
    assert.equal(scheduler.scheduledItems[0].status, 'completed');
    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should use OpenX schedule names and migrate accidental cwd schedules', function() {
    const originalCwd = process.cwd();
    const originalDataDir = process.env.OPENX_DATA_DIR;
    const cwdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-cwd-schedules-'));
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-managed-schedules-'));

    try {
      process.env.OPENX_DATA_DIR = dataDir;
      process.chdir(cwdDir);
      fs.writeFileSync(path.join(cwdDir, 'schedules.json'), JSON.stringify([{
        id: 'JARVIS_Reminder_legacy',
        taskName: 'JARVIS_Reminder_legacy',
        kind: 'Reminder',
        title: 'JARVIS Reminder Reminder',
        message: 'legacy reminder',
        dueAt: new Date(Date.now() + 60000).toISOString(),
        status: 'scheduled',
        createdAt: new Date().toISOString()
      }], null, 2), 'utf8');

      const scheduler = new SchedulerController({
        app: { cleanupLegacySchedules: false, migrateCwdSchedules: true }
      });
      const result = scheduler.setReminder('call mummy', { duration: 30 });
      const entries = readSecureJsonFile(path.join(dataDir, 'schedules.json'), [], {
        createIfMissing: false,
        validate: value => Array.isArray(value)
      });

      assert.equal(result.success, true);
      assert.equal(fs.existsSync(path.join(cwdDir, 'schedules.json')), false);
      assert.ok(entries.every(item => !String(item.id).startsWith('JARVIS_')));
      assert.ok(entries.every(item => !String(item.taskName).startsWith('JARVIS_')));
      assert.ok(entries.every(item => !/^JARVIS\b/.test(String(item.title || ''))));
      assert.ok(entries.some(item => item.id === 'OpenX_Reminder_legacy'));
      assert.ok(entries.some(item => item.title === 'OpenX Reminder'));
      assert.match(result.data.id, /^OpenX_Reminder_/);
      assert.equal(result.data.title, 'OpenX Reminder');
      scheduler.destroy();
    } finally {
      process.chdir(originalCwd);
      if (originalDataDir === undefined) {
        delete process.env.OPENX_DATA_DIR;
      } else {
        process.env.OPENX_DATA_DIR = originalDataDir;
      }
      fs.rmSync(cwdDir, { recursive: true, force: true });
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('should classify reminders and persist category symbols', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-reminder-category-'));
    const scheduler = new SchedulerController({
      app: { dataDir, cleanupLegacySchedules: false },
      eventBus: { publish() {} }
    });

    const college = scheduler.setReminder('go to college', { duration: 10 });
    const water = scheduler.setReminder('drink water', { duration: 20 });
    const exercise = scheduler.setReminder('do my exercise', { duration: 30 });

    assert.equal(college.data.category, 'education');
    assert.equal(college.data.symbol, '🎓');
    assert.equal(water.data.category, 'water');
    assert.equal(water.data.symbol, '💧');
    assert.equal(exercise.data.category, 'exercise');
    assert.equal(exercise.data.symbol, '🏃');
    const schedulePath = path.join(dataDir, 'schedules.json');
    const persisted = readSecureJsonFile(schedulePath, [], {
      createIfMissing: false,
      validate: value => Array.isArray(value)
    });
    assert.deepEqual(persisted.map(item => item.category), ['education', 'water', 'exercise']);
    assert.match(fs.readFileSync(schedulePath, 'utf8'), /OPENX_SECURE_JSON_V1/);
    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should understand worded clock expressions', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-worded-clock-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    assert.ok(scheduler._parseTimeExpression('seven am') instanceof Date);
    assert.ok(scheduler._parseTimeExpression('noon') instanceof Date);
    assert.ok(scheduler._parseTimeExpression('midnight') instanceof Date);
    assert.ok(scheduler._parseTimeExpression('half past seven') instanceof Date);
    assert.ok(scheduler._parseTimeExpression('quarter to eight') instanceof Date);

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should manage active timers alarms and schedule lists', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-schedule-management-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    scheduler.setTimer(5);
    assert.equal(scheduler.pauseActiveTimer().success, true);
    assert.equal(scheduler.resumeActiveTimer().success, true);
    assert.equal(scheduler.getRemainingTimer().data.remainingMinutes, 5);
    assert.equal(scheduler.listSchedules('Timer').data.count, 1);
    assert.equal(scheduler.resetActiveTimer().success, true);
    const cancelledTimer = scheduler.cancelLatest('Timer');
    assert.equal(cancelledTimer.success, true);
    assert.equal(cancelledTimer.data.status, 'dismissed');
    scheduler.setAlarm('noon', 'Lunch');
    assert.equal(scheduler.listSchedules('Alarm').data.entries[0].alarmLabel, 'Lunch');
    assert.equal(scheduler.snoozeLatestAlarm().success, true);
    const clearedAlarms = scheduler.clearSchedules('Alarm');
    assert.equal(clearedAlarms.data.count, 1);
    assert.equal(scheduler.listSchedules('Alarm').data.count, 0);
    scheduler.setReminder('drink water', { duration: 15 });
    assert.equal(scheduler.snoozeLatestReminder(10).success, true);

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should remove recurring reminders without rescheduling them into active lists', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-remove-recurring-schedule-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    const result = scheduler.setReminder('mark attendance', {
      timeExpression: '9:30 pm',
      recurrence: 'daily'
    });
    assert.equal(result.success, true);

    const removed = scheduler.removeSchedule(result.data.id);
    assert.equal(removed.success, true);
    assert.equal(removed.data.status, 'dismissed');
    assert.equal(scheduler.listSchedules('Reminder').data.count, 0);
    assert.equal(scheduler.listSchedules('Reminder', 'today').data.entries.some(item => item.id === result.data.id), false);
    assert.equal(scheduler.getScheduleSnapshot().entries.some(item => item.id === result.data.id), false);

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should cancel recurring reminders and alarms without rescheduling them', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-cancel-recurring-schedule-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    const reminder = scheduler.setReminder('mark attendance', {
      timeExpression: '9:30 pm',
      recurrence: 'daily'
    });
    const alarm = scheduler.setAlarm('10 am', 'Standup', { recurrence: 'daily' });

    assert.equal(reminder.success, true);
    assert.equal(alarm.success, true);
    assert.equal(scheduler.cancelLatest('Reminder').data.status, 'dismissed');
    assert.equal(scheduler.cancelLatest('Alarm').data.status, 'dismissed');
    assert.equal(scheduler.listSchedules('Reminder').data.count, 0);
    assert.equal(scheduler.listSchedules('Alarm').data.count, 0);

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should expose timer and stopwatch state for the mini widget', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-timer-widget-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    const timer = scheduler.setTimer(5);
    assert.equal(timer.success, true);
    const timerState = scheduler.getTimerWidgetState(timer.data.taskName);
    assert.equal(timerState.visible, true);
    assert.equal(timerState.mode, 'timer');
    assert.equal(timerState.durationMs, 300000);
    assert.ok(timerState.remainingMs > 0);
    scheduler.cancelLatest('Timer');

    const stopwatch = scheduler.startStopwatch();
    assert.equal(stopwatch.success, true);
    assert.equal(scheduler.getTimerWidgetState(stopwatch.data.taskName).visible, false);
    const stopwatchState = scheduler.getTimerWidgetState(stopwatch.data.taskName, { includeStopwatch: true });
    assert.equal(stopwatchState.visible, true);
    assert.equal(stopwatchState.mode, 'stopwatch');
    assert.equal(stopwatchState.status, 'running');
    assert.ok(stopwatchState.elapsedMs >= 0);
    assert.equal(scheduler.pauseStopwatch().success, true);
    assert.equal(scheduler.resetStopwatch().data.status, 'paused');
    assert.equal(scheduler.getTimerWidgetState(stopwatch.data.taskName, { includeStopwatch: true }).elapsedMs, 0);
    assert.equal(scheduler.resumeStopwatch().data.status, 'running');
    assert.equal(scheduler.stopStopwatch().success, true);
    assert.equal(scheduler.getTimerWidgetState().visible, false);

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should not let an active stopwatch appear from timer or alarm widget polling', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-stopwatch-isolation-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    const stopwatch = scheduler.startStopwatch();
    assert.equal(stopwatch.success, true);
    assert.equal(scheduler.getTimerWidgetState().visible, false);
    assert.equal(scheduler.getTimerWidgetState(null, { includeStopwatch: true }).mode, 'stopwatch');

    const timer = scheduler.setTimer(5);
    assert.equal(timer.success, true);
    assert.equal(scheduler.getTimerWidgetState().mode, 'timer');
    scheduler.complete(timer.data.id);
    assert.equal(scheduler.getTimerWidgetState().visible, false);

    const alarm = scheduler.setAlarm('noon', 'Lunch');
    assert.equal(alarm.success, true);
    assert.equal(scheduler.getTimerWidgetState(alarm.data.id).visible, false);

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should persist and roll recurring reminders forward', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-recurring-reminder-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });
    const result = scheduler.setReminder('drink water', { recurrence: 'hourly' });
    const firstDueAt = result.data.dueAt;

    assert.equal(result.success, true);
    assert.equal(scheduler.scheduledItems[0].recurrence, 'hourly');
    scheduler.complete(result.data.taskName);
    assert.equal(scheduler.scheduledItems[0].status, 'scheduled');
    assert.ok(new Date(scheduler.scheduledItems[0].dueAt) > new Date(firstDueAt));

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should update duplicate active reminders instead of creating repeated alerts', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-scheduler-dedupe-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    const first = scheduler.setReminder('call mummy', { duration: 30 });
    const second = scheduler.setReminder('call mummy', { duration: 30 });

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(second.data.operation, 'update');
    assert.equal(second.data.duplicate, true);
    assert.equal(scheduler.listSchedules('Reminder').data.count, 1);

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should keep active schedules when compacting old completed history', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-scheduler-compact-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    scheduler.scheduledItems = Array.from({ length: 190 }, (_, index) => ({
      id: `OpenX_Reminder_old_${index}`,
      taskName: `OpenX_Reminder_old_${index}`,
      kind: 'Reminder',
      title: 'Old reminder',
      message: `old ${index}`,
      dueAt: new Date(Date.now() + 60000 + index).toISOString(),
      status: 'completed',
      createdAt: new Date(Date.now() - index * 1000).toISOString()
    }));
    scheduler.scheduledItems.push({
      id: 'OpenX_Reminder_active',
      taskName: 'OpenX_Reminder_active',
      kind: 'Reminder',
      title: 'Active reminder',
      message: 'active',
      dueAt: new Date(Date.now() + 60000).toISOString(),
      status: 'scheduled',
      createdAt: new Date().toISOString()
    });

    scheduler._saveScheduledItems();

    assert.ok(scheduler.scheduledItems.some(item => item.id === 'OpenX_Reminder_active'));
    assert.ok(scheduler.scheduledItems.length <= 160);

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should verify schedule state actions without requiring future due time for clears', function() {
    const verifier = new ActionVerifier({});
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-scheduler-verify-'));
    const scheduler = new SchedulerController({ app: { dataDir, cleanupLegacySchedules: false } });

    scheduler.setTimer(5);
    const paused = verifier.verify('timer.pause', {}, scheduler.pauseActiveTimer());
    const cleared = verifier.verify('timer.clear', {}, scheduler.clearSchedules('Timer'));

    assert.equal(paused.verification.status, 'passed');
    assert.equal(paused.verification.check, 'schedule-paused');
    assert.equal(cleared.verification.status, 'passed');
    assert.equal(cleared.verification.check, 'schedule-cleared');

    scheduler.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
});
