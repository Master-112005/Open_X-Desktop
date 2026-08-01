'use strict';

const crypto = require('crypto');
const { buildDataPaths, readJsonFile } = require('../../../assistant/Data');

const OWNER_ID_PATTERN = /^home_owner_[a-f0-9]{32}$/;

function generateHomeOwnerId() {
  return `home_owner_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Resolves this desktop install's stable Home Automation owner ID, generating
 * and persisting one under OpenX_Data on first use. Every server request that
 * lists, renames, or removes Home Devices is scoped to this ID so that two
 * different installs never see or modify each other's paired devices.
 */
function resolveHomeOwnerId(options = {}) {
  const config = options.config || {};
  const paths = options.dataPaths || buildDataPaths(config);
  const filePath = options.filePath || paths.homeOwnerIdPath;
  const record = readJsonFile(filePath, () => ({
    ownerId: generateHomeOwnerId(),
    createdAt: new Date().toISOString()
  }), {
    createIfMissing: true,
    validate: value => value && typeof value.ownerId === 'string' && OWNER_ID_PATTERN.test(value.ownerId)
  });
  return record.ownerId;
}

module.exports = { resolveHomeOwnerId, generateHomeOwnerId, OWNER_ID_PATTERN };
