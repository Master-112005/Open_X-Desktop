(function() {
  'use strict';

  const DEFAULT_VISIBLE_MS = 9000;
  const LEAVE_MS = 220;
  const elements = {
    island: document.getElementById('island'),
    label: document.getElementById('island-label'),
    time: document.getElementById('island-time'),
    text: document.getElementById('island-text'),
    snooze: document.getElementById('island-snooze'),
    stop: document.getElementById('island-stop')
  };

  let queue = [];
  let current = null;
  let phaseTimer = null;
  let busy = false;

  function normalizeItem(item = {}) {
    const kind = String(item.kind || item.type || 'assistant').trim().toLowerCase();
    return {
      id: String(item.id || `${kind}-${Date.now()}`),
      kind,
      title: String(item.title || '').trim(),
      text: String(item.text || item.message || item.body || '').trim(),
      dueAt: item.dueAt || item.createdAt || item.time || null,
      visibleMs: Math.max(1800, Math.min(60000, Number(item.visibleMs) || DEFAULT_VISIBLE_MS)),
      snoozeMinutes: Math.max(1, Math.min(60, Number(item.snoozeMinutes) || 5)),
      primaryAction: String(item.primaryAction || '').trim()
    };
  }

  function labelFor(item) {
    if (item.title) return item.title;
    if (item.kind === 'timer') return 'Timer';
    if (item.kind === 'alarm') return 'Alarm';
    if (item.kind === 'schedule' || item.kind === 'calendar') return 'Schedule';
    if (item.kind === 'reminder') return 'Reminder';
    return 'Assistant';
  }

  function primaryActionFor(item) {
    if (item.primaryAction) return item.primaryAction;
    if (item.kind === 'timer' || item.kind === 'alarm') return 'Stop';
    return 'Done';
  }

  function shouldShowSnooze(item) {
    return ['reminder', 'timer', 'alarm', 'schedule', 'calendar'].includes(item.kind);
  }

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function render(item) {
    current = item;
    elements.island.dataset.kind = item.kind;
    elements.label.textContent = labelFor(item);
    elements.time.textContent = formatTime(item.dueAt);
    elements.text.textContent = item.text || labelFor(item);
    elements.stop.textContent = primaryActionFor(item);
    elements.snooze.hidden = !shouldShowSnooze(item);
    elements.island.dataset.phase = 'shown';
    clearTimeout(phaseTimer);
    phaseTimer = setTimeout(() => hideCurrent(false), item.visibleMs);
  }

  function showNext() {
    if (current || queue.length === 0) {
      if (!current && queue.length === 0) window.openx?.islandIdle?.().catch?.(() => {});
      return;
    }
    render(queue.shift());
  }

  function hideCurrent(consumeNext = true) {
    clearTimeout(phaseTimer);
    phaseTimer = null;
    if (!current) {
      showNext();
      return;
    }
    elements.island.dataset.phase = 'leaving';
    const leavingItem = current;
    current = null;
    setTimeout(() => {
      if (!current && elements.island.dataset.phase === 'leaving') {
        elements.island.dataset.phase = 'hidden';
        if (!consumeNext && queue.length === 0) {
          window.openx?.islandIdle?.().catch?.(() => {});
        }
      }
      if (consumeNext) showNext();
    }, LEAVE_MS);
    return leavingItem;
  }

  async function runAction(action) {
    if (!current || busy) return;
    busy = true;
    elements.stop.disabled = true;
    elements.snooze.disabled = true;
    const item = current;
    try {
      if (action === 'snooze') {
        await window.openx?.snoozeIsland?.({ id: item.id, kind: item.kind, minutes: item.snoozeMinutes });
      } else {
        await window.openx?.stopIsland?.({ id: item.id, kind: item.kind });
      }
    } finally {
      busy = false;
      elements.stop.disabled = false;
      elements.snooze.disabled = false;
      hideCurrent(true);
    }
  }

  function enqueue(item) {
    const normalized = normalizeItem(item);
    if (!normalized.text && !normalized.title) return;
    queue.push(normalized);
    showNext();
  }

  elements.stop.addEventListener('click', () => runAction('stop'));
  elements.snooze.addEventListener('click', () => runAction('snooze'));

  if (window.openx?.onIslandShow) {
    window.openx.onIslandShow(item => enqueue(item));
  }
  window.openx?.islandIdle?.().catch?.(() => {});
})();
