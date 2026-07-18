const ChatConfiguration = require('./ChatConfiguration');
const ChatConnectionManager = require('./ChatConnectionManager');
const ChatEventBus = require('./ChatEventBus');
const CHAT_EVENTS = require('./ChatEvents');
const ChatHealthManager = require('./ChatHealthManager');
const ChatLifecycleManager = require('./ChatLifecycleManager');
const ChatLogger = require('./ChatLogger');
const ChatService = require('./ChatService');
const ChatStatusManager = require('./ChatStatusManager');
const ChatVersionManager = require('./ChatVersionManager');
const { resolveChatDataPaths } = require('./ChatDataPaths');
const { DeviceManager } = require('./devices');
const { ContactDiscoveryManager } = require('./discovery');
const { MailboxManager } = require('./mailbox');
const { MessageManager } = require('./messages');
const { SynchronizationManager } = require('./synchronization');
const { HistorySynchronizationManager } = require('./history');
const { MultiDeviceManager } = require('./multidevice');
const { ConnectionEngine } = require('./connection');
const { TransferManager } = require('./transfer');
const { ConversationManager } = require('./conversations');
const { SecurityManager } = require('./security');
const {
  ConnectionOptimizer,
  MemoryOptimizer,
  MetricsManager,
  MonitoringManager,
  PerformanceManager,
  StorageOptimizer,
  SynchronizationOptimizer
} = require('./infrastructure');
const {
  CrashRecoveryManager,
  PerformanceReporter,
  ProductionValidator,
  QualityManager,
  ReleaseLogger
} = require('./quality');
const {
  BlockManager,
  ContactRequestManager,
  NicknameManager,
  RequestConfiguration,
  RequestLogger,
  RequestService,
  RequestValidation,
  TrustManager
} = require('./requests');

/**
 * Top-level Desktop Chat composition root.
 */
