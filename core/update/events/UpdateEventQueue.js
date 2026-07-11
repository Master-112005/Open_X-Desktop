class UpdateEventQueue {
  constructor(options = {}) {
    this.maxItems = Math.max(1, Number(options.maxItems || 25));
    this.items = [];
    this.ids = new Set();
  }

  enqueue(event) {
    const eventId = String(event?.eventId || '').trim();
    if (eventId && this.ids.has(eventId)) return { added: false, duplicate: true, event };
    this.items.unshift(event);
    if (eventId) this.ids.add(eventId);
    while (this.items.length > this.maxItems) {
      const removed = this.items.pop();
      if (removed?.eventId) this.ids.delete(removed.eventId);
    }
    return { added: true, duplicate: false, event };
  }

  has(eventId) {
    return this.ids.has(String(eventId || '').trim());
  }

  list() {
    return this.items.slice();
  }
}

module.exports = UpdateEventQueue;
