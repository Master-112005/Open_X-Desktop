const fs = require('fs');
const Normalizer = require('../../assistant/Data').Normalizer;

const MAX_TEXT_LENGTH = 240;
const STATUS_CONFIDENCE = Object.freeze({
  passed: 0.95,
  failed: 0.9,
  unknown: 0.45
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeText(value, fallback = '') {
  return String(value ?? fallback ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function safeStat(targetPath) {
  const pathValue = String(targetPath || '').trim();
  if (!pathValue) {
    return { exists: false, error: 'No path provided' };
  }

  try {
    if (!fs.existsSync(pathValue)) {
      return { exists: false };
    }
    const stats = fs.statSync(pathValue);
    return {
      exists: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size
    };
  } catch (error) {
    return {
      exists: true,
      readable: false,
      error: sanitizeText(error.message, 'Could not inspect path')
    };
  }
}

function cloneResult(result) {
  if (!isPlainObject(result)) {
    return { success: false, error: 'Action returned an invalid result' };
  }

  return {
    ...result,
    data: isPlainObject(result.data) ? { ...result.data } : result.data
  };
}

function normalizeDetail(detail = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(detail || {})) {
    if (typeof value === 'string') {
      normalized[key] = sanitizeText(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

function evidenceFrom(detail = {}) {
  const evidence = [];
  const fields = [
    ['target', 'target'],
    ['path', 'path'],
    ['url', 'url'],
    ['app', 'app'],
    ['matchedWindow', 'window'],
    ['processName', 'process'],
    ['method', 'method'],
    ['value', 'value'],
    ['count', 'count'],
    ['dueAt', 'time'],
    ['status', 'state']
  ];

  for (const [field, type] of fields) {
    const value = detail[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      evidence.push({ type, value: typeof value === 'string' ? sanitizeText(value) : value });
    }
  }

  return evidence.slice(0, 8);
}

function makeResult(status, check, detail = {}) {
  const normalized = normalizeDetail(detail);
  const {
    status: detailStatus,
    confidence: detailConfidence,
    evidence: detailEvidence,
    ...safeDetail
  } = normalized;
  delete safeDetail.check;
  const resolvedStatus = ['passed', 'failed', 'unknown'].includes(status) ? status : 'unknown';
  return {
    status: resolvedStatus,
    check: sanitizeText(check, 'postcondition'),
    confidence: Number.isFinite(Number(detailConfidence))
      ? Number(detailConfidence)
      : STATUS_CONFIDENCE[resolvedStatus],
    ...(resolvedStatus === 'failed' && safeDetail.blocking === undefined ? { blocking: true } : {}),
    ...safeDetail,
    ...(detailStatus !== undefined ? { state: detailStatus } : {}),
    evidence: Array.isArray(detailEvidence) ? detailEvidence : evidenceFrom(normalized)
  };
}

function ok(check, detail = {}) {
  return makeResult('passed', check, detail);
}

function fail(check, detail = {}) {
  return makeResult('failed', check, detail);
}

function warn(check, detail = {}) {
  return makeResult('unknown', check, { blocking: false, ...detail });
}

class ActionVerifier {
  constructor(controllers = {}) {
    this.controllers = controllers;
  }

  verify(actionId, entities = {}, result = {}) {
    const verified = cloneResult(result);
    const validation = this._validate(actionId, entities, verified);
    const verification = this._verify(actionId, entities, verified);
    const verificationSummary = this._buildVerificationSummary(actionId, validation, verification);

    verified.validation = validation;
    verified.verification = verification;
    verified.verificationSummary = verificationSummary;
    if (isPlainObject(verified.data)) {
      verified.data.validation = validation;
      verified.data.verification = verification;
      verified.data.verificationSummary = verificationSummary;
    }

    if (verified.success && validation.status === 'failed') {
      verified.success = false;
      verified.error = validation.message || `Validation failed for ${actionId}`;
    }

    if (verified.success && verification.status === 'failed' && verification.blocking !== false) {
      verified.success = false;
      verified.error = verification.message || `Could not verify ${actionId}`;
    }

    return verified;
  }

  _buildVerificationSummary(actionId, validation, verification) {
    const validationPassed = validation.status === 'passed';
    const verificationPassed = verification.status === 'passed';
    const verificationFailed = verification.status === 'failed';
    return {
      actionId: sanitizeText(actionId, 'action'),
      validationStatus: validation.status,
      verificationStatus: verification.status,
      confidence: Math.min(
        Number(validation.confidence ?? STATUS_CONFIDENCE[validation.status] ?? 0.45),
        Number(verification.confidence ?? STATUS_CONFIDENCE[verification.status] ?? 0.45)
      ),
      verified: validationPassed && verificationPassed,
      blockingFailure: verificationFailed && verification.blocking !== false,
      evidenceCount: Array.isArray(verification.evidence) ? verification.evidence.length : 0,
      check: verification.check
    };
  }

  _validate(actionId, entities, result) {
    if (!result.success) {
      return warn('result-success', { reason: result.error || 'action failed before validation' });
    }

    const required = this._requiredFields(actionId);
    const missing = required.filter(field => !this._hasValue(entities[field]));
    if (missing.length > 0) {
      return fail('required-entities', {
        missing,
        message: `Missing required value: ${missing.join(', ')}`
      });
    }

    if (actionId.startsWith('browser.') && this._hasValue(result.data?.url) && !this._looksLikeUrl(result.data.url)) {
      return fail('result-url', { message: `Invalid URL returned: ${result.data.url}` });
    }

    if (actionId === 'app.open') {
      const wantsNewWindow = entities.forceNewWindow === true || entities.requestedOperation === 'open-new-window';
      if (wantsNewWindow && result.data?.launchMethod === 'focus-existing') {
        return fail('app-open-operation', {
          message: 'The command requested a new app window, but the existing window was focused'
        });
      }
      if (wantsNewWindow && result.data?.forceNewWindow !== true) {
        return fail('app-open-operation', {
          message: 'The new-window requirement was not preserved during execution'
        });
      }
      if (!wantsNewWindow && result.data?.forceNewWindow === true) {
        return fail('app-open-operation', {
          message: 'A new app window was launched without being requested'
        });
      }
    }

    if (actionId === 'system.calculate' && !Number.isFinite(Number(result.data?.result))) {
      return fail('calculation-result', { message: 'Calculation did not produce a finite number' });
    }

    if ((actionId === 'volume.set' || actionId === 'brightness.set') && !Number.isFinite(Number(result.data?.value))) {
      return fail('device-value', { message: `${actionId} did not return a readable device value` });
    }

    return ok('required-entities');
  }

  _verify(actionId, entities, result) {
    if (!result.success) {
      return warn('postcondition', { reason: result.error || 'action failed before verification' });
    }

    const usesDomainVerifier = actionId.startsWith('calendar.') ||
      actionId.startsWith('timetable.') ||
      actionId.startsWith('volume.') ||
      actionId.startsWith('brightness.');
    if (result.data?.verified === true && !actionId.startsWith('app.') && !usesDomainVerifier) {
      return ok(result.data?.verification?.check || 'controller-verification', {
        method: result.data?.launchMethod || 'controller',
        target: this._targetLabel(actionId, entities, result),
        ...(result.data?.matchedWindow ? { matchedWindow: result.data.matchedWindow } : {})
      });
    }
    if (result.data?.verified === false && !actionId.startsWith('app.') && !usesDomainVerifier) {
      return fail('controller-verification', {
        method: 'controller',
        target: this._targetLabel(actionId, entities, result),
        message: result.error || 'Controller could not verify the action'
      });
    }

    if (actionId.startsWith('file.')) {
      return this._verifyFileAction(actionId, result);
    }

    if (actionId.startsWith('folder.')) {
      return this._verifyFolderAction(actionId, result);
    }

    if (actionId === 'app.open') {
      return this._verifyAppOpen(entities, result);
    }

    if (actionId === 'app.close') {
      return this._verifyAppClose(entities, result);
    }

    if (actionId === 'app.newTab') {
      return result.data?.verified === true && result.data?.matchedWindow
        ? ok('app-new-tab', {
            app: Normalizer.normalizeText(entities.appName || result.data?.app || ''),
            matchedWindow: result.data.matchedWindow,
            shortcut: result.data.shortcut || ''
          })
        : fail('app-new-tab', {
            message: `Could not verify that a new tab opened in ${entities.appName || 'the requested application'}`
          });
    }

    if (actionId === 'app.switch') {
      return result.data?.matchedWindow
        ? ok('app-focused', {
            app: Normalizer.normalizeText(result.data?.app || entities.appName || ''),
            matchedWindow: result.data.matchedWindow,
            method: result.data?.launchMethod || 'window-focus'
          })
        : fail('app-focused', { message: 'No application window was confirmed in the foreground' });
    }

    if (actionId.startsWith('browser.')) {
      return this._verifyBrowserAction(actionId, result);
    }

    if (actionId.startsWith('calendar.') || actionId.startsWith('timetable.')) {
      return this._verifyPlannerAction(actionId, result);
    }

    if (actionId.startsWith('volume.') || actionId.startsWith('brightness.')) {
      return this._verifyDeviceAction(actionId, entities, result);
    }

    if (actionId.startsWith('window.')) {
      return result.data?.matchedWindow
        ? ok('window-target', { matchedWindow: result.data.matchedWindow, method: 'window-session' })
        : warn('window-target', { reason: 'Window command was dispatched without a readable target', blocking: false });
    }

    if (actionId.startsWith('system.')) {
      return this._verifySystemAction(actionId, result);
    }

    if (actionId.startsWith('media.')) {
      return result.data?.action || result.data?.mediaQuery || result.data?.videoId
        ? ok('media-command', { method: 'controller-result' })
        : warn('media-command', { reason: 'Media command was dispatched without a readable playback state', blocking: false });
    }

    if (actionId.startsWith('timer.') || actionId.startsWith('alarm.') || actionId.startsWith('reminder.') || actionId.startsWith('stopwatch.')) {
      return this._verifyScheduleAction(actionId, result);
    }

    if (actionId === 'message.compose' || actionId === 'email.compose' || actionId === 'call.start') {
      return this._verifyCommunicationAction(actionId, result);
    }

    return warn('postcondition', {
      reason: 'No concrete postcondition is available for this action',
      blocking: false
    });
  }

  _verifySystemAction(actionId, result) {
    const data = result.data || {};
    if (actionId === 'system.calculate') {
      return Number.isFinite(Number(data.result))
        ? ok('calculation-result', { result: Number(data.result) })
        : fail('calculation-result', { message: 'Calculation did not produce a finite number' });
    }

    if (['system.time', 'system.date', 'system.cpu', 'system.memory', 'system.battery', 'system.disk', 'system.status', 'system.processes', 'system.insight'].includes(actionId)) {
      return Object.keys(data).length > 0
        ? ok('system-read', { fields: Object.keys(data) })
        : warn('system-read', { reason: 'No system data returned', blocking: false });
    }

    if (actionId === 'system.bluetooth') {
      return data.available === false
        ? fail('bluetooth-state', { message: 'Bluetooth device not found' })
        : ok('bluetooth-state', { enabled: data.enabled, status: data.status });
    }

    if (actionId === 'system.screenshot') {
      if (isPlainObject(data.verification) && data.verification.status === 'passed') {
        return ok(data.verification.check || 'screenshot-file-created', {
          filePath: data.filePath,
          size: data.size,
          method: data.method || 'screenshot-controller'
        });
      }
      return fail(data.verification?.check || 'screenshot-file-created', {
        message: data.verification?.message || result.error || 'Screenshot file was not created'
      });
    }

    if (isPlainObject(data.verification)) {
      return data.verification.status === 'failed'
        ? fail(data.verification.check || 'system-postcondition', {
            message: data.verification.message || result.error || 'System command could not be verified',
            ...data.verification
          })
        : warn(data.verification.check || 'system-postcondition', {
            reason: data.verification.reason || 'System command was dispatched without a safe immediate postcondition',
            blocking: false,
            ...data.verification
          });
    }

    return warn('system-postcondition', {
      reason: 'System command was dispatched; Windows does not expose a safe immediate postcondition here',
      blocking: false
    });
  }

  _verifyPlannerAction(actionId, result) {
    const data = result.data || {};
    if (actionId.endsWith('.open')) {
      return data.view
        ? ok(data.verification?.check || 'planner-open', { view: data.view, count: data.count || 0 })
        : warn('planner-open', { reason: 'Planner window open request did not return a view', blocking: false });
    }

    if (actionId.endsWith('.add')) {
      const entry = data.entry || {};
      return entry.id && entry.title && entry.date && data.verified !== false
        ? ok(data.verification?.check || 'planner-entry-persisted', {
            entryId: entry.id,
            view: entry.type || data.view,
            date: entry.date,
            startTime: entry.startTime || '',
            operation: data.operation || 'add'
          })
        : fail('planner-entry-persisted', {
            message: 'Planner entry was not persisted with the required title and date'
          });
    }

    return warn('planner-postcondition', { blocking: false });
  }

  _verifyDeviceAction(actionId, entities, result) {
    const data = result.data || {};
    const value = Number(data.value);
    const requested = Number.isFinite(Number(data.requestedValue))
      ? Number(data.requestedValue)
      : Number(entities.value);
    const deviceVerification = isPlainObject(data.verification) ? data.verification : null;

    if (deviceVerification?.status === 'failed') {
      return fail(deviceVerification.check || 'device-postcondition', {
        message: deviceVerification.message || result.error || 'Windows did not confirm the device state',
        ...deviceVerification
      });
    }

    if (!Number.isFinite(value)) {
      return warn('device-value', {
        reason: data.supported === false ? 'Device control is not supported on this system' : 'No readable value returned',
        blocking: data.supported === false
      });
    }

    if (value < 0 || value > 100) {
      return fail('device-value-range', {
        value,
        message: 'Device value is outside the expected 0-100 range'
      });
    }

    if (actionId.endsWith('.set') && Number.isFinite(requested) && Math.abs(value - requested) > 5) {
      return warn('device-readback-adjusted', {
        value,
        requestedValue: requested,
        reason: 'Windows or display hardware reported a nearby supported level',
        blocking: false
      });
    }

    if (actionId === 'volume.mute' && data.muted !== true) {
      return fail('volume-muted', { message: 'Windows did not report the endpoint as muted' });
    }

    if (actionId === 'volume.unmute' && data.muted === true) {
      return fail('volume-unmuted', { message: 'Windows still reports the endpoint as muted' });
    }

    return ok(deviceVerification?.check || 'device-readback', {
      value,
      requestedValue: Number.isFinite(requested) ? requested : undefined,
      muted: data.muted,
      method: data.method || 'windows-device-control',
      source: data.source || 'windows'
    });
  }

  _verifyScheduleAction(actionId, result) {
    const data = result.data || {};
    if (isPlainObject(data.verification) && data.verification.status === 'passed') {
      return ok(data.verification.check || 'schedule-state', {
        id: data.id || data.taskName,
        kind: data.kind,
        status: data.status,
        dueAt: data.dueAt,
        operation: data.operation
      });
    }

    if (/\.(?:list|clear)$/.test(actionId)) {
      return Number.isFinite(Number(data.count))
        ? ok(actionId.endsWith('.list') ? 'schedule-list' : 'schedule-cleared', { count: Number(data.count) })
        : warn('schedule-count', { reason: 'Schedule count was not returned', blocking: false });
    }

    if (actionId.startsWith('stopwatch.')) {
      return Number.isFinite(Number(data.elapsedMs ?? 0)) || data.status
        ? ok('stopwatch-state', { status: data.status, elapsedMs: data.elapsedMs })
        : warn('stopwatch-state', { reason: 'Stopwatch state was not returned', blocking: false });
    }

    const dueAt = Date.parse(data.dueAt || '');
    if (['paused', 'completed', 'due'].includes(String(data.status || '').toLowerCase())) {
      return ok('schedule-state', { status: data.status, id: data.id || data.taskName });
    }

    return Number.isFinite(dueAt) && dueAt > Date.now()
      ? ok('scheduled-time', { dueAt: data.dueAt, id: data.id || data.taskName })
      : fail('scheduled-time', { message: 'Scheduled task does not have a future due time' });
  }

  _verifyFileAction(actionId, result) {
    const data = result.data || {};
    const target = data.path || data.newPath || data.destination;
    const source = data.source || data.oldPath;

    if (actionId === 'file.delete') {
      const deletedPath = source || data.path;
      const state = safeStat(deletedPath);
      return deletedPath
        ? (!state.exists
            ? ok('file-deleted', { path: deletedPath })
            : fail('file-deleted', { path: deletedPath, message: 'File still exists after delete' }))
        : warn('file-deleted', { reason: 'No deleted path returned', blocking: false });
    }

    if (actionId === 'file.move') {
      if (!target) return warn('file-moved', { reason: 'No destination returned', blocking: false });
      const targetState = safeStat(target);
      if (!targetState.exists || targetState.readable === false || !targetState.isFile) {
        return fail('file-moved', { path: target, message: 'Destination file was not found after move' });
      }
      if (source && safeStat(source).exists) {
        return fail('file-moved', { path: source, message: 'Source file still exists after move' });
      }
      return ok('file-moved', { path: target });
    }

    if (actionId === 'file.copy' || actionId === 'file.rename' || actionId === 'file.create') {
      if (!target) return warn('file-exists', { reason: 'No target path returned', blocking: false });
      const targetState = safeStat(target);
      if (targetState.readable === false) {
        return fail('file-exists', { path: target, message: `Could not inspect target file: ${targetState.error}` });
      }
      return targetState.exists && targetState.isFile
        ? ok('file-exists', { path: target, size: targetState.size })
        : fail('file-exists', { path: target, message: 'Expected file was not found' });
    }

    if (actionId === 'file.open') {
      const targetState = safeStat(data.path);
      return data.path && targetState.exists && targetState.isFile
        ? ok('file-target', { path: data.path, size: targetState.size })
        : fail('file-target', { path: data.path, message: 'Opened file target no longer exists' });
    }

    if (actionId === 'file.search' || actionId === 'file.list') {
      return Number.isFinite(Number(data.count))
        ? ok('result-count', { count: Number(data.count) })
        : warn('result-count', { reason: 'No result count returned', blocking: false });
    }

    return warn('file-postcondition', { blocking: false });
  }

  _verifyFolderAction(actionId, result) {
    const data = result.data || {};
    const target = data.path || data.destination;
    const source = data.source;

    if (actionId === 'folder.delete') {
      const targetState = safeStat(target);
      return target
        ? (!targetState.exists
            ? ok('folder-deleted', { path: target })
            : fail('folder-deleted', { path: target, message: 'Folder still exists after delete' }))
        : warn('folder-deleted', { reason: 'No deleted path returned', blocking: false });
    }

    if (actionId === 'folder.move') {
      if (!target) return warn('folder-moved', { reason: 'No destination returned', blocking: false });
      const targetState = safeStat(target);
      if (!targetState.exists || targetState.readable === false || !targetState.isDirectory) {
        return fail('folder-moved', { path: target, message: 'Destination folder was not found after move' });
      }
      if (source && safeStat(source).exists) {
        return fail('folder-moved', { path: source, message: 'Source folder still exists after move' });
      }
      return ok('folder-moved', { path: target });
    }

    if (actionId === 'folder.create' || actionId === 'folder.open') {
      const targetState = safeStat(target);
      return target && targetState.exists && targetState.isDirectory
        ? ok('folder-exists', { path: target })
        : fail('folder-exists', { path: target, message: 'Expected folder was not found' });
    }

    return warn('folder-postcondition', { blocking: false });
  }

  _verifyAppOpen(entities, result) {
    const appName = Normalizer.normalizeText(entities.appName || result.data?.app || result.data?.appName || '');
    const wantsNewWindow = entities.forceNewWindow === true || entities.requestedOperation === 'open-new-window';
    if (result.data?.launchMethod === 'folder' && result.data?.path) {
      const targetState = safeStat(result.data.path);
      return targetState.exists
        ? ok('folder-fallback-target', { path: result.data.path })
        : fail('folder-fallback-target', { path: result.data.path, message: 'Folder fallback target does not exist' });
    }

    if (result.data?.launchMethod === 'chrome-web-app-fallback' && result.data?.url) {
      return this._looksLikeUrl(result.data.url)
        ? ok('app-web-fallback', {
            app: appName,
            url: result.data.url,
            browserName: result.data.browserName || 'chrome'
          })
        : fail('app-web-fallback', {
            app: appName,
            url: result.data.url,
            message: 'Invalid web app fallback URL'
          });
    }

    if (wantsNewWindow) {
      if (result.data?.newWindowVerified === true) {
        return ok('app-new-window', {
          app: appName,
          beforeWindowCount: Number(result.data.beforeWindowCount || 0),
          afterWindowCount: Number(result.data.afterWindowCount || 0),
          launchMethod: result.data.launchMethod,
          launchArguments: result.data.launchArguments || []
        });
      }
      if (result.data?.newWindowVerified === null) {
        return warn('app-new-window', {
          app: appName,
          reason: 'The new-window launch was dispatched, but Windows window observation was unavailable',
          blocking: false
        });
      }
      return fail('app-new-window', {
        app: appName,
        beforeWindowCount: Number(result.data?.beforeWindowCount || 0),
        afterWindowCount: Number(result.data?.afterWindowCount || 0),
        message: `Could not verify that a new ${appName} window opened`
      });
    }

    if (result.data?.launchMethod === 'focus-existing') {
      return result.data?.matchedWindow
        ? ok('app-existing-focused', {
            app: appName,
            matchedWindow: result.data.matchedWindow,
            processName: result.data.processName || ''
          })
        : fail('app-existing-focused', {
            app: appName,
            message: `Could not verify that the existing ${appName} window was focused`
          });
    }

    const apps = this.controllers.apps;
    const found = typeof apps?.waitForVisibleApp === 'function'
      ? apps.waitForVisibleApp(appName)
      : this._findAppWindowOrProcess(appName);
    if (found) {
      return ok('app-open', { app: appName, matchedWindow: found.title || found.MainWindowTitle || '', processName: found.processName || found.ProcessName || '' });
    }

    return warn('app-open', {
      app: appName,
      reason: 'The launch was dispatched, but no matching visible process was available yet',
      blocking: false
    });
  }

  _verifyAppClose(entities, result) {
    const appName = Normalizer.normalizeText(result.data?.app || entities.appName || '');
    const apps = this.controllers.apps;
    if (typeof apps?.waitForAppClosed === 'function') {
      return apps.waitForAppClosed(appName)
        ? ok('app-closed', { app: appName })
        : fail('app-closed', {
            app: appName,
            message: `${appName} still appears to be open`
          });
    }

    const found = this._findAppWindowOrProcess(appName, { visibleOnly: true });
    return found
      ? fail('app-closed', {
          app: appName,
          matchedWindow: found.title || found.MainWindowTitle || '',
          message: `${appName} still appears to be open`
        })
      : ok('app-closed', { app: appName });
  }

  _verifyBrowserAction(actionId, result) {
    const data = result.data || {};
    if (actionId === 'browser.listTabs') {
      return Number.isFinite(Number(data.count))
        ? ok('browser-tabs-read', {
            count: Number(data.count),
            limitation: data.limitation,
            verifiedAllTabs: data.verifiedAllTabs === true
          })
        : warn('browser-tabs-read', { reason: 'No browser tab count returned', blocking: false });
    }

    if (actionId === 'browser.search' && data.background) {
      return Array.isArray(data.results)
        ? ok('background-search-results', { count: data.results.length })
        : warn('background-search-results', { reason: 'No search results array returned', blocking: false });
    }

    if (data.url && this._looksLikeUrl(data.url)) {
      return data.controllerVerified === true
        ? ok(data.verification?.check || 'browser-target-url', {
            url: data.url,
            method: data.launchMethod || 'launch-dispatch',
            matchedWindow: data.matchedWindow || undefined
          })
        : warn(data.verification?.check || 'browser-launch-dispatch', {
            url: data.url,
            method: data.launchMethod || 'launch-dispatch',
            reason: data.verification?.reason || 'Browser launch was dispatched, but the final tab was not observed.',
            blocking: false
          });
    }

    return warn('browser-postcondition', { blocking: false });
  }

  _verifyCommunicationAction(actionId, result) {
    const data = result.data || {};
    if (actionId === 'email.compose') {
      if (data.needsDetails) {
        return ok('email-contact-resolved', { contactName: data.contactName, email: data.email });
      }
      return data.url && /^mailto:/i.test(data.url)
        ? ok('email-draft-uri', { contactName: data.contactName, email: data.email })
        : fail('email-draft-uri', { message: 'Email draft did not produce a mailto URL' });
    }

    if (actionId === 'message.compose') {
      return data.contactName || data.messageText || data.url
        ? ok('message-draft', { contactName: data.contactName, platform: data.platform })
        : warn('message-draft', { reason: 'No message draft data returned', blocking: false });
    }

    if (actionId === 'call.start') {
      return data.contactName || data.url
        ? ok('call-target', { contactName: data.contactName, platform: data.platform })
        : warn('call-target', { reason: 'No call target data returned', blocking: false });
    }

    return warn('communication-postcondition', { blocking: false });
  }

  _findAppWindowOrProcess(appName, options = {}) {
    if (!appName) {
      return null;
    }

    const windows = this._listWindows();
    const normalized = Normalizer.normalizeText(appName);
    const windowMatch = windows.find(window => {
      const title = Normalizer.normalizeText(window.title || '');
      const processName = Normalizer.normalizeText(window.processName || '');
      const titleMatch = Boolean(title) && title.includes(normalized);
      const processMatch = Boolean(processName) &&
        (processName.includes(normalized) || normalized.includes(processName));
      return titleMatch || processMatch;
    });
    if (windowMatch) {
      return windowMatch;
    }

    if (options.visibleOnly) {
      return null;
    }

    const apps = this.controllers.apps;
    if (apps && typeof apps._findRunningProcesses === 'function' && typeof apps._resolveProcessCandidates === 'function') {
      const candidates = apps._resolveProcessCandidates(normalized);
      const processes = apps._findRunningProcesses(normalized, candidates);
      return Array.isArray(processes) ? processes[0] : null;
    }

    return null;
  }

  _listWindows() {
    try {
      const windows = this.controllers.windows?.listWindows?.() || [];
      return Array.isArray(windows) ? windows : [];
    } catch (error) {
      return [];
    }
  }

  _requiredFields(actionId) {
    const map = {
      'app.open': ['appName'],
      'app.newTab': ['appName'],
      'app.close': ['appName'],
      'app.switch': ['appName'],
      'file.create': ['filename'],
      'file.open': ['filename'],
      'file.delete': ['filename'],
      'file.rename': ['oldName', 'newName'],
      'file.copy': ['source', 'destination'],
      'file.move': ['source', 'destination'],
      'file.search': ['query'],
      'folder.create': ['folderName'],
      'folder.delete': ['folderName'],
      'folder.open': ['folderName'],
      'folder.move': ['source', 'destination'],
      'browser.open': ['url'],
      'browser.openTab': ['tabQuery'],
      'browser.search': ['query'],
      'browser.siteSearch': ['site', 'query'],
      'system.insight': ['insightType'],
      'media.play': ['mediaQuery'],
      'message.compose': ['contactName', 'messageText'],
      'email.compose': ['contactName'],
      'call.start': ['contactName'],
      'timer.set': ['duration'],
      'alarm.set': ['timeExpression'],
      'reminder.set': ['reminderText'],
      'system.calculate': ['expression'],
      'window.minimize': ['windowName'],
      'window.maximize': ['windowName'],
      'window.close': ['windowName']
    };
    return map[actionId] || [];
  }

  _targetLabel(actionId, entities, result) {
    return result.data?.path ||
      result.data?.url ||
      result.data?.app ||
      result.data?.browserName ||
      entities.appName ||
      entities.query ||
      actionId;
  }

  _hasValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  _looksLikeUrl(value) {
    const source = String(value || '').trim();
    if (/^(?:https?|mailto|chrome|edge|about|file):/i.test(source)) {
      return true;
    }
    try {
      new URL(source);
      return true;
    } catch (err) {
      return false;
    }
  }
}

module.exports = ActionVerifier;
