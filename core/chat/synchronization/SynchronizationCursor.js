const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

/**
 * Stores durable desktop sync cursors under OpenX_Data.
 */
class SynchronizationCursor {
  /**
   * Creates cursor store.
   * @param {object} options Store options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.events = options.events;
    this.state = { version: 1, cursors: [], acknowledgementHistory: [], recoveryHistory: [], retryQueue: [], conflictLog: [], sequenceState: [], futureSnapshotPlaceholder: [] };
    this.started = false;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Initializes storage.
   */
  async initialize() {
    if (this.started) return;
    await fs.mkdir(path.dirname(this.config.storagePath), { recursive: true });
    try {
      this.state = this.normalize(JSON.parse(await fs.readFile(this.config.storagePath, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
    this.started = true;
  }

  /**
   * Normalizes loaded state.
   * @param {object} state State.
   * @returns {object} Normalized state.
   */
  normalize(state = {}) {
    return {
      version: Number(state.version || 1),
      cursors: Array.isArray(state.cursors) ? state.cursors : [],
      acknowledgementHistory: Array.isArray(state.acknowledgementHistory) ? state.acknowledgementHistory : [],
      recoveryHistory: Array.isArray(state.recoveryHistory) ? state.recoveryHistory : [],
      retryQueue: Array.isArray(state.retryQueue) ? state.retryQueue : [],
      conflictLog: Array.isArray(state.conflictLog) ? state.conflictLog : [],
      sequenceState: Array.isArray(state.sequenceState) ? state.sequenceState : [],
      futureSnapshotPlaceholder: Array.isArray(state.futureSnapshotPlaceholder) ? state.futureSnapshotPlaceholder : []
    };
  }

  /**
   * Gets or creates a cursor.
   * @param {object} input Cursor input.
   * @returns {Promise<object>} Cursor.
   */
  async getOrCreate(input = {}) {
    await this.initialize();
    const deviceId = String(input.deviceId || '').trim().toLowerCase();
    let cursor = this.state.cursors.find(item => item.deviceId === deviceId);
    if (!cursor) {
      cursor = {
        cursorId: `cur_${crypto.randomBytes(32).toString('hex')}`,
        deviceId,
        mailboxId: input.mailboxId || null,
        currentSequence: Number(input.currentSequence || 0),
        lastAck: Number(input.lastAck || 0),
        lastUpdated: new Date().toISOString(),
        status: 'Idle',
        metadata: {},
        futureCheckpoint: null
      };
      this.state.cursors.push(cursor);
      await this.persist();
    }
    return cursor;
  }

  /**
   * Updates a cursor.
   * @param {object} cursor Cursor.
   * @param {object} patch Patch.
   * @returns {Promise<object>} Updated cursor.
   */
  async update(cursor, patch = {}) {
    await this.initialize();
    const updated = {
      ...cursor,
      ...patch,
      currentSequence: Math.max(0, Number(patch.currentSequence ?? cursor.currentSequence ?? 0)),
      lastAck: Math.max(0, Number(patch.lastAck ?? cursor.lastAck ?? 0)),
      metadata: { ...(cursor.metadata || {}), ...(patch.metadata || {}) },
      lastUpdated: new Date().toISOString()
    };
    const index = this.state.cursors.findIndex(item => item.cursorId === updated.cursorId);
    if (index >= 0) this.state.cursors[index] = updated;
    else this.state.cursors.push(updated);
    await this.persist();
    this.eventBus?.emit?.(this.events.CURSOR_UPDATED, { deviceId: updated.deviceId, sequence: updated.currentSequence, status: updated.status });
    return updated;
  }

  /** @param {object} record ACK record. */
  async recordAck(record) {
    await this.initialize();
    this.state.acknowledgementHistory.push(record);
    await this.persist();
  }

  /** @param {object} record Recovery record. */
  async recordRecovery(record) {
    await this.initialize();
    this.state.recoveryHistory.push(record);
    await this.persist();
  }

  /** @param {object} record Conflict record. */
  async recordConflict(record) {
    await this.initialize();
    this.state.conflictLog.push(record);
    await this.persist();
  }

  /** @param {object} record Sequence state. */
  async recordSequenceState(record) {
    await this.initialize();
    const index = this.state.sequenceState.findIndex(item => item.deviceId === record.deviceId);
    if (index >= 0) this.state.sequenceState[index] = record;
    else this.state.sequenceState.push(record);
    await this.persist();
  }

  /**
   * Persists state atomically.
   */
  async persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const tempPath = `${this.config.storagePath}.tmp`;
      await fs.writeFile(tempPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
      await fs.rename(tempPath, this.config.storagePath);
    });
    await this.writeQueue;
  }
}

module.exports = SynchronizationCursor;
