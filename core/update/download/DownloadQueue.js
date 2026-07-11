class DownloadQueue {
  constructor() {
    this.items = [];
  }

  enqueue(task) {
    if (!this.items.includes(task)) this.items.push(task);
    return task;
  }

  dequeue() {
    return this.items.shift() || null;
  }

  remove(taskId) {
    const before = this.items.length;
    this.items = this.items.filter(task => task.id !== taskId);
    return before !== this.items.length;
  }

  list() {
    return this.items.slice();
  }
}

module.exports = DownloadQueue;
