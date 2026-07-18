const assert = require('assert');
const { ChatManager, Quality } = require('../../core/chat');

describe('OpenX Chat Desktop Production Readiness Phase 16', () => {
  it('exposes local production readiness managers and a release-ready report', () => {
    const chat = new ChatManager({
      fetchImpl: async () => {
        throw new Error('Production readiness managers must not call the server.');
      },
      cryptoConfig: { storageBackend: {} },
      config: {
        optimization: {
          maxReleaseLogEntries: 3,
          slowOperationMs: 5
        }
      }
    });
    const readiness = chat.getProductionReadiness();
    readiness.performance.createReport();
    readiness.crashRecovery.recordCrash({ component: 'test', reason: 'simulated' });
    const report = chat.getProductionReadinessReport();

    assert(readiness.quality instanceof Quality.QualityManager);
    assert(readiness.validator instanceof Quality.ProductionValidator);
    assert(readiness.performance instanceof Quality.PerformanceReporter);
    assert(readiness.crashRecovery instanceof Quality.CrashRecoveryManager);
    assert(readiness.releaseLogger instanceof Quality.ReleaseLogger);
    assert.equal(chat.config.featureFlags.productionReadiness, true);
    assert.equal(report.releaseReady, true);
    assert.equal(report.crashRecovery.crashCount, 1);
    assert.deepEqual(report.production.gates.filter(gate => !gate.pass), []);
  });
});
