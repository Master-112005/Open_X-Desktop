const fs = require('fs');
const path = require('path');
const {
  buildDataPaths,
  readSecureJsonFile: readJsonFile,
  writeSecureJsonAtomic: writeJsonAtomic,
  migrateJsonArrayFile
} = require('../assistant/Data');

const ENTRY_TYPES = new Set(['calendar', 'timetable']);
const MAX_ENTRIES = 500;
const MAX_TITLE_LENGTH = 160;
const MAX_NOTES_LENGTH = 1200;

function localDateKey(date = new Date()) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return localDateKey(new Date());
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function parseIsoDateKey(value) {
  const match = String(value || '').trim().match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return '';
  }
  return localDateKey(parsed);
}

function sanitizeText(value, maxLength = 500) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeDate(value, fallback = new Date()) {
  const input = String(value || '').trim().toLowerCase();
  const date = new Date(fallback);
  date.setHours(0, 0, 0, 0);

  if (!input || input === 'today') return localDateKey(date);
  if (input === 'tomorrow') {
    date.setDate(date.getDate() + 1);
    return localDateKey(date);
  }

  const iso = parseIsoDateKey(input);
  if (iso) return iso;

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = dayNames.findIndex(day => input.includes(day));
  if (dayIndex >= 0) {
    const current = date.getDay();
    let delta = (dayIndex - current + 7) % 7;
    if (delta === 0 || input.includes('next ')) delta += 7;
    date.setDate(date.getDate() + delta);
    return localDateKey(date);
  }

  return localDateKey(date);
}

function normalizeTime(value) {
  const input = String(value || '').trim().toLowerCase();
  if (!input) return '';

  if (/\bnoon\b/.test(input)) return '12:00';
  if (/\bmidnight\b/.test(input)) return '00:00';

  const match = input.match(/\b(\d{1,2})(?::|\s+)(\d{2})\s*(am|pm)?\b/) ||
    input.match(/\b(\d{1,2})\s*(am|pm)\b/) ||
    input.match(/\b(\d{1,2})\b/);
  if (!match) return '';

  let hour = Number(match[1]);
  const hasMinute = match[2] && /^\d{2}$/.test(match[2]);
  const minute = hasMinute ? Number(match[2]) : 0;
  const meridiem = hasMinute ? (match[3] || '') : (match[2] || '');
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractDateExpression(text) {
  const input = String(text || '').toLowerCase();
  const match = input.match(/\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2}-\d{1,2}-\d{1,2})\b/);
  return match ? match[1] : '';
}

function extractTimeExpression(text) {
  const input = String(text || '').toLowerCase();
  const match = input.match(/\b(?:at|from|by)\s+(\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm)?)\b/) ||
    input.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/) ||
    input.match(/\b(\d{1,2}\s+\d{2}\s*(?:am|pm)?)\b/) ||
    input.match(/\b(\d{1,2}\s*(?:am|pm))\b/) ||
    input.match(/\b(noon|midnight)\b/);
  return match ? match[1] : '';
}

function cleanTitle(value) {
  return sanitizeText(value, MAX_TITLE_LENGTH)
    .replace(/\b(?:today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2}-\d{1,2}-\d{1,2})\b/gi, ' ')
    .replace(/\b(?:at|from|by)\s+\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm)?\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi, ' ')
    .replace(/\b\d{1,2}\s+\d{2}\s*(?:am|pm)?\b/gi, ' ')
    .replace(/\b(?:at|from|by)\s+(?:noon|midnight)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
}

function stableEntryKey(entry) {
  return [
    entry.type,
    entry.date,
    entry.startTime || '',
    sanitizeText(entry.title, MAX_TITLE_LENGTH).toLowerCase()
  ].join('|');
}

class PlannerController {
  constructor(config = {}) {
    this.config = config;
    const dataPaths = config?.app?.dataPaths || buildDataPaths(config);
    this.plannerPath = config?.app?.plannerPath || dataPaths.plannerPath;
    this._migrateWorkingDirectoryPlanner(config);
    this.entries = this._loadEntries();
  }

