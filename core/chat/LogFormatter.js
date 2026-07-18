const DEFAULT_REDACTION_PATTERN = /token|secret|password|authorization|cookie|credential|api[_-]?key|otp|pin|private|key|plaintext|ciphertext|sessionkey|messagekey|filekey|material/i;

function humanKey(key) {
  return String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function redact(value, pattern = DEFAULT_REDACTION_PATTERN, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 5) return '[MaxDepth]';
  if (Array.isArray(value)) return value.slice(0, 25).map(item => redact(item, pattern, depth + 1));
  if (typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = pattern.test(String(key)) ? '[REDACTED]' : redact(child, pattern, depth + 1);
  }
  return output;
}

function formatValue(value) {
  if (value === null || value === undefined) return 'none';
  if (value instanceof Error) return value.message;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return 'empty';
    return /[\s|=]/.test(normalized) ? `"${normalized.slice(0, 160)}"` : normalized.slice(0, 160);
  }
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') {
    const id = value.id || value.accountId || value.deviceId || value.requestId || value.relationshipId || value.status || value.message || value.name;
    if (id) return formatValue(id);
    return formatObjectSummary(value);
  }
  return String(value);
}

function formatObjectSummary(value) {
  const preferred = ['role', 'engine', 'model', 'runtime', 'provider', 'language', 'modelStatus', 'preload', 'files', 'version', 'platform', 'release', 'reason', 'code'];
  const pairs = [];
  const append = key => {
    if (pairs.length >= 5 || !Object.prototype.hasOwnProperty.call(value, key)) return;
    const child = value[key];
    if (child === undefined || child === null || child === '' || typeof child === 'object') return;
    pairs.push(`${humanKey(key)}:${formatValue(child)}`);
  };
  for (const key of preferred) append(key);
  for (const key of Object.keys(value)) {
    if (pairs.length >= 5) break;
    if (!preferred.includes(key)) append(key);
  }
  return pairs.length ? `{${pairs.join(',')}}` : '[object]';
}

function formatData(data) {
  if (data === null || data === undefined || data === '') return '';
  if (typeof data !== 'object' || Array.isArray(data)) return `value=${formatValue(data)}`;
  const pairs = [];
  for (const [key, value] of Object.entries(data)) {
    if (pairs.length >= 16 || value === undefined || value === null || value === '') continue;
    pairs.push(`${humanKey(key)}=${formatValue(value)}`);
  }
  return pairs.join(' | ');
}

function formatLogLine(scope, level, message, data = {}, options = {}) {
  const redacted = redact(data, options.redactionPattern || DEFAULT_REDACTION_PATTERN);
  const details = formatData(redacted);
  const timestamp = new Date().toISOString();
  const levelLabel = String(level || 'info').toUpperCase();
  const scopeLabel = String(scope || 'OpenX').replace(/[\[\]]/g, '');
  return `[${timestamp}] [${levelLabel}] [${scopeLabel}] ${message}${details ? ` | ${details}` : ''}`;
}

module.exports = {
  DEFAULT_REDACTION_PATTERN,
  formatData,
  formatLogLine,
  formatObjectSummary,
  formatValue,
  humanKey,
  redact
};
