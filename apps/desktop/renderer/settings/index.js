(function () {
  'use strict';

  const els = {};
  let settingsSnapshot = null;
  let presentation = null;
  let saveTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function text(id, value) {
    if (els[id]) els[id].textContent = String(value || '');
  }

  function unwrap(result) {
    return result && result.data !== undefined ? result.data : result;
  }

  function formatDate(value, fallback = 'Not available') {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function model() {
    return presentation?.model || {};
  }

  function renderStatus() {
    const current = model();
    const progress = current.progress || {};
    const version = current.version || {};
    const health = current.health || {};
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    text('status-summary', current.status?.message || 'Update status unavailable.');
    text('state-pill', current.status?.label || current.state || 'Unknown');
    text('status-label', current.status?.label || 'Unknown');
    text('status-message', current.status?.message || 'No update status is available.');
    text('progress-percent', `${percent}%`);
    text('progress-detail', [progress.speedLabel, progress.etaLabel, progress.transferredLabel].filter(Boolean).join(' · ') || 'No active download');
    if (els.progressBar) els.progressBar.style.width = `${percent}%`;
    text('current-version', version.currentVersionLabel || version.currentVersion || 'Unknown');
    text('latest-version', version.latestVersionLabel || version.latestVersion || 'Unknown');
    text('channel', version.channel || 'stable');
    text('release-date', formatDate(version.releaseDate));
    text('last-checked', formatDate(current.generatedAt, 'Not checked'));
    text('verification-state', version.verificationStatus || health.verification || 'Ready');
    text('package-state', version.packageStatus || health.download || 'Idle');
    text('health-state', health.offline ? 'Offline' : `${health.updateEngine || 'Unknown'} / ${current.status?.health || 'unknown'}`);
    document.body.dataset.state = String(current.state || 'idle').toLowerCase();
  }

  function renderActions() {
    const actions = Array.isArray(model().actions) ? model().actions : [];
    els.updateActions.replaceChildren();
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `action${action.primary ? ' primary' : ''}`;
      button.textContent = action.label || action.id;
      button.disabled = action.enabled === false || action.future === true;
      button.title = action.reason || action.label || action.id;
      button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
      button.addEventListener('click', () => executeAction(action.id, button));
      els.updateActions.appendChild(button);
    }
  }

  function renderReleaseNotes() {
    const notes = model().releaseNotes || {};
    text('release-summary', notes.summary || 'No release notes available for this update.');
    els.releaseSections.replaceChildren();
    const sections = Array.isArray(notes.sections) ? notes.sections : [];
    for (const section of sections) {
      if (!Array.isArray(section.items) || section.items.length === 0) continue;
      const article = document.createElement('article');
      article.className = 'release-section';
      const heading = document.createElement('h3');
      heading.textContent = section.title || section.id || 'Notes';
      const list = document.createElement('ul');
      for (const item of section.items.slice(0, 12)) {
        const li = document.createElement('li');
        li.textContent = String(item).slice(0, 240);
        list.appendChild(li);
      }
      article.append(heading, list);
      els.releaseSections.appendChild(article);
    }
  }

  function updateToggle(id, value) {
    if (els[id]) els[id].checked = value === true;
  }

  function updateNumber(id, value, fallback) {
    if (!els[id]) return;
    const number = Number(value);
    els[id].value = String(Number.isFinite(number) ? Math.round(number) : fallback);
  }

  function secondsToMs(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(5, Math.min(600, Math.round(number))) * 1000;
  }

  function renderPreferences() {
    const update = settingsSnapshot?.settings?.update || {};
    const presentationSettings = update.presentation || {};
    updateToggle('prefCheckStartup', update.checkOnStartup === true || update.versionCheck?.checkOnStartup === true);
    updateToggle('prefAutoDownload', update.automaticDownload === true);
    updateToggle('prefAutoInstall', update.automaticInstall === true);
    updateToggle('prefInstallEnabled', update.installation?.enabled !== false);
    updateToggle('prefInstallConfirm', update.installation?.requireConfirmation !== false);
    updateToggle('prefSelfUpdateEnabled', update.selfUpdate?.enabled !== false && update.selfUpdate?.silentInstallationEnabled !== false);
    updateToggle('prefSelfUpdateRestart', update.selfUpdate?.restartAfterInstall !== false);
    updateToggle('prefSelfUpdatePreserve', update.selfUpdate?.preserveSession !== false);
    updateToggle('prefSelfUpdateFutureAuto', update.selfUpdate?.futureAutomaticRestart === true);
    updateToggle('prefRecoveryEnabled', update.recovery?.enabled !== false && update.recovery?.automaticRollback !== false);
    updateToggle('prefRecoveryStartupValidation', update.recovery?.startupValidationEnabled !== false);
    updateToggle('prefRecoveryLogging', update.recovery?.loggingEnabled !== false);
    updateToggle('prefRecoveryDiagnostics', update.recovery?.diagnosticsEnabled !== false);
    updateNumber('prefRecoveryStartupTimeout', Math.round((update.recovery?.startupTimeoutMs || 120000) / 1000), 120);
    updateNumber('prefRecoveryHealthTimeout', Math.round((update.recovery?.healthTimeoutMs || 30000) / 1000), 30);
    updateToggle('prefNotify', presentationSettings.notifyAboutUpdates !== false);
    updateToggle('prefIsland', presentationSettings.showDynamicIsland !== false);
    updateToggle('prefAssistant', presentationSettings.assistantUpdates !== false);
    updateToggle('prefVoice', presentationSettings.voiceUpdates !== false);
    updateToggle('prefHighContrast', presentationSettings.highContrast === true);
    updateToggle('prefReducedMotion', presentationSettings.reducedMotion === true);
    updateToggle('prefUpdateLogging', update.loggingEnabled !== false);
    updateToggle('prefDiagnostics', update.diagnosticsEnabled !== false);
    document.body.classList.toggle('high-contrast', presentationSettings.highContrast === true);
    document.body.classList.toggle('reduced-motion', presentationSettings.reducedMotion === true);
  }

  async function savePreferences() {
    clearTimeout(saveTimer);
    text('settingsSaveState', 'Saving...');
    saveTimer = setTimeout(async () => {
      const previous = settingsSnapshot?.settings || {};
      const previousUpdate = previous.update || {};
      const previousPresentation = previousUpdate.presentation || {};
      const next = {
        ...previous,
        update: {
          ...previousUpdate,
          checkOnStartup: els.prefCheckStartup.checked,
          automaticDownload: els.prefAutoDownload.checked,
          automaticInstall: els.prefAutoInstall.checked,
          loggingEnabled: els.prefUpdateLogging.checked,
          diagnosticsEnabled: els.prefDiagnostics.checked,
          installation: {
            ...(previousUpdate.installation || {}),
            enabled: els.prefInstallEnabled.checked,
            requireConfirmation: true,
            loggingEnabled: els.prefDiagnostics.checked,
            diagnosticsEnabled: els.prefDiagnostics.checked
          },
          selfUpdate: {
            ...(previousUpdate.selfUpdate || {}),
            enabled: els.prefSelfUpdateEnabled.checked,
            silentInstallationEnabled: els.prefSelfUpdateEnabled.checked,
            restartAfterInstall: els.prefSelfUpdateRestart.checked,
            preserveSession: els.prefSelfUpdatePreserve.checked,
            futureAutomaticRestart: els.prefSelfUpdateFutureAuto.checked,
            loggingEnabled: els.prefUpdateLogging.checked,
            diagnosticsEnabled: els.prefDiagnostics.checked
          },
          recovery: {
            ...(previousUpdate.recovery || {}),
            enabled: els.prefRecoveryEnabled.checked,
            automaticRollback: els.prefRecoveryEnabled.checked,
            startupValidationEnabled: els.prefRecoveryStartupValidation.checked,
            loggingEnabled: els.prefRecoveryLogging.checked,
            diagnosticsEnabled: els.prefRecoveryDiagnostics.checked,
            startupTimeoutMs: secondsToMs(els.prefRecoveryStartupTimeout.value, previousUpdate.recovery?.startupTimeoutMs || 120000),
            healthTimeoutMs: secondsToMs(els.prefRecoveryHealthTimeout.value, previousUpdate.recovery?.healthTimeoutMs || 30000)
          },
          versionCheck: {
            ...(previousUpdate.versionCheck || {}),
            checkOnStartup: els.prefCheckStartup.checked
          },
          presentation: {
            ...previousPresentation,
            notifyAboutUpdates: els.prefNotify.checked,
            showNotifications: els.prefNotify.checked,
            showDynamicIsland: els.prefIsland.checked,
            assistantUpdates: els.prefAssistant.checked,
            voiceUpdates: els.prefVoice.checked,
            highContrast: els.prefHighContrast.checked,
            reducedMotion: els.prefReducedMotion.checked,
            preferredView: 'overview',
            expandedSections: ['version', 'download', 'releaseNotes']
          }
        }
      };
      try {
        const result = await window.openx.saveSettings(next);
        settingsSnapshot = result || { settings: next };
        text('settingsSaveState', 'Saved');
        renderPreferences();
      } catch (_) {
        text('settingsSaveState', 'Save failed');
      }
    }, 220);
  }

  async function executeAction(actionId, button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Working...';
    try {
      if (actionId === 'install') {
        await window.openx.installUpdate({ source: 'settings' });
      } else if (actionId === 'selfUpdate') {
        await window.openx.selfUpdate({ source: 'settings' });
      } else {
        await window.openx.executeUpdateAction(actionId, { source: 'settings' });
      }
      await refreshPresentation();
    } catch (_) {
      text('status-summary', 'Update action failed.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function refreshPresentation() {
    const result = await window.openx.getUpdatePresentation({ source: 'settings', view: 'overview' });
    presentation = unwrap(result);
    renderStatus();
    renderActions();
    renderReleaseNotes();
  }

  async function initialize() {
    for (const element of document.querySelectorAll('[id]')) {
      const camel = element.id.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      els[camel] = element;
    }
    els.progressBar = $('progress-bar');
    els.updateActions = $('update-actions');
    els.releaseSections = $('release-sections');
    settingsSnapshot = await window.openx.getSettings();
    renderPreferences();
    await refreshPresentation();
    $('open-assistant').addEventListener('click', () => window.openx.openChat());
    $('close-window').addEventListener('click', () => window.close());
    $('refresh-presentation').addEventListener('click', refreshPresentation);
    for (const input of document.querySelectorAll('.toggle input')) {
      input.addEventListener('change', savePreferences);
    }
    for (const input of document.querySelectorAll('.recovery-input')) {
      input.addEventListener('input', savePreferences);
    }
    window.addEventListener('beforeunload', () => {
      const width = window.outerWidth || 960;
      const height = window.outerHeight || 720;
      const previous = settingsSnapshot?.settings || {};
      const previousUpdate = previous.update || {};
      window.openx.saveSettings({
        ...previous,
        update: {
          ...previousUpdate,
          presentation: {
            ...(previousUpdate.presentation || {}),
            windowState: { width, height, maximized: false }
          }
        }
      }).catch(() => {});
    });
  }

  initialize().catch(() => {
    text('status-summary', 'Failed to load update settings.');
  });
}());