  open(view = 'calendar') {
    const normalizedView = view === 'timetable' ? 'timetable' : 'calendar';
    return {
      success: true,
      data: {
        view: normalizedView,
        count: this.entries.length,
        operation: 'open',
        verified: true,
        verification: {
          status: 'passed',
          check: 'planner-open',
          view: normalizedView
        },
        responseVariantSeed: `planner.open:${normalizedView}:${this.entries.length}`
      }
    };
  }

  addCalendarEntry(entities = {}, context = {}) {
    return this.addEntry({ ...entities, type: 'calendar' }, context);
  }

  addTimetableEntry(entities = {}, context = {}) {
    return this.addEntry({ ...entities, type: 'timetable' }, context);
  }

  addEntry(entities = {}, context = {}) {
    const normalized = this._normalizeIncomingEntry(entities, context);

    if (!normalized.title) {
      return {
        success: false,
        needsClarification: true,
        error: `Tell me what to add to the ${normalized.type}.`,
        data: {
          operation: 'add',
          view: normalized.type,
          verification: {
            status: 'failed',
            check: 'planner-entry-title',
            message: `Planner ${normalized.type} entries require a title.`
          }
        }
      };
    }

    const now = new Date();
    const entry = {
      id: normalized.id || this._createId(now),
      type: normalized.type,
      title: normalized.title,
      notes: normalized.notes,
      date: normalized.date,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      sourceText: normalized.sourceText || normalized.title,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const existingIndex = this.entries.findIndex(item => stableEntryKey(item) === stableEntryKey(entry));
    const duplicate = existingIndex >= 0;
    if (duplicate) {
      const existing = this.entries[existingIndex];
      this.entries[existingIndex] = {
        ...existing,
        notes: entry.notes || existing.notes || '',
        endTime: entry.endTime || existing.endTime || '',
        sourceText: entry.sourceText || existing.sourceText || entry.title,
        updatedAt: now.toISOString()
      };
    } else {
      this.entries.push(entry);
    }

    this.entries = this.entries.slice(-MAX_ENTRIES);
    this._saveEntries();

    const savedEntry = duplicate ? this.entries[existingIndex] : entry;
    const verified = this._hasEntry(savedEntry.id);
    return {
      success: true,
      data: {
        entry: savedEntry,
        view: savedEntry.type,
        count: this.entries.length,
        operation: duplicate ? 'update' : 'add',
        duplicate,
        verified,
        verification: {
          status: verified ? 'passed' : 'failed',
          check: 'planner-entry-persisted',
          entryId: savedEntry.id,
          view: savedEntry.type
        },
        responseVariantSeed: `planner.${savedEntry.type}:${savedEntry.date}:${savedEntry.startTime}:${savedEntry.title}:${duplicate ? 'updated' : 'added'}`
      }
    };
  }

  listEntries(options = {}) {
    const type = ENTRY_TYPES.has(options.type) ? options.type : null;
    const date = options.date ? normalizeDate(options.date) : null;
    const entries = this.entries
      .filter(entry => !type || entry.type === type)
      .filter(entry => !date || entry.date === date)
      .sort((a, b) => `${a.date} ${a.startTime || '99:99'}`.localeCompare(`${b.date} ${b.startTime || '99:99'}`));
    return {
      success: true,
      data: {
        entries,
        count: entries.length,
        operation: 'list',
        verified: true,
        verification: {
          status: 'passed',
          check: 'planner-entries-read',
          count: entries.length
        }
      }
    };
  }

  deleteEntry(id) {
    const targetId = sanitizeText(id, 120);
    const before = this.entries.length;
    this.entries = this.entries.filter(entry => entry.id !== targetId);
    if (this.entries.length === before) {
      return {
        success: false,
        error: 'Planner entry not found',
        data: {
          id: targetId,
          operation: 'delete',
          verification: {
            status: 'failed',
            check: 'planner-entry-delete',
            message: 'Planner entry not found'
          }
        }
      };
    }
    this._saveEntries();
    const removed = !this._hasEntry(targetId);
    return {
      success: true,
      data: {
        id: targetId,
        count: this.entries.length,
        operation: 'delete',
        verified: removed,
        verification: {
          status: removed ? 'passed' : 'failed',
          check: 'planner-entry-deleted',
          entryId: targetId
        }
      }
    };
  }

  _normalizeIncomingEntry(entities, context) {
    const type = ENTRY_TYPES.has(entities.type) ? entities.type : 'calendar';
    const sourceText = this._resolveSourceText(entities, context);
    const dateExpression = entities.date || entities.dateExpression || extractDateExpression(sourceText);
    const timeExpression = entities.startTime || entities.timeExpression || extractTimeExpression(sourceText);
    const explicitTitle = entities.title || entities.plannerText || '';
    const title = cleanTitle(explicitTitle || sourceText);
    const date = normalizeDate(dateExpression);
    const startTime = normalizeTime(timeExpression);
    const endTime = normalizeTime(entities.endTime);

    return {
      id: sanitizeText(entities.id, 120),
      type,
      title,
      notes: sanitizeText(entities.notes, MAX_NOTES_LENGTH),
      date,
      startTime,
      endTime: endTime && startTime && endTime <= startTime ? '' : endTime,
      sourceText: sanitizeText(sourceText || title, MAX_NOTES_LENGTH)
    };
  }

  _normalizeStoredEntry(entry) {
    if (!entry || !ENTRY_TYPES.has(entry.type)) return null;
    const title = cleanTitle(entry.title);
    if (!title) return null;
    const now = new Date().toISOString();
    return {
      id: sanitizeText(entry.id, 120) || this._createId(),
      type: entry.type,
      title,
      notes: sanitizeText(entry.notes, MAX_NOTES_LENGTH),
      date: normalizeDate(entry.date),
      startTime: normalizeTime(entry.startTime),
      endTime: normalizeTime(entry.endTime),
      sourceText: sanitizeText(entry.sourceText || title, MAX_NOTES_LENGTH),
      createdAt: Number.isFinite(Date.parse(entry.createdAt)) ? entry.createdAt : now,
      updatedAt: Number.isFinite(Date.parse(entry.updatedAt)) ? entry.updatedAt : now
    };
  }

  _createId(date = new Date()) {
    return `planner-${date.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _hasEntry(id) {
    const targetId = sanitizeText(id, 120);
    return this._loadEntries().some(entry => entry.id === targetId);
  }

  _resolveSourceText(entities, context) {
    const direct = String(entities.plannerText || entities.title || '').trim();
    if (direct && !/^(?:this|that)$/i.test(direct)) return direct;
    if (entities.reference !== 'previous') return direct;

    const recent = Array.isArray(context?.conversation?.recent) ? context.conversation.recent : [];
    const previous = recent
      .slice()
      .reverse()
      .find(entry => entry?.input && !/\b(?:calendar|timetable|time\s+table)\b/i.test(entry.input));
    return String(previous?.target || previous?.input || context?.conversation?.summaryText || direct).trim();
  }

  _loadEntries() {
    const parsed = readJsonFile(this.plannerPath, [], {
      createIfMissing: false,
      validate: value => Array.isArray(value)
    });
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const entries = [];
    for (const rawEntry of parsed) {
      const entry = this._normalizeStoredEntry(rawEntry);
      if (!entry) continue;
      const key = stableEntryKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
    return entries.slice(-MAX_ENTRIES);
  }

  _saveEntries() {
    writeJsonAtomic(this.plannerPath, this.entries.slice(-MAX_ENTRIES), { backup: true });
  }

  _migrateWorkingDirectoryPlanner(config) {
    const shouldMigrate = config?.app?.migrateCwdPlanner === true || !config?.app?.dataDir;
    if (!shouldMigrate) return;

    const sourcePath = path.resolve(process.cwd(), 'planner.json');
    const targetPath = path.resolve(this.plannerPath);
    if (sourcePath === targetPath || !fs.existsSync(sourcePath)) return;

    try {
      migrateJsonArrayFile(sourcePath, targetPath, {
        limit: MAX_ENTRIES,
        normalizeItem: entry => entry && ENTRY_TYPES.has(entry.type) && entry.id && entry.title ? entry : null
      });
    } catch (_) {
      // Planner migration is best effort; normal loading still uses the managed path.
    }
  }
}

module.exports = PlannerController;
