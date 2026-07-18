const { contextBridge, ipcRenderer } = require('electron');

let voiceAssistantResultClearTimer = null;
let voiceAssistantActionCollapseTimer = null;
let voiceAlertAudioContext = null;
let voiceAlertSoundInterval = null;
let voiceAlertActiveTones = [];
let voiceLiveScheduleTimer = null;
let voiceHoverAutoHideTimer = null;
let voiceHoverAutoHideLeaveTimer = null;
let voiceHoverAutoHideWatchTimer = null;
let voiceHoverAutoHidePayload = null;
let voiceHoverPointerInside = false;
let voiceHoverPointerPosition = null;
let voiceHoverTrackingAttached = false;

function voiceResultNameFromPath(pathValue, fallback) {
  return String(pathValue || '').split(/[\\/]/).filter(Boolean).pop() || fallback;
}

function isWebResultUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function makeVoiceWebCardOpenable(item, url) {
  if (!isWebResultUrl(url)) return false;
  item.classList.add('voice-card-openable');
  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `Open ${url}`);
  item.title = String(url);
  const open = () => ipcRenderer.invoke('browser:openExternal', { url }).catch(() => {});
  item.addEventListener('click', open);
  item.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open();
  });
  return true;
}

function appendVoiceCard(list, entry, options = {}) {
  const item = document.createElement('li');
  item.className = 'voice-card';
  const number = document.createElement('span');
  number.className = 'voice-card-number';
  number.textContent = String(Number(entry?.index) || list.children.length + 1);
  const body = document.createElement('span');
  body.className = 'voice-card-body';
  const name = document.createElement('strong');
  name.textContent = String(entry?.name || entry?.title || voiceResultNameFromPath(entry?.path, 'Result'));
  body.appendChild(name);
  const metaText = [
    entry?.location,
    entry?.sizeMB > 0 ? `${entry.sizeMB} MB` : '',
    entry?.matchScore > 0 && entry?.type !== 'web' ? `${Math.round(entry.matchScore)}% match` : '',
    !entry?.location && entry?.path ? entry.path : ''
  ].filter(Boolean).join(' - ');
  if (entry?.snippet) {
    const snippet = document.createElement('small');
    snippet.className = 'voice-card-snippet';
    snippet.textContent = String(entry.snippet);
    body.appendChild(snippet);
  }
  if (metaText) {
    const meta = document.createElement('small');
    meta.className = 'voice-card-meta';
    meta.textContent = metaText;
    body.appendChild(meta);
  }
  if (entry?.type === 'web' && entry?.path) {
    makeVoiceWebCardOpenable(item, entry.path);
  } else if (options.showPath && entry?.path && metaText !== entry.path) {
    const pathEl = document.createElement('small');
    pathEl.className = 'voice-card-path';
    pathEl.textContent = String(entry.path);
    body.appendChild(pathEl);
  }
  item.append(number, body);
  list.appendChild(item);
}

function appendVoiceScheduleDue(fragment, payload = {}) {
  const schedule = payload.schedule || {};
  const message = String(schedule.message || payload.response || 'Scheduled item').trim();
  const kind = String(schedule.kind || payload.scheduleKind || 'Schedule').trim();
  const dueLabel = String(schedule.dueLabel || '').trim();
  const recurrenceLabel = String(schedule.recurrenceLabel || '').trim();
  const category = String(schedule.category || '').trim();
  const panel = document.createElement('div');
  panel.className = 'voice-schedule-due';

  const top = document.createElement('div');
  top.className = 'voice-schedule-due-top';
  const kindEl = document.createElement('span');
  kindEl.className = 'voice-schedule-kind';
  kindEl.textContent = kind;
  const dueEl = document.createElement('span');
  dueEl.className = 'voice-schedule-time';
  dueEl.textContent = dueLabel || 'Now';
  top.append(kindEl, dueEl);

  const title = document.createElement('strong');
  title.className = 'voice-schedule-title';
  title.textContent = message;

  const metaItems = [recurrenceLabel, category && category !== kind.toLowerCase() ? category : ''].filter(Boolean);
  panel.append(top, title);
  if (metaItems.length > 0) {
    const meta = document.createElement('div');
    meta.className = 'voice-schedule-meta';
    for (const item of metaItems.slice(0, 2)) {
      const chip = document.createElement('span');
      chip.textContent = item;
      meta.appendChild(chip);
    }
    panel.appendChild(meta);
  }
  fragment.appendChild(panel);
}

function formatVoiceDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatVoiceIcon(value, fallback = 'JA') {
  const raw = String(value || fallback).trim() || fallback;
  if (/[\u{2300}-\u{23FF}\u{1F300}-\u{1FAFF}]/u.test(raw)) return raw;
  return Array.from(raw).slice(0, 2).join('').toUpperCase();
}