class ChatManager {
  /**
   * Creates a Desktop Chat manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof ChatConfiguration
      ? options.config
      : new ChatConfiguration(options.config || {});
    this.dataPaths = resolveChatDataPaths({
      dataPaths: options.dataPaths || options.config?.dataPaths,
      dataRoot: options.dataRoot || options.config?.dataRoot,
      app: options.app || options.config?.app
    });
    this.logger = options.logger || new ChatLogger({ level: options.logLevel || 'info' });
    this.eventBus = options.eventBus || new ChatEventBus({ logger: this.logger });
    this.statusManager = new ChatStatusManager();
    this.versionManager = new ChatVersionManager({
      protocolVersion: this.config.protocolVersion,
      moduleVersion: options.moduleVersion || '0.1.0'
    });
    this.connectionManager = new ChatConnectionManager({
      config: this.config,
      logger: this.logger,
      eventBus: this.eventBus,
      statusManager: this.statusManager
    });
    this.healthManager = new ChatHealthManager({
      statusManager: this.statusManager,
      connectionManager: this.connectionManager,
      versionManager: this.versionManager
    });
    this.lifecycleManager = new ChatLifecycleManager({
      eventBus: this.eventBus,
      statusManager: this.statusManager
    });
    this.deviceManager = options.deviceManager || new DeviceManager({
      config: this._withDataPaths(options.deviceConfig || {}, {
        statePath: this.dataPaths.chatDevicePath
      }),
      eventBus: this.eventBus,
      logger: options.deviceLogger
    });
    this.discoveryManager = options.discoveryManager || new ContactDiscoveryManager({
      config: options.discoveryConfig || {},
      eventBus: this.eventBus,
      logger: options.discoveryLogger,
      fetchImpl: options.fetchImpl
    });
    const requestConfig = options.requestConfig instanceof RequestConfiguration
      ? options.requestConfig
      : new RequestConfiguration(this._withDataPaths(options.requestConfig || {}, {
        nicknameStatePath: this.dataPaths.chatRequestNicknamesPath
      }));
    const requestLogger = options.requestLogger || new RequestLogger();
    const requestValidator = options.requestValidator || new RequestValidation({ config: requestConfig });
    const requestService = options.requestService || new RequestService({ config: requestConfig, fetchImpl: options.fetchImpl });
    this.requestManager = options.requestManager || new ContactRequestManager({
      config: requestConfig,
      eventBus: this.eventBus,
      logger: requestLogger,
      validator: requestValidator,
      service: requestService
    });
    this.trustManager = options.trustManager || new TrustManager({
      config: requestConfig,
      eventBus: this.eventBus,
      logger: requestLogger,
      validator: requestValidator,
      service: requestService
    });
    this.blockManager = options.blockManager || new BlockManager({
      config: requestConfig,
      eventBus: this.eventBus,
      logger: requestLogger,
      validator: requestValidator,
      service: requestService
    });
    this.nicknameManager = options.nicknameManager || new NicknameManager({
      config: requestConfig,
      eventBus: this.eventBus,
      logger: requestLogger,
      validator: requestValidator
    });
    this.mailboxManager = options.mailboxManager || new MailboxManager({
      config: this._withDataPaths(options.mailboxConfig || {}, {
        sequenceStatePath: this.dataPaths.chatMailboxSequencesPath
      }),
      eventBus: this.eventBus,
      logger: options.mailboxLogger,
      fetchImpl: options.fetchImpl
    });
    this.messageManager = options.messageManager || new MessageManager({
      config: this._withDataPaths(options.messageConfig || {}, {
        storagePath: this.dataPaths.chatMessagesPath
      }),
      eventBus: this.eventBus,
      logger: options.messageLogger,
      fetchImpl: options.fetchImpl,
      connectionManager: this.connectionManager,
      mailboxManager: this.mailboxManager,
      crypto: options.cryptoManager,
      cryptoConfig: this._withDataPaths(options.cryptoConfig || {}, {
        storagePath: this.dataPaths.chatCryptoSecretsPath
      }),
      sessionResolver: options.sessionResolver
    });
    this.synchronizationManager = options.synchronizationManager || new SynchronizationManager({
      config: this._withDataPaths(options.synchronizationConfig || {}, {
        storagePath: this.dataPaths.chatSyncCursorsPath
      }),
      eventBus: this.eventBus,
      logger: options.synchronizationLogger,
      fetchImpl: options.fetchImpl,
      messageManager: this.messageManager
    });
    this.messageManager.synchronizationManager = this.synchronizationManager;
    this.historySynchronizationManager = options.historySynchronizationManager || new HistorySynchronizationManager({
      ...this._withDataPaths(options.historySynchronizationConfig || {}, {
        storagePath: this.dataPaths.chatHistorySyncPath
      }),
      eventBus: this.eventBus,
      fetchImpl: options.fetchImpl
    });
    this.multiDeviceManager = options.multiDeviceManager || new MultiDeviceManager({
      config: this._withDataPaths(options.multiDeviceConfig || {}, {
        storagePath: this.dataPaths.chatMultiDevicePath
      }),
      eventBus: this.eventBus,
      logger: options.multiDeviceLogger,
      fetchImpl: options.fetchImpl
    });
    this.connectionEngine = options.connectionEngine || new ConnectionEngine({
      config: options.connectionConfig || {},
      connectionManager: this.connectionManager,
      synchronizationManager: this.synchronizationManager,
      eventBus: this.eventBus,
      logger: options.connectionLogger,
      networkProvider: options.networkProvider
    });
    this.eventBus.on('connection:identified', event => this.connectionEngine.acceptSession(event));
    this.transferManager = options.transferManager || new TransferManager({
      config: this._withDataPaths(options.transferConfig || {}, {
        storagePath: this.dataPaths.chatFileTransfersPath
      }),
      eventBus: this.eventBus,
      logger: options.transferLogger,
      fetchImpl: options.fetchImpl,
      crypto: options.cryptoManager,
      cryptoConfig: this._withDataPaths(options.cryptoConfig || {}, {
        storagePath: this.dataPaths.chatCryptoSecretsPath
      })
    });
    this.conversationManager = options.conversationManager || new ConversationManager({
      config: this._withDataPaths(options.conversationConfig || {}, {
        storagePath: this.dataPaths.chatConversationsPath
      }),
      eventBus: this.eventBus,
      logger: options.conversationLogger
    });
    this.securityManager = options.securityManager || new SecurityManager({
      config: options.securityConfig || {},
      eventBus: this.eventBus,
      logger: options.securityLogger,
      fetchImpl: options.fetchImpl
    });
    this.metricsManager = options.metricsManager || new MetricsManager({
      eventBus: this.eventBus,
      maxSamples: this.config.optimization.maxMetricSamples
    });
    this.performanceManager = options.performanceManager || new PerformanceManager({
      metrics: this.metricsManager,
      eventBus: this.eventBus,
      slowOperationMs: this.config.optimization.slowOperationMs
    });
    this.connectionOptimizer = options.connectionOptimizer || new ConnectionOptimizer({
      config: this.config,
      eventBus: this.eventBus
    });
    this.storageOptimizer = options.storageOptimizer || new StorageOptimizer({
      eventBus: this.eventBus,
      maxRecords: this.config.optimization.maxLocalRecords
    });
    this.memoryOptimizer = options.memoryOptimizer || new MemoryOptimizer({
      eventBus: this.eventBus,
      heapWarningBytes: this.config.optimization.heapWarningBytes
    });
    this.synchronizationOptimizer = options.synchronizationOptimizer || new SynchronizationOptimizer({
      eventBus: this.eventBus,
      defaultBatchSize: this.config.optimization.defaultSyncBatchSize,
      maxBatchSize: this.config.optimization.maxSyncBatchSize
    });
    this.monitoringManager = options.monitoringManager || new MonitoringManager({
      metrics: this.metricsManager,
      performance: this.performanceManager,
      connection: this.connectionOptimizer,
      storage: this.storageOptimizer,
      memory: this.memoryOptimizer,
      synchronization: this.synchronizationOptimizer
    });
    this.infrastructureOptimization = Object.freeze({
      metrics: this.metricsManager,
      performance: this.performanceManager,
      connection: this.connectionOptimizer,
      storage: this.storageOptimizer,
      memory: this.memoryOptimizer,
      synchronization: this.synchronizationOptimizer,
      monitoring: this.monitoringManager
    });
    this.releaseLogger = options.releaseLogger || new ReleaseLogger({
      maxEntries: this.config.optimization.maxReleaseLogEntries
    });
    this.crashRecoveryManager = options.crashRecoveryManager || new CrashRecoveryManager({
      eventBus: this.eventBus,
      releaseLogger: this.releaseLogger
    });
    this.performanceReporter = options.performanceReporter || new PerformanceReporter({
      metrics: this.metricsManager,
      performance: this.performanceManager,
      monitoring: this.monitoringManager,
      benchmarks: options.productionBenchmarks
    });
    this.productionValidator = options.productionValidator || new ProductionValidator({
      config: this.config,
      healthProvider: () => this.getHealth(),
      infrastructure: this.infrastructureOptimization,
      crashRecovery: this.crashRecoveryManager,
      performanceReporter: this.performanceReporter
    });
    this.qualityManager = options.qualityManager || new QualityManager({
      productionValidator: this.productionValidator,
      performanceReporter: this.performanceReporter,
      crashRecovery: this.crashRecoveryManager,
      releaseLogger: this.releaseLogger
    });
    this.productionReadiness = Object.freeze({
      quality: this.qualityManager,
      validator: this.productionValidator,
      performance: this.performanceReporter,
      crashRecovery: this.crashRecoveryManager,
      releaseLogger: this.releaseLogger
    });
    this.service = new ChatService({
      connectionManager: this.connectionManager,
      healthManager: this.healthManager,
      versionManager: this.versionManager
    });
  }

  /**
   * Adds shared OpenX_Data paths to plain configuration objects.
   * @param {object} config Configuration overrides.
   * @param {object} defaults Storage path defaults.
   * @returns {object} Configuration with shared data paths.
   */
  _withDataPaths(config = {}, defaults = {}) {
    if (config && typeof config === 'object' && config.constructor && config.constructor !== Object) return config;
    return {
      dataPaths: this.dataPaths,
      dataRoot: this.dataPaths.root,
      ...defaults,
      ...(config || {})
    };
  }

