class DownloadSession {
  constructor(task) {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.taskId = task.id;
    this.startTime = new Date().toISOString();
    this.endTime = null;
  }

  finish() {
    this.endTime = new Date().toISOString();
  }

  snapshot(task) {
    return Object.freeze({
      sessionId: this.sessionId,
      taskId: this.taskId,
      startTime: this.startTime,
      endTime: this.endTime,
      currentBytes: task.currentBytes,
      totalBytes: task.totalBytes,
      averageSpeed: task.statistics.averageSpeed,
      currentSpeed: task.statistics.currentSpeed,
      etaMs: task.statistics.etaMs,
      retryCount: task.retryCount,
      resumeCount: task.resumeCount,
      failureReason: task.failureReason,
      futureChecksum: task.futureChecksum
    });
  }
}

module.exports = DownloadSession;