function stopVoiceLiveScheduleTicker() {
  if (voiceLiveScheduleTimer) {
    clearInterval(voiceLiveScheduleTimer);
    voiceLiveScheduleTimer = null;
  }
}

function updateVoiceLiveScheduleDom(panel, schedule = {}) {
  const dueAt = new Date(schedule.dueAt || 0).getTime();
  const createdAt = new Date(schedule.createdAt || 0).getTime();
  const remainingMs = Number.isFinite(dueAt) ? Math.max(0, dueAt - Date.now()) : 0;
  const durationMs = Number(schedule.durationMs) > 0
    ? Number(schedule.durationMs)
    : (Number.isFinite(createdAt) && Number.isFinite(dueAt) ? Math.max(1000, dueAt - createdAt) : 0);
  const value = panel.querySelector('.voice-live-value');
  const subValue = panel.querySelector('.voice-live-subvalue');
  const ring = panel.querySelector('.voice-live-ring');
  if (value) value.textContent = formatVoiceDuration(remainingMs);
  if (subValue) subValue.textContent = remainingMs <= 0 ? 'Due now' : `Ends ${String(schedule.dueLabel || '').trim() || 'soon'}`;
  if (ring && durationMs > 0) {
    const progress = Math.max(0, Math.min(1, remainingMs / durationMs));
    ring.style.setProperty('--voice-live-progress', `${Math.round(progress * 360)}deg`);
  }
}

function appendVoiceScheduleLive(fragment, payload = {}) {
  const schedule = payload.schedule || {};
  const kind = String(schedule.kind || payload.scheduleKind || 'Schedule').trim();
  const message = String(schedule.message || payload.response || `${kind} running`).trim();
  const panel = document.createElement('div');
  panel.className = 'voice-schedule-live';

  const ring = document.createElement('div');
  ring.className = 'voice-live-ring';
  const ringInner = document.createElement('div');
  ringInner.className = 'voice-live-ring-inner';
  const value = document.createElement('strong');
  value.className = 'voice-live-value';
  value.textContent = '0:00';
  const subValue = document.createElement('span');
  subValue.className = 'voice-live-subvalue';
  subValue.textContent = 'Running';
  ringInner.append(value, subValue);
  ring.appendChild(ringInner);

  const details = document.createElement('div');
  details.className = 'voice-live-details';
  const label = document.createElement('span');
  label.className = 'voice-live-kind';
  label.textContent = kind;
  const title = document.createElement('strong');
  title.className = 'voice-live-title';
  title.textContent = message;
  const meta = document.createElement('span');
  meta.className = 'voice-live-meta';
  meta.textContent = schedule.recurrenceLabel || schedule.category || 'Live activity';
  details.append(label, title, meta);

  panel.append(ring, details);
  updateVoiceLiveScheduleDom(panel, schedule);
  stopVoiceLiveScheduleTicker();
  voiceLiveScheduleTimer = setInterval(() => updateVoiceLiveScheduleDom(panel, schedule), 1000);
  fragment.appendChild(panel);
}

function getVoiceAlertAudioContext() {
  if (!voiceAlertAudioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    voiceAlertAudioContext = new Context();
  }
  if (voiceAlertAudioContext.state === 'suspended') {
    voiceAlertAudioContext.resume().catch(() => {});
  }
  return voiceAlertAudioContext;
}

function stopVoiceAlertSound() {
  if (voiceAlertSoundInterval) {
    clearInterval(voiceAlertSoundInterval);
    voiceAlertSoundInterval = null;
  }
  for (const tone of voiceAlertActiveTones) {
    try {
      tone.stop();
    } catch (_) {}
  }
  voiceAlertActiveTones = [];
}

function playVoiceAlertTone(frequency, delay, duration, gainValue = 0.08) {
  const context = getVoiceAlertAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startAt = context.currentTime + delay;
  const stopAt = startAt + duration;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(stopAt + 0.03);
  voiceAlertActiveTones.push(oscillator);
  oscillator.onended = () => {
    voiceAlertActiveTones = voiceAlertActiveTones.filter(tone => tone !== oscillator);
  };
}

function playVoiceScheduleSound(kind) {
  const normalized = String(kind || '').toLowerCase();
  const pattern = normalized === 'alarm'
    ? [[880, 0, 0.16], [660, 0.22, 0.16], [880, 0.44, 0.22]]
    : normalized === 'timer'
      ? [[640, 0, 0.14], [820, 0.18, 0.18]]
      : normalized === 'reminder'
        ? [[560, 0, 0.12], [760, 0.18, 0.16]]
        : null;
  if (!pattern) return;
  stopVoiceAlertSound();
  const playPattern = () => pattern.forEach(([frequency, delay, duration]) => playVoiceAlertTone(frequency, delay, duration));
  playPattern();
  voiceAlertSoundInterval = setInterval(playPattern, normalized === 'alarm' ? 1200 : 2200);
}

