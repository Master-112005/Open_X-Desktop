'use strict';

const HOME_BLE_SERVICE_UUID = '6f18c610-7a95-4a5d-9f7a-5f1fd7f3a201';

function normalizeUuid(value) {
  return String(value || '').trim().toLowerCase().replace(/[{}]/g, '');
}

function collectServiceUuids(device = {}) {
  const sources = [
    device.uuids,
    device.serviceUuids,
    device.services,
    device.advertisement?.serviceUuids,
    device.advertisement?.uuids
  ];
  const uuids = [];
  for (const source of sources) {
    if (Array.isArray(source)) uuids.push(...source);
  }
  return uuids.map(normalizeUuid).filter(Boolean);
}

function isOpenXHomeBluetoothDevice(device = {}) {
  const name = String(device.deviceName || device.name || '').trim();
  const loweredName = name.toLowerCase();
  const hasOpenXName = loweredName.includes('openx');
  const hasHomeService = collectServiceUuids(device).includes(HOME_BLE_SERVICE_UUID);
  return hasOpenXName || hasHomeService;
}

function selectHomeBluetoothDevice(devices = []) {
  if (!Array.isArray(devices)) return null;
  return devices.find(isOpenXHomeBluetoothDevice) || null;
}

module.exports = {
  HOME_BLE_SERVICE_UUID,
  isOpenXHomeBluetoothDevice,
  selectHomeBluetoothDevice
};
