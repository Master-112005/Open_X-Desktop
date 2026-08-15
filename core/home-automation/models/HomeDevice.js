function createHomeDevice(input = {}) {
  return Object.freeze({
    id: String(input.id || '').trim(),
    name: String(input.name || input.id || '').trim(),
    type: String(input.type || 'unknown').trim(),
    room: String(input.room || '').trim(),
    status: String(input.status || 'unknown').trim(),
    lastSeenAt: input.lastSeenAt || null,
    metadata: Object.freeze({ ...(input.metadata || {}) })
  });
}

module.exports = {
  createHomeDevice
};