function clearVoiceActionCollapseTimer() {
  if (voiceAssistantActionCollapseTimer) {
    clearTimeout(voiceAssistantActionCollapseTimer);
    voiceAssistantActionCollapseTimer = null;
  }
}

function clearVoiceHoverAutoHideTimers() {
  if (voiceHoverAutoHideTimer) {
    clearTimeout(voiceHoverAutoHideTimer);
    voiceHoverAutoHideTimer = null;
  }
  if (voiceHoverAutoHideLeaveTimer) {
    clearTimeout(voiceHoverAutoHideLeaveTimer);
    voiceHoverAutoHideLeaveTimer = null;
  }
  if (voiceHoverAutoHideWatchTimer) {
    clearInterval(voiceHoverAutoHideWatchTimer);
    voiceHoverAutoHideWatchTimer = null;
  }
  voiceHoverAutoHidePayload = null;
}

function refreshVoiceHoverPointerState(root = document.getElementById('voice-overlay')) {
  if (!root) {
    voiceHoverPointerInside = false;
    return false;
  }
  if (root.matches?.(':hover')) {
    voiceHoverPointerInside = true;
    return true;
  }
  if (voiceHoverPointerPosition) {
    const target = document.elementFromPoint(voiceHoverPointerPosition.x, voiceHoverPointerPosition.y);
    voiceHoverPointerInside = Boolean(target && root.contains(target));
    return voiceHoverPointerInside;
  }
  voiceHoverPointerInside = false;
  return false;
}

function collapseVoiceHoverAutoHideResult(delayMs = 0) {
  if (voiceHoverAutoHideWatchTimer) {
    clearInterval(voiceHoverAutoHideWatchTimer);
    voiceHoverAutoHideWatchTimer = null;
  }
  if (voiceHoverAutoHideLeaveTimer) {
    clearTimeout(voiceHoverAutoHideLeaveTimer);
    voiceHoverAutoHideLeaveTimer = null;
  }
  voiceHoverAutoHideLeaveTimer = setTimeout(async () => {
    voiceHoverAutoHideLeaveTimer = null;
    voiceHoverAutoHidePayload = null;
    try {
      await ipcRenderer.invoke('voiceOverlay:collapse', {
        statusText: 'OpenX',
        icon: 'OX'
      });
    } catch (_) {
      renderVoiceAssistantResult({});
    }
  }, Math.max(0, Math.min(5000, Number(delayMs) || 0)));
}

function watchVoiceHoverExit(root = document.getElementById('voice-overlay')) {
  if (voiceHoverAutoHideWatchTimer || !voiceHoverAutoHidePayload) return;
  voiceHoverAutoHideWatchTimer = setInterval(() => {
    if (!voiceHoverAutoHidePayload) {
      clearInterval(voiceHoverAutoHideWatchTimer);
      voiceHoverAutoHideWatchTimer = null;
      return;
    }
    if (!refreshVoiceHoverPointerState(root)) {
      clearInterval(voiceHoverAutoHideWatchTimer);
      voiceHoverAutoHideWatchTimer = null;
      collapseVoiceHoverAutoHideResult(5000);
    }
  }, 500);
}

function ensureVoiceHoverTracking(root) {
  if (!root || voiceHoverTrackingAttached) return;
  voiceHoverTrackingAttached = true;
  const markInside = event => {
    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      voiceHoverPointerPosition = { x: event.clientX, y: event.clientY };
    }
    voiceHoverPointerInside = true;
    if (voiceHoverAutoHideLeaveTimer) {
      clearTimeout(voiceHoverAutoHideLeaveTimer);
      voiceHoverAutoHideLeaveTimer = null;
    }
  };
  const markOutside = () => {
    voiceHoverPointerPosition = null;
    voiceHoverPointerInside = false;
    if (voiceHoverAutoHidePayload && !voiceHoverAutoHideTimer) {
      collapseVoiceHoverAutoHideResult(5000);
    }
  };
  root.addEventListener('mouseenter', markInside);
  root.addEventListener('mousemove', markInside);
  root.addEventListener('pointerenter', markInside);
  root.addEventListener('pointermove', markInside);
  root.addEventListener('mouseleave', markOutside);
  root.addEventListener('pointerleave', markOutside);
}

function scheduleVoiceHoverAutoHide(payload = {}) {
  clearVoiceHoverAutoHideTimers();
  if (payload.hoverHoldAutoHide !== true) return;
  const root = document.getElementById('voice-overlay');
  refreshVoiceHoverPointerState(root);
  const autoHideMs = Math.max(1200, Math.min(30000, Number(payload.autoHideMs) || 15000));
  voiceHoverAutoHidePayload = payload;
  voiceHoverAutoHideTimer = setTimeout(() => {
    voiceHoverAutoHideTimer = null;
    if (refreshVoiceHoverPointerState(root)) {
      watchVoiceHoverExit(root);
      return;
    }
    collapseVoiceHoverAutoHideResult(0);
  }, autoHideMs);
}

