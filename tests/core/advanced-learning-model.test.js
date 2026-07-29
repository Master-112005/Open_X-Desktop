const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-advanced-learning-'));
}

describe('Advanced User Learning Model', function() {
  it('stores family contact information in the encrypted personal vault', function() {
    const { PersonalMemoryManager } = require('../../core/assistant/personal-memory');
    const dataDir = tempDir();
    const manager = new PersonalMemoryManager({
      config: { app: { dataDir } }
    });

    const result = manager.learnFromText('Ravi is my father. His phone number is 9876543210 and his Gmail is ravi@gmail.com.');
    const people = manager.listPeople({ revealSensitive: true });
    const rawVault = fs.readFileSync(path.join(dataDir, 'personal', 'personal-vault.db'), 'utf8');

    assert.equal(result.type, 'personal-memory');
    assert.deepEqual(result.safeLearningEvent.fieldsChanged.sort(), ['gmail', 'phone', 'relationship']);
    assert.equal(people.length, 1);
    assert.equal(people[0].relationships[0].relationshipType, 'father');
    assert.ok(people[0].contactMethods.some(method => method.type === 'phone' && method.value === '9876543210'));
    assert.ok(people[0].contactMethods.some(method => method.type === 'gmail' && method.value === 'ravi@gmail.com'));
    assert.doesNotMatch(rawVault, /9876543210/);
    assert.doesNotMatch(rawVault, /ravi@gmail\.com/);
  });

  it('learns favorite media preferences from external events', async function() {
    const { createDefaultLearningManager } = require('../../core/assistant/learning');
    const baseDir = tempDir();
    const manager = createDefaultLearningManager({
      configuration: {
        clock: () => '2026-07-29T12:00:00.000Z',
        storage: { baseDir }
      }
    });

    const result = await manager.learnExternalEvent({
      type: 'favorite',
      kind: 'favoriteSong',
      value: 'Dulander song',
      signal: 'explicit_favorite',
      source: 'test'
    });

    assert.ok(result.updatedPreferences.some(item => item.key === 'favoriteSong.dulander.song'));
    const profile = manager.getPersonalizationProfile();
    assert.ok(Object.values(profile.profile.preference).some(item =>
      item.key === 'favoriteSong.dulander.song' &&
      item.metadata.advancedPreference === true &&
      item.metadata.preferenceScore >= 10
    ));
  });

  it('uses circular clock statistics for routine times near midnight', async function() {
    const { createDefaultLearningManager, routines } = require('../../core/assistant/learning');
    const stats = new routines.CircularTimeStatistics().summarize([1435, 5, 10]);
    assert.ok(stats.typicalMinutes < 30 || stats.typicalMinutes > 1420);

    const baseDir = tempDir();
    const manager = createDefaultLearningManager({
      configuration: {
        clock: () => '2026-07-29T12:00:00.000Z',
        storage: { baseDir }
      }
    });
    const result = await manager.learnExternalEvent({
      type: 'routine_observation',
      routineType: 'bedtime',
      timestamp: '2026-07-29T23:55:00.000Z',
      localTimeMinutes: 1435,
      dayType: 'weekday',
      source: 'test',
      confidence: 0.9
    });

    assert.ok(result.updatedHabits.some(item => item.key === 'routine.bedtime.weekday'));
  });

  it('deduplicates raw home events and emits compact device preference learning', function() {
    const { HomeLearningManager } = require('../../core/assistant/home-learning');
    const dataDir = tempDir();
    const manager = new HomeLearningManager({
      config: { app: { dataDir } }
    });

    const first = manager.observe({
      type: 'home_device_event',
      deviceId: 'bedroom_fan_01',
      deviceName: 'Bedroom Fan',
      deviceType: 'fan',
      room: 'bedroom',
      action: 'speed',
      value: 2,
      timestamp: '2026-07-29T22:04:00.000Z'
    });
    const duplicate = manager.observe({
      type: 'home_device_event',
      deviceId: 'bedroom_fan_01',
      deviceName: 'Bedroom Fan',
      deviceType: 'fan',
      room: 'bedroom',
      action: 'speed',
      value: 2,
      timestamp: '2026-07-29T22:04:02.000Z'
    });

    assert.equal(first.accepted, true);
    assert.equal(first.duplicate, false);
    assert.ok(first.learningEvents.some(event => event.key === 'preferredFanSpeed.bedroom_2'));
    assert.equal(duplicate.duplicate, true);
    assert.ok(fs.existsSync(path.join(dataDir, 'home-learning', 'home-learning.db')));
  });

  it('learns home action sequences through the external event pipeline', async function() {
    const { createDefaultLearningManager } = require('../../core/assistant/learning');
    const baseDir = tempDir();
    const manager = createDefaultLearningManager({
      configuration: {
        clock: () => '2026-07-29T12:00:00.000Z',
        storage: { baseDir }
      }
    });

    await manager.learnExternalEvent({
      type: 'home_device_event',
      deviceId: 'bedroom_light_01',
      deviceType: 'light',
      room: 'bedroom',
      action: 'turn_on',
      timestamp: '2026-07-29T22:04:00.000Z'
    });
    const result = await manager.learnExternalEvent({
      type: 'home_device_event',
      deviceId: 'bedroom_fan_01',
      deviceType: 'fan',
      room: 'bedroom',
      action: 'speed',
      value: 2,
      timestamp: '2026-07-29T22:04:08.000Z'
    });

    assert.ok(result.updatedWorkflows.some(item => /bedroom\.light\.turn_on>bedroom\.fan\.speed_2/.test(item.key)));
    assert.ok(result.updatedPreferences.some(item => item.key === 'preferredFanSpeed.bedroom_2'));
  });
});
