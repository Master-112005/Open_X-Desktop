function createHomeAutomationUiSnapshot(state) {
  const pending = typeof state?.listPendingRequests === 'function' ? state.listPendingRequests() : [];
  const devices = typeof state?.listDevices === 'function' ? state.listDevices() : [];
  return Object.freeze({
    title: 'Home Automation',
    status: 'Foundation ready',
    deviceList: devices,
    pendingCommands: pending,
    emptyDeviceText: 'No home devices are connected yet.',
    emptyPendingText: 'No pending home automation packets.',
    phase: 'desktop-foundation'
  });
}

module.exports = {
  createHomeAutomationUiSnapshot
};