function collapseVoiceIslandAfter(delayMs = 80, options = {}) {
  clearVoiceActionCollapseTimer();
  voiceAssistantActionCollapseTimer = setTimeout(async () => {
    voiceAssistantActionCollapseTimer = null;
    try {
      await ipcRenderer.invoke('voiceOverlay:collapse', options);
    } catch (_) {
      renderVoiceAssistantResult({});
    }
  }, Math.max(0, Math.min(1500, Number(delayMs) || 80)));
}

function buildVoiceActionFeedback(action = {}, result = {}) {
  const kind = String(action.kind || action.id || '').toLowerCase();
  const scheduleKind = String(result?.data?.kind || action.scheduleKind || 'Schedule').trim() || 'Schedule';
  const minutes = Math.max(1, Math.min(180, Number(action.minutes) || 5));
  if (kind === 'snooze') {
    return {
      heading: 'Snoozed',
      response: `${scheduleKind} will return in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      icon: 'OK',
      statusText: `Snoozed for ${minutes} min`,
      intent: 'schedule.action',
      displayMode: 'medium'
    };
  }
  if (kind === 'stop' || kind === 'end') {
    return {
      heading: 'Stopped',
      response: `${scheduleKind} dismissed.`,
      icon: 'OK',
      statusText: 'Stopped',
      intent: 'schedule.action',
      displayMode: 'medium'
    };
  }
  if (kind === 'accept') {
    const fileName = String(result?.data?.fileName || action.fileName || 'File').trim() || 'File';
    return {
      heading: 'Receiving',
      response: `${fileName} is being saved to Documents\\OpenX.`,
      icon: 'FI',
      statusText: 'Receiving file',
      intent: 'cloud.fileTransfer.action',
      displayMode: 'medium'
    };
  }
  if (kind === 'reject') {
    return {
      heading: 'Rejected',
      response: 'Incoming file was rejected.',
      icon: 'OK',
      statusText: 'File rejected',
      intent: 'cloud.fileTransfer.action',
      displayMode: 'medium'
    };
  }
  return {
    heading: 'Done',
    response: 'Closed.',
    icon: 'OK',
    statusText: 'Closed',
    intent: 'dismiss',
    displayMode: 'medium'
  };
}

function setVoiceActionRowResolving(row, activeButton, resolving) {
  row.classList.toggle('is-resolving', resolving);
  Array.from(row.querySelectorAll('.voice-action')).forEach(button => {
    button.disabled = resolving;
    button.toggleAttribute('data-active', resolving && button === activeButton);
  });
}

function appendVoiceActions(fragment, payload = {}) {
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  if (actions.length === 0) return;
  const row = document.createElement('div');
  row.className = 'voice-action-row';
  for (const action of actions.slice(0, 3)) {
    const button = document.createElement('button');
    button.className = `voice-action${action.primary ? ' primary' : ''}`;
    button.type = 'button';
    button.textContent = String(action.label || action.id || 'Action');
    button.setAttribute('aria-label', button.textContent);
    button.title = button.textContent;
    button.addEventListener('click', async () => {
      const kind = String(action.kind || action.id || '').toLowerCase();
      const originalLabel = button.textContent;
      setVoiceActionRowResolving(row, button, true);
      button.textContent = kind === 'snooze'
        ? 'Snoozing...'
        : (kind === 'stop' || kind === 'end')
          ? 'Stopping...'
          : kind === 'contact-select'
            ? 'Opening...'
            : kind === 'accept'
              ? 'Accepting...'
              : kind === 'reject'
                ? 'Rejecting...'
                : 'Closing...';
      stopVoiceAlertSound();
      if (['ok', 'dismiss', 'close'].includes(kind)) {
        const feedback = buildVoiceActionFeedback(action);
        collapseVoiceIslandAfter(80, {
          statusText: feedback.statusText,
          icon: feedback.icon,
          hideAfterMs: 5000
        });
        return;
      }
      if (kind === 'open-settings') {
        try {
          await ipcRenderer.invoke('window:openSettings');
        } catch (_) {}
        collapseVoiceIslandAfter(80, {
          statusText: 'Settings opened',
          icon: 'WA',
          hideAfterMs: 5000
        });
        return;
      }
      if (['accept', 'reject'].includes(kind) && action.transferId) {
        try {
          const result = await ipcRenderer.invoke('cloud:fileTransferAction', {
            transferId: action.transferId,
            action: kind
          });
          if (!result?.success) {
            throw new Error(result?.error || 'Action failed');
          }
          const feedback = buildVoiceActionFeedback(action, result);
          collapseVoiceIslandAfter(80, {
            statusText: feedback.statusText,
            icon: feedback.icon,
            hideAfterMs: kind === 'accept' ? 2500 : 5000
          });
        } catch (_) {
          button.textContent = originalLabel;
          setVoiceActionRowResolving(row, button, false);
        }
        return;
      }
      try {
        const scheduleAction = kind === 'end' ? 'stop' : kind;
        const result = await ipcRenderer.invoke('schedule:alertAction', {
          id: action.scheduleId,
          action: scheduleAction,
          minutes: action.minutes || 5
        });
        if (!result?.success) {
          throw new Error(result?.error || 'Action failed');
        }
        const feedback = buildVoiceActionFeedback(action, result);
        collapseVoiceIslandAfter(80, {
          statusText: feedback.statusText,
          icon: feedback.icon,
          hideAfterMs: 5000
        });
      } catch (_) {
        button.textContent = originalLabel;
        setVoiceActionRowResolving(row, button, false);
      }
    });
    row.appendChild(button);
  }
  fragment.appendChild(row);
}

function renderVoiceAssistantResult(payload = {}) {
  const responseEl = document.getElementById('assistant-response');
  if (!responseEl) return;
  const root = document.getElementById('voice-overlay');
  if (voiceAssistantResultClearTimer) {
    clearTimeout(voiceAssistantResultClearTimer);
    voiceAssistantResultClearTimer = null;
  }
  const hasPayload = Boolean(String(payload.response || '').trim()) ||
    Boolean(String(payload.heading || '').trim()) ||
    (Array.isArray(payload.resultEntries) && payload.resultEntries.length > 0) ||
    (Array.isArray(payload.choices) && payload.choices.length > 0) ||
    (Array.isArray(payload.actions) && payload.actions.length > 0);
  if (!hasPayload) {
    stopVoiceLiveScheduleTicker();
    stopVoiceAlertSound();
    clearVoiceActionCollapseTimer();
    clearVoiceHoverAutoHideTimers();
    if (root) root.classList.remove('expanded', 'medium', 'large', 'schedule-due-result', 'schedule-live-result', 'schedule-live-compact');
    responseEl.classList.remove('visible');
    voiceAssistantResultClearTimer = setTimeout(() => {
      voiceAssistantResultClearTimer = null;
      responseEl.replaceChildren();
    }, 180);
    return;
  }
  if (root) {
    ensureVoiceHoverTracking(root);
    const displayMode = String(payload.displayMode || 'expanded').toLowerCase();
    const isScheduleDue = String(payload.intent || '') === 'schedule.due';
    const isScheduleLive = String(payload.intent || '') === 'schedule.live';
    root.classList.add('expanded');
    root.classList.toggle('medium', displayMode === 'medium');
    root.classList.toggle('large', displayMode !== 'medium');
    root.classList.toggle('schedule-due-result', isScheduleDue);
    root.classList.toggle('schedule-live-result', isScheduleLive);
    root.classList.toggle('schedule-live-compact', false);
  }
  responseEl.replaceChildren();
  const fragment = document.createDocumentFragment();
  const heading = String(payload.heading || '').trim();
  if (heading) {
    const headingEl = document.createElement('div');
    headingEl.className = 'voice-response-heading';
    headingEl.textContent = heading;
    fragment.appendChild(headingEl);
  }
  const isScheduleDue = String(payload.intent || '') === 'schedule.due';
  const isScheduleLive = String(payload.intent || '') === 'schedule.live';
  const response = String(payload.response || '').trim();
  if (response && !isScheduleDue && !isScheduleLive) {
    const text = document.createElement('div');
    text.className = 'voice-response-text';
    text.textContent = response;
    fragment.appendChild(text);
  }
  if (isScheduleDue) {
    appendVoiceScheduleDue(fragment, payload);
  }
  if (isScheduleLive) {
    appendVoiceScheduleLive(fragment, payload);
  } else {
    stopVoiceLiveScheduleTicker();
  }
  const entries = Array.isArray(payload.resultEntries) ? payload.resultEntries : [];
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const cards = choices.length > 0 ? choices : entries;
  if (cards.length > 0) {
    const summary = document.createElement('div');
    summary.className = 'voice-content-summary';
    summary.textContent = choices.length > 0
      ? `${cards.length} option${cards.length === 1 ? '' : 's'}`
      : `${cards.length} result${cards.length === 1 ? '' : 's'}`;
    fragment.appendChild(summary);
    const list = document.createElement('ol');
    list.className = 'voice-card-list';
    for (const card of cards.slice(0, 6)) {
      const normalized = choices.length > 0
        ? {
            index: card.index,
            name: voiceResultNameFromPath(card.path, card.title || `Option ${card.index || list.children.length + 1}`),
            path: card.path || card.title || ''
          }
        : card;
      appendVoiceCard(list, normalized, { showPath: choices.length > 0 });
    }
    fragment.appendChild(list);
  }
  appendVoiceActions(fragment, payload);
  responseEl.appendChild(fragment);
  if (String(payload.intent || '') === 'schedule.due') {
    const scheduleKind = payload.scheduleKind || payload.schedule?.kind || '';
    playVoiceScheduleSound(scheduleKind);
  }
  scheduleVoiceHoverAutoHide(payload);
  requestAnimationFrame(() => responseEl.classList.add('visible'));
}

function updateVoiceOverlayDom(message) {
  const operation = message?.operation;
  const view = message?.payload?.view || message?.payload || {};
  const root = document.getElementById('voice-overlay');
  if (!root) return;
  if (operation === 'displayAssistantResult') {
    renderVoiceAssistantResult(message?.payload || {});
    return;
  }
  const title = document.getElementById('title');
  const status = document.getElementById('status');
  const transcript = document.getElementById('transcript');
  const icon = document.getElementById('icon');
  const responseEl = document.getElementById('assistant-response');
  const state = String(view.state || '').toLowerCase();
  const keepExpandedResult = responseEl?.classList?.contains('visible');
  const wasMedium = root.classList.contains('medium');
  const wasLarge = root.classList.contains('large');
  const wasScheduleDue = root.classList.contains('schedule-due-result');
  const wasScheduleLive = root.classList.contains('schedule-live-result');
  const wasScheduleCompact = root.classList.contains('schedule-live-compact');
  root.className = state;
  if (keepExpandedResult) {
    root.classList.add('expanded');
    root.classList.toggle('medium', wasMedium);
    root.classList.toggle('large', wasLarge || !wasMedium);
    root.classList.toggle('schedule-due-result', wasScheduleDue);
    root.classList.toggle('schedule-live-result', wasScheduleLive);
    root.classList.toggle('schedule-live-compact', wasScheduleCompact);
  }
  const presentationClass = String(view.presentationClass || '').trim();
  if (presentationClass) root.classList.add(presentationClass);
  root.tabIndex = root.classList.contains('schedule-live-compact') ? 0 : -1;
  root.setAttribute('aria-label', view.accessibility?.label || view.ariaLabel || view.statusText || 'Voice status');
  root.setAttribute('aria-live', view.accessibility?.live || 'polite');
  if (title) title.textContent = view.title || 'Voice';
  if (status) status.textContent = view.statusText || '';
  if (transcript) {
    const transcriptText = message?.payload?.transcript || view.transcript || view.partialTranscript || view.finalTranscript || '';
    transcript.textContent = transcriptText;
    if (operation === 'updateTranscript' && transcriptText) {
      renderVoiceAssistantResult({});
    }
  }
  if (icon) icon.textContent = formatVoiceIcon(view.icon || 'JA');
  if (operation === 'hideOverlay') {
    root.style.opacity = '0';
    renderVoiceAssistantResult({});
  } else {
    root.style.opacity = '1';
  }
  for (const [name, value] of Object.entries(view.cssVariables || {})) {
    document.documentElement.style.setProperty(name, value);
  }
}

ipcRenderer.on('voiceOverlay:event', (_event, message) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => updateVoiceOverlayDom(message), { once: true });
    return;
  }
  updateVoiceOverlayDom(message);
});

contextBridge.exposeInMainWorld('openxVoiceCapture', {
  ready: () =>
    ipcRenderer.invoke('voiceCapture:report', { event: 'ready', data: {} }),

  report: (event, data = {}) =>
    ipcRenderer.invoke('voiceCapture:report', { event, data }),

  sendFrame: (frame) =>
    ipcRenderer.send('voiceCapture:frame', frame),

  onStart: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Voice capture start listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('voiceCapture:start', handler);
    return () => ipcRenderer.removeListener('voiceCapture:start', handler);
  },

  onStop: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Voice capture stop listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('voiceCapture:stop', handler);
    return () => ipcRenderer.removeListener('voiceCapture:stop', handler);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('voice-overlay');
  if (!root) return;
  const expandLiveSchedule = () => {
    if (!root.classList.contains('schedule-live-compact')) return;
    ipcRenderer.invoke('voiceOverlay:expandLiveSchedule').catch(() => {});
  };
  root.addEventListener('click', event => {
    if (event.target?.closest?.('button')) return;
    expandLiveSchedule();
  });
  root.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    expandLiveSchedule();
  });
});

const openxApi = {
  processCommand: (input, source) =>
    ipcRenderer.invoke('command:process', { input, source }),

  confirmAction: (commandId, intentId, entities) =>
    ipcRenderer.invoke('command:confirm', { commandId, intentId, entities }),

  getStatus: () =>
    ipcRenderer.invoke('assistant:status'),

  speak: (text) =>
    ipcRenderer.invoke('tts:speak', { text }),

  stopSpeaking: () =>
    ipcRenderer.invoke('tts:stop'),

  startVoice: () =>
    ipcRenderer.invoke('voice:start'),

  openChat: () =>
    ipcRenderer.invoke('window:openChat'),

  openDesktopChatApp: () =>
    ipcRenderer.invoke('window:openPeopleChat'),

  openSettings: () =>
    ipcRenderer.invoke('window:openSettings'),

  openPlanner: (view = 'calendar') =>
    ipcRenderer.invoke('window:openPlanner', { view }),

  closePlanner: () =>
    ipcRenderer.invoke('window:closePlanner'),

  openGallery: (view = 'timeline') =>
    ipcRenderer.invoke('window:openGallery', { view }),

  closeGallery: () =>
    ipcRenderer.invoke('window:closeGallery'),

  getConfig: () =>
    ipcRenderer.invoke('config:get'),

  getSettings: () =>
    ipcRenderer.invoke('settings:get'),

  getChatHistory: () =>
    ipcRenderer.invoke('chatHistory:get'),

  saveChatHistory: (entries = []) =>
    ipcRenderer.invoke('chatHistory:save', { entries }),

  clearChatHistory: () =>
    ipcRenderer.invoke('chatHistory:clear'),

  listDesktopChatConversations: (query = {}) =>
    ipcRenderer.invoke('desktopChat:list', query),

  openDesktopChatConversation: (conversationId) =>
    ipcRenderer.invoke('desktopChat:open', { conversationId }),

  createDesktopChatConversation: (conversation = {}) =>
    ipcRenderer.invoke('desktopChat:create', conversation),

  updateDesktopChatConversation: (conversation = {}) =>
    ipcRenderer.invoke('desktopChat:update', conversation),

  deleteDesktopChatConversation: (conversationId) =>
    ipcRenderer.invoke('desktopChat:delete', { conversationId }),

  sendDesktopChatMessage: (message = {}) =>
    ipcRenderer.invoke('desktopChat:send', message),

  getDesktopChatRegistration: () =>
    ipcRenderer.invoke('desktopChat:registration:get'),

  startDesktopChatRegistration: (registration = {}) =>
    ipcRenderer.invoke('desktopChat:registration:start', registration),

  verifyDesktopChatRegistration: (registration = {}) =>
    ipcRenderer.invoke('desktopChat:registration:verify', registration),

  getUiState: () =>
    ipcRenderer.invoke('uiState:get'),

  saveUiState: (state = {}) =>
    ipcRenderer.invoke('uiState:save', state),

  getSecurityStatus: () =>
    ipcRenderer.invoke('security:status'),

  verifySecurityAccess: (password) =>
    ipcRenderer.invoke('security:verifyAccess', { password }),

  setSecurityPassword: (currentPassword, newPassword) =>
    ipcRenderer.invoke('security:setPassword', { currentPassword, newPassword }),

  getCloudStatus: () =>
    ipcRenderer.invoke('cloud:status'),

  connectCloud: (settings = {}) =>
    ipcRenderer.invoke('cloud:connect', settings),

  disconnectCloud: () =>
    ipcRenderer.invoke('cloud:disconnect'),

  generateCloudPairingQR: (password) =>
    ipcRenderer.invoke('cloud:pairingQR:create', { password }),

  getCloudPairingStatus: () =>
    ipcRenderer.invoke('cloud:pairing:status'),

  approveCloudPairing: (pairRequestId) =>
    ipcRenderer.invoke('cloud:pairing:approve', { pairRequestId }),

  rejectCloudPairing: (pairRequestId) =>
    ipcRenderer.invoke('cloud:pairing:reject', { pairRequestId }),

  getPhoneDevices: () =>
    ipcRenderer.invoke('cloud:devices:list'),

  renamePhoneDevice: (deviceId, deviceName) =>
    ipcRenderer.invoke('cloud:device:rename', { deviceId, deviceName }),

  removePhoneDevice: (deviceId) =>
    ipcRenderer.invoke('cloud:device:remove', { deviceId }),

  saveSettings: (settings) =>
    ipcRenderer.invoke('settings:save', settings),

  resetSettings: () =>
    ipcRenderer.invoke('settings:reset'),

  handleScheduleAlert: (id, action, minutes = 5) =>
    ipcRenderer.invoke('schedule:alertAction', { id, action, minutes }),

  getScheduleSnapshot: () =>
    ipcRenderer.invoke('schedule:getSnapshot'),

  getTimerWidgetState: () =>
    ipcRenderer.invoke('timerWidget:getState'),

  closeTimerWidget: () =>
    ipcRenderer.invoke('timerWidget:close'),

  stopStopwatchFromWidget: () =>
    ipcRenderer.invoke('timerWidget:stopStopwatch'),

  resumeStopwatchFromWidget: () =>
    ipcRenderer.invoke('timerWidget:resumeStopwatch'),

  resetStopwatchFromWidget: () =>
    ipcRenderer.invoke('timerWidget:resetStopwatch'),

  getPlannerEntries: () =>
    ipcRenderer.invoke('planner:getEntries'),

  addPlannerEntry: (entry) =>
    ipcRenderer.invoke('planner:addEntry', entry),

  deletePlannerEntry: (id) =>
    ipcRenderer.invoke('planner:deleteEntry', { id }),

  getGalleryPhotos: (query = {}) =>
    ipcRenderer.invoke('gallery:getPhotos', query),

  getGalleryView: (view = 'timeline', query = {}) =>
    ipcRenderer.invoke('gallery:getView', { ...query, view }),

  getGalleryImageData: (photoId) =>
    ipcRenderer.invoke('gallery:getImageData', { photoId }),

  openGalleryPhoto: (photoId) =>
    ipcRenderer.invoke('gallery:openPhoto', { photoId }),

  showGalleryPhoto: (photoId) =>
    ipcRenderer.invoke('gallery:showPhoto', { photoId }),

  toggleGalleryFavorite: (photoId, favorite = null) =>
    ipcRenderer.invoke('gallery:toggleFavorite', { photoId, favorite }),

  nameGalleryFace: (clusterId, name, relationship = '') =>
    ipcRenderer.invoke('gallery:nameFace', { clusterId, name, relationship }),

  setGalleryFaceRelationship: (identityId, relationship = '') =>
    ipcRenderer.invoke('gallery:setFaceRelationship', { identityId, relationship }),

  updateGalleryFacePerson: (identityId, name, relationship = '') =>
    ipcRenderer.invoke('gallery:updateFacePerson', { identityId, name, relationship }),

  deleteGalleryFacePerson: (identityId) =>
    ipcRenderer.invoke('gallery:deleteFacePerson', { identityId }),

  addGalleryFaceToPerson: (clusterId, identityId) =>
    ipcRenderer.invoke('gallery:addFaceToPerson', { clusterId, identityId }),

  removeGalleryFaceCluster: (clusterId) =>
    ipcRenderer.invoke('gallery:removeFaceCluster', { clusterId }),

  scanGalleryPeople: (options = {}) =>
    ipcRenderer.invoke('gallery:scanPeople', options),

  quit: () =>
    ipcRenderer.invoke('app:quit'),

  onSettingsChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Settings listener must be a function');
    }
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('settings:changed', handler);
    return () => ipcRenderer.removeListener('settings:changed', handler);
  },

  onCloudStatus: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Cloud status listener must be a function');
    }
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('cloud:status', handler);
    return () => ipcRenderer.removeListener('cloud:status', handler);
  },

  onCloudPairingStatus: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Cloud pairing listener must be a function');
    }
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('cloud:pairing:status', handler);
    return () => ipcRenderer.removeListener('cloud:pairing:status', handler);
  },

  onScheduleChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Schedule listener must be a function');
    }
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('schedule:changed', handler);
    return () => ipcRenderer.removeListener('schedule:changed', handler);
  },

  onOpenSettings: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Settings open listener must be a function');
    }
    const handler = () => callback();
    ipcRenderer.on('settings:open', handler);
    return () => ipcRenderer.removeListener('settings:open', handler);
  },

  onOpenDesktopChat: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Desktop chat open listener must be a function');
    }
    const handler = () => callback();
    ipcRenderer.on('desktopChat:open', handler);
    return () => ipcRenderer.removeListener('desktopChat:open', handler);
  },

  onDesktopChatChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Desktop chat listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('desktopChat:changed', handler);
    return () => ipcRenderer.removeListener('desktopChat:changed', handler);
  },

  onDesktopChatRegistrationChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Desktop chat registration listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('desktopChat:registrationChanged', handler);
    return () => ipcRenderer.removeListener('desktopChat:registrationChanged', handler);
  },

  onScheduleDue: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Schedule listener must be a function');
    }
    const handler = (_event, schedule) => callback(schedule);
    ipcRenderer.on('schedule:due', handler);
    return () => ipcRenderer.removeListener('schedule:due', handler);
  },

  onTimerWidgetState: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Timer widget listener must be a function');
    }
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('timerWidget:state', handler);
    return () => ipcRenderer.removeListener('timerWidget:state', handler);
  },

  onPlannerView: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Planner view listener must be a function');
    }
    const handler = (_event, view) => callback(view);
    ipcRenderer.on('planner:view', handler);
    return () => ipcRenderer.removeListener('planner:view', handler);
  },

  onPlannerEntriesChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Planner entries listener must be a function');
    }
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('planner:entriesChanged', handler);
    return () => ipcRenderer.removeListener('planner:entriesChanged', handler);
  },

  onGalleryView: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Gallery view listener must be a function');
    }
    const handler = (_event, view) => callback(view);
    ipcRenderer.on('gallery:view', handler);
    return () => ipcRenderer.removeListener('gallery:view', handler);
  },

  onGalleryOpenPhoto: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Gallery photo listener must be a function');
    }
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('gallery:openPhoto', handler);
    return () => ipcRenderer.removeListener('gallery:openPhoto', handler);
  }
};

contextBridge.exposeInMainWorld('openx', openxApi);
contextBridge.exposeInMainWorld('jarvis', openxApi);
