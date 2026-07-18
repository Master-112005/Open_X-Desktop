const os = require('os');
const path = require('path');

const DATA_ROOT_NAME = 'OpenX_Data';

/**
 * Resolves the desktop Chat data root.
 * @param {object} options Optional path overrides.
 * @returns {string} Absolute data root.
 */
function resolveChatDataRoot(options = {}) {
  const configured = String(options.dataRoot || process.env.OPENX_DATA_DIR || '').trim();
  return path.resolve(configured || path.join(os.homedir(), DATA_ROOT_NAME));
}

/**
 * Resolves a file path under the desktop Chat data root.
 * @param {string} fileName File name.
 * @param {object} options Optional path overrides.
 * @returns {string} Absolute file path.
 */
function chatDataPath(fileName, options = {}) {
  return path.join(resolveChatDataRoot(options), fileName);
}

module.exports = Object.freeze({
  DATA_ROOT_NAME,
  resolveChatDataRoot,
  chatDataPath
});
