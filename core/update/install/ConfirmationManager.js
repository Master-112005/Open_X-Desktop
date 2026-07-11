class ConfirmationManager {
  constructor(options = {}) {
    this.confirm = options.confirm || null;
  }

  async request(session, details = {}) {
    if (typeof this.confirm !== 'function') {
      return { confirmed: false, reason: 'No confirmation provider is registered.' };
    }
    const result = await this.confirm({
      session: session.snapshot(),
      title: 'OpenX Update Ready',
      message: `Version ${session.installerVersion || 'unknown'} has been downloaded and verified. OpenX must restart to install the update.`,
      details
    });
    return {
      confirmed: result === true || result?.confirmed === true,
      reason: result?.reason || ''
    };
  }
}

module.exports = ConfirmationManager;
