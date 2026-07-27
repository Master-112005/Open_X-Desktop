const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  Logger,
  IdGenerator,
  EVENTS,
  buildDataPaths,
  readJsonFile,
  writeJsonAtomic,
  migrateJsonArrayFile
} = require('../assistant/Data');

const PRODUCT_NAME = 'OpenX';
const MAX_SCHEDULES = 160;
const MAX_ACTIVE_SCHEDULES = 120;
const MAX_TIMEOUT_MS = 2147483647;
const MAX_MESSAGE_LENGTH = 500;
const MAX_TITLE_LENGTH = 160;
const MAX_CATEGORY_LENGTH = 60;
const VALID_STATUSES = new Set(['scheduled', 'paused', 'due', 'completed', 'dismissed', 'running']);
const VALID_KINDS = new Set(['Timer', 'Alarm', 'Reminder', 'Stopwatch']);
const SCHEDULED_ACTION_IDS = new Set([
  'app.open',
  'app.close',
  'browser.open',
  'browser.openTab',
  'browser.closeTab',
  'file.open',
  'folder.open',
  'media.play',
  'media.pause',
  'media.resume',
  'media.stop'
]);
const SCHEDULED_ACTION_BROWSER_NAMES = new Set(['browser', 'chrome', 'edge', 'firefox']);

const REMINDER_PRESENTATIONS = Object.freeze({
  education: { symbol: '\u{1F393}', label: 'School & college' },
  water: { symbol: '\u{1F4A7}', label: 'Water' },
  exercise: { symbol: '\u{1F3C3}', label: 'Exercise' },
  health: { symbol: '\u{1F48A}', label: 'Health' },
  work: { symbol: '\u{1F4BC}', label: 'Work' },
  birthday: { symbol: '\u{1F382}', label: 'Birthday' },
  general: { symbol: '\u{1F4DD}', label: 'Reminder' }
});

const MONTH_INDEX = Object.freeze({
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
});

const WEEKDAY_INDEX = Object.freeze({
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
});

function inferReminderCategory(message, preferredCategory = '') {
  const preferred = String(preferredCategory || '').trim().toLowerCase();
  if (REMINDER_PRESENTATIONS[preferred]) return preferred;
  const text = String(message || '').toLowerCase();
  if (/\b(?:college|collage|school|class|lecture|campus|study|exam|assignment|homework|tuition)\b/.test(text)) return 'education';
  if (/\b(?:water|hydrate|hydration|drink)\b/.test(text)) return 'water';
  if (/\b(?:exercise|workout|gym|walk|run|running|yoga|stretch|fitness)\b/.test(text)) return 'exercise';
  if (/\b(?:medicine|medication|tablet|pill|doctor|appointment|health)\b/.test(text)) return 'health';
  if (/\b(?:work|office|meeting|project|deadline|client|email)\b/.test(text)) return 'work';
  if (/\b(?:birthday|anniversary|celebrate|party)\b/.test(text)) return 'birthday';
  return 'general';
}

function sanitizeText(value, maxLength = MAX_MESSAGE_LENGTH) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeScheduleKind(value, fallback = 'Reminder') {
  const key = String(value || fallback || '').trim().toLowerCase();
  if (key === 'timer') return 'Timer';
  if (key === 'alarm') return 'Alarm';
  if (key === 'reminder') return 'Reminder';
  if (key === 'stopwatch') return 'Stopwatch';
  return VALID_KINDS.has(fallback) ? fallback : 'Reminder';
}

function normalizeScheduleStatus(value, fallback = 'scheduled') {
  const status = String(value || fallback || '').trim().toLowerCase();
  return VALID_STATUSES.has(status) ? status : fallback;
}

function scheduleIdentity(item = {}) {
  const due = Number.isFinite(Date.parse(item.dueAt)) ? new Date(item.dueAt).toISOString().slice(0, 16) : '';
  return [
    item.kind || '',
    sanitizeText(item.message || item.title || '', MAX_MESSAGE_LENGTH).toLowerCase(),
    due,
    item.recurrence || ''
  ].join('|');
}

function scheduleVerification(status, check, detail = {}) {
  return { status, check, ...detail };
}

function normalizeScheduledAction(action = {}) {
  if (!action || typeof action !== 'object') return null;
  const actionId = sanitizeText(action.actionId || action.intent || action.id, 80);
  if (!SCHEDULED_ACTION_IDS.has(actionId)) return null;
  const entities = action.entities && typeof action.entities === 'object' ? action.entities : {};

  if (actionId === 'app.open' || actionId === 'app.close') {
    const appName = sanitizeText(entities.appName, 120);
    if (!appName) return null;
    return {
      actionId,
      entities: {
        appName,
        ...(entities.forceNewWindow === true ? { forceNewWindow: true } : {}),
        ...(entities.requestedOperation ? { requestedOperation: sanitizeText(entities.requestedOperation, 60) } : {}),
        ...(entities.allowWebSearchFallback === true ? { allowWebSearchFallback: true } : {}),
        ...(entities.webFallbackUrl ? { webFallbackUrl: sanitizeText(entities.webFallbackUrl, 240) } : {}),
        ...(entities.webFallbackBrowser ? { webFallbackBrowser: sanitizeText(entities.webFallbackBrowser, 40).toLowerCase() } : {})
      }
    };
  }

  if (actionId === 'browser.closeTab') {
    const requestedBrowser = sanitizeText(entities.browserName || 'browser', 40).toLowerCase();
    const browserName = SCHEDULED_ACTION_BROWSER_NAMES.has(requestedBrowser) ? requestedBrowser : 'browser';
    const tabQuery = sanitizeText(entities.tabQuery, 120);
    return {
      actionId,
      entities: {
        browserName,
        ...(tabQuery ? { tabQuery } : {})
      }
    };
  }

  if (actionId === 'browser.open') {
    const url = sanitizeText(entities.url, 240);
    if (!url) return null;
    return {
      actionId,
      entities: {
        url,
        ...(entities.browserName ? { browserName: sanitizeText(entities.browserName, 40).toLowerCase() } : {}),
        ...(entities.newTab === true ? { newTab: true } : {})
      }
    };
  }

  if (actionId === 'browser.openTab') {
    const tabQuery = sanitizeText(entities.tabQuery, 120);
    if (!tabQuery) return null;
    return {
      actionId,
      entities: {
        tabQuery,
        browserName: sanitizeText(entities.browserName || 'browser', 40).toLowerCase(),
        ...(entities.forceNewTab === true ? { forceNewTab: true } : {})
      }
    };
  }

  if (actionId === 'file.open') {
    const filename = sanitizeText(entities.filename || entities.path, 240);
    if (!filename) return null;
    return {
      actionId,
      entities: {
        filename,
        ...(entities.path ? { path: sanitizeText(entities.path, 260) } : {})
      }
    };
  }

  if (actionId === 'folder.open') {
    const folderName = sanitizeText(entities.folderName || entities.path, 240);
    if (!folderName) return null;
    return {
      actionId,
      entities: {
        folderName,
        ...(entities.path ? { path: sanitizeText(entities.path, 260) } : {})
      }
    };
  }

  if (actionId === 'media.play') {
    const mediaQuery = sanitizeText(entities.mediaQuery || entities.query, 180);
    if (!mediaQuery) return null;
    return {
      actionId,
      entities: {
        mediaQuery,
        mediaPlatform: sanitizeText(entities.mediaPlatform || entities.platform || 'youtube', 40).toLowerCase()
      }
    };
  }

  if (['media.pause', 'media.resume', 'media.stop'].includes(actionId)) {
    return {
      actionId,
      entities: {}
    };
  }

  return null;
}

