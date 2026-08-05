const PROTOCOL_VERSION = 1;
const MAX_RESPONSE_TEXT = 1200;
const MAX_ERROR_TEXT = 400;
const MAX_CHOICES = 8;
const MAX_ENTRIES = 8;
const MAX_FIELD = 320;

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

class CloudResponseSerializer {
  constructor(options = {}) {
    this.version = options.version || PROTOCOL_VERSION;
  }

  serialize({ request, result, status = 'completed', responseType = 'assistant-response', error = null }) {
    const now = Date.now();
    const responseId = createId('cloud_response');
    const normalizedStatus = String(status || '').toLowerCase();
    const isResponseStatus = ['completed', 'processing', 'queued', 'received'].includes(normalizedStatus);
    const payloadResult = responseType === 'schedule-sync'
      ? (result || null)
      : responseType === 'remote-control'
        ? this.sanitizeRemoteResult(result)
        : this.sanitizeAssistantResult(result);
    const feature = responseType === 'schedule-sync'
      ? 'schedule-sync'
      : responseType === 'remote-control'
        ? 'remote-control'
        : 'assistant-command';
    return {
      packetId: createId('cloud_packet'),
      protocolVersion: this.version,
      packetType: isResponseStatus ? 'response' : 'error',
      sourceDeviceId: request.destinationDeviceId,
      destinationDeviceId: request.sourceDeviceId,
      ownerId: request.ownerId,
      timestamp: now,
      requestId: request.requestId,
      responseId,
      metadata: {
        feature,
        lifecycle: status,
        source: 'desktop',
        destination: 'cloud-phone',
        streaming: responseType === 'assistant-status',
        retryable: responseType !== 'remote-control' && responseType !== 'assistant-status'
      },
      checksum: null,
      encryption: null,
      payload: {
        version: this.version,
        requestId: request.requestId,
        responseId,
        status,
        timestamp: now,
        sourceDeviceId: request.destinationDeviceId,
        destinationDeviceId: request.sourceDeviceId,
        responseType,
        payload: payloadResult,
        error,
        metadata: {
          streaming: false,
          structured: Boolean(payloadResult && typeof payloadResult === 'object')
        }
      }
    };
  }

  sanitizeAssistantResult(result = {}) {
    if (!result || typeof result !== 'object') {
      return {
        success: false,
        response: 'Command completed.',
        message: 'Command completed.',
        data: null
      };
    }

    const data = result.data && typeof result.data === 'object' ? result.data : null;
    const safeData = this.sanitizeData(data, result.intent);
    return {
      success: result.success === true,
      response: this.cleanText(result.response || result.message || (result.success === false ? 'Command failed.' : 'Command completed.'), MAX_RESPONSE_TEXT),
      message: this.cleanText(result.message || result.response || (result.success === false ? 'Command failed.' : 'Command completed.'), MAX_RESPONSE_TEXT),
      commandId: this.cleanText(result.commandId || '', 128) || null,
      intent: this.cleanText(result.intent || '', 120) || null,
      needsClarification: result.needsClarification === true,
      requiresConfirmation: result.requiresConfirmation === true,
      entities: this.sanitizePlainObject(result.entities || {}, 20),
      data: safeData,
      error: result.error ? this.cleanText(result.error, MAX_ERROR_TEXT) : null
    };
  }

