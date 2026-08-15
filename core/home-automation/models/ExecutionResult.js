function createExecutionResult(input = {}) {
  return Object.freeze({
    success: input.success === true,
    requestId: String(input.requestId || '').trim(),
    target: String(input.target || '').trim(),
    action: String(input.action || '').trim(),
    status: String(input.status || (input.success ? 'prepared' : 'failed')).trim(),
    message: String(input.message || '').trim(),
    error: input.error ? String(input.error).trim() : null,
    data: Object.freeze({ ...(input.data || {}) })
  });
}

module.exports = {
  createExecutionResult
};
