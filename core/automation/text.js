const fs = require('fs');
const path = require('path');
const Logger = require('../assistant/Data').Logger;
const TextRepair = require('./common/text-repair');
const { requireSafeUserPath } = require('./common/path-utils');

const DEFAULT_TEXT_TARGET = 'active window';
const TEXT_PREVIEW_LIMIT = 120;
const MAX_FILE_TEXT_BYTES = 128 * 1024;
const MAX_WRITTEN_TEXT_LENGTH = 20000;
const TEXT_HOST_WINDOWS = [
  { name: 'notepad', processTokens: ['notepad'], titleTokens: ['notepad'] },
  { name: 'notepad++', processTokens: ['notepad++'], titleTokens: ['notepad++'] },
  { name: 'word', processTokens: ['winword', 'wordpad'], titleTokens: ['word'] },
  { name: 'visual studio code', processTokens: ['code'], titleTokens: ['visual studio code'] },
  { name: 'sublime text', processTokens: ['sublime_text'], titleTokens: ['sublime'] },
  { name: 'textpad', processTokens: ['textpad'], titleTokens: ['textpad'] },
  { name: 'onenote', processTokens: ['onenote', 'microsoft.onenote'], titleTokens: ['onenote'] },
  { name: 'obsidian', processTokens: ['obsidian'], titleTokens: ['obsidian'] }
];

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function previewText(value) {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  return text.length > TEXT_PREVIEW_LIMIT
    ? `${text.slice(0, TEXT_PREVIEW_LIMIT - 3).trim()}...`
    : text;
}

function targetWindowName(target = {}) {
  const requested = String(target.windowName || target.targetWindow || target.appName || '').trim();
  if (requested) {
    return requested;
  }
  return '';
}

