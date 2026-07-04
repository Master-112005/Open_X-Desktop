const PROTOCOL_VERSION = 1;

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
    return {
      packetId: createId('cloud_packet'),
      protocolVersion: this.version,
      packetType: status === 'completed' ? 'response' : 'error',
      sourceDeviceId: request.destinationDeviceId,
      destinationDeviceId: request.sourceDeviceId,
      ownerId: request.ownerId,
      timestamp: now,
      requestId: request.requestId,
      responseId,
      metadata: {
        feature: 'assistant-command',
        lifecycle: status,
        source: 'desktop',
        destination: 'cloud-phone',
        streaming: false
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
        payload: result || null,
        error,
        metadata: {
          streaming: false,
          structured: Boolean(result && typeof result === 'object')
        }
      }
    };
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
}

module.exports = CloudResponseSerializer;
