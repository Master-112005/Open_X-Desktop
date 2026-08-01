const assert = require('assert');

const {
  HOME_BLE_SERVICE_UUID,
  isOpenXHomeBluetoothDevice,
  selectHomeBluetoothDevice
} = require('../../apps/desktop/electron/home-bluetooth-selection');

describe('Home Bluetooth device selection', function() {
  it('does not auto-select a lone unknown Bluetooth device', function() {
    const selected = selectHomeBluetoothDevice([{
      deviceName: 'Unknown or Unsupported Device (D4:E9:F4:E6:CC:DA)',
      deviceId: 'unknown-device-id'
    }]);

    assert.equal(selected, null);
  });

  it('selects OpenX devices by name or provisioning service UUID', function() {
    const byName = { deviceName: 'OpenX Home Device', deviceId: 'device_1' };
    const byService = {
      deviceName: 'Unknown or Unsupported Device (D4:E9:F4:E6:CC:DA)',
      deviceId: 'device_2',
      serviceUuids: [HOME_BLE_SERVICE_UUID.toUpperCase()]
    };

    assert.equal(isOpenXHomeBluetoothDevice(byName), true);
    assert.equal(isOpenXHomeBluetoothDevice(byService), true);
    assert.equal(selectHomeBluetoothDevice([{ deviceName: 'Headphones', deviceId: 'audio_1' }, byService]), byService);
  });
});
