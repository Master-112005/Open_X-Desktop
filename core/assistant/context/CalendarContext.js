'use strict';

function compactText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function compactEvent(event) {
  return {
    id: event?.id || null,
    title: compactText(event?.title || event?.summary || event?.message || '', 140) || null,
    startsAt: event?.startsAt || event?.start || event?.dueAt || null,
    kind: compactText(event?.kind || event?.type || '', 40) || null
  };
}

class CalendarContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.calendar');
    this.priority = Number.isFinite(options.priority) ? options.priority : 170;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.maxEvents = Number(options.maxEvents || 8);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const calendar = context.snapshots?.calendar || {};
    const upcoming = (Array.isArray(calendar.upcoming) ? calendar.upcoming : [])
      .map(compactEvent)
      .filter(event => event.title || event.startsAt)
      .slice(0, this.maxEvents);
    const reminders = (Array.isArray(calendar.reminders) ? calendar.reminders : [])
      .map(compactEvent)
      .filter(event => event.title || event.startsAt)
      .slice(0, this.maxEvents);
    context.context.calendar = {
      today: calendar.today || new Date().toISOString().slice(0, 10),
      upcoming,
      reminders,
      activeTimerCount: Number.isFinite(Number(calendar.activeTimerCount)) ? Number(calendar.activeTimerCount) : null,
      nextEvent: upcoming[0] || reminders[0] || null,
      state: upcoming.length || reminders.length ? 'scheduled' : 'empty'
    };
    return context;
  }
}

module.exports = CalendarContext;
