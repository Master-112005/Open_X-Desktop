function createHomePacket(input = {}) {
  return Object.freeze({
    type: String(input.type || '').trim(),
    requestId: String(input.requestId || '').trim(),
    target: String(input.target || '').trim(),
    action: String(input.action || '').trim(),
    timestamp: String(input.timestamp || '').trim(),
    expiresAt: String(input.expiresAt || '').trim()
  });
}

module.exports = {
  createHomePacket
};
