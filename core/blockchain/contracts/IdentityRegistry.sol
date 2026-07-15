// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    enum DeviceStatus {
        Unknown,
        Registered,
        Revoked
    }

    struct DeviceRecord {
        string deviceId;
        address walletAddress;
        uint256 registeredAt;
        string deviceType;
        DeviceStatus status;
        string blockchainVersion;
        string identityVersion;
        uint256 revokedAt;
    }

    string public constant blockchainVersion = "openx-avalanche-phase2";

    mapping(string => DeviceRecord) private devices;
    mapping(address => string) private walletDeviceIds;

    event DeviceRegistered(
        string indexed deviceId,
        address indexed walletAddress,
        string deviceType,
        uint256 registeredAt,
        string identityVersion
    );

    event DeviceRevoked(
        string indexed deviceId,
        address indexed walletAddress,
        uint256 revokedAt
    );

    function registerDevice(
        string calldata deviceId,
        string calldata deviceType,
        string calldata identityVersion
    ) external returns (bool) {
        require(bytes(deviceId).length > 0, "DEVICE_ID_REQUIRED");
        require(bytes(deviceType).length > 0, "DEVICE_TYPE_REQUIRED");
        require(bytes(devices[deviceId].deviceId).length == 0, "DEVICE_ALREADY_REGISTERED");
        require(bytes(walletDeviceIds[msg.sender]).length == 0, "WALLET_ALREADY_REGISTERED");

        devices[deviceId] = DeviceRecord({
            deviceId: deviceId,
            walletAddress: msg.sender,
            registeredAt: block.timestamp,
            deviceType: deviceType,
            status: DeviceStatus.Registered,
            blockchainVersion: blockchainVersion,
            identityVersion: identityVersion,
            revokedAt: 0
        });
        walletDeviceIds[msg.sender] = deviceId;

        emit DeviceRegistered(deviceId, msg.sender, deviceType, block.timestamp, identityVersion);
        return true;
    }

    function verifyDevice(
        string calldata deviceId,
        address walletAddress
    ) external view returns (bool) {
        DeviceRecord memory record = devices[deviceId];
        return record.walletAddress == walletAddress &&
            record.status == DeviceStatus.Registered &&
            bytes(record.deviceId).length > 0;
    }

    function getDevice(
        string calldata deviceId
    ) external view returns (DeviceRecord memory) {
        return devices[deviceId];
    }

    function revokeDevice(string calldata deviceId) external returns (bool) {
        DeviceRecord storage record = devices[deviceId];
        require(bytes(record.deviceId).length > 0, "DEVICE_NOT_FOUND");
        require(record.walletAddress == msg.sender, "ONLY_DEVICE_WALLET");
        require(record.status == DeviceStatus.Registered, "DEVICE_NOT_REGISTERED");

        record.status = DeviceStatus.Revoked;
        record.revokedAt = block.timestamp;

        emit DeviceRevoked(deviceId, msg.sender, block.timestamp);
        return true;
    }

    function deviceExists(string calldata deviceId) external view returns (bool) {
        return bytes(devices[deviceId].deviceId).length > 0;
    }
}
