const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PlannerController = require('../../core/automation/planner');
const ActionVerifier = require('../../core/automation/common/action-verification');

describe('Planner Controller', function() {
  it('should persist calendar and timetable entries', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-planner-'));
    const planner = new PlannerController({ app: { dataDir } });

    const calendar = planner.addCalendarEntry({
      plannerText: 'team review tomorrow at 4 pm'
    });
    const timetable = planner.addTimetableEntry({
      title: 'study block',
      dateExpression: 'today',
      timeExpression: '7:30 am'
    });

    assert.equal(calendar.success, true);
    assert.equal(calendar.data.entry.type, 'calendar');
    assert.equal(calendar.data.entry.startTime, '16:00');
    assert.equal(timetable.success, true);
    assert.equal(timetable.data.entry.type, 'timetable');
    assert.equal(timetable.data.entry.startTime, '07:30');
    assert.equal(fs.existsSync(path.join(dataDir, 'planner.json')), true);

    const restored = new PlannerController({ app: { dataDir } });
    assert.equal(restored.listEntries().data.count, 2);
  });

  it('should resolve "this" from recent conversation context', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-planner-context-'));
    const planner = new PlannerController({ app: { dataDir } });

    const result = planner.addCalendarEntry(
      { reference: 'previous', dateExpression: 'tomorrow', timeExpression: '5 pm' },
      {
        conversation: {
          recent: [
            { input: 'submit the lab form', success: false },
            { input: 'update this in calendar tomorrow at 5 pm', success: true }
          ]
        }
      }
    );

    assert.equal(result.success, true);
    assert.equal(result.data.entry.title, 'submit the lab form');
    assert.equal(result.data.entry.startTime, '17:00');
  });

  it('should normalize spaced human times and clean schedule words from titles', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-planner-time-'));
    const planner = new PlannerController({ app: { dataDir } });

    const result = planner.addCalendarEntry({
      plannerText: 'team review tomorrow at 12 21 am'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.entry.startTime, '00:21');
    assert.equal(result.data.entry.title, 'team review');
    assert.equal(result.data.verified, true);
    assert.equal(result.data.verification.status, 'passed');
  });

  it('should update duplicate planner entries instead of writing repeated rows', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-planner-dedupe-'));
    const planner = new PlannerController({ app: { dataDir } });

    const first = planner.addTimetableEntry({
      title: 'study block',
      dateExpression: '2026-07-14',
      timeExpression: '7:30 pm',
      notes: 'math'
    });
    const second = planner.addTimetableEntry({
      title: 'study block',
      dateExpression: '2026-07-14',
      timeExpression: '19:30',
      notes: 'physics'
    });

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(second.data.operation, 'update');
    assert.equal(second.data.duplicate, true);
    assert.equal(planner.listEntries({ type: 'timetable' }).data.count, 1);
    assert.equal(planner.listEntries({ type: 'timetable' }).data.entries[0].notes, 'physics');
  });

  it('should expose concrete planner verification results', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-planner-verify-'));
    const planner = new PlannerController({ app: { dataDir } });
    const verifier = new ActionVerifier({});

    const result = planner.addCalendarEntry({
      plannerText: 'review release notes today at noon'
    });
    const verification = verifier.verify('calendar.add', result.data.entry, result);

    assert.equal(verification.verification.status, 'passed');
    assert.equal(verification.verification.check, 'planner-entry-persisted');
    assert.equal(verification.verification.date, result.data.entry.date);
  });

  it('should migrate accidental cwd planner data into the managed data root', function() {
    const originalCwd = process.cwd();
    const originalDataDir = process.env.OPENX_DATA_DIR;
    const cwdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-cwd-planner-'));
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-managed-planner-'));

    try {
      process.env.OPENX_DATA_DIR = dataDir;
      process.chdir(cwdDir);
      fs.writeFileSync(path.join(cwdDir, 'planner.json'), JSON.stringify([{
        id: 'planner-legacy',
        type: 'calendar',
        title: 'legacy entry',
        date: '2026-06-30',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }], null, 2), 'utf8');

      const planner = new PlannerController({
        app: { migrateCwdPlanner: true }
      });

      assert.equal(fs.existsSync(path.join(cwdDir, 'planner.json')), false);
      assert.equal(fs.existsSync(path.join(dataDir, 'planner.json')), true);
      assert.equal(planner.listEntries().data.count, 1);
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
});
