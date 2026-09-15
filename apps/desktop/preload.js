const { contextBridge, ipcRenderer } = require('electron');

const openxApi = {
  processCommand: (input, source) =>
    ipcRenderer.invoke('command:process', { input, source }),

  confirmAction: (commandId, intentId, entities) =>
    ipcRenderer.invoke('command:confirm', { commandId, intentId, entities }),

  getStatus: () =>
    ipcRenderer.invoke('assistant:status'),


  openChat: () =>
    ipcRenderer.invoke('window:openChat'),

  hideChat: () =>
    ipcRenderer.invoke('window:hideChat'),

  openVoice: () =>
    ipcRenderer.invoke('window:openVoice'),

  closeVoice: () =>
    ipcRenderer.invoke('voice:close'),

  getVoiceActivation: () =>
    ipcRenderer.invoke('voice:getActivation'),

  getVoiceSettings: () =>
    ipcRenderer.invoke('voice:getSettings'),

  updateVoiceSettings: (settings = {}) =>
    ipcRenderer.invoke('voice:updateSettings', settings),

  transcribeVoice: (samples) =>
    ipcRenderer.invoke('voice:transcribe', samples),

  processVoiceCommand: (input) =>
    ipcRenderer.invoke('command:process', { input, source: 'voice' }),

  openSettings: () =>
    ipcRenderer.invoke('window:openSettings'),

  openPlanner: (view = 'calendar') =>
    ipcRenderer.invoke('window:openPlanner', { view }),

  closePlanner: () =>
    ipcRenderer.invoke('window:closePlanner'),

  getConfig: () =>
    ipcRenderer.invoke('config:get'),

  getSettings: () =>
    ipcRenderer.invoke('settings:get'),

  getAssistantChatHistory: () =>
    ipcRenderer.invoke('assistantChatHistory:get'),

  getAssistantChatHistorySync: () => {
    const result = ipcRenderer.sendSync('assistantChatHistory:getSync');
    if (!result?.success) throw new Error(result?.error || 'Unable to load chat history');
    return result;
  },

  saveAssistantChatHistory: (entries = []) =>
    ipcRenderer.invoke('assistantChatHistory:save', { entries }),

  saveAssistantChatHistorySync: (entries = []) => {
    const result = ipcRenderer.sendSync('assistantChatHistory:saveSync', { entries });
    if (!result?.success) throw new Error(result?.error || 'Unable to save chat history');
    return result;
  },

  clearAssistantChatHistory: () =>
    ipcRenderer.invoke('assistantChatHistory:clear'),

  listRemoteTargets: () =>
    ipcRenderer.invoke('remote:listTargets'),

  sendRemoteControl: (payload = {}) =>
    ipcRenderer.invoke('remote:control', payload),

  getHomeOnboardingSnapshot: () =>
    ipcRenderer.invoke('homeOnboarding:snapshot'),

  getSelectedHomeBluetoothDevice: () =>
    ipcRenderer.invoke('homeOnboarding:getBluetoothSelection'),

  startHomeDiscovery: () =>
    ipcRenderer.invoke('homeOnboarding:startDiscovery'),

  stopHomeDiscovery: () =>
    ipcRenderer.invoke('homeOnboarding:stopDiscovery'),

  addDiscoveredHomeDevice: (device = {}) =>
    ipcRenderer.invoke('homeOnboarding:addDiscoveredDevice', device),

  startHomeOnboarding: (deviceId) =>
    ipcRenderer.invoke('homeOnboarding:start', { deviceId }),

  configureHomeDevice: (configuration = {}) =>
    ipcRenderer.invoke('homeOnboarding:configure', configuration),

  waitForHomeDeviceConnection: (sessionId) =>
    ipcRenderer.invoke('homeOnboarding:waitForConnection', { sessionId }),

  approveHomeDevicePairing: (sessionId, ownerId) =>
    ipcRenderer.invoke('homeOnboarding:approve', { sessionId, ownerId }),

  renameHomeDevice: (deviceId, deviceName, ownerId) =>
    ipcRenderer.invoke('homeOnboarding:renameDevice', { deviceId, deviceName, ownerId }),

  removeHomeDevice: (deviceId, ownerId) =>
    ipcRenderer.invoke('homeOnboarding:removeDevice', { deviceId, ownerId }),

  refreshHomeDevice: (deviceId) =>
    ipcRenderer.invoke('homeOnboarding:refreshDevice', { deviceId }),

  finishHomeOnboarding: (sessionId) =>
    ipcRenderer.invoke('homeOnboarding:finish', { sessionId }),

  cancelHomeOnboarding: (sessionId) =>
    ipcRenderer.invoke('homeOnboarding:cancel', { sessionId }),

  getUiState: () =>
    ipcRenderer.invoke('uiState:get'),

  saveUiState: (state = {}) =>
    ipcRenderer.invoke('uiState:save', state),

  getSecurityStatus: () =>
    ipcRenderer.invoke('security:status'),

  verifySecurityAccess: (password) =>
    ipcRenderer.invoke('security:verifyAccess', { password }),

  setSecurityPassword: (currentPassword, newPassword) =>
    ipcRenderer.invoke('security:setPassword', { currentPassword, newPassword }),

  getCloudStatus: () =>
    ipcRenderer.invoke('cloud:status'),

  connectCloud: (settings = {}) =>
    ipcRenderer.invoke('cloud:connect', settings),

  disconnectCloud: () =>
    ipcRenderer.invoke('cloud:disconnect'),

  generateCloudPairingQR: (password) =>
    ipcRenderer.invoke('cloud:pairingQR:create', { password }),

  getCloudPairingStatus: () =>
    ipcRenderer.invoke('cloud:pairing:status'),

  approveCloudPairing: (pairRequestId) =>
    ipcRenderer.invoke('cloud:pairing:approve', { pairRequestId }),

  rejectCloudPairing: (pairRequestId) =>
    ipcRenderer.invoke('cloud:pairing:reject', { pairRequestId }),

  getPhoneDevices: () =>
    ipcRenderer.invoke('cloud:devices:list'),

  renamePhoneDevice: (deviceId, deviceName) =>
    ipcRenderer.invoke('cloud:device:rename', { deviceId, deviceName }),

  removePhoneDevice: (deviceId) =>
    ipcRenderer.invoke('cloud:device:remove', { deviceId }),

  saveSettings: (settings) =>
    ipcRenderer.invoke('settings:save', settings),

  resetSettings: () =>
    ipcRenderer.invoke('settings:reset'),

  handleScheduleAlert: (id, action, minutes = 5) =>
    ipcRenderer.invoke('schedule:alertAction', { id, action, minutes }),

  stopIsland: (payload = {}) =>
    ipcRenderer.invoke('island:stop', payload),

  snoozeIsland: (payload = {}) =>
    ipcRenderer.invoke('island:snooze', payload),

  islandIdle: () =>
    ipcRenderer.invoke('island:idle'),

  getScheduleSnapshot: () =>
    ipcRenderer.invoke('schedule:getSnapshot'),

  getTimerWidgetState: () =>
    ipcRenderer.invoke('timerWidget:getState'),

  closeTimerWidget: () =>
    ipcRenderer.invoke('timerWidget:close'),

  stopStopwatchFromWidget: () =>
    ipcRenderer.invoke('timerWidget:stopStopwatch'),

  resumeStopwatchFromWidget: () =>
    ipcRenderer.invoke('timerWidget:resumeStopwatch'),

  resetStopwatchFromWidget: () =>
    ipcRenderer.invoke('timerWidget:resetStopwatch'),

  getPlannerEntries: () =>
    ipcRenderer.invoke('planner:getEntries'),

  addPlannerEntry: (entry) =>
    ipcRenderer.invoke('planner:addEntry', entry),

  deletePlannerEntry: (id) =>
    ipcRenderer.invoke('planner:deleteEntry', { id }),

  quit: () =>
    ipcRenderer.invoke('app:quit'),

  onSettingsChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Settings listener must be a function');
    }
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('settings:changed', handler);
    return () => ipcRenderer.removeListener('settings:changed', handler);
  },

  onCloudStatus: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Cloud status listener must be a function');
    }
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('cloud:status', handler);
    return () => ipcRenderer.removeListener('cloud:status', handler);
  },

  onCloudPairingStatus: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Cloud pairing listener must be a function');
    }
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('cloud:pairing:status', handler);
    return () => ipcRenderer.removeListener('cloud:pairing:status', handler);
  },

  onHomeOnboardingChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Home onboarding listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('homeOnboarding:changed', handler);
    return () => ipcRenderer.removeListener('homeOnboarding:changed', handler);
  },

  onScheduleChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Schedule listener must be a function');
    }
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('schedule:changed', handler);
    return () => ipcRenderer.removeListener('schedule:changed', handler);
  },

  onConversationAppend: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Conversation listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('conversation:append', handler);
    return () => ipcRenderer.removeListener('conversation:append', handler);
  },

  onOpenSettings: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Settings open listener must be a function');
    }
    const handler = () => callback();
    ipcRenderer.on('settings:open', handler);
    return () => ipcRenderer.removeListener('settings:open', handler);
  },

  onScheduleDue: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Schedule listener must be a function');
    }
    const handler = (_event, schedule) => callback(schedule);
    ipcRenderer.on('schedule:due', handler);
    return () => ipcRenderer.removeListener('schedule:due', handler);
  },

  onVoiceActivated: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Voice activation listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('voice:activated', handler);
    return () => ipcRenderer.removeListener('voice:activated', handler);
  },

  onVoiceDeactivated: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Voice deactivation listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('voice:deactivated', handler);
    return () => ipcRenderer.removeListener('voice:deactivated', handler);
  },

  onVoiceInterrupted: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Voice interrupt listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('voice:interrupted', handler);
    return () => ipcRenderer.removeListener('voice:interrupted', handler);
  },

  onIslandShow: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Island listener must be a function');
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('island:show', handler);
    return () => ipcRenderer.removeListener('island:show', handler);
  },

  onTimerWidgetState: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Timer widget listener must be a function');
    }
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('timerWidget:state', handler);
    return () => ipcRenderer.removeListener('timerWidget:state', handler);
  },

  onPlannerView: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Planner view listener must be a function');
    }
    const handler = (_event, view) => callback(view);
    ipcRenderer.on('planner:view', handler);
    return () => ipcRenderer.removeListener('planner:view', handler);
  },

  onPlannerEntriesChanged: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Planner entries listener must be a function');
    }
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('planner:entriesChanged', handler);
    return () => ipcRenderer.removeListener('planner:entriesChanged', handler);
  },

};

contextBridge.exposeInMainWorld('openx', openxApi);
contextBridge.exposeInMainWorld('jarvis', openxApi);
