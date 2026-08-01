const { HOME_ONBOARDING_STATES, HOME_ONBOARDING_STEPS } = require('../constants/OnboardingStates');
const { cleanDeviceId } = require('../utilities/OnboardingSanitizer');

class HomeOnboardingStateManager {
  constructor(options = {}) {
    this.now = options.now || (() => Date.now());
    this.sessions = new Map();
  }

  startSession(device) {
    const deviceId = cleanDeviceId(device?.deviceId);
    if (!deviceId) {
      return { success: false, code: 'device-not-found', message: 'Home device was not found.' };
    }
    const active = this.getActiveSession(deviceId);
    if (active && !['failed', 'cancelled', 'finished'].includes(active.state)) {
      return { success: false, code: 'onboarding-in-progress', message: 'This device is already being configured.', session: active };
    }
    const session = {
      sessionId: `home_onboarding_${deviceId}_${this.now().toString(36)}`,
      deviceId,
      state: HOME_ONBOARDING_STATES.DEVICE_FOUND,
      step: HOME_ONBOARDING_STEPS[0],
      progress: 0,
      device,
      error: '',
      createdAt: new Date(this.now()).toISOString(),
      updatedAt: new Date(this.now()).toISOString(),
      history: []
    };
    this.sessions.set(session.sessionId, session);
    this.transition(session.sessionId, HOME_ONBOARDING_STATES.DEVICE_FOUND, 'welcome', 5, 'Device selected for onboarding.');
    return { success: true, session: this.toPublicSession(session) };
  }

  transition(sessionId, state, step, progress, message = '') {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.state = state;
    session.step = step || session.step;
    session.progress = Math.max(0, Math.min(100, Number(progress) || session.progress));
    session.updatedAt = new Date(this.now()).toISOString();
    session.history.push({
      state,
      step: session.step,
      progress: session.progress,
      message,
      timestamp: session.updatedAt
    });
    return this.toPublicSession(session);
  }

  fail(sessionId, message, code = 'onboarding-failed') {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.error = message;
    session.code = code;
    return this.transition(sessionId, HOME_ONBOARDING_STATES.FAILED, session.step, session.progress, message);
  }

  cancel(sessionId) {
    return this.transition(sessionId, HOME_ONBOARDING_STATES.CANCELLED, 'welcome', 0, 'Configuration cancelled.');
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? this.toPublicSession(session) : null;
  }

  getActiveSession(deviceId) {
    const normalized = cleanDeviceId(deviceId);
    const session = [...this.sessions.values()]
      .reverse()
      .find(item => item.deviceId === normalized) || null;
    return session ? this.toPublicSession(session) : null;
  }

  replaceSessionDevice(sessionId, device = {}) {
    const session = this.sessions.get(sessionId);
    const deviceId = cleanDeviceId(device?.deviceId);
    if (!session || !deviceId) return null;
    session.deviceId = deviceId;
    session.device = {
      ...(session.device || {}),
      ...device,
      deviceId
    };
    session.updatedAt = new Date(this.now()).toISOString();
    session.history.push({
      state: session.state,
      step: session.step,
      progress: session.progress,
      message: 'Device identity updated from OpenX_Server.',
      timestamp: session.updatedAt
    });
    return this.toPublicSession(session);
  }

  toPublicSession(session) {
    return {
      sessionId: session.sessionId,
      deviceId: session.deviceId,
      state: session.state,
      step: session.step,
      progress: session.progress,
      device: { ...session.device },
      error: session.error,
      code: session.code || '',
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      history: session.history.map(entry => ({ ...entry }))
    };
  }
}

module.exports = HomeOnboardingStateManager;
