// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DeviceTrustRegistry {
    enum TrustStatus {
        Trusted,
        Pending,
        Blocked,
        Revoked,
        Unknown,
        Expired
    }

    struct TrustRecord {
        string deviceId;
        address walletAddress;
        TrustStatus status;
        uint256 lastVerified;
        uint256 expiresAt;
        string version;
    }

    mapping(string => TrustRecord) private trustRecords;

    event TrustUpdated(string indexed deviceId, address indexed walletAddress, TrustStatus status, uint256 expiresAt);

    function setTrust(
        string calldata deviceId,
        address walletAddress,
        uint8 status,
        uint256 expiresAt,
        string calldata version
    ) external returns (bool) {
        require(bytes(deviceId).length > 0, "DEVICE_ID_REQUIRED");
        require(walletAddress != address(0), "WALLET_REQUIRED");
        require(status <= uint8(TrustStatus.Expired), "INVALID_STATUS");
        trustRecords[deviceId] = TrustRecord({
            deviceId: deviceId,
            walletAddress: walletAddress,
            status: TrustStatus(status),
            lastVerified: block.timestamp,
            expiresAt: expiresAt,
            version: version
        });
        emit TrustUpdated(deviceId, walletAddress, TrustStatus(status), expiresAt);
        return true;
    }

    function getTrust(string calldata deviceId) external view returns (TrustRecord memory) {
        return trustRecords[deviceId];
    }

    function verifyTrust(string calldata deviceId, address walletAddress) external view returns (bool) {
        TrustRecord memory record = trustRecords[deviceId];
        return record.walletAddress == walletAddress &&
            record.status == TrustStatus.Trusted &&
            record.expiresAt > block.timestamp;
    }

    function blockDevice(string calldata deviceId) external returns (bool) {
        return _setStatus(deviceId, TrustStatus.Blocked);
    }

    function revokeDevice(string calldata deviceId) external returns (bool) {
        return _setStatus(deviceId, TrustStatus.Revoked);
    }

    function restoreTrust(string calldata deviceId, uint256 expiresAt) external returns (bool) {
        TrustRecord storage record = trustRecords[deviceId];
        require(bytes(record.deviceId).length > 0, "TRUST_NOT_FOUND");
        record.status = TrustStatus.Trusted;
        record.expiresAt = expiresAt;
        record.lastVerified = block.timestamp;
        emit TrustUpdated(deviceId, record.walletAddress, record.status, expiresAt);
        return true;
    }

    function trustExists(string calldata deviceId) external view returns (bool) {
        return bytes(trustRecords[deviceId].deviceId).length > 0;
    }

    function getStatus(string calldata deviceId) external view returns (TrustStatus) {
        TrustRecord memory record = trustRecords[deviceId];
        if (bytes(record.deviceId).length == 0) return TrustStatus.Unknown;
        if (record.status == TrustStatus.Trusted && record.expiresAt <= block.timestamp) return TrustStatus.Expired;
        return record.status;
    }

    function _setStatus(string calldata deviceId, TrustStatus status) private returns (bool) {
        TrustRecord storage record = trustRecords[deviceId];
        require(bytes(record.deviceId).length > 0, "TRUST_NOT_FOUND");
        record.status = status;
        record.lastVerified = block.timestamp;
        emit TrustUpdated(deviceId, record.walletAddress, status, record.expiresAt);
        return true;
    }
}
