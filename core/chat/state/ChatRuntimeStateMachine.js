const CHAT_RUNTIME_STATES = Object.freeze({
  UNINITIALIZED: 'UNINITIALIZED',
  SERVER_CONNECTED: 'SERVER_CONNECTED',
  ACCOUNT_VERIFIED: 'ACCOUNT_VERIFIED',
  DEVICE_REGISTERED: 'DEVICE_REGISTERED',
  DEVICE_APPROVAL_REQUIRED: 'DEVICE_APPROVAL_REQUIRED',
  DEVICE_APPROVED: 'DEVICE_APPROVED',
  IDENTITY_READY: 'IDENTITY_READY',
  SESSION_READY: 'SESSION_READY',
  CHAT_READY: 'CHAT_READY',
  ERROR: 'ERROR'
});

const TERMINAL_BLOCKING_STATES = new Set([
  CHAT_RUNTIME_STATES.DEVICE_APPROVAL_REQUIRED,
  CHAT_RUNTIME_STATES.ERROR
]);

const LEGACY_STATE_ALIASES = Object.freeze({
  offline: CHAT_RUNTIME_STATES.UNINITIALIZED,
  disconnected: CHAT_RUNTIME_STATES.UNINITIALIZED,
  stopping: CHAT_RUNTIME_STATES.UNINITIALIZED,
  stopped: CHAT_RUNTIME_STATES.UNINITIALIZED,
  connecting: CHAT_RUNTIME_STATES.SERVER_CONNECTED,
  connected: CHAT_RUNTIME_STATES.SERVER_CONNECTED,
  reconnecting: CHAT_RUNTIME_STATES.SERVER_CONNECTED,
  ready: CHAT_RUNTIME_STATES.SERVER_CONNECTED,
  starting: CHAT_RUNTIME_STATES.UNINITIALIZED,
  started: CHAT_RUNTIME_STATES.UNINITIALIZED,
  error: CHAT_RUNTIME_STATES.ERROR
});

/**
 * Authoritative Desktop Chat setup state machine.
 */
class ChatRuntimeStateMachine {
  /**
   * Creates a runtime state machine.
   * @param {object} options Initial options.
   */
  constructor(options = {}) {
    this.state = ChatRuntimeStateMachine.normalizeState(options.initialState);
    this.lastChangedAt = new Date().toISOString();
    this.lastError = null;
    this.details = {};
  }

  /**
   * Updates the current state.
   * @param {string} state Runtime state.
   * @param {object} details State details.
   * @returns {object} State snapshot.
   */
  setState(state, details = {}) {
    const nextState = ChatRuntimeStateMachine.normalizeState(state);
    this.state = nextState;
    this.lastChangedAt = new Date().toISOString();
    this.lastError = details.error || null;
    this.details = { ...details };
    return this.getSnapshot();
  }

  /**
   * Applies a derived lifecycle context.
   * @param {object} context Lifecycle context.
   * @returns {object} State snapshot.
   */
  applyContext(context = {}) {
    const derived = ChatRuntimeStateMachine.derive(context);
    return this.setState(derived.runtimeState, derived);
  }

  /**
   * Returns a frozen state snapshot.
   * @returns {object} Runtime state snapshot.
   */
  getSnapshot() {
    return Object.freeze({
      state: this.state,
      runtimeState: this.state,
      chatReady: this.state === CHAT_RUNTIME_STATES.CHAT_READY,
      blocked: TERMINAL_BLOCKING_STATES.has(this.state),
      lastChangedAt: this.lastChangedAt,
      lastError: this.lastError,
      details: Object.freeze({ ...this.details })
    });
  }

  /**
   * Derives the highest valid runtime state from known setup facts.
   * @param {object} context Lifecycle context.
   * @returns {object} Derived state with readiness booleans.
   */
  static derive(context = {}) {
    if (context.error) {
      return {
        runtimeState: CHAT_RUNTIME_STATES.ERROR,
        chatReady: false,
        blockingReason: 'error',
        serverConnected: false,
        accountVerified: false,
        deviceRegistered: false,
        deviceApproved: false,
        identityReady: false,
        sessionReady: false
      };
    }

    const serverConnected = context.serverConnected === true || Boolean(context.apiBaseUrl);
    const accountVerified = serverConnected && context.accountVerified === true;
    const deviceRegistered = accountVerified && context.deviceRegistered === true;
    const deviceApproved = deviceRegistered && ChatRuntimeStateMachine.isDeviceApproved(context.device || context);
    const identityReady = deviceApproved && context.identityReady === true;
    const sessionReady = identityReady && context.sessionReady === true;
    const chatReady = sessionReady && context.chatReady !== false;

    let runtimeState = CHAT_RUNTIME_STATES.UNINITIALIZED;
    let blockingReason = null;
    if (serverConnected) runtimeState = CHAT_RUNTIME_STATES.SERVER_CONNECTED;
    if (accountVerified) runtimeState = CHAT_RUNTIME_STATES.ACCOUNT_VERIFIED;
    if (deviceRegistered) runtimeState = CHAT_RUNTIME_STATES.DEVICE_REGISTERED;
    if (deviceRegistered && !deviceApproved) {
      runtimeState = CHAT_RUNTIME_STATES.DEVICE_APPROVAL_REQUIRED;
      blockingReason = 'device_approval_required';
    }
    if (deviceApproved) runtimeState = CHAT_RUNTIME_STATES.DEVICE_APPROVED;
    if (identityReady) runtimeState = CHAT_RUNTIME_STATES.IDENTITY_READY;
    if (sessionReady) runtimeState = CHAT_RUNTIME_STATES.SESSION_READY;
    if (chatReady) runtimeState = CHAT_RUNTIME_STATES.CHAT_READY;

    if (!blockingReason && serverConnected && !accountVerified) blockingReason = 'account_verification_required';
    if (!blockingReason && accountVerified && !deviceRegistered) blockingReason = 'device_registration_required';
    if (!blockingReason && deviceApproved && !identityReady) blockingReason = 'identity_keys_required';
    if (!blockingReason && identityReady && !sessionReady) blockingReason = 'session_required';

    return {
      runtimeState,
      chatReady: runtimeState === CHAT_RUNTIME_STATES.CHAT_READY,
      blockingReason,
      serverConnected,
      accountVerified,
      deviceRegistered,
      deviceApproved,
      identityReady,
      sessionReady
    };
  }

  /**
   * Returns whether a server device can use chat workloads.
   * @param {object} device Device snapshot.
   * @returns {boolean} Whether approved.
   */
  static isDeviceApproved(device = {}) {
    const approvalStatus = String(device.approvalStatus || '').trim().toLowerCase();
    const deviceStatus = String(device.deviceStatus || '').trim().toLowerCase();
    if (approvalStatus !== 'approved') return false;
    return !['pending', 'deleted', 'archived', 'revoked', 'blocked', 'rejected'].includes(deviceStatus);
  }

  /**
   * Normalizes a state value.
   * @param {string} state Candidate state.
   * @returns {string} Runtime state.
   */
  static normalizeState(state) {
    const raw = String(state || '').trim();
    const legacy = LEGACY_STATE_ALIASES[raw.toLowerCase()];
    if (legacy) return legacy;
    const value = raw.toUpperCase();
    return Object.values(CHAT_RUNTIME_STATES).includes(value)
      ? value
      : CHAT_RUNTIME_STATES.UNINITIALIZED;
  }
}

ChatRuntimeStateMachine.STATES = CHAT_RUNTIME_STATES;

module.exports = ChatRuntimeStateMachine;
