const { ProviderNotFoundError } = require('./CommunicationErrors');

class CommunicationProviderManager {
  constructor(options = {}) {
    this.providers = new Map();
    this.logger = options.logger || console;
  }

  register(provider) {
    if (!provider || !provider.id) {
      throw new TypeError('Communication provider must expose an id');
    }
    this.providers.set(String(provider.id).toLowerCase(), provider);
    return provider;
  }

  unregister(providerId) {
    return this.providers.delete(String(providerId || '').toLowerCase());
  }

  get(providerId) {
    const key = String(providerId || '').trim().toLowerCase();
    const provider = this.providers.get(key);
    if (!provider) throw new ProviderNotFoundError(providerId);
    return provider;
  }

  list() {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name || provider.id
    }));
  }

  async disconnectAll() {
    for (const provider of this.providers.values()) {
      await provider.disconnect?.();
    }
  }
}

module.exports = CommunicationProviderManager;