class SchedulerController {
  constructor(config) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.eventBus = config?.eventBus || null;
    this.actionExecutor = typeof config?.scheduledActionExecutor === 'function'
      ? config.scheduledActionExecutor
      : null;
    const dataPaths = config?.app?.dataPaths || buildDataPaths(config);
    this.schedulePath = config?.app?.schedulesPath || dataPaths.schedulesPath;
    this._migrateWorkingDirectorySchedules(config);
    this._loadedSchedulesChanged = false;
    this.scheduledItems = this._loadScheduledItems();
    this.timers = new Map();
    this._cleanupLegacyWindowsTasks(config);
    if (this._loadedSchedulesChanged) {
      this._saveScheduledItems();
    }
    this.scheduledItems.filter(item => item.status === 'scheduled').forEach(item => this._arm(item));
  }

  setActionExecutor(executor) {
    this.actionExecutor = typeof executor === 'function' ? executor : null;
  }

  setTimer(durationMinutes) {
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return this._failure('Invalid timer duration', 'Timer', 'schedule-input');
    }

    const dueAt = new Date(Date.now() + (minutes * 60 * 1000));
    return this._scheduleNotification({
      kind: 'Timer',
      title: `${PRODUCT_NAME} Timer`,
      message: `Your ${minutes} minute timer is done.`,
      dueAt,
      category: 'timer',
      symbol: '\u23F1\uFE0F',
      metadata: {
        durationMinutes: minutes,
        durationMs: minutes * 60 * 1000
      }
    });
  }

  startStopwatch() {
    const existing = this._latestSchedule('Stopwatch', ['running', 'paused']);
    if (existing) {
      return { success: true, data: this._stopwatchData(existing) };
    }

    const taskName = this._scheduleTaskName('Stopwatch');
    const now = new Date().toISOString();
    const item = {
      id: taskName,
      taskName,
      kind: 'Stopwatch',
      title: `${PRODUCT_NAME} Stopwatch`,
      message: 'Stopwatch is running.',
      category: 'stopwatch',
      symbol: '\u23F1\uFE0F',
      status: 'running',
      startedAt: now,
      elapsedMs: 0,
      createdAt: now
    };
    this.scheduledItems.push(item);
    this._saveScheduledItems();
    return { success: true, data: this._stopwatchData(item) };
  }

  pauseStopwatch() {
    const item = this._latestSchedule('Stopwatch', ['running']);
    if (!item) return { success: false, error: 'No running stopwatch found' };
    item.elapsedMs = this._stopwatchElapsedMs(item);
    item.status = 'paused';
    delete item.startedAt;
    this._saveScheduledItems();
    return { success: true, data: this._stopwatchData(item) };
  }

  resumeStopwatch() {
    const item = this._latestSchedule('Stopwatch', ['paused']);
    if (!item) return { success: false, error: 'No paused stopwatch found' };
    item.startedAt = new Date().toISOString();
    item.status = 'running';
    this._saveScheduledItems();
    return { success: true, data: this._stopwatchData(item) };
  }

  resetStopwatch() {
    const item = this._latestSchedule('Stopwatch', ['running', 'paused']);
    if (!item) return this.startStopwatch();
    const wasRunning = item.status === 'running';
    item.elapsedMs = 0;
    if (wasRunning) {
      item.startedAt = new Date().toISOString();
      item.status = 'running';
    } else {
      item.status = 'paused';
      delete item.startedAt;
    }
    this._saveScheduledItems();
    return { success: true, data: this._stopwatchData(item) };
  }

  stopStopwatch() {
    const item = this._latestSchedule('Stopwatch', ['running', 'paused']);
    if (!item) return { success: false, error: 'No active stopwatch found' };
    item.elapsedMs = this._stopwatchElapsedMs(item);
    item.status = 'completed';
    delete item.startedAt;
    this._saveScheduledItems();
    return { success: true, data: this._stopwatchData(item) };
  }

  getStopwatchElapsed() {
    const item = this._latestSchedule('Stopwatch', ['running', 'paused']);
    if (!item) return { success: false, error: 'No active stopwatch found' };
    return { success: true, data: this._stopwatchData(item) };
  }

  setAlarm(timeExpression, alarmLabel = '', options = {}) {
    let dueAt = this._parseTimeExpression(timeExpression);
    if (!dueAt) {
      return this._failure('Invalid alarm time', 'Alarm', 'schedule-time');
    }

    const label = sanitizeText(alarmLabel, MAX_TITLE_LENGTH);
    const recurrence = this._normalizeRecurrence(options.recurrence);
    if (recurrence) {
      dueAt = this._alignRecurringDueDate(recurrence, dueAt);
    }
    return this._scheduleNotification({
      kind: 'Alarm',
      title: label ? `${PRODUCT_NAME} Alarm: ${label}` : `${PRODUCT_NAME} Alarm`,
      message: label || `Alarm for ${timeExpression} is ringing.`,
      dueAt,
      category: 'alarm',
      symbol: '\u23F0',
      metadata: {
        ...(label ? { alarmLabel: label } : {}),
        ...(recurrence ? { recurrence } : {})
      }
    });
  }

  setReminder(reminderText, options = {}) {
    const message = sanitizeText(reminderText, MAX_MESSAGE_LENGTH);
    if (!message) {
      return this._failure('Reminder text is required', 'Reminder', 'schedule-input');
    }

    let dueAt = null;
    if (options.duration && options.duration > 0) {
      dueAt = new Date(Date.now() + (options.duration * 60 * 1000));
    } else if (options.timeExpression) {
      dueAt = this._parseTimeExpression(options.timeExpression);
      if (dueAt && options.recurrence) {
        dueAt = this._alignRecurringDueDate(this._normalizeRecurrence(options.recurrence), dueAt);
      }
    } else if (options.recurrence) {
      dueAt = this._nextRecurringDate(this._normalizeRecurrence(options.recurrence), new Date());
    }

    if (!dueAt) {
      return this._failure('Invalid reminder time', 'Reminder', 'schedule-time');
    }

    const category = inferReminderCategory(message, options.category);
    const presentation = REMINDER_PRESENTATIONS[category];
    const scheduledAction = normalizeScheduledAction(options.scheduledAction);
    return this._scheduleNotification({
      kind: 'Reminder',
      title: this._reminderTitle(presentation),
      message,
      dueAt,
      category,
      symbol: presentation.symbol,
      metadata: {
        ...(options.recurrence ? { recurrence: this._normalizeRecurrence(options.recurrence) } : {}),
        ...(scheduledAction ? { scheduledAction } : {})
      }
    });
  }

  _parseTimeExpression(input) {
    const value = this._normalizeSpokenTime(String(input || ''))
      .trim()
      .toLowerCase()
      .replace(/^on\s+/, '')
      .replace(/\s+/g, ' ');
    if (!value) return null;

    const durationMatch = value.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\s*five)?|sixty)\s*(seconds?|secs?|minutes?|mins?|minits?|hours?|hrs?)/i);
    if (durationMatch) {
      const durationWords = {
        one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
        ten: 10, fifteen: 15, twenty: 20, thirty: 30, fortyfive: 45, sixty: 60
      };
      const amountText = durationMatch[1].toLowerCase().replace(/\s+/g, '');
      const amount = /^\d+$/.test(amountText) ? parseInt(amountText, 10) : durationWords[amountText];
      if (!amount) return null;
      const unit = durationMatch[2].toLowerCase();
      let minutes = amount;
      if (unit.startsWith('hour') || unit.startsWith('hr')) {
        minutes = amount * 60;
      } else if (unit.startsWith('second') || unit.startsWith('sec')) {
        minutes = Math.max(1, Math.ceil(amount / 60));
      }

      return new Date(Date.now() + (minutes * 60 * 1000));
    }

    const calendarDate = this._parseCalendarDateExpression(value);
    if (calendarDate) {
      return calendarDate;
    }

    const morningEveningNightMatch = value.match(/^(in\s+(?:the\s+)?)?(morning|afternoon|evening|night)(?:\s+at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?$/i);
    if (morningEveningNightMatch) {
      const period = morningEveningNightMatch[2].toLowerCase();
      const timePart = morningEveningNightMatch[3] || '';
      const dueAt = new Date();
      dueAt.setSeconds(0, 0);

      if (period === 'morning') {
        dueAt.setHours(timePart ? this._parseClockParts(timePart)?.hours || 9 : 9, timePart ? this._parseClockParts(timePart)?.minutes || 0 : 0, 0, 0);
      } else if (period === 'afternoon') {
        dueAt.setHours(timePart ? this._parseClockParts(timePart)?.hours || 15 : 15, timePart ? this._parseClockParts(timePart)?.minutes || 0 : 0, 0, 0);
      } else if (period === 'evening') {
        dueAt.setHours(timePart ? this._parseClockParts(timePart)?.hours || 18 : 18, timePart ? this._parseClockParts(timePart)?.minutes || 0 : 0, 0, 0);
      } else if (period === 'night') {
        dueAt.setHours(timePart ? this._parseClockParts(timePart)?.hours || 21 : 21, timePart ? this._parseClockParts(timePart)?.minutes || 0 : 0, 0, 0);
      }

      if (dueAt.getTime() <= Date.now()) {
        dueAt.setDate(dueAt.getDate() + 1);
      }
      return dueAt;
    }

    const relativeDayMatch = value.match(/^(today|tomorrow|tonight)$/i);
    if (relativeDayMatch) {
      const dueAt = new Date();
      dueAt.setSeconds(0, 0);
      dueAt.setHours(relativeDayMatch[1] === 'tonight' ? 20 : 9, 0, 0, 0);
      if (relativeDayMatch[1] === 'tomorrow' || dueAt.getTime() <= Date.now()) {
        dueAt.setDate(dueAt.getDate() + 1);
      }
      return dueAt;
    }

    const tomorrowPeriodMatch = value.match(/^tomorrow\s+(?:in\s+the\s+)?(morning|afternoon|evening|night)$/i);
    if (tomorrowPeriodMatch) {
      const hours = { morning: 9, afternoon: 15, evening: 18, night: 21 };
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 1);
      dueAt.setHours(hours[tomorrowPeriodMatch[1].toLowerCase()], 0, 0, 0);
      return dueAt;
    }

    if (/^next\s+week$/i.test(value)) {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 7);
      dueAt.setHours(9, 0, 0, 0);
      return dueAt;
    }

    const monthDayMatch = value.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(this|next)\s+month|\s+(this|next)\s+month)(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?$/i);
    if (monthDayMatch) {
      const day = parseInt(monthDayMatch[1], 10);
      if (day < 1 || day > 31) return null;
      const monthDirective = String(monthDayMatch[2] || monthDayMatch[3] || 'this').toLowerCase();
      const timeParts = this._parseClockParts(monthDayMatch[4] || '9 am');
      if (!timeParts) return null;

      const now = new Date();
      const dueAt = new Date(now);
      dueAt.setSeconds(0, 0);
      dueAt.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      if (monthDirective === 'next') {
        dueAt.setMonth(dueAt.getMonth() + 1, 1);
      }
      const targetMonth = dueAt.getMonth();
      dueAt.setDate(day);
      if (dueAt.getMonth() !== targetMonth) return null;
      if (dueAt.getTime() <= Date.now()) {
        dueAt.setMonth(dueAt.getMonth() + (monthDirective === 'next' ? 1 : 1), 1);
        const fallbackMonth = dueAt.getMonth();
        dueAt.setDate(day);
        if (dueAt.getMonth() !== fallbackMonth) return null;
      }
      return dueAt;
    }

    const tomorrowMatch = value.match(/^(tomorrow)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?$/i);
    if (tomorrowMatch) {
      const dueAt = new Date();
      dueAt.setSeconds(0, 0);
      dueAt.setDate(dueAt.getDate() + 1);
      if (tomorrowMatch[2]) {
        const timeParts = this._parseClockParts(tomorrowMatch[2]);
        if (timeParts) {
          dueAt.setHours(timeParts.hours, timeParts.minutes, 0, 0);
        } else {
          dueAt.setHours(9, 0, 0, 0);
        }
      } else {
        dueAt.setHours(9, 0, 0, 0);
      }
      return dueAt;
    }

    const timeThenTomorrowMatch = value.match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(tomorrow)$/i);
    if (timeThenTomorrowMatch) {
      const dueAt = new Date();
      dueAt.setSeconds(0, 0);
      const timeParts = this._parseClockParts(timeThenTomorrowMatch[1]);
      if (timeParts) {
        dueAt.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      } else {
        dueAt.setHours(9, 0, 0, 0);
      }
      dueAt.setDate(dueAt.getDate() + 1);
      if (dueAt.getTime() <= Date.now()) {
        dueAt.setDate(dueAt.getDate() + 1);
      }
      return dueAt;
    }

    const timeWithTodayMatch = value.match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+today$/i);
    if (timeWithTodayMatch) {
      const timeParts = this._parseClockParts(timeWithTodayMatch[1]);
      if (!timeParts) {
        return null;
      }
      const dueAt = new Date();
      dueAt.setSeconds(0, 0);
      dueAt.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      if (dueAt.getTime() <= Date.now()) {
        dueAt.setDate(dueAt.getDate() + 1);
      }
      return dueAt;
    }

    const todayWithTimeMatch = value.match(/^today\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i);
    if (todayWithTimeMatch) {
      const timeParts = this._parseClockParts(todayWithTimeMatch[1]);
      if (!timeParts) {
        return null;
      }
      const dueAt = new Date();
      dueAt.setSeconds(0, 0);
      dueAt.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      if (dueAt.getTime() <= Date.now()) {
        dueAt.setDate(dueAt.getDate() + 1);
      }
      return dueAt;
    }

    const simpleAtTimeMatch = value.match(/^at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i);
    if (simpleAtTimeMatch && simpleAtTimeMatch[1]) {
      const parsed = this._parseClockParts(simpleAtTimeMatch[1]);
      if (parsed) {
        const dueAt = new Date();
        dueAt.setSeconds(0, 0);
        dueAt.setHours(parsed.hours, parsed.minutes, 0, 0);
        if (dueAt.getTime() <= Date.now()) {
          dueAt.setDate(dueAt.getDate() + 1);
        }
        return dueAt;
      }
    }

    const weekdayMatch = value.match(/^(?:(next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?$/i);
    if (weekdayMatch) {
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = weekdays.indexOf(weekdayMatch[2].toLowerCase());
      const dueAt = new Date();
      dueAt.setSeconds(0, 0);
      const timeParts = this._parseClockParts(weekdayMatch[3] || '9 am');
      if (!timeParts) {
        return null;
      }
      dueAt.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      let daysUntil = (targetDay - dueAt.getDay() + 7) % 7;
      if (daysUntil === 0 || weekdayMatch[1]) {
        daysUntil = daysUntil === 0 ? 7 : daysUntil;
      }
      dueAt.setDate(dueAt.getDate() + daysUntil);
      return dueAt;
    }

    const match = value.match(/^(tomorrow\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) {
      return null;
    }

    const isTomorrow = Boolean(match[1]);
    const parsedClock = this._parseClockParts(`${match[2]}${match[3] ? `:${match[3]}` : ''}${match[4] || ''}`);
    if (!parsedClock) {
      return null;
    }

    const dueAt = new Date();
    dueAt.setSeconds(0, 0);
    dueAt.setHours(parsedClock.hours, parsedClock.minutes, 0, 0);

    if (isTomorrow || dueAt.getTime() <= Date.now()) {
      dueAt.setDate(dueAt.getDate() + 1);
    }

    return dueAt;
  }

  _parseCalendarDateExpression(value) {
    let dateText = String(value || '').trim().replace(/,/g, '').replace(/\s+/g, ' ');
    if (!dateText) return null;

    let timeText = '9 am';
    const timeMatch = dateText.match(/\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i) ||
      dateText.match(/\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i);
    if (timeMatch?.[1]) {
      timeText = timeMatch[1];
      dateText = dateText.slice(0, timeMatch.index).trim();
    }
    const timeParts = this._parseClockParts(timeText);
    if (!timeParts) return null;

    const numericDateMatch = dateText.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
    if (numericDateMatch) {
      const now = new Date();
      const year = numericDateMatch[3]
        ? this._normalizeYear(numericDateMatch[3])
        : now.getFullYear();
      const day = parseInt(numericDateMatch[1], 10);
      const month = parseInt(numericDateMatch[2], 10) - 1;
      return this._buildCalendarDate(year, month, day, timeParts, !numericDateMatch[3]);
    }

    const relativeMonthMatch = dateText.match(/^(?:(this|next)\s+month\s+(\d{1,2})(?:st|nd|rd|th)?|(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(this|next)\s+month|\s+(this|next)\s+month))$/i);
    if (relativeMonthMatch) {
      const now = new Date();
      const directive = String(relativeMonthMatch[1] || relativeMonthMatch[4] || relativeMonthMatch[5] || 'this').toLowerCase();
      const day = parseInt(relativeMonthMatch[2] || relativeMonthMatch[3], 10);
      const month = now.getMonth() + (directive === 'next' ? 1 : 0);
      return this._buildCalendarDate(now.getFullYear(), month, day, timeParts, true, 'month');
    }

    const monthName = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
    const monthFirst = dateText.match(new RegExp(`^${monthName}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(?:of\\s+)?(this|next)\\s+year|\\s+(\\d{2,4}))?$`, 'i'));
    const dayFirst = dateText.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthName}(?:\\s+(?:of\\s+)?(this|next)\\s+year|\\s+(\\d{2,4}))?$`, 'i'));
    const named = monthFirst
      ? { monthName: monthFirst[1], day: monthFirst[2], yearDirective: monthFirst[3], year: monthFirst[4] }
      : dayFirst
      ? { monthName: dayFirst[2], day: dayFirst[1], yearDirective: dayFirst[3], year: dayFirst[4] }
      : null;
    if (named) {
      const now = new Date();
      const month = MONTH_INDEX[String(named.monthName).toLowerCase()];
      if (!Number.isInteger(month)) return null;
      const explicitYear = named.year ? this._normalizeYear(named.year) : null;
      const directive = String(named.yearDirective || '').toLowerCase();
      const year = explicitYear || now.getFullYear() + (directive === 'next' ? 1 : 0);
      return this._buildCalendarDate(year, month, parseInt(named.day, 10), timeParts, !explicitYear && directive !== 'this');
    }

    return null;
  }

  _normalizeYear(value) {
    const year = parseInt(value, 10);
    return year < 100 ? 2000 + year : year;
  }

  _buildCalendarDate(year, month, day, timeParts, rollForward = false, rollUnit = 'year') {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || day < 1 || day > 31) {
      return null;
    }
    const target = new Date();
    target.setFullYear(year, month, 1);
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    const dueAt = new Date();
    dueAt.setSeconds(0, 0);
    dueAt.setFullYear(year, month, day);
    dueAt.setHours(timeParts.hours, timeParts.minutes, 0, 0);
    if (dueAt.getFullYear() !== targetYear || dueAt.getMonth() !== targetMonth || dueAt.getDate() !== day) {
      return null;
    }
    if (rollForward && dueAt.getTime() <= Date.now()) {
      if (rollUnit === 'month') {
        dueAt.setMonth(dueAt.getMonth() + 1, 1);
        const targetMonth = dueAt.getMonth();
        dueAt.setDate(day);
        if (dueAt.getMonth() !== targetMonth) return null;
      } else {
        dueAt.setFullYear(dueAt.getFullYear() + 1);
      }
    }
    return dueAt.getTime() > Date.now() ? dueAt : null;
  }

  _normalizeSpokenTime(input) {
    const numbers = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
      seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12
    };
    let value = String(input || '').trim().toLowerCase();
    value = value.replace(/\bnoon\b/g, '12 pm').replace(/\bmidnight\b/g, '12 am');
    value = value.replace(/\bhalf\s+past\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
      (_, hour) => `${numbers[hour]}:30`);
    value = value.replace(/\bquarter\s+past\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
      (_, hour) => `${numbers[hour]}:15`);
    value = value.replace(/\bquarter\s+to\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
      (_, hour) => `${numbers[hour] === 1 ? 12 : numbers[hour] - 1}:45`);
    value = value.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?=\s*(?:am|pm|today|tomorrow|$))/g,
      (_, hour) => String(numbers[hour]));
    value = value.replace(/\b(\d{1,2})\s+(\d{2})\s*(am|pm)\b/g, '$1:$2 $3');
    return value.replace(/\bo['’]?clock\b/g, '').replace(/\s+/g, ' ').trim();
  }

  _parseClockParts(value) {
    const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) {
      return null;
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2] || '0', 10);
    const meridiem = match[3] ? match[3].toLowerCase() : null;

    if (meridiem) {
      if (hours === 12) {
        hours = meridiem === 'am' ? 0 : 12;
      } else if (meridiem === 'pm') {
        hours += 12;
      }
    }

    if (hours > 23 || minutes > 59) {
      return null;
    }

    return { hours, minutes };
  }

  _scheduleNotification({ kind, title, message, dueAt, category = null, symbol = null, metadata = {} }) {
    try {
      const normalizedKind = normalizeScheduleKind(kind);
      const targetDate = dueAt instanceof Date ? dueAt : new Date(dueAt);
      if (!Number.isFinite(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
        return this._failure(`Invalid ${normalizedKind.toLowerCase()} time`, normalizedKind, 'schedule-time');
      }
      const cleanTitle = sanitizeText(title || `${PRODUCT_NAME} ${normalizedKind}`, MAX_TITLE_LENGTH);
      const cleanMessage = sanitizeText(message || cleanTitle, MAX_MESSAGE_LENGTH);
      if (!cleanMessage) {
        return this._failure(`${normalizedKind} text is required`, normalizedKind, 'schedule-input');
      }

      const safeMetadata = { ...metadata };
      const scheduledAction = normalizeScheduledAction(safeMetadata.scheduledAction);
      if (scheduledAction) {
        safeMetadata.scheduledAction = scheduledAction;
      } else {
        delete safeMetadata.scheduledAction;
      }

      const taskName = this._scheduleTaskName(normalizedKind);
      const item = {
        id: taskName,
        taskName,
        kind: normalizedKind,
        title: cleanTitle,
        message: cleanMessage,
        category: sanitizeText(category || normalizedKind.toLowerCase(), MAX_CATEGORY_LENGTH),
        symbol: sanitizeText(symbol, 8) || null,
        ...safeMetadata,
        recurrence: this._normalizeRecurrence(safeMetadata.recurrence),
        dueAt: targetDate.toISOString(),
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };

      const duplicateIndex = normalizedKind !== 'Timer'
        ? this.scheduledItems.findIndex(existing =>
            ['scheduled', 'paused', 'due'].includes(existing.status) &&
            scheduleIdentity(existing) === scheduleIdentity(item))
        : -1;

      let savedItem = item;
      const duplicate = duplicateIndex >= 0;
      if (duplicate) {
        const existing = this.scheduledItems[duplicateIndex];
        const timer = this.timers.get(existing.id);
        if (timer) clearTimeout(timer);
        this.timers.delete(existing.id);
        savedItem = {
          ...existing,
          ...item,
          id: existing.id,
          taskName: existing.taskName,
          createdAt: existing.createdAt || item.createdAt,
          updatedAt: new Date().toISOString()
        };
        this.scheduledItems[duplicateIndex] = savedItem;
      } else {
        this.scheduledItems.push(item);
      }
      this._saveScheduledItems();
      this._arm(savedItem);

      return {
        success: true,
        data: {
          ...this._publicScheduleData(savedItem),
          operation: duplicate ? 'update' : 'schedule',
          duplicate,
          verified: this._hasSchedule(savedItem.id),
          verification: scheduleVerification(
            this._hasSchedule(savedItem.id) ? 'passed' : 'failed',
            'schedule-persisted',
            { id: savedItem.id, kind: savedItem.kind, dueAt: savedItem.dueAt }
          ),
          responseVariantSeed: `schedule:${savedItem.kind}:${savedItem.dueAt}:${savedItem.message}:${duplicate ? 'updated' : 'created'}`
        }
      };
    } catch (err) {
      this.logger.error(`Failed to schedule ${String(kind || 'schedule').toLowerCase()}`, err);
      return this._failure(`Could not schedule ${String(kind || 'schedule').toLowerCase()}`, kind, 'schedule-exception');
    }
  }

  _publicScheduleData(item = {}) {
    return {
      taskName: item.taskName,
      dueAt: item.dueAt,
      kind: item.kind,
      title: item.title,
      message: item.message,
      category: item.category,
      symbol: item.symbol,
      id: item.id,
      status: item.status,
      durationMinutes: item.durationMinutes,
      durationMs: item.durationMs,
      alarmLabel: item.alarmLabel,
      recurrence: item.recurrence || null,
      remainingMs: item.remainingMs,
      source: item.source || null,
      sourceDeviceId: item.sourceDeviceId || null,
      scheduledAction: normalizeScheduledAction(item.scheduledAction)
    };
  }

  _failure(error, kind = 'Schedule', check = 'schedule-result') {
    const normalizedKind = normalizeScheduleKind(kind, 'Reminder');
    return {
      success: false,
      error,
      data: {
        kind: normalizedKind,
        operation: 'schedule',
        verified: false,
        verification: scheduleVerification('failed', check, { message: error })
      }
    };
  }

  _hasSchedule(id) {
    const target = String(id || '').trim();
    if (!target) return false;
    return this._loadScheduledItems().some(item => item.id === target || item.taskName === target);
  }

  _stateResult(item, operation, check = 'schedule-state') {
    const data = {
      ...this._publicScheduleData(item),
      operation,
      verified: Boolean(item?.id),
      verification: scheduleVerification(
        item?.id ? 'passed' : 'failed',
        check,
        { id: item?.id, kind: item?.kind, status: item?.status, dueAt: item?.dueAt }
      ),
      responseVariantSeed: `schedule:${operation}:${item?.kind || 'Schedule'}:${item?.status || ''}:${item?.dueAt || ''}`
    };
    return { success: Boolean(item?.id), data, ...(item?.id ? {} : { error: 'Schedule state not available' }) };
  }

  _loadScheduledItems() {
    const parsed = readJsonFile(this.schedulePath, [], {
      createIfMissing: false,
      validate: value => Array.isArray(value)
    });
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => {
      const normalized = this._normalizeStoredSchedule(item);
      if (normalized && JSON.stringify(normalized) !== JSON.stringify(item)) {
        this._loadedSchedulesChanged = true;
      }
      return normalized;
    }).filter(Boolean);
  }

  _migrateWorkingDirectorySchedules(config) {
    const shouldMigrate = config?.app?.migrateCwdSchedules === true || !config?.app?.dataDir;
    if (!shouldMigrate) return;

    const sourcePath = path.resolve(process.cwd(), 'schedules.json');
    const targetPath = path.resolve(this.schedulePath);
    if (sourcePath === targetPath || !fs.existsSync(sourcePath)) return;

    try {
      migrateJsonArrayFile(sourcePath, targetPath, {
        limit: 100,
        normalizeItem: item => this._normalizeStoredSchedule(item)
      });
    } catch (error) {
      this.logger.warn('Could not migrate working-directory schedules', error.message);
    }
  }

  _cleanupLegacyWindowsTasks(config) {
    if (process.platform !== 'win32' || !config?.app?.dataDir || config.app.cleanupLegacySchedules === false) return;
    const script = "$patterns=@('JARVIS_*','OpenX_*'); foreach($pattern in $patterns){ Get-ScheduledTask -TaskName $pattern -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false }";
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: 'ignore',
      detached: true,
      windowsHide: true
    });
    child.once('error', error => this.logger.warn('Could not clean up legacy schedules', error.message));
    child.unref();
  }

  _saveScheduledItems() {
    this.scheduledItems = this._compactSchedules(this.scheduledItems);
    writeJsonAtomic(this.schedulePath, this.scheduledItems, { backup: true });
    if (typeof this.eventBus?.subscribe === 'function') {
      this.eventBus.publish?.(EVENTS.SCHEDULE_CHANGED, this.getScheduleSnapshot());
    }
  }

  _compactSchedules(items = []) {
    const seenById = new Map();
    for (const raw of items) {
      const item = this._normalizeStoredSchedule(raw);
      if (!item) continue;
      seenById.set(item.id, item);
    }

    const normalized = Array.from(seenById.values());
    const active = normalized.filter(item => ['scheduled', 'paused', 'due', 'running'].includes(item.status));
    const inactive = normalized
      .filter(item => !active.includes(item))
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));
    return [
      ...active.slice(-MAX_ACTIVE_SCHEDULES),
      ...inactive.slice(0, Math.max(0, MAX_SCHEDULES - Math.min(active.length, MAX_ACTIVE_SCHEDULES)))
    ];
  }

  _scheduleTaskName(kind) {
    return `${PRODUCT_NAME}_${kind}_${IdGenerator.short()}`;
  }

  _reminderTitle(presentation = {}) {
    const label = String(presentation.label || '').trim();
    return !label || /^reminder$/i.test(label)
      ? `${PRODUCT_NAME} Reminder`
      : `${PRODUCT_NAME} ${label} Reminder`;
  }

  _normalizeStoredSchedule(item) {
    if (!item || typeof item !== 'object') return null;
    const next = { ...item };
    next.kind = normalizeScheduleKind(next.kind || next.type || 'Reminder');
    if (next.id) next.id = String(next.id).replace(/^JARVIS_/i, `${PRODUCT_NAME}_`);
    if (next.taskName) next.taskName = String(next.taskName).replace(/^JARVIS_/i, `${PRODUCT_NAME}_`);
    if (!next.id && next.taskName) next.id = next.taskName;
    if (!next.taskName && next.id) next.taskName = next.id;
    if (!next.id || !next.taskName) return null;
    const dueAt = new Date(next.dueAt || 0);
    if (next.kind !== 'Stopwatch' && !Number.isFinite(dueAt.getTime())) return null;
    if (next.kind !== 'Stopwatch') next.dueAt = dueAt.toISOString();
    if (next.title) {
      next.title = sanitizeText(next.title, MAX_TITLE_LENGTH)
        .replace(/^JARVIS\b/i, PRODUCT_NAME)
        .replace(/^OpenX\s+Reminder\s+Reminder$/i, `${PRODUCT_NAME} Reminder`);
    }
    next.title = sanitizeText(next.title || `${PRODUCT_NAME} ${next.kind}`, MAX_TITLE_LENGTH);
    next.message = sanitizeText(next.message || next.title, MAX_MESSAGE_LENGTH);
    next.category = sanitizeText(next.category || next.kind.toLowerCase(), MAX_CATEGORY_LENGTH);
    next.symbol = sanitizeText(next.symbol, 8) || null;
    next.status = normalizeScheduleStatus(next.status, next.kind === 'Stopwatch' ? 'running' : 'scheduled');
    const scheduledAction = normalizeScheduledAction(next.scheduledAction);
    if (scheduledAction) next.scheduledAction = scheduledAction;
    else delete next.scheduledAction;
    next.recurrence = this._normalizeRecurrence(next.recurrence);
    next.createdAt = Number.isFinite(Date.parse(next.createdAt)) ? next.createdAt : new Date().toISOString();
    next.updatedAt = Number.isFinite(Date.parse(next.updatedAt)) ? next.updatedAt : next.createdAt;
    if (Number.isFinite(Number(next.durationMinutes))) next.durationMinutes = Number(next.durationMinutes);
    if (Number.isFinite(Number(next.durationMs))) next.durationMs = Number(next.durationMs);
    if (Number.isFinite(Number(next.remainingMs))) next.remainingMs = Math.max(0, Number(next.remainingMs));
    return next;
  }

  _arm(item) {
    if (!item?.id || item.status !== 'scheduled') return;
    const existing = this.timers.get(item.id);
    if (existing) clearTimeout(existing);
    const remaining = new Date(item.dueAt).getTime() - Date.now();
    if (!Number.isFinite(remaining)) return;
    const delay = Math.max(1, Math.min(remaining, MAX_TIMEOUT_MS));
    const timer = setTimeout(() => {
      this.timers.delete(item.id);
      if (remaining > MAX_TIMEOUT_MS) {
        this._arm(item);
        return;
      }
      this._publishDue(item);
    }, delay);
    this.timers.set(item.id, timer);
  }

  _publishDue(item) {
    if (!item || item.status !== 'scheduled') return;
    if (normalizeScheduledAction(item.scheduledAction)) {
      this._executeScheduledAction(item)
        .then(() => {
          const current = this.scheduledItems.find(entry => entry.id === item.id || entry.taskName === item.taskName) || item;
          this.eventBus?.publish?.(EVENTS.SCHEDULE_DUE, { ...current });
        })
        .catch(error => {
          this.logger.error('Scheduled action execution failed', error);
          const current = this.scheduledItems.find(entry => entry.id === item.id || entry.taskName === item.taskName) || item;
          this.eventBus?.publish?.(EVENTS.SCHEDULE_DUE, { ...current });
        });
      return;
    }

    item.status = 'due';
    item.updatedAt = new Date().toISOString();
    this._saveScheduledItems();
    this.eventBus?.publish?.(EVENTS.SCHEDULE_DUE, { ...item });
  }

  async _executeScheduledAction(item) {
    const itemId = String(item?.id || item?.taskName || '').trim();
    const current = this.scheduledItems.find(entry => entry.id === itemId || entry.taskName === itemId) || item;
    const scheduledAction = normalizeScheduledAction(current?.scheduledAction);
    if (!scheduledAction) return;
    if (typeof this.actionExecutor !== 'function') {
      this.logger.warn('Scheduled action is due but no executor is available', {
        id: current.id,
        actionId: scheduledAction.actionId
      });
      current.status = 'due';
      current.updatedAt = new Date().toISOString();
      current.scheduledActionResult = {
        success: false,
        actionId: scheduledAction.actionId,
        completedAt: current.updatedAt,
        error: 'Scheduled action executor is unavailable'
      };
      this._saveScheduledItems();
      return current.scheduledActionResult;
    }

    current.status = 'running';
    current.updatedAt = new Date().toISOString();
    this._saveScheduledItems();

    try {
      const result = await this.actionExecutor(scheduledAction, current);
      const active = this.scheduledItems.find(entry => entry.id === itemId || entry.taskName === itemId) || current;
      const success = Boolean(result?.success);
      active.status = success ? 'completed' : 'due';
      active.scheduledActionResult = {
        success,
        actionId: scheduledAction.actionId,
        completedAt: new Date().toISOString(),
        error: success ? null : sanitizeText(result?.error || 'Scheduled action failed', 180)
      };
      active.updatedAt = active.scheduledActionResult.completedAt;
      this._saveScheduledItems();
      return active.scheduledActionResult;
    } catch (error) {
      const active = this.scheduledItems.find(entry => entry.id === itemId || entry.taskName === itemId) || current;
      active.status = 'due';
      active.scheduledActionResult = {
        success: false,
        actionId: scheduledAction.actionId,
        completedAt: new Date().toISOString(),
        error: sanitizeText(error.message || 'Scheduled action failed', 180)
      };
      active.updatedAt = active.scheduledActionResult.completedAt;
      this._saveScheduledItems();
      throw error;
    }
  }

  snooze(id, minutes = 5) {
    const item = this.scheduledItems.find(entry => entry.id === id || entry.taskName === id);
    if (!item) return { success: false, error: 'Schedule not found' };
    const existingTimer = this.timers.get(item.id);
    if (existingTimer) clearTimeout(existingTimer);
    this.timers.delete(item.id);
    item.status = 'scheduled';
    item.dueAt = new Date(Date.now() + (Math.max(1, Number(minutes) || 5) * 60 * 1000)).toISOString();
    item.updatedAt = new Date().toISOString();
    this._saveScheduledItems();
    this._arm(item);
    return this._stateResult(item, 'snooze', 'schedule-snoozed');
  }

  complete(id) {
    const item = this.scheduledItems.find(entry => entry.id === id || entry.taskName === id);
    if (!item) return { success: false, error: 'Schedule not found' };
    const timer = this.timers.get(item.id);
    if (timer) clearTimeout(timer);
    this.timers.delete(item.id);
    if (item.recurrence) {
      item.dueAt = this._nextRecurringDate(item.recurrence, new Date(item.dueAt)).toISOString();
      item.status = 'scheduled';
      this._arm(item);
    } else {
      item.status = 'completed';
    }
    item.updatedAt = new Date().toISOString();
    this._saveScheduledItems();
    return this._stateResult(item, item.status === 'scheduled' ? 'reschedule' : 'complete', 'schedule-completed');
  }

  upsertSyncedSchedule(input = {}, metadata = {}) {
    const normalized = this._normalizeIncomingSchedule(input, metadata);
    if (!normalized) return { success: false, error: 'Invalid schedule item' };

    const existingIndex = this.scheduledItems.findIndex(item => item.id === normalized.id || item.taskName === normalized.taskName);
    let operation = 'sync-add';
    if (existingIndex >= 0) {
      const existing = this.scheduledItems[existingIndex];
      const existingTimer = this.timers.get(existing.id);
      if (existingTimer) clearTimeout(existingTimer);
      this.timers.delete(existing.id);
      this.scheduledItems[existingIndex] = {
        ...existing,
        ...normalized,
        updatedAt: new Date().toISOString()
      };
      operation = 'sync-update';
    } else {
      this.scheduledItems.push(normalized);
    }

    const item = existingIndex >= 0 ? this.scheduledItems[existingIndex] : normalized;
    this._saveScheduledItems();
    if (item.status === 'scheduled') this._arm(item);
    return {
      success: true,
      data: {
        ...this._publicScheduleData(item),
        operation,
        verified: this._hasSchedule(item.id),
        verification: scheduleVerification(
          this._hasSchedule(item.id) ? 'passed' : 'failed',
          'schedule-sync-persisted',
          { id: item.id, kind: item.kind, dueAt: item.dueAt }
        )
      }
    };
  }

  getScheduleSnapshot(scope = 'all') {
    const entries = this.listSchedules(null, scope)?.data?.entries || [];
    return {
      version: 1,
      source: 'desktop',
      generatedAt: new Date().toISOString(),
      count: entries.length,
      entries
    };
  }

  pauseActiveTimer() {
    const item = this._latestSchedule('Timer', ['scheduled']);
    if (!item) return { success: false, error: 'No active timer found' };
    const timer = this.timers.get(item.id);
    if (timer) clearTimeout(timer);
    this.timers.delete(item.id);
    item.remainingMs = Math.max(0, new Date(item.dueAt).getTime() - Date.now());
    item.status = 'paused';
    item.updatedAt = new Date().toISOString();
    this._saveScheduledItems();
    return this._stateResult(item, 'pause', 'schedule-paused');
  }

  resumeActiveTimer() {
    const item = this._latestSchedule('Timer', ['paused']);
    if (!item) return { success: false, error: 'No paused timer found' };
    item.dueAt = new Date(Date.now() + Math.max(1000, Number(item.remainingMs) || 1000)).toISOString();
    item.status = 'scheduled';
    delete item.remainingMs;
    item.updatedAt = new Date().toISOString();
    this._saveScheduledItems();
    this._arm(item);
    return this._stateResult(item, 'resume', 'schedule-resumed');
  }

  resetActiveTimer() {
    const item = this._latestSchedule('Timer', ['scheduled', 'paused', 'due']);
    if (!item || !item.durationMinutes) return { success: false, error: 'No resettable timer found' };
    const timer = this.timers.get(item.id);
    if (timer) clearTimeout(timer);
    this.timers.delete(item.id);
    item.dueAt = new Date(Date.now() + Number(item.durationMinutes) * 60000).toISOString();
    item.status = 'scheduled';
    delete item.remainingMs;
    item.updatedAt = new Date().toISOString();
    this._saveScheduledItems();
    this._arm(item);
    return this._stateResult(item, 'reset', 'schedule-reset');
  }

  getRemainingTimer() {
    const item = this._latestSchedule('Timer', ['scheduled', 'paused']);
    if (!item) return { success: false, error: 'No active timer found' };
    const remainingMs = item.status === 'paused'
      ? Number(item.remainingMs) || 0
      : Math.max(0, new Date(item.dueAt).getTime() - Date.now());
    return { success: true, data: { ...item, remainingMs, remainingMinutes: Math.max(0, Math.ceil(remainingMs / 60000)) } };
  }

  getTimerWidgetState(preferredId = null, options = {}) {
    const includeStopwatch = options.includeStopwatch === true;
    const timer = this._activeTimerForWidget(preferredId);
    const stopwatch = includeStopwatch ? this._activeStopwatchForWidget(preferredId) : null;
    const active = timer || stopwatch;
    if (!active) {
      return { visible: false };
    }

    if (String(active.kind || '').toLowerCase() === 'stopwatch') {
      return {
        visible: true,
        mode: 'stopwatch',
        id: active.id,
        taskName: active.taskName,
        status: active.status,
        elapsedMs: this._stopwatchElapsedMs(active),
        title: active.title || 'Stopwatch',
        createdAt: active.createdAt
      };
    }

    const durationMs = Math.max(1000, Number(active.durationMs) || Number(active.durationMinutes) * 60000 || 1000);
    const remainingMs = active.status === 'paused'
      ? Math.max(0, Number(active.remainingMs) || 0)
      : Math.max(0, new Date(active.dueAt).getTime() - Date.now());
    return {
      visible: true,
      mode: 'timer',
      id: active.id,
      taskName: active.taskName,
      status: active.status,
      dueAt: active.dueAt,
      durationMs,
      remainingMs,
      title: active.title || 'Timer',
      createdAt: active.createdAt
    };
  }

  listSchedules(kind = null, scope = 'active') {
    const normalizedKind = String(kind || '').trim().toLowerCase();
    const now = new Date();
    const entries = this.scheduledItems.filter(item => {
      if (normalizedKind && String(item.kind || '').toLowerCase() !== normalizedKind) return false;
      if (scope === 'today') {
        const due = new Date(item.dueAt);
        return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate();
      }
      if (scope === 'all') return item.status !== 'dismissed';
      return ['scheduled', 'paused', 'due'].includes(item.status);
    });
    return {
      success: true,
      data: {
        kind: kind || 'Schedule',
        scope,
        count: entries.length,
        entries: entries.map(item => ({ ...item })),
        operation: 'list',
        verified: true,
        verification: scheduleVerification('passed', 'schedule-list', { count: entries.length, scope })
      }
    };
  }

  cancelLatest(kind) {
    const item = this._latestSchedule(kind, ['scheduled', 'paused', 'due']);
    if (!item) return { success: false, error: `No active ${String(kind || 'schedule').toLowerCase()} found` };
    return this.complete(item.id);
  }

  clearSchedules(kind) {
    const normalizedKind = String(kind || '').toLowerCase();
    const targets = this.scheduledItems.filter(item =>
      String(item.kind || '').toLowerCase() === normalizedKind && ['scheduled', 'paused', 'due'].includes(item.status));
    for (const item of targets) {
      const timer = this.timers.get(item.id);
      if (timer) clearTimeout(timer);
      this.timers.delete(item.id);
      item.status = 'completed';
      item.updatedAt = new Date().toISOString();
    }
    this._saveScheduledItems();
    return {
      success: true,
      data: {
        kind,
        count: targets.length,
        operation: 'clear',
        verified: true,
        verification: scheduleVerification('passed', 'schedule-cleared', { kind, count: targets.length })
      }
    };
  }

  snoozeLatestAlarm(minutes = 5) {
    const item = this._latestSchedule('Alarm', ['scheduled', 'due']);
    return item ? this.snooze(item.id, minutes) : { success: false, error: 'No active alarm found' };
  }

  snoozeLatestReminder(minutes = 5) {
    const item = this._latestSchedule('Reminder', ['scheduled', 'due']);
    return item ? this.snooze(item.id, minutes) : { success: false, error: 'No active reminder found' };
  }

  _latestSchedule(kind, statuses) {
    const normalizedKind = String(kind || '').toLowerCase();
    return this.scheduledItems
      .slice()
      .reverse()
      .find(item => String(item.kind || '').toLowerCase() === normalizedKind && statuses.includes(item.status)) || null;
  }

  _activeTimerForWidget(preferredId = null) {
    const active = this.scheduledItems.filter(item =>
      String(item.kind || '').toLowerCase() === 'timer' && ['scheduled', 'paused'].includes(item.status));
    if (preferredId) {
      const preferred = active.find(item => item.id === preferredId || item.taskName === preferredId);
      if (preferred) return preferred;
    }
    return active.slice().reverse()[0] || null;
  }

  _activeStopwatchForWidget(preferredId = null) {
    const active = this.scheduledItems.filter(item =>
      String(item.kind || '').toLowerCase() === 'stopwatch' && ['running', 'paused'].includes(item.status));
    if (preferredId) {
      const preferred = active.find(item => item.id === preferredId || item.taskName === preferredId);
      if (preferred) return preferred;
    }
    return active.slice().reverse()[0] || null;
  }

  _normalizeIncomingSchedule(input = {}, metadata = {}) {
    if (!input || typeof input !== 'object') return null;
    const kind = normalizeScheduleKind(input.kind || input.type || 'Reminder');
    const normalizedKind = kind.toLowerCase();
    if (!/^(?:reminder|alarm|timer)$/i.test(kind)) return null;
    const dueAt = new Date(input.dueAt || input.time || input.when || 0);
    if (!Number.isFinite(dueAt.getTime())) return null;
    const message = sanitizeText(input.message || input.title || `${kind} from phone`, MAX_MESSAGE_LENGTH);
    if (!message) return null;
    const sourceDeviceId = sanitizeText(metadata.deviceId || input.sourceDeviceId || input.deviceId || '', 128);
    const baseId = sanitizeText(input.id || input.taskName || '', 128);
    const taskName = baseId && /^OpenX_/i.test(baseId)
      ? baseId
      : `${PRODUCT_NAME}_${kind}_${IdGenerator.short()}`;
    const now = new Date().toISOString();
    return this._normalizeStoredSchedule({
      ...input,
      id: taskName,
      taskName,
      kind,
      title: sanitizeText(input.title || `${PRODUCT_NAME} ${kind}`, MAX_TITLE_LENGTH),
      message,
      category: sanitizeText(input.category || normalizedKind, MAX_CATEGORY_LENGTH),
      symbol: sanitizeText(input.symbol || (normalizedKind === 'alarm' ? '\u23F0' : normalizedKind === 'timer' ? '\u23F1\uFE0F' : '\u{1F4DD}'), 8),
      recurrence: this._normalizeRecurrence(input.recurrence),
      dueAt: dueAt.toISOString(),
      status: normalizeScheduleStatus(input.status, 'scheduled'),
      createdAt: input.createdAt || now,
      updatedAt: now,
      source: 'phone',
      sourceDeviceId: sourceDeviceId || undefined,
      sourceDeviceName: sanitizeText(metadata.deviceName || input.sourceDeviceName || '', 120) || undefined
    });
  }

  _stopwatchElapsedMs(item) {
    const base = Math.max(0, Number(item?.elapsedMs) || 0);
    if (!item || item.status !== 'running') return base;
    const startedAt = new Date(item.startedAt).getTime();
    if (!Number.isFinite(startedAt)) return base;
    return base + Math.max(0, Date.now() - startedAt);
  }

  _stopwatchData(item) {
    return {
      ...item,
      elapsedMs: this._stopwatchElapsedMs(item)
    };
  }

  _nextRecurringDate(recurrence, fromDate = new Date()) {
    const from = fromDate instanceof Date && Number.isFinite(fromDate.getTime()) ? fromDate : new Date();
    const next = new Date(Math.max(Date.now(), from.getTime()));
    const key = String(recurrence || '').toLowerCase();
    const weeklyDays = this._recurrenceWeekdays(key);
    if (weeklyDays.length > 0) {
      next.setHours(from.getHours(), from.getMinutes(), 0, 0);
      next.setDate(next.getDate() + 1);
      for (let index = 0; index < 14; index += 1) {
        if (weeklyDays.includes(next.getDay()) && next.getTime() > Date.now()) {
          return next;
        }
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    if (key === 'hourly' || key === 'every-2-hours') {
      next.setTime(next.getTime() + (key === 'hourly' ? 1 : 2) * 3600000);
      return next;
    }
    if (key === 'weekly') {
      next.setDate(next.getDate() + 7);
      return next;
    }
    next.setDate(next.getDate() + 1);
    if (key.startsWith('weekday')) {
      while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
    }
    if (key.includes('morning')) next.setHours(9, 0, 0, 0);
    else if (key.includes('evening')) next.setHours(18, 0, 0, 0);
    else if (key.includes('night')) next.setHours(21, 0, 0, 0);
    return next;
  }

  _normalizeRecurrence(value) {
    const key = sanitizeText(value, 120).toLowerCase().replace(/\s+/g, '-');
    if (!key) return '';
    if (['daily', 'weekly', 'hourly', 'weekday', 'weekdays', 'weekday-morning', 'every-2-hours'].includes(key)) {
      return key === 'weekdays' ? 'weekday' : key;
    }
    if (key.startsWith('weekly:')) {
      const days = key
        .slice('weekly:'.length)
        .split(',')
        .map(day => day.trim().replace(/[^a-z]/g, ''))
        .filter(day => Number.isInteger(WEEKDAY_INDEX[day]));
      return days.length ? `weekly:${Array.from(new Set(days)).join(',')}` : '';
    }
    return key;
  }

  _alignRecurringDueDate(recurrence, dueAt) {
    if (!(dueAt instanceof Date) || !Number.isFinite(dueAt.getTime())) return dueAt;
    const weeklyDays = this._recurrenceWeekdays(recurrence);
    if (weeklyDays.length === 0) return dueAt;
    const candidate = new Date();
    candidate.setSeconds(0, 0);
    candidate.setHours(dueAt.getHours(), dueAt.getMinutes(), 0, 0);
    for (let index = 0; index < 14; index += 1) {
      if (weeklyDays.includes(candidate.getDay()) && candidate.getTime() > Date.now()) {
        return candidate;
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    return dueAt;
  }

  _recurrenceWeekdays(recurrence) {
    const key = String(recurrence || '').toLowerCase().trim();
    if (!key.startsWith('weekly:')) return [];
    return key
      .slice('weekly:'.length)
      .split(',')
      .map(day => WEEKDAY_INDEX[day.trim()])
      .filter(day => Number.isInteger(day));
  }

  destroy() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

module.exports = SchedulerController;
module.exports.inferReminderCategory = inferReminderCategory;
module.exports.REMINDER_PRESENTATIONS = REMINDER_PRESENTATIONS;
