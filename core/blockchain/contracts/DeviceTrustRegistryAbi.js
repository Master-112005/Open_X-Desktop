'use strict';

module.exports = Object.freeze([
  'function setTrust(string deviceId,address walletAddress,uint8 status,uint256 expiresAt,string version) returns (bool)',
  'function getTrust(string deviceId) view returns (string deviceId,address walletAddress,uint8 status,uint256 lastVerified,uint256 expiresAt,string version)',
  'function verifyTrust(string deviceId,address walletAddress) view returns (bool)',
  'function blockDevice(string deviceId) returns (bool)',
  'function revokeDevice(string deviceId) returns (bool)',
  'function restoreTrust(string deviceId,uint256 expiresAt) returns (bool)',
  'function trustExists(string deviceId) view returns (bool)',
  'function getStatus(string deviceId) view returns (uint8)'
]);
