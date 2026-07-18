const path = require('path');
const { buildDataPaths } = require('../assistant/Data');

const DATA_ROOT_NAME = 'OpenX_Data';

/**
 * Resolves the shared OpenX data path bundle for Desktop Chat modules.
 * @param {object} options Optional path overrides.
 * @returns {object} Shared assistant data paths.
 */
function resolveChatDataPaths(options = {}) {
  if (options.dataPaths && typeof options.dataPaths === 'object') return options.dataPaths;
  if (options.app?.dataPaths && typeof options.app.dataPaths === 'object') return options.app.dataPaths;
  return buildDataPaths({
    app: {
      dataDir: options.dataRoot || options.dataDir || options.app?.dataDir,
      cloudReceivedDir: options.cloudReceivedDir || options.app?.cloudReceivedDir
    }
  });
}

/**
 * Resolves the desktop Chat data root.
 * @param {object} options Optional path overrides.
 * @returns {string} Absolute data root.
 */
function resolveChatDataRoot(options = {}) {
  return path.resolve(resolveChatDataPaths(options).root);
}

/**
 * Resolves a file path under the desktop Chat data root.
 * @param {string} fileName File name.
 * @param {object} options Optional path overrides.
 * @returns {string} Absolute file path.
 */
function chatDataPath(fileName, options = {}) {
  const dataPaths = resolveChatDataPaths(options);
  if (options.pathKey && dataPaths[options.pathKey]) return dataPaths[options.pathKey];
  return path.join(dataPaths.root, fileName);
}

module.exports = Object.freeze({
  DATA_ROOT_NAME,
  resolveChatDataPaths,
  resolveChatDataRoot,
  chatDataPath
});
