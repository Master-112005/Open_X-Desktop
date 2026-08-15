function createHomeCommand(input = {}) {
  return Object.freeze({
    intent: String(input.intent || 'home.device_control').trim(),
    target: String(input.target || '').trim(),
    action: String(input.action || '').trim(),
    displayTarget: String(input.displayTarget || input.target || '').trim(),
    value: input.value === undefined ? null : input.value,
    rawText: String(input.rawText || '').trim(),
    source: String(input.source || 'assistant').trim()
  });
}

module.exports = {
  createHomeCommand
};
