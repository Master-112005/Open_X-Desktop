// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PermissionRegistry {
    enum PermissionStatus {
        GRANTED,
        DENIED,
        PENDING,
        REVOKED,
        EXPIRED,
        UNKNOWN
    }

    struct PermissionRecord {
        bytes32 permissionId;
        string deviceId;
        address walletAddress;
        string permissionName;
        PermissionStatus status;
        address grantedBy;
        uint256 createdAt;
        uint256 updatedAt;
        uint256 expiresAt;
        string version;
    }

    mapping(bytes32 => PermissionRecord) private permissions;
    mapping(bytes32 => bool) private exists;
    mapping(bytes32 => bytes32[]) private devicePermissionIds;

    event PermissionGranted(bytes32 indexed permissionId, string indexed deviceId, string permissionName, PermissionStatus status, address grantedBy);
    event PermissionRemoved(bytes32 indexed permissionId, string indexed deviceId, string permissionName, address removedBy);
    event PermissionUpdated(bytes32 indexed permissionId, string indexed deviceId, string permissionName, PermissionStatus status, address updatedBy);

    function grantPermission(
        string calldata deviceId,
        string calldata walletAddress,
        string calldata permissionName,
        PermissionStatus status,
        uint256 expiresAt,
        string calldata version
    ) external {
        _grantPermission(deviceId, walletAddress, permissionName, status, expiresAt, version);
    }

    function _grantPermission(
        string calldata deviceId,
        string calldata walletAddress,
        string calldata permissionName,
        PermissionStatus status,
        uint256 expiresAt,
        string calldata version
    ) internal {
        bytes32 permissionId = _permissionId(deviceId, permissionName);
        address parsedWallet = _parseAddress(walletAddress);
        if (!exists[permissionId]) {
            devicePermissionIds[keccak256(bytes(deviceId))].push(permissionId);
        }
        permissions[permissionId] = PermissionRecord(
            permissionId,
            deviceId,
            parsedWallet,
            permissionName,
            status,
            msg.sender,
            block.timestamp,
            block.timestamp,
            expiresAt,
            version
        );
        exists[permissionId] = true;
        emit PermissionGranted(permissionId, deviceId, permissionName, status, msg.sender);
    }

    function removePermission(string calldata deviceId, string calldata permissionName) external {
        _removePermission(deviceId, permissionName);
    }

    function _removePermission(string calldata deviceId, string calldata permissionName) internal {
        bytes32 permissionId = _permissionId(deviceId, permissionName);
        require(exists[permissionId], "permission missing");
        PermissionRecord storage record = permissions[permissionId];
        record.status = PermissionStatus.REVOKED;
        record.updatedAt = block.timestamp;
        emit PermissionRemoved(permissionId, deviceId, permissionName, msg.sender);
    }

    function updatePermission(
        string calldata deviceId,
        string calldata walletAddress,
        string calldata permissionName,
        PermissionStatus status,
        uint256 expiresAt,
        string calldata version
    ) external {
        _updatePermission(deviceId, walletAddress, permissionName, status, expiresAt, version);
    }

    function _updatePermission(
        string calldata deviceId,
        string calldata walletAddress,
        string calldata permissionName,
        PermissionStatus status,
        uint256 expiresAt,
        string calldata version
    ) internal {
        bytes32 permissionId = _permissionId(deviceId, permissionName);
        require(exists[permissionId], "permission missing");
        PermissionRecord storage record = permissions[permissionId];
        record.walletAddress = _parseAddress(walletAddress);
        record.status = status;
        record.updatedAt = block.timestamp;
        record.expiresAt = expiresAt;
        record.version = version;
        emit PermissionUpdated(permissionId, deviceId, permissionName, status, msg.sender);
    }

    function checkPermission(string calldata deviceId, string calldata permissionName) external view returns (bool) {
        return _checkPermission(deviceId, permissionName);
    }

    function _checkPermission(string calldata deviceId, string calldata permissionName) internal view returns (bool) {
        PermissionRecord storage record = permissions[_permissionId(deviceId, permissionName)];
        if (record.status != PermissionStatus.GRANTED) return false;
        return record.expiresAt == 0 || record.expiresAt > block.timestamp;
    }

    function permissionExists(string calldata deviceId, string calldata permissionName) external view returns (bool) {
        return _permissionExists(deviceId, permissionName);
    }

    function _permissionExists(string calldata deviceId, string calldata permissionName) internal view returns (bool) {
        return exists[_permissionId(deviceId, permissionName)];
    }

    function getPermission(string calldata deviceId, string calldata permissionName) external view returns (PermissionRecord memory) {
        return _getPermission(deviceId, permissionName);
    }

    function _getPermission(string calldata deviceId, string calldata permissionName) internal view returns (PermissionRecord memory) {
        bytes32 permissionId = _permissionId(deviceId, permissionName);
        require(exists[permissionId], "permission missing");
        return permissions[permissionId];
    }

    function listPermissions(string calldata deviceId) external view returns (bytes32[] memory) {
        return _listPermissions(deviceId);
    }

    function _listPermissions(string calldata deviceId) internal view returns (bytes32[] memory) {
        return devicePermissionIds[keccak256(bytes(deviceId))];
    }

    function GrantPermission(string calldata deviceId, string calldata walletAddress, string calldata permissionName, PermissionStatus status, uint256 expiresAt, string calldata version) external {
        _grantPermission(deviceId, walletAddress, permissionName, status, expiresAt, version);
    }

    function RemovePermission(string calldata deviceId, string calldata permissionName) external {
        _removePermission(deviceId, permissionName);
    }

    function UpdatePermission(string calldata deviceId, string calldata walletAddress, string calldata permissionName, PermissionStatus status, uint256 expiresAt, string calldata version) external {
        _updatePermission(deviceId, walletAddress, permissionName, status, expiresAt, version);
    }

    function CheckPermission(string calldata deviceId, string calldata permissionName) external view returns (bool) {
        return _checkPermission(deviceId, permissionName);
    }

    function PermissionExists(string calldata deviceId, string calldata permissionName) external view returns (bool) {
        return _permissionExists(deviceId, permissionName);
    }

    function GetPermission(string calldata deviceId, string calldata permissionName) external view returns (PermissionRecord memory) {
        return _getPermission(deviceId, permissionName);
    }

    function ListPermissions(string calldata deviceId) external view returns (bytes32[] memory) {
        return _listPermissions(deviceId);
    }

    function _permissionId(string calldata deviceId, string calldata permissionName) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(deviceId, ":", permissionName));
    }

    function _parseAddress(string calldata walletAddress) private pure returns (address) {
        bytes memory input = bytes(walletAddress);
        if (input.length == 0) return address(0);
        require(input.length == 42 && input[0] == bytes1("0") && (input[1] == bytes1("x") || input[1] == bytes1("X")), "invalid address");
        uint160 result = 0;
        for (uint256 i = 2; i < 42; i++) {
            uint8 digit = uint8(input[i]);
            if (digit >= 48 && digit <= 57) result = result * 16 + uint160(digit - 48);
            else if (digit >= 65 && digit <= 70) result = result * 16 + uint160(digit - 55);
            else if (digit >= 97 && digit <= 102) result = result * 16 + uint160(digit - 87);
            else revert("invalid address");
        }
        return address(result);
    }
}
