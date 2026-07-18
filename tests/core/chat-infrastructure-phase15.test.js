const assert = require('assert');
const { ChatManager, Infrastructure } = require('../../core/chat');

describe('OpenX Chat Desktop Infrastructure Phase 15', () => {
  it('exposes local metrics, performance, connection, storage, memory, and sync optimization managers', async () => {
    const chat = new ChatManager({
      fetchImpl: async () => {
        throw new Error('Infrastructure managers must not call the server.');
      },
      cryptoConfig: { storageBackend: {} },
      config: {
        optimization: {
          slowOperationMs: 5,
          maxLocalRecords: 2,
          maxSyncBatchSize: 4
        }
      }
    });
    const infra = chat.getInfrastructureOptimization();

    infra.connection.recordConnectionResult(false);
    infra.storage.trackCollection('conversations', 3);
    const result = await infra.performance.measure('local-test', async () => 'ok');
    const batch = infra.synchronization.planBatch({ pending: 10, limit: 7 });
    const status = infra.monitoring.getStatus();
    const health = chat.getHealth();

    assert.equal(result, 'ok');
    assert.equal(batch.limit, 4);
    assert.equal(infra.connection.nextReconnectDelay(), chat.config.reconnectMinDelayMs);
    assert.equal(status.storage.cleanup[0].name, 'conversations');
    assert.equal(health.infrastructure.metrics.latency.count, 1);
    assert.equal(chat.config.featureFlags.infrastructureOptimization, true);
  });

  it('exports individual infrastructure manager classes', () => {
    const metrics = new Infrastructure.MetricsManager();
    metrics.increment('test.counter');

    assert.equal(metrics.getSnapshot().counters['test.counter'], 1);
    assert.equal(typeof Infrastructure.MonitoringManager, 'function');
  });
});
