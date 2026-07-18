const RequestConfiguration = require('./RequestConfiguration');
const RequestEvents = require('./RequestEvents');
const RequestLogger = require('./RequestLogger');
const RequestService = require('./RequestService');
const RequestValidation = require('./RequestValidation');

/**
 * Desktop trust manager for relationships created from accepted requests.
 */
class TrustManager {
  /**
   * Creates a trust manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof RequestConfiguration ? options.config : new RequestConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new RequestLogger();
    this.validator = options.validator || new RequestValidation({ config: this.config });
    this.service = options.service || new RequestService({ config: this.config, fetchImpl: options.fetchImpl });
    this.relationships = new Map();
  }

  /**
   * Accepts a pending request and caches the resulting relationship.
   * @param {object} input Accept input.
   * @returns {Promise<object>} Request and relationship.
   */
  async acceptRequest(input = {}) {
    const result = await this.service.acceptRequest({
      accountId: this.validator.accountId(input.accountId),
      requestId: this.validator.requestId(input.requestId)
    });
    if (result.relationship) {
      this.relationships.set(result.relationship.relationshipId, result.relationship);
      this.emit(RequestEvents.TRUST_ESTABLISHED, { relationshipId: result.relationship.relationshipId });
    }
    return result;
  }

  /**
   * Caches a relationship already returned by the server.
   * @param {object} relationship Trusted relationship.
   * @returns {object|null} Cached relationship.
   */
  cacheRelationship(relationship) {
    if (!relationship?.relationshipId) return null;
    this.relationships.set(relationship.relationshipId, relationship);
    return relationship;
  }

  /**
   * Lists locally cached relationships.
   * @returns {object[]} Relationships.
   */
  listCachedRelationships() {
    return Array.from(this.relationships.values());
  }

  /**
   * Emits an event if a bus is available.
   * @param {string} eventName Event name.
   * @param {object} payload Payload.
   */
  emit(eventName, payload = {}) {
    this.eventBus?.emit?.(eventName, payload);
  }
}

module.exports = TrustManager;