class TextController {
  constructor(config, dependencies = {}) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.windows = dependencies.windows;
    this.files = dependencies.files;
    this.browser = dependencies.browser;
    this.apps = dependencies.apps;
    this.repairer = dependencies.repairer || new TextRepair({ llm: dependencies.llm });
  }

  async _repairWrittenContent(content) {
    if (!this.repairer || typeof this.repairer.repair !== 'function') {
      return { text: content, changed: false, method: 'none', confidence: 1 };
    }
    return await this.repairer.repair(content);
  }

  async write(text, target = {}) {
    const content = normalizeText(text ?? target.text ?? target.content);
    if (!content) {
      return { success: false, error: 'No text provided to write' };
    }
    if (content.length > MAX_WRITTEN_TEXT_LENGTH) {
      return { success: false, error: 'Text is too long to write in one command' };
    }
    if (target.filename || target.fileName) {
      return await this.writeToFile(content, target);
    }

    const repaired = await this._repairWrittenContent(content);
    const writeContent = repaired.text || content;

    const prepared = await this._prepareTargetWindow(target);
    if (!prepared.success) {
      return prepared;
    }

    const result = this.windows.pasteText(prepared.windowName, writeContent, prepared.options);
    if (!result?.success) {
      return result;
    }

    return {
      success: true,
      data: {
        action: 'text.write',
        targetWindow: prepared.displayTarget,
        textLength: writeContent.length,
        preview: previewText(writeContent),
        launchMethod: 'clipboard-paste',
        verified: true,
        ...(repaired.changed ? { repairMethod: repaired.method } : {}),
        ...result.data
      }
    };
  }

  async pasteFromFile(source, target = {}) {
    const filePath = await this._resolveReadableFile(source || target.source || target.filename, target);
    if (!filePath) {
      return { success: false, error: 'File not found' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_TEXT_BYTES) {
      return { success: false, error: 'File is too large to paste safely' };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const result = await this.write(content, target);
    if (!result.success) {
      return result;
    }

    return {
      ...result,
      data: {
        ...result.data,
        action: 'text.pasteFromFile',
        sourcePath: filePath,
        filename: path.basename(filePath)
      }
    };
  }

  async writeSearchResult(query, target = {}) {
    const cleanQuery = normalizeText(query || target.query);
    if (!cleanQuery) {
      return { success: false, error: 'No search query provided' };
    }

    const searchResult = target.openFirstResult === false
      ? await this.browser.search(cleanQuery, { openInBrowser: true, browserName: target.browserName || 'chrome' })
      : await this.browser.openFirstResult(cleanQuery);
    if (!searchResult?.success) {
      return searchResult;
    }

    const data = searchResult.data || {};
    const lines = [
      `Search: ${cleanQuery}`,
      data.title ? `Title: ${data.title}` : '',
      data.url ? `URL: ${data.url}` : data.searchUrl ? `URL: ${data.searchUrl}` : ''
    ].filter(Boolean);

    const writeResult = await this.write(lines.join('\n'), target);
    if (!writeResult.success) {
      return writeResult;
    }

    return {
      ...writeResult,
      data: {
        ...writeResult.data,
        action: 'text.writeSearchResult',
        query: cleanQuery,
        searchResult: data
      }
    };
  }

  async writeToFile(text, target = {}) {
    const content = normalizeText(text ?? target.text ?? target.content);
    if (!content) {
      return { success: false, error: 'No text provided to write' };
    }

    const filename = target.filename || target.fileName;
    const filePath = await this._resolveReadableFile(filename, target);
    if (!filePath) {
      return { success: false, error: 'File not found' };
    }

    const safePath = requireSafeUserPath(filePath);
    const currentSize = fs.existsSync(safePath) ? fs.statSync(safePath).size : 0;
    const prefix = currentSize > 0 ? '\n' : '';
    fs.appendFileSync(safePath, `${prefix}${content}`, 'utf8');

    return {
      success: true,
      data: {
        action: 'text.writeToFile',
        path: safePath,
        filename: path.basename(safePath),
        textLength: content.length,
        preview: previewText(content),
        launchMethod: 'file-append',
        verified: true
      }
    };
  }

  async createDocument(target = {}) {
    const documentType = normalizeText(target.documentType).toLowerCase() === 'note' ? 'note' : 'document';
    const requestedEditor = normalizeText(target.appName || target.editor);
    const editor = requestedEditor || (documentType === 'note' ? 'notepad' : 'notepad');

    let openResult = { success: true };
    if (this.apps && typeof this.apps.open === 'function') {
      openResult = await this.apps.open(editor, { skipAlreadyOpenCheck: false });
      if (!openResult?.success && !/already|visible|focus/i.test(String(openResult?.error || ''))) {
        return openResult;
      }
    }

    const content = normalizeText(target.text ?? target.content);
    let writeData = null;
    if (content) {
      const writeResult = await this.write(content, { appName: editor, windowName: target.windowName });
      if (!writeResult.success) {
        return writeResult;
      }
      writeData = writeResult.data;
    }

    return {
      success: true,
      data: {
        action: 'document.create',
        editor,
        documentType,
        title: normalizeText(target.title) || null,
        ready: true,
        ...(writeData ? { textLength: writeData.textLength, preview: writeData.preview } : {})
      }
    };
  }

  async _prepareTargetWindow(target = {}) {
    const requestedWindow = targetWindowName(target);
    const requestedApp = String(target.appName || '').trim().toLowerCase();
    if (requestedApp && this.apps && !target.skipOpenApp) {
      const openResult = await this.apps.open(requestedApp, { skipAlreadyOpenCheck: false });
      if (!openResult?.success && !/already|visible|focus/i.test(String(openResult?.error || ''))) {
        return openResult;
      }
    }

    let windowName = requestedWindow || requestedApp || '';
    let options = this._windowOptions(target);

    if (!windowName) {
      const detected = this._detectWriteWindow();
      if (detected) {
        windowName = String(detected.window.title || detected.window.windowTitle || '').trim();
        options = {
          preferredProcessNames: detected.host.processTokens.slice(),
          preferredTitleTokens: detected.host.titleTokens.slice(),
          requireTitleTokenMatch: true,
          settleDelayMs: target.settleDelayMs
        };
      }
    }

    return {
      success: true,
      windowName,
      displayTarget: windowName || DEFAULT_TEXT_TARGET,
      options
    };
  }

  _detectWriteWindow() {
    if (!this.windows || typeof this.windows.findWindow !== 'function' || typeof this.windows.listWindows !== 'function') {
      return null;
    }

    let active = null;
    try {
      active = this.windows.findWindow('') || null;
    } catch (error) {
      active = null;
    }
    if (active) {
      const activeHost = this._textHostForWindow(active);
      if (activeHost) {
        return { window: active, host: activeHost };
      }
    }

    let windows = [];
    try {
      windows = this.windows.listWindows() || [];
    } catch (error) {
      windows = [];
    }
    if (!Array.isArray(windows) || windows.length === 0) {
      return null;
    }

    let best = null;
    windows.forEach(window => {
      const host = this._textHostForWindow(window);
      if (!host) return;
      const isActive = active && Number(window?.handle) === Number(active?.handle);
      const score = (Number(window?.handle) > 0 ? 1 : 0) + (isActive ? 5 : 0);
      if (!best || score > best.score) {
        best = { window, host, score };
      }
    });
    return best || null;
  }

  _textHostForWindow(window = {}) {
    const title = String(window.title || window.windowTitle || '').trim().toLowerCase();
    const processName = String(window.processName || '').trim().toLowerCase();
    for (const host of TEXT_HOST_WINDOWS) {
      const matchesProcess = host.processTokens.some(token => Boolean(token) && (processName === token || processName.includes(token)));
      const matchesTitle = host.titleTokens.some(token => Boolean(token) && title.includes(token));
      if (matchesProcess || matchesTitle) {
        return host;
      }
    }
    return null;
  }

  _windowOptions(target = {}) {
    const appName = String(target.appName || target.windowName || '').trim().toLowerCase();
    const preferredProcessNames = [];
    const preferredTitleTokens = [];
    if (/^(?:notepad|note pad)$/.test(appName)) {
      preferredProcessNames.push('notepad');
      preferredTitleTokens.push('notepad');
    } else if (/^(?:chrome|google chrome)$/.test(appName)) {
      preferredProcessNames.push('chrome');
      preferredTitleTokens.push('chrome');
    }
    return {
      preferredProcessNames,
      preferredTitleTokens,
      settleDelayMs: target.settleDelayMs
    };
  }

  async _resolveReadableFile(filename, target = {}) {
    const source = String(filename || '').trim();
    if (!source || !this.files) {
      return null;
    }
    if (path.isAbsolute(source) && fs.existsSync(source) && fs.statSync(source).isFile()) {
      return source;
    }
    if (typeof this.files._findFileMatches === 'function') {
      const matches = await this.files._findFileMatches(source, target);
      return matches.length === 1 ? matches[0] : null;
    }
    return null;
  }
}

module.exports = TextController;
