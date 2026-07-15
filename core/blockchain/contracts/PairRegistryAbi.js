'use strict';

module.exports = Object.freeze([
  'function createPair(bytes32 pairHash,string desktopDeviceId,address desktopWallet,uint256 expiresAt,string version) returns (bool)',
  'function approvePair(bytes32 pairHash,string phoneDeviceId,address phoneWallet) returns (bool)',
  'function rejectPair(bytes32 pairHash) returns (bool)',
  'function revokePair(bytes32 pairHash) returns (bool)',
  'function getPair(bytes32 pairHash) view returns (bytes32 pairHash,string desktopDeviceId,string phoneDeviceId,address desktopWallet,address phoneWallet,uint8 status,uint256 createdAt,uint256 approvedAt,uint256 expiresAt,string version)',
  'function pairExists(bytes32 pairHash) view returns (bool)',
  'function getStatus(bytes32 pairHash) view returns (uint8)',
  'event PairCreated(bytes32 indexed pairHash,string desktopDeviceId,address indexed desktopWallet,uint256 expiresAt,string version)',
  'event PairApproved(bytes32 indexed pairHash,string phoneDeviceId,address indexed phoneWallet,uint256 approvedAt)',
  'event PairRejected(bytes32 indexed pairHash,uint256 rejectedAt)',
  'event PairRevoked(bytes32 indexed pairHash,uint256 revokedAt)'
]);
