class BackgroundTransferManager {
  constructor() {
    this.active = new Map();
  }

  track(task) {
    this.active.set(task.id, task);
  }

  untrack(taskId) {
    this.active.delete(taskId);
  }

  list() {
    return Array.from(this.active.values());
  }
}

module.exports = BackgroundTransferManager;
