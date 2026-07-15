// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PairRegistry {
    enum PairStatus {
        Pending,
        WaitingApproval,
        Approved,
        Rejected,
        Expired,
        Revoked,
        Failed
    }

    struct PairRecord {
        bytes32 pairHash;
        string desktopDeviceId;
        string phoneDeviceId;
        address desktopWallet;
        address phoneWallet;
        PairStatus status;
        uint256 createdAt;
        uint256 approvedAt;
        uint256 expiresAt;
        string version;
    }

    mapping(bytes32 => PairRecord) private pairs;

    event PairCreated(bytes32 indexed pairHash, string desktopDeviceId, address indexed desktopWallet, uint256 expiresAt, string version);
    event PairApproved(bytes32 indexed pairHash, string phoneDeviceId, address indexed phoneWallet, uint256 approvedAt);
    event PairRejected(bytes32 indexed pairHash, uint256 rejectedAt);
    event PairRevoked(bytes32 indexed pairHash, uint256 revokedAt);

    function createPair(
        bytes32 pairHash,
        string calldata desktopDeviceId,
        address desktopWallet,
        uint256 expiresAt,
        string calldata version
    ) external returns (bool) {
        require(pairHash != bytes32(0), "PAIR_HASH_REQUIRED");
        require(bytes(desktopDeviceId).length > 0, "DESKTOP_DEVICE_REQUIRED");
        require(desktopWallet == msg.sender, "DESKTOP_WALLET_MISMATCH");
        require(expiresAt > block.timestamp, "PAIR_EXPIRED");
        require(pairs[pairHash].pairHash == bytes32(0), "PAIR_EXISTS");

        pairs[pairHash] = PairRecord({
            pairHash: pairHash,
            desktopDeviceId: desktopDeviceId,
            phoneDeviceId: "",
            desktopWallet: desktopWallet,
            phoneWallet: address(0),
            status: PairStatus.WaitingApproval,
            createdAt: block.timestamp,
            approvedAt: 0,
            expiresAt: expiresAt,
            version: version
        });
        emit PairCreated(pairHash, desktopDeviceId, desktopWallet, expiresAt, version);
        return true;
    }

    function approvePair(bytes32 pairHash, string calldata phoneDeviceId, address phoneWallet) external returns (bool) {
        PairRecord storage record = pairs[pairHash];
        require(record.pairHash != bytes32(0), "PAIR_NOT_FOUND");
        require(block.timestamp <= record.expiresAt, "PAIR_EXPIRED");
        require(record.status == PairStatus.WaitingApproval || record.status == PairStatus.Pending, "PAIR_NOT_PENDING");
        require(phoneWallet == msg.sender, "PHONE_WALLET_MISMATCH");
        require(bytes(phoneDeviceId).length > 0, "PHONE_DEVICE_REQUIRED");

        record.phoneDeviceId = phoneDeviceId;
        record.phoneWallet = phoneWallet;
        record.status = PairStatus.Approved;
        record.approvedAt = block.timestamp;
        emit PairApproved(pairHash, phoneDeviceId, phoneWallet, block.timestamp);
        return true;
    }

    function rejectPair(bytes32 pairHash) external returns (bool) {
        PairRecord storage record = pairs[pairHash];
        require(record.pairHash != bytes32(0), "PAIR_NOT_FOUND");
        require(record.status == PairStatus.WaitingApproval || record.status == PairStatus.Pending, "PAIR_NOT_PENDING");
        record.status = PairStatus.Rejected;
        emit PairRejected(pairHash, block.timestamp);
        return true;
    }

    function revokePair(bytes32 pairHash) external returns (bool) {
        PairRecord storage record = pairs[pairHash];
        require(record.pairHash != bytes32(0), "PAIR_NOT_FOUND");
        require(msg.sender == record.desktopWallet || msg.sender == record.phoneWallet, "PAIR_WALLET_REQUIRED");
        record.status = PairStatus.Revoked;
        emit PairRevoked(pairHash, block.timestamp);
        return true;
    }

    function getPair(bytes32 pairHash) external view returns (PairRecord memory) {
        return pairs[pairHash];
    }

    function pairExists(bytes32 pairHash) external view returns (bool) {
        return pairs[pairHash].pairHash != bytes32(0);
    }

    function getStatus(bytes32 pairHash) external view returns (PairStatus) {
        PairRecord memory record = pairs[pairHash];
        if (record.pairHash == bytes32(0)) return PairStatus.Failed;
        if (record.status == PairStatus.WaitingApproval && block.timestamp > record.expiresAt) return PairStatus.Expired;
        return record.status;
    }
}
