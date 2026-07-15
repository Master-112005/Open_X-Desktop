'use strict';

module.exports = Object.freeze([
  'function grantPermission(string deviceId,string walletAddress,string permissionName,uint8 status,uint256 expiresAt,string version) external',
  'function removePermission(string deviceId,string permissionName) external',
  'function updatePermission(string deviceId,string walletAddress,string permissionName,uint8 status,uint256 expiresAt,string version) external',
  'function checkPermission(string deviceId,string permissionName) external view returns (bool)',
  'function permissionExists(string deviceId,string permissionName) external view returns (bool)',
  'function getPermission(string deviceId,string permissionName) external view returns (tuple(bytes32 permissionId,string deviceId,address walletAddress,string permissionName,uint8 status,address grantedBy,uint256 createdAt,uint256 updatedAt,uint256 expiresAt,string version))',
  'function listPermissions(string deviceId) external view returns (bytes32[])',
  'event PermissionGranted(bytes32 indexed permissionId,string indexed deviceId,string permissionName,uint8 status,address grantedBy)',
  'event PermissionRemoved(bytes32 indexed permissionId,string indexed deviceId,string permissionName,address removedBy)',
  'event PermissionUpdated(bytes32 indexed permissionId,string indexed deviceId,string permissionName,uint8 status,address updatedBy)'
]);
