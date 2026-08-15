function createPendingRequest(input = {}) {
  return Object.freeze({
    requestId: String(input.requestId || '').trim(),
    packet: Object.freeze({ ...(input.packet || {}) }),
    command: Object.freeze({ ...(input.command || {}) }),
    status: String(input.status || 'pending').trim(),
    createdAt: input.createdAt || new Date().toISOString(),
    expiresAt: input.expiresAt || input.packet?.expiresAt || null
  });
}

module.exports = {
  createPendingRequest
};
