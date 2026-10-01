'use strict';

function compactText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function finiteNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function uniqueCompactList(items, limit, length = 80) {
  return Array.from(new Set((Array.isArray(items) ? items : [])
    .map(item => typeof item === 'string' ? item : item?.name || item?.app || item?.title || '')
    .map(item => compactText(item, length))
    .filter(Boolean))).slice(0, limit);
}

function safeUrl(value) {
  const text = compactText(value, 500);
  if (!text) return null;
  return /^(https?:|file:|about:)/i.test(text) ? text : null;
}

function compactEvent(event) {
  return {
    id: event?.id || null,
    title: compactText(event?.title || event?.summary || event?.message || '', 140) || null,
    startsAt: event?.startsAt || event?.start || event?.dueAt || null,
    kind: compactText(event?.kind || event?.type || '', 40) || null
  };
}

function compactFileName(item, limit) {
  return compactText(typeof item === 'string' ? item : item?.path || item?.name || item?.text || '', limit);
}

function compactNamedList(items, limit = 12, textLength = 220) {
  return (Array.isArray(items) ? items : [])
    .map(item => typeof item === 'string' ? item : item?.path || item?.name || item?.title || '')
    .map(item => compactText(item, textLength))
    .filter(Boolean)
    .slice(0, limit);
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function compactFiles(items, limit = 8) {
  return (Array.isArray(items) ? items : [])
    .map(item => typeof item === 'string'
      ? { path: compactText(item, 260), name: compactText(item.split(/[\\/]/).pop(), 120) }
      : {
          path: compactText(item?.path || item?.location || '', 260),
          name: compactText(item?.name || item?.title || '', 120)
        })
    .filter(item => item.path || item.name)
    .slice(0, limit);
}

function publicProfile(user) {
  return {
    name: compactText(user.name || user.displayName || '', 80) || null,
    role: compactText(user.role || '', 80) || null,
    company: compactText(user.company || '', 100) || null,
    country: compactText(user.country || '', 80) || null,
    locale: compactText(user.locale || '', 40) || null
  };
}

function compactWindow(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    title: compactText(value.title || '', 180) || null,
    app: compactText(value.app || value.process || '', 80) || null,
    handle: value.handle || null,
    fullscreen: Boolean(value.fullscreen),
    minimized: Boolean(value.minimized)
  };
}

class ApplicationContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.application');
    this.priority = Number.isFinite(options.priority) ? options.priority : 110;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.reader = options.reader || null;
    this.maxApplications = Number(options.maxApplications || 20);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  async collect(context) {
    const snapshots = context.snapshots || {};
    const activeWindow = this.reader ? await this.reader(context) : snapshots.activeWindow || null;
    const apps = uniqueCompactList(snapshots.runningApplications, this.maxApplications);
    const focusedApplication = compactText(activeWindow?.app || context.workingMemory?.currentApplication || '', 80) || null;
    context.context.runningApplications = apps;
    context.context.application = {
      focusedApplication,
      foregroundWindow: activeWindow ? {
        app: compactText(activeWindow.app || focusedApplication || '', 80),
        title: compactText(activeWindow.title || '', 160),
        handle: activeWindow.handle || null
      } : null,
      recentApplications: uniqueCompactList(context.sessionMemory?.recentApplications || [], this.maxApplications),
      applicationCount: apps.length,
      state: focusedApplication ? 'focused' : 'unknown'
    };
    return context;
  }
}

class BrowserContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.browser');
    this.priority = Number.isFinite(options.priority) ? options.priority : 130;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const browser = context.snapshots?.browser || {};
    const currentUrl = safeUrl(browser.currentUrl);
    const currentBrowser = compactText(browser.currentBrowser || context.workingMemory?.currentBrowser || '', 80) || null;
    const query = compactText(browser.query || browser.lastQuery || context.topic?.label || '', 180) || null;
    context.context.browserState = {
      currentBrowser,
      currentTab: compactText(browser.currentTab || '', 160) || null,
      currentUrl,
      currentWebsite: compactText(browser.currentWebsite || '', 120) || null,
      tabTitle: compactText(browser.tabTitle || browser.title || '', 160) || null,
      lastQuery: query,
      hasNavigablePage: Boolean(currentUrl),
      state: currentBrowser ? 'available' : 'unknown'
    };
    return context;
  }
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

class ClipboardContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.clipboard');
    this.priority = Number.isFinite(options.priority) ? options.priority : 150;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.maxPreview = Number(options.maxPreview || 220);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const clipboard = context.snapshots?.clipboard || {};
    const text = compactText(clipboard.text || clipboard.selectedText || clipboard.preview || '', this.maxPreview);
    const files = (Array.isArray(clipboard.files || clipboard.paths) ? clipboard.files || clipboard.paths : [])
      .map(item => compactFileName(item, 220))
      .filter(Boolean)
      .slice(0, 8);
    context.context.clipboard = {
      type: clipboard.type || (files.length ? 'files' : text ? 'text' : 'empty'),
      textPreview: text || null,
      files,
      hasText: Boolean(text),
      hasFiles: files.length > 0,
      updatedAt: clipboard.updatedAt || null
    };
    return context;
  }
}

class DesktopContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.desktop');
    this.priority = Number.isFinite(options.priority) ? options.priority : 120;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.maxItems = Number(options.maxItems || 12);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const snapshots = context.snapshots || {};
    const desktop = snapshots.desktop || {};
    context.context.desktopState = {
      path: compactText(desktop.path || desktop.desktopPath || '', 260) || null,
      workspace: compactText(desktop.workspace || desktop.currentWorkspace || '', 160) || null,
      openFolders: compactNamedList(snapshots.openFolders || desktop.openFolders, this.maxItems),
      recentFiles: compactNamedList(desktop.recentFiles || context.sessionMemory?.recentFiles, this.maxItems),
      itemCount: Number.isFinite(desktop.itemCount) ? desktop.itemCount : null,
      state: desktop.state || (snapshots.activeWindow ? 'active' : 'unknown')
    };
    return context;
  }
}

class MediaContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.media');
    this.priority = Number.isFinite(options.priority) ? options.priority : 180;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const media = context.snapshots?.media || {};
    const topic = context.topic?.type === 'media' ? context.topic.label : null;
    context.context.media = {
      state: media.state || media.playbackState || 'unknown',
      title: compactText(media.title || media.track || topic || '', 180) || null,
      artist: compactText(media.artist || '', 120) || null,
      album: compactText(media.album || '', 120) || null,
      source: compactText(media.source || media.player || media.platform || '', 80) || null,
      lastQuery: compactText(media.lastQuery || topic || '', 180) || null,
      volume: Number.isFinite(Number(media.volume)) ? Number(media.volume) : null,
      canControl: media.canControl !== false
    };
    return context;
  }
}

class ScreenContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.screen');
    this.priority = Number.isFinite(options.priority) ? options.priority : 140;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const screen = context.snapshots?.screen || {};
    const displays = (Array.isArray(screen.displays) ? screen.displays : [])
      .map(display => ({
        id: display.id || null,
        width: numberOrNull(display.width),
        height: numberOrNull(display.height),
        scaleFactor: numberOrNull(display.scaleFactor),
        primary: Boolean(display.primary)
      }))
      .slice(0, 4);
    context.context.screen = {
      width: numberOrNull(screen.width),
      height: numberOrNull(screen.height),
      scaleFactor: numberOrNull(screen.scaleFactor),
      displays,
      displayCount: displays.length || numberOrNull(screen.displayCount),
      locked: Boolean(screen.locked),
      state: screen.state || (screen.locked ? 'locked' : 'available')
    };
    return context;
  }
}

class SelectionContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.selection');
    this.priority = Number.isFinite(options.priority) ? options.priority : 210;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const selection = context.snapshots?.selection || {};
    const selectedText = compactText(selection.selectedText || selection.text || '', 240);
    const selectedFiles = compactFiles(selection.selectedFiles || selection.files || []);
    context.context.selections = {
      selectedText: selectedText || null,
      selectedFiles,
      selectedFile: selectedFiles[0] || null,
      selectionType: selectedFiles.length ? 'file' : selectedText ? 'text' : selection.type || 'none',
      sourceApplication: compactText(selection.sourceApplication || selection.app || '', 80) || null,
      hasSelection: Boolean(selectedText || selectedFiles.length)
    };
    return context;
  }
}

class SystemContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.system');
    this.priority = Number.isFinite(options.priority) ? options.priority : 160;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const system = context.snapshots?.system || {};
    context.context.system = {
      os: process.platform,
      arch: process.arch,
      version: compactText(system.version || system.osVersion || '', 80) || null,
      batteryPercent: finiteNumber(system.batteryPercent ?? system.battery),
      pluggedIn: system.pluggedIn === undefined ? null : Boolean(system.pluggedIn),
      cpuPercent: finiteNumber(system.cpuPercent ?? system.cpu),
      memoryPercent: finiteNumber(system.memoryPercent ?? system.memory),
      network: compactText(system.network || system.networkState || '', 80) || null,
      powerMode: compactText(system.powerMode || '', 80) || null,
      state: system.state || 'available'
    };
    return context;
  }
}

class TimeContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.time');
    this.priority = Number.isFinite(options.priority) ? options.priority : 190;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
    this.now = options.now || (() => new Date());
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const now = this.now();
    const hour = now.getHours();
    const day = now.getDay();
    context.context.time = {
      currentTime: now.toISOString(),
      timeZone: globalThis.Intl?.DateTimeFormat().resolvedOptions().timeZone || '',
      date: now.toISOString().slice(0, 10),
      localHour: hour,
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      isWeekend: day === 0 || day === 6,
      partOfDay: hour < 5 ? 'night'
        : hour < 12 ? 'morning'
          : hour < 17 ? 'afternoon'
            : hour < 21 ? 'evening'
              : 'night',
      relativeTime: 'now',
      timestamp: now.getTime()
    };
    return context;
  }
}

class UserContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.user');
    this.priority = Number.isFinite(options.priority) ? options.priority : 200;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const user = context.snapshots?.user || {};
    const preferences = user.preferences && typeof user.preferences === 'object'
      ? Object.fromEntries(Object.entries(user.preferences)
        .slice(0, 12)
        .map(([key, value]) => [compactText(key, 80), compactText(value, 120)]))
      : {};
    context.context.user = {
      ...publicProfile(user),
      preferences,
      assistantName: compactText(user.assistantName || '', 80) || null,
      hasProfile: Boolean(user.name || user.displayName || Object.keys(preferences).length),
      securityProfile: user.securityProfile ? {
        lockConfigured: Boolean(user.securityProfile.lockConfigured),
        encryptionEnabled: Boolean(user.securityProfile.encryptionEnabled)
      } : null
    };
    return context;
  }
}

class WindowContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.window');
    this.priority = Number.isFinite(options.priority) ? options.priority : 220;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.maxWindows = Number(options.maxWindows || 10);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const snapshots = context.snapshots || {};
    const activeWindow = compactWindow(snapshots.activeWindow);
    const openWindows = (Array.isArray(snapshots.openWindows) ? snapshots.openWindows : [])
      .map(compactWindow)
      .filter(Boolean)
      .slice(0, this.maxWindows);
    context.context.windows = {
      focusedWindow: activeWindow,
      title: activeWindow?.title || null,
      handle: activeWindow?.handle || null,
      openWindows,
      openWindowCount: openWindows.length,
      state: activeWindow?.fullscreen ? 'fullscreen' : activeWindow ? 'focused' : 'unknown'
    };
    return context;
  }
}

module.exports = {
  ApplicationContext,
  BrowserContext,
  CalendarContext,
  ClipboardContext,
  DesktopContext,
  MediaContext,
  ScreenContext,
  SelectionContext,
  SystemContext,
  TimeContext,
  UserContext,
  WindowContext
};