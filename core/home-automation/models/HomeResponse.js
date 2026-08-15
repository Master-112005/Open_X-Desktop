function createHomeResponse(input = {}) {
  return Object.freeze({
    success: input.success === true,
    intent: String(input.intent || 'home.device_control').trim(),
    requestId: String(input.requestId || '').trim(),
    target: String(input.target || '').trim(),
    action: String(input.action || '').trim(),
    message: String(input.message || '').trim(),
    pending: input.pending === true,
    packet: input.packet ? Object.freeze({ ...input.packet }) : null,
    error: input.error ? String(input.error).trim() : null
  });
}

module.exports = {
  createHomeResponse
};