  /**
   * Starts Desktop Chat infrastructure without opening a network connection.
   */
  async start() {
    this.lifecycleManager.start();
    return this.deviceManager.start();
  }

  /**
   * Stops Desktop Chat infrastructure and disconnects if needed.
   */
  stop() {
    this.connectionManager.disconnect();
    this.lifecycleManager.stop();
  }

  /**
   * Registers a Desktop Chat event listener.
   * @param {string} eventName Event name.
   * @param {Function} listener Listener function.
   * @returns {Function} Unsubscribe function.
   */
  on(eventName, listener) {
    return this.eventBus.on(eventName, listener);
  }

  /**
   * Returns the service facade.
   * @returns {ChatService} Chat service.
   */
  getService() {
    return this.service;
  }

  /**
   * Returns the trusted device manager.
   * @returns {DeviceManager} Device manager.
   */
  getDeviceManager() {
    return this.deviceManager;
  }

  /**
   * Returns the contact discovery manager.
   * @returns {ContactDiscoveryManager} Contact discovery manager.
   */
  getDiscoveryManager() {
    return this.discoveryManager;
  }

  /**
   * Returns the contact request manager.
   * @returns {ContactRequestManager} Request manager.
   */
  getRequestManager() {
    return this.requestManager;
  }

  /**
   * Returns the trust relationship manager.
   * @returns {TrustManager} Trust manager.
   */
  getTrustManager() {
    return this.trustManager;
  }

