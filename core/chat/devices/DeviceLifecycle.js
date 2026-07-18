/**
 * Desktop trusted device lifecycle helper.
 */
class DeviceLifecycle {
  /**
   * Checks whether a device is trusted locally.
   * @param {object|null} device Device state.
   * @returns {boolean} Whether trusted.
   */
  isTrusted(device) {
    return Boolean(device && ['Approved', 'Active'].includes(device.deviceStatus) && device.approvalStatus === 'Approved');
  }
}

module.exports = DeviceLifecycle;
