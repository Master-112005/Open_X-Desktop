'use strict';

module.exports = Object.freeze([
  'function registerDevice(string deviceId,string deviceType,string identityVersion) returns (bool)',
  'function verifyDevice(string deviceId,address walletAddress) view returns (bool)',
  'function getDevice(string deviceId) view returns (string deviceId,address walletAddress,uint256 registeredAt,string deviceType,uint8 status,string blockchainVersion,string identityVersion,uint256 revokedAt)',
  'function revokeDevice(string deviceId) returns (bool)',
  'function deviceExists(string deviceId) view returns (bool)',
  'event DeviceRegistered(string indexed deviceId,address indexed walletAddress,string deviceType,uint256 registeredAt,string identityVersion)',
  'event DeviceRevoked(string indexed deviceId,address indexed walletAddress,uint256 revokedAt)'
]);