  /**
   * Returns the block manager.
   * @returns {BlockManager} Block manager.
   */
  getBlockManager() {
    return this.blockManager;
  }

  /**
   * Returns the private nickname manager.
   * @returns {NicknameManager} Nickname manager.
   */
  getNicknameManager() {
    return this.nicknameManager;
  }

  /**
   * Returns the encrypted mailbox manager.
   * @returns {MailboxManager} Mailbox manager.
   */
  getMailboxManager() {
    return this.mailboxManager;
  }

  /**
   * Returns the encrypted message manager.
   * @returns {MessageManager} Message manager.
   */
  getMessageManager() {
    return this.messageManager;
  }

  /**
   * Returns the reliable synchronization manager.
   * @returns {SynchronizationManager} Synchronization manager.
   */
  getSynchronizationManager() {
    return this.synchronizationManager;
  }

  /**
   * Returns the trusted-device history synchronization manager.
   * @returns {HistorySynchronizationManager} History synchronization manager.
   */
  getHistorySynchronizationManager() {
    return this.historySynchronizationManager;
  }

  /**
   * Returns the multi-device manager.
   * @returns {MultiDeviceManager} Multi-device manager.
   */
  getMultiDeviceManager() {
    return this.multiDeviceManager;
  }

  /**
   * Returns the connection and presence engine.
   * @returns {ConnectionEngine} Connection engine.
   */
  getConnectionEngine() {
    return this.connectionEngine;
  }

  /**
   * Returns the encrypted file-transfer manager.
   * @returns {TransferManager} Transfer manager.
   */
  getTransferManager() {
    return this.transferManager;
  }

  /**
   * Returns the local conversation manager.
   * @returns {ConversationManager} Conversation manager.
   */
  getConversationManager() {
    return this.conversationManager;
  }

  /**
   * Returns the centralized security manager.
   * @returns {SecurityManager} Security manager.
   */
  getSecurityManager() {
    return this.securityManager;
  }

  /**
   * Returns Desktop Chat infrastructure optimization managers.
   * @returns {object} Infrastructure optimization managers.
   */
  getInfrastructureOptimization() {
    return this.infrastructureOptimization;
  }

  /**
   * Returns Desktop Chat production readiness managers.
   * @returns {object} Production readiness managers.
   */
  getProductionReadiness() {
    return this.productionReadiness;
  }

  /**
   * Builds the Desktop Chat production readiness report.
   * @returns {object} Production readiness report.
   */
  getProductionReadinessReport() {
    return this.qualityManager.createReport();
  }

  /**
   * Returns health information.
   * @returns {object} Health snapshot.
   */
  getHealth() {
    return {
      ...this.healthManager.getHealth(),
      infrastructure: this.monitoringManager.getStatus()
    };
  }
}

ChatManager.Events = CHAT_EVENTS;

module.exports = ChatManager;