  sanitizeRemoteResult(result = {}) {
    const data = result?.data && typeof result.data === 'object' ? result.data : {};
    const targets = Array.isArray(data.targets)
      ? data.targets.slice(0, 8).map((target, index) => ({
          index: Number(target?.index) || index + 1,
          id: this.cleanText(target?.id || '', 40),
          label: this.cleanText(target?.label || target?.name || `Target ${index + 1}`, 80),
          kind: this.cleanText(target?.kind || '', 40),
          handle: Number.isSafeInteger(Number(target?.handle)) && Number(target.handle) > 0 ? Number(target.handle) : null,
          processId: Number.isSafeInteger(Number(target?.processId)) && Number(target.processId) > 0 ? Number(target.processId) : null,
          processName: this.cleanText(target?.processName || '', 80),
          windowTitle: this.cleanText(target?.windowTitle || '', MAX_FIELD),
          tabTitle: this.cleanText(target?.tabTitle || '', MAX_FIELD),
          active: target?.active === true,
          source: this.cleanText(target?.source || '', 60)
        }))
      : undefined;
    const safeData = {};
    if (targets) safeData.targets = targets;
    for (const key of ['count', 'generatedAt', 'action', 'targetId', 'targetLabel', 'command', 'matchedWindow', 'verified']) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        safeData[key] = typeof data[key] === 'number' || typeof data[key] === 'boolean'
          ? data[key]
          : this.cleanText(data[key], MAX_FIELD);
      }
    }
    return {
      success: result?.success === true,
      response: this.cleanText(result?.response || result?.message || (result?.success === false ? 'Remote control failed.' : 'Remote control updated.'), MAX_RESPONSE_TEXT),
      message: this.cleanText(result?.message || result?.response || (result?.success === false ? 'Remote control failed.' : 'Remote control updated.'), MAX_RESPONSE_TEXT),
      data: Object.keys(safeData).length > 0 ? safeData : null,
      error: result?.error ? this.cleanText(result.error, MAX_ERROR_TEXT) : null
    };
  }

  sanitizeData(data, intent = '') {
    if (!data) return null;
    const safe = {};
    if (Array.isArray(data.choices)) {
      safe.choices = data.choices.slice(0, MAX_CHOICES).map((choice, index) => ({
        index: Number(choice?.index) || index + 1,
        title: this.cleanText(choice?.title || choice?.name || `Option ${index + 1}`, MAX_FIELD),
        path: this.cleanText(choice?.path || '', MAX_FIELD),
        type: this.cleanText(choice?.type || '', 80),
        entities: this.sanitizePlainObject(choice?.entities || {}, 12)
      }));
    }
    if (Array.isArray(data.entries)) {
      safe.entries = data.entries.slice(0, MAX_ENTRIES).map((entry, index) => this.sanitizeEntry(entry, index, intent));
    }
    if (Array.isArray(data.resultEntries)) {
      safe.resultEntries = data.resultEntries.slice(0, MAX_ENTRIES).map((entry, index) => this.sanitizeEntry(entry, index, intent));
    }
    if (Array.isArray(data.visualResults)) {
      safe.visualResults = data.visualResults.slice(0, MAX_ENTRIES).map((entry, index) => this.sanitizeVisualEntry(entry, index));
    }
    if (data.searchSummary && typeof data.searchSummary === 'object') {
      const sources = Array.isArray(data.searchSummary.sources)
        ? data.searchSummary.sources.slice(0, 4).map((entry, index) => this.sanitizeEntry(entry, index, 'browser.search'))
        : [];
      safe.searchSummary = {
        answer: this.cleanText(data.searchSummary.answer || data.searchSummary.summary || '', MAX_RESPONSE_TEXT),
        sources
      };
    }
    for (const key of ['path', 'filename', 'folderName', 'url', 'query', 'count', 'dueAt', 'kind', 'message', 'title', 'status', 'cloudStatus', 'queuedPosition']) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        safe[key] = typeof data[key] === 'number' || typeof data[key] === 'boolean'
          ? data[key]
          : this.cleanText(data[key], MAX_FIELD);
      }
    }
    return Object.keys(safe).length > 0 ? safe : null;
  }

  sanitizeEntry(entry = {}, index = 0, intent = '') {
    const value = entry && typeof entry === 'object' ? entry : {};
    return {
      index: Number(value.index) || index + 1,
      name: this.cleanText(value.name || value.title || value.sourceDomain || `Result ${index + 1}`, 180),
      title: this.cleanText(value.title || value.name || '', 180),
      type: this.cleanText(value.type || (intent === 'folder.search' ? 'folder' : intent === 'browser.search' ? 'web' : 'file'), 40),
      path: this.cleanText(value.path || value.url || '', MAX_FIELD),
      url: this.cleanText(value.url || value.path || '', MAX_FIELD),
      location: this.cleanText(value.location || value.sourceDomain || '', 140),
      snippet: this.cleanText(value.snippet || value.summary || '', 220),
      sizeMB: Number(value.sizeMB || 0),
      matchScore: Number(value.matchScore || value.score || 0)
    };
  }

  sanitizeVisualEntry(entry = {}, index = 0) {
    const value = entry && typeof entry === 'object' ? entry : {};
    const confidence = Number(value.confidence ?? value.matchScore ?? value.score ?? 0);
    return {
      index: Number(value.index) || index + 1,
      photoId: this.cleanText(value.photoId || value.id || '', 120),
      name: this.cleanText(value.name || value.title || value.fileName || `Photo ${index + 1}`, 180),
      title: this.cleanText(value.title || value.name || value.fileName || '', 180),
      fileName: this.cleanText(value.fileName || '', 180),
      type: this.cleanText(value.type || 'photo', 40),
      path: this.cleanText(value.path || '', MAX_FIELD),
      location: this.cleanText(value.location || '', 140),
      createdAt: this.cleanText(value.createdAt || value.timestamp || '', 80),
      confidence,
      matchScore: confidence <= 1 ? confidence * 100 : confidence
    };
  }

  sanitizePlainObject(value = {}, maxKeys = 16) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    for (const key of Object.keys(value).slice(0, maxKeys)) {
      const current = value[key];
      if (current === null || current === undefined) continue;
      if (typeof current === 'number' || typeof current === 'boolean') {
        output[key] = current;
      } else if (typeof current === 'string') {
        output[key] = this.cleanText(current, MAX_FIELD);
      }
    }
    return output;
  }

  cleanText(value, limit = MAX_FIELD) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  error(request, code, message, metadata = {}) {
    return this.serialize({
      request,
      status: metadata.status || 'failed',
      responseType: 'error',
      result: {
        success: false,
        response: message,
        message,
        error: code,
        data: { code, ...(metadata.data || {}) }
      },
      error: { code, message }
    });
  }

  status(request, status, message, metadata = {}) {
    return this.serialize({
      request,
      status,
      responseType: metadata.responseType || 'assistant-status',
      result: {
        success: true,
        response: message,
        message,
        data: {
          cloudStatus: status,
          ...(metadata.data || {})
        }
      }
    });
  }
}

module.exports = CloudResponseSerializer;
