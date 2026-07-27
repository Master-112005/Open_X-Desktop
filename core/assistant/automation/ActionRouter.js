const Logger = require('../Data').Logger;
const IdGenerator = require('../Data').IdGenerator;
const Normalizer = require('../Data').Normalizer;
const IntentRegistry = require('../reasoning/IntentRegistry').IntentRegistry;
const InputParser = require('../linguistic/InputParser');
const EntityExtractor = require('../entities/EntityExtractor');
const PermissionValidator = require('../../../apps/desktop/permissions');
const NaturalLanguageExecution = require('./NaturalLanguageExecution');
const ActionValidation = require('../../automation/common/action-velidation');
const ActionConfirmation = require('../../automation/common/action-confirm');
const NlpProcessor = require('../linguistic/NlpProcessor');
const { normalizeWebTarget, resolveTrustedWebTarget } = require('../semantic/WebTargets');
const { MediaCommandRouter } = require('../../automation/media');
const { CommandFrameParser } = require('../linguistic/InputParser');
const NaturalLanguageRouter = require('../semantic/NaturalLanguageRouter');
const { AppCommandLanguage, BrowserCommandLanguage } = NaturalLanguageRouter;
const ResponseGenerator = require('../response/ResponseGenerator');
const { findVisualConcepts } = require('../capabilities/visual-memory/runtime/utils/VisualConceptLexicon');
const {
  isCancellationError,
  throwIfAborted
} = require('../utils/Cancellation');

const CONFIDENCE_THRESHOLD = 0.5;
const PHONE_TRANSFER_ACTION_PATTERN = /^(?:(?:please|can\s+you|could\s+you|would\s+you|can\s+u)\s+)?(?:send|share|transfer|copy|export|push|move|give|get|bring|send\s+over|send\s+across)\b/i;
const PHONE_ORIGIN_FETCH_PATTERN = /^(?:(?:please|can\s+you|could\s+you|would\s+you|can\s+u)\s+)?(?:find|search|locate|open|fetch|download|show|get|give|send|share|transfer|copy|bring|i\s+need|i\s+want|need|want)\b/i;
const PHONE_TRANSFER_TRAILING_TARGET_PATTERN = /\s+(?:to|with|onto|on|into|over\s+to|across\s+to|here\s+on)\s+(?:my\s+)?(?:phone|mobile|iphone|android|device|smartphone|cell|cellphone|tablet|handset|this\s+phone|this\s+device)\s*$/i;
const PHONE_TRANSFER_TARGET_WORD_PATTERN = /\b(?:phone|mobile|iphone|android|device|smartphone|cell|cellphone|tablet|handset)\b/i;
const PHONE_TRANSFER_FILE_EVIDENCE_PATTERN = /\b(?:file|files|folder|folders|directory|document|documents|pdf|pdfs|docx?|xlsx?|pptx?|csv|json|txt|log|zip|rar|7z|apk|image|images|photo|photos|picture|pictures|pic|pics|screenshot|screenshots|video|videos|audio|music|downloads?|documents?|desktop|resume|report|presentation|spreadsheet|sheet|archive)\b|[^\s]+\.[a-z0-9]{1,10}\b/i;
const EXPLICIT_APP_DOMAIN_PATTERN = /\b(?:app|apps|application|applications|program|programs|software)\b|\bnot\s+(?:a\s+|an\s+|the\s+)?(?:file|folder|document|pdf|docx?)\b/i;
const EXPLICIT_NOT_APP_PATTERN = /\bnot\s+(?:a\s+|an\s+|the\s+)?(?:app|application|program|software)\b/i;

const WEBSITE_URL_MAP = {
  'github': 'https://github.com',
  'git hub': 'https://github.com',
  'hacker rank': 'https://www.hackerrank.com',
  'hackerrank': 'https://www.hackerrank.com',
  'linkedin': 'https://www.linkedin.com',
  'linked in': 'https://www.linkedin.com',
  'facebook': 'https://www.facebook.com',
  'fb': 'https://www.facebook.com',
  'twitter': 'https://twitter.com',
  'x.com': 'https://x.com',
  'instagram': 'https://www.instagram.com',
  'ig': 'https://www.instagram.com',
  'amazon': 'https://www.amazon.com',
  'netflix': 'https://www.netflix.com',
  'youtube': 'https://www.youtube.com',
  'google': 'https://www.google.com',
  'wikipedia': 'https://www.wikipedia.org',
  'reddit': 'https://www.reddit.com',
  'stackoverflow': 'https://stackoverflow.com',
  'stack overflow': 'https://stackoverflow.com',
  'gfg': 'https://www.geeksforgeeks.org',
  'geeksforgeeks': 'https://www.geeksforgeeks.org',
  'leetcode': 'https://leetcode.com',
  'codeforces': 'https://codeforces.com',
  'codechef': 'https://www.codechef.com',
  'hackerearth': 'https://www.hackerearth.com',
  'kaggle': 'https://www.kaggle.com',
  'coursera': 'https://www.coursera.org',
  'udemy': 'https://www.udemy.com',
  'w3schools': 'https://www.w3schools.com',
  'mozilla': 'https://www.mozilla.org',
  'mozilla firefox': 'https://www.mozilla.org/firefox'
};

const DIRECT_WEB_TAB_CLOSE_TARGETS = new Set([
  'chatgpt',
  'claude ai',
  'google gemini',
  'perplexity ai',
  'gmail',
  'google maps',
  'google photos',
  'google drive',
  'google docs',
  'google colab',
  'youtube'
]);

const SCHEDULED_ACTION_INTENTS = new Set([
  'app.open',
  'app.close',
  'browser.open',
  'browser.openTab',
  'browser.closeTab',
  'file.open',
  'folder.open',
  'media.play',
  'presentation.start',
  'presentation.next',
  'presentation.previous',
  'presentation.goto',
  'remote.control',
  'media.pause',
  'media.resume',
  'media.stop'
]);

class ActionRouter {
  constructor(config, automationEngine) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.config = config;
    this.intentRegistry = new IntentRegistry();
    this.parser = new InputParser(config);
    this.entityExtractor = new EntityExtractor(config);
    this.permissionValidator = new PermissionValidator(config);
    this.automationEngine = automationEngine;
    this.nle = new NaturalLanguageExecution(automationEngine);
    this.actionValidation = new ActionValidation();
    this.actionConfirmation = new ActionConfirmation();
    this.nlp = new NlpProcessor(this.intentRegistry);
    this.commandFrameParser = new CommandFrameParser();
    this.naturalLanguageRouter = new NaturalLanguageRouter({
      intentRegistry: this.intentRegistry,
      entityExtractor: this.entityExtractor,
      nlp: this.nlp
    });
    this.appCommandLanguage = new AppCommandLanguage();
    this.browserCommandLanguage = new BrowserCommandLanguage();
    this.responseGenerator = new ResponseGenerator(config);
    this.learningStore = config?.learningStore || null;
    this.mediaRouter = new MediaCommandRouter({
      logging: config?.logging,
      contextProvider: config?.contextEngine || config?.contextProvider || null
    });
    this.clauseActionableCache = new Map();
    this.semanticParseCache = new Map();
    this.matchIntentCache = new Map();
  }

  _rememberRouterCache(cache, key, value, limit = 2048) {
    if (cache.has(key)) {
      cache.delete(key);
    }
    cache.set(key, value);
    while (cache.size > limit) {
      cache.delete(cache.keys().next().value);
    }
    return value;
  }

  async process(inputText, source = 'chat', options = {}) {
    const commandId = IdGenerator.generate();
    this.logger.info(`Processing command: ${commandId}`, { input: inputText, source });

    const parseResult = this._safeParseInput(inputText);
    if (!parseResult.hasCommand) {
      return {
        commandId,
        success: false,
        error: 'No command detected',
        response: this._buildResponse('error', 'noCommand')
      };
    }

    const initialPreparedInput = this._safePrepareInput(parseResult.commandText);
    const useNoisyRepair = !this._classifyCapabilityCommand(
      initialPreparedInput.correctedText,
      parseResult.rawCommandText || parseResult.commandText
    ) && !(source === 'phone' && PHONE_TRANSFER_FILE_EVIDENCE_PATTERN.test(`${parseResult.rawCommandText || ''} ${parseResult.commandText || ''}`))
      && !this._shouldPreserveStructuralCommand(parseResult.rawCommandText || parseResult.commandText)
      && this._shouldUseNoisyRepair(
      initialPreparedInput,
      parseResult.rawCommandText || parseResult.commandText,
      source
    );
    const effectiveCommandText = useNoisyRepair
      ? String(initialPreparedInput.repairedCommandText || '').trim()
      : String(parseResult.commandText || '').trim();
    const preparedInput = effectiveCommandText === parseResult.commandText
      ? initialPreparedInput
      : this._safePrepareInput(effectiveCommandText);
    preparedInput.contextualRewrite = options.contextualRewrite || null;
    preparedInput.conversation = options.conversation || null;
    preparedInput.resolvedContext = options.resolvedContext || null;
    preparedInput.structuredEntities = options.structuredEntities || null;
    preparedInput.semanticRepresentation = options.semanticRepresentation || null;
    preparedInput.linguisticGraph = options.linguisticGraph || null;
    const rawCommandText = useNoisyRepair
      ? effectiveCommandText
      : (parseResult.rawCommandText || parseResult.commandText);
    preparedInput.commandFrame = this._safeCommandFrameParse(rawCommandText, preparedInput);
    preparedInput.semanticParse = this._safeNaturalLanguageParse(rawCommandText, preparedInput);
    preparedInput.appLanguage = this._safeAppLanguageParse(rawCommandText, preparedInput.correctedText);
    preparedInput.browserLanguage = this._safeBrowserLanguageParse(rawCommandText, preparedInput.correctedText);

    if (this._isIncompleteCommand(rawCommandText, preparedInput)) {
      const capability = this._resolveCapabilityCommandIntent(
        rawCommandText,
        preparedInput,
        { allowGeneric: true }
      );
      if (capability) {
        return this._completeIntent(commandId, capability, rawCommandText, source, preparedInput, options);
      }
      return {
        commandId,
        success: false,
        error: 'Could not determine intent',
        response: this._buildResponse('error', 'unknownCommand', {
          input: rawCommandText,
          suggestions: []
        }),
        normalizedInput: preparedInput.correctedText || parseResult.commandText,
        languageUnderstanding: this._buildLanguageUnderstanding(preparedInput, null, [], 'failed')
      };
    }

    const commandLooksLikeCapability = this._classifyCapabilityCommand(
      preparedInput.correctedText,
      rawCommandText
    );

    const commandLooksLikeLearningRepair = preparedInput.learningDirective?.kind === 'repair-learning';
    const capabilityAllowsMulti = this._capabilityCommandAllowsMulti(commandLooksLikeCapability, rawCommandText);
    if (options.allowMulti !== false &&
      (!commandLooksLikeCapability || capabilityAllowsMulti) &&
      !commandLooksLikeLearningRepair) {
      const multiPlan = this._buildMultiCommandPlan(rawCommandText, source);
      if (multiPlan) {
        return this._executeMultiCommand(commandId, multiPlan, source, options);
      }
    }

    const intentResult = this._resolveIntent(rawCommandText, preparedInput, source);
    this._logRoutingDiagnostics(rawCommandText, preparedInput, intentResult);
    const minAcceptableConfidence = 0.3;

    if (!intentResult) {
      this._recordRoutingEvidence({
        input: rawCommandText,
        source,
        intent: null,
        success: false,
        preparedInput,
        validationStatus: 'unknown'
      });
      if (this._isIncompleteCommand(rawCommandText, preparedInput)) {
        return {
          commandId,
          success: false,
          error: 'Could not determine intent',
          response: this._buildResponse('error', 'unknownCommand', {
            input: rawCommandText,
            suggestions: this._shouldSuggestAlternatives(preparedInput) ? this._suggestAlternatives(preparedInput) : []
          }),
          normalizedInput: preparedInput.correctedText || parseResult.commandText,
          languageUnderstanding: this._buildLanguageUnderstanding(preparedInput, intentResult, [], 'failed')
        };
      }
      const searchFallback = this._trySearchFallback(rawCommandText, preparedInput);
      if (searchFallback) {
        return searchFallback;
      }

      return {
        commandId,
        success: false,
        error: 'Could not determine intent',
        response: this._buildResponse('error', 'unknownCommand', {
          input: rawCommandText,
          suggestions: this._shouldSuggestAlternatives(preparedInput) ? this._suggestAlternatives(preparedInput) : []
        }),
        normalizedInput: preparedInput.correctedText || parseResult.commandText,
        languageUnderstanding: this._buildLanguageUnderstanding(preparedInput, intentResult, [], 'failed')
      };
    }

    if (intentResult.confidence < minAcceptableConfidence) {
      const searchFallback = this._trySearchFallback(rawCommandText, preparedInput);
      if (searchFallback) {
        return searchFallback;
      }
    }

    if (intentResult.confidence < CONFIDENCE_THRESHOLD) {
      this.logger.warn(`Low confidence intent ${intentResult.intent?.id} at ${intentResult.confidence}, proceeding anyway`);
    }

    return this._completeIntent(commandId, intentResult, rawCommandText, source, preparedInput, options);
  }

  _safeParseInput(inputText) {
    try {
      return this.parser.parse(inputText);
    } catch (error) {
      this.logger.error('Router parser failed', { error: error.message, inputText });
      const text = String(inputText || '').trim();
      return {
        hasCommand: text.length > 0,
        commandText: text,
        rawCommandText: text
      };
    }
  }

  _safePrepareInput(inputText) {
    try {
      return this.nlp.prepare(inputText);
    } catch (error) {
      this.logger.error('Router NLP prepare failed', { error: error.message, inputText });
      const correctedText = String(inputText || '').trim();
      return {
        originalText: correctedText,
        correctedText,
        repairedCommandText: correctedText,
        intentText: correctedText,
        tokens: correctedText ? correctedText.toLowerCase().split(/\s+/).filter(Boolean) : [],
        semanticFrame: null,
        learningDirective: null
      };
    }
  }

  _safeCommandFrameParse(rawCommandText, preparedInput) {
    try {
      return this.commandFrameParser.parse(rawCommandText, preparedInput);
    } catch (error) {
      this.logger.warn('Command frame parsing failed', { error: error.message, rawCommandText });
      return null;
    }
  }

  _safeNaturalLanguageParse(rawCommandText, preparedInput) {
    const cacheKey = `${String(rawCommandText || '').trim()}\n${String(preparedInput?.correctedText || '').trim()}`;
    if (this.semanticParseCache.has(cacheKey)) {
      const cached = this.semanticParseCache.get(cacheKey);
      this.semanticParseCache.delete(cacheKey);
      this.semanticParseCache.set(cacheKey, cached);
      return cached;
    }
    try {
      return this._rememberRouterCache(
        this.semanticParseCache,
        cacheKey,
        this.naturalLanguageRouter.parse(rawCommandText, preparedInput)
      );
    } catch (error) {
      this.logger.warn('Natural language routing parse failed', { error: error.message, rawCommandText });
      return null;
    }
  }

  _safeAppLanguageParse(rawCommandText, correctedText) {
    try {
      return this.appCommandLanguage.parse(rawCommandText, correctedText);
    } catch (error) {
      this.logger.warn('App language parse failed', { error: error.message, rawCommandText });
      return null;
    }
  }

  _safeBrowserLanguageParse(rawCommandText, correctedText) {
    try {
      return this.browserCommandLanguage.parse(rawCommandText, correctedText);
    } catch (error) {
      this.logger.warn('Browser language parse failed', { error: error.message, rawCommandText });
      return null;
    }
  }

  _resolveIntent(rawCommandText, preparedInput, source) {
    if (this._isIncompleteCommand(rawCommandText, preparedInput)) {
      return this._resolveCapabilityCommandIntent(
        rawCommandText,
        preparedInput,
        { allowGeneric: true }
      );
    }

    return this._runResolverChain([
      ['_resolveLearningRepairIntent', () => this._resolveLearningRepairIntent(rawCommandText, preparedInput)],
      ['_resolvePlannerIntent', () => this._resolvePlannerIntent(rawCommandText, preparedInput)],
      ['_resolveStopwatchIntent', () => this._resolveStopwatchIntent(rawCommandText, preparedInput)],
      ['_resolveScheduleManagementIntent', () => this._resolveScheduleManagementIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitReminderIntent', () => this._resolveExplicitReminderIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitAlarmIntent', () => this._resolveExplicitAlarmIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitTimerIntent', () => this._resolveExplicitTimerIntent(rawCommandText, preparedInput)],
      ['_resolveRemoteControlIntent', () => this._resolveRemoteControlIntent(rawCommandText, preparedInput)],
      ['_resolvePresentationControlIntent', () => this._resolvePresentationControlIntent(rawCommandText, preparedInput)],
      ['_resolvePresentationFileIntent', () => this._resolvePresentationFileIntent(rawCommandText, preparedInput)],
      ['_resolveSystemPowerIntent', () => this._resolveSystemPowerIntent(rawCommandText, preparedInput)],
      ['_resolveSystemSettingsIntent', () => this._resolveSystemSettingsIntent(rawCommandText, preparedInput)],
      ['_resolveSystemInsightIntent', () => this._resolveSystemInsightIntent(rawCommandText, preparedInput)],
      ['_resolveFolderOpenInAppIntent', () => this._resolveFolderOpenInAppIntent(rawCommandText, preparedInput)],
      ['_resolveWorkspaceSetupIntent', () => this._resolveWorkspaceSetupIntent(rawCommandText, preparedInput)],
      ['_resolvePhoneTransferIntent', () => this._resolvePhoneTransferIntent(rawCommandText, preparedInput, source)],
      ['_resolveScreenshotIntent', () => this._resolveScreenshotIntent(rawCommandText, preparedInput)],
      ['_resolveFormFillIntent', () => this._resolveFormFillIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitCommunicationIntent', () => this._resolveExplicitCommunicationIntent(rawCommandText, preparedInput)],
      ['_resolveEarlyCapabilityCommandIntent', () => this._resolveEarlyCapabilityCommandIntent(rawCommandText, preparedInput)],
      ['_resolveYouTubeMediaIntent', () => this._resolveYouTubeMediaIntent(rawCommandText, preparedInput)],
      ['_resolveBrowserFollowupIntent', () => this._resolveBrowserFollowupIntent(rawCommandText, preparedInput)],
      ['_resolveKnownWebOpenIntent', () => this._resolveKnownWebOpenIntent(rawCommandText, preparedInput)],
      ['_resolveAppLanguageIntent', () => this._resolveAppLanguageIntent(rawCommandText, preparedInput)],
      ['_resolveBrowserLanguageIntent', () => this._resolveBrowserLanguageIntent(rawCommandText, preparedInput)],
      ['_resolveBrowserTabIntent', () => this._resolveBrowserTabIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitAppDomainIntent', () => this._resolveExplicitAppDomainIntent(rawCommandText, preparedInput)],
      ['_resolveNaturalLanguageRouteIntent', () => this._resolveNaturalLanguageRouteIntent(rawCommandText, preparedInput)],
      ['_resolveCommandFrameIntent', () => this._resolveCommandFrameIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitMediaControlIntent', () => this._resolveExplicitMediaControlIntent(rawCommandText, preparedInput)],
      ['_resolveMediaIntent', () => this._resolveMediaIntent(rawCommandText, source)],
      ['_resolveExplicitMediaIntent', () => this._resolveExplicitMediaIntent(rawCommandText, preparedInput)],
      ['_resolvePersonalPhotoIntent', () => this._resolvePersonalPhotoIntent(rawCommandText, preparedInput)],
      ['_resolveVisualPhotoSearchIntent', () => this._resolveVisualPhotoSearchIntent(rawCommandText, preparedInput)],
      ['_resolveSmartFileIntent', () => this._resolveSmartFileIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitFileIntent', () => this._resolveExplicitFileIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitFolderIntent', () => this._resolveExplicitFolderIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitFolderMoveIntent', () => this._resolveExplicitFolderMoveIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitModeIntent', () => this._resolveExplicitModeIntent(rawCommandText, preparedInput)],
      ['_resolveLocalInfoIntent', () => this._resolveLocalInfoIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitAppIntent', () => this._resolveExplicitAppIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitWindowIntent', () => this._resolveExplicitWindowIntent(rawCommandText, preparedInput)],
      ['_resolveSiteSearchIntent', () => this._resolveSiteSearchIntent(rawCommandText, preparedInput)],
      ['_resolveNaturalConditionIntent', () => this._resolveNaturalConditionIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitOpenIntent', () => this._resolveExplicitOpenIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitAppOpenIntent', () => this._resolveExplicitAppOpenIntent(rawCommandText, preparedInput)],
      ['_resolveCalculationIntent', () => this._resolveCalculationIntent(rawCommandText, preparedInput)],
      ['_resolveLocalFileListIntent', () => this._resolveLocalFileListIntent(rawCommandText, preparedInput)],
      ['_resolveAssistantConversationIntent', () => this._resolveAssistantConversationIntent(rawCommandText, preparedInput)],
      ['_resolveLocalFileSearchIntent', () => this._resolveLocalFileSearchIntent(rawCommandText, preparedInput)],
      ['_resolveExplicitSearchIntent', () => this._resolveExplicitSearchIntent(rawCommandText, preparedInput)],
      ['_resolveBareKnowledgeSearchIntent', () => this._resolveBareKnowledgeSearchIntent(rawCommandText, preparedInput)],
      ['_resolveGeneralQuestionSearchIntent', () => this._resolveGeneralQuestionSearchIntent(rawCommandText, preparedInput)],
      ['_matchIntent', () => this._matchIntent(preparedInput)],
      ['_resolveCapabilityCommandIntent', () => this._resolveCapabilityCommandIntent(rawCommandText, preparedInput)],
      ['_resolveSemanticFrameIntent', () => this._resolveSemanticFrameIntent(rawCommandText, preparedInput)]
    ], { rawCommandText });
  }

  _resolveEarlyCapabilityCommandIntent(rawCommandText, preparedInput = {}) {
    const text = `${rawCommandText || ''} ${preparedInput?.correctedText || ''}`.toLowerCase();
    if (/^(?:open|launch|start|run|show)\b/i.test(String(rawCommandText || preparedInput?.correctedText || '').trim())) {
      const appIntent = this.intentRegistry.get('app.open');
      if (appIntent) {
        const appEntities = this.entityExtractor.extract(appIntent, rawCommandText || preparedInput?.correctedText || '');
        if (appEntities?.appName) {
          return null;
        }
      }
    }
    if (/\b(?:file|files|folder|folders|directory|directories|document|documents|pdf|pdfs|docx?|xlsx?|pptx?|csv|json|zip|rar|image|images|photo|photos|picture|pictures|screenshot|screenshots|downloads?|desktop|resume|report|song|songs|track|tracks|playlist|playlists|music|video|videos|album|artist|favorites?|favourites?)\b|[^\s]+\.[a-z0-9]{1,10}\b/i.test(text)) {
      return null;
    }
    const capability = this._classifyCapabilityCommand(
      preparedInput?.correctedText,
      rawCommandText
    );
    if (!capability) {
      return null;
    }
    if (!['workflow-step', 'document-tools', 'local-command', 'desktop-automation'].includes(capability.capability)) {
      return null;
    }
    return this._resolveCapabilityCommandIntent(rawCommandText, preparedInput, { allowGeneric: true });
  }

  _runResolverChain(resolvers = [], context = {}) {
    for (const [name, resolver] of resolvers) {
      const result = this._safeInvokeResolver(name, resolver, context);
      if (result) return result;
    }
    return null;
  }

  _safeInvokeResolver(name, resolver, context = {}) {
    try {
      return typeof resolver === 'function' ? resolver() : null;
    } catch (error) {
      this.logger.error('Intent resolver failed', {
        resolver: name,
        error: error.message,
        input: context.rawCommandText || ''
      });
      return null;
    }
  }

  _resolveRemoteControlIntent(rawText, preparedInput = {}) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim().toLowerCase();
    const input = `${raw} ${corrected}`.replace(/\s+/g, ' ').trim();
    if (!input) return null;

    const route = (intentId, entities = {}, confidence = 0.98) => {
      const intent = this.intentRegistry.get(intentId);
      return intent ? { intent, confidence, entities } : null;
    };

    if (/\b(?:show|list|scan|refresh|find)\b.*\b(?:remote\s+apps?|remote\s+targets?|controllable\s+apps?)\b/.test(input) ||
      /\b(?:what|which)\b.*\b(?:remote|control)\b.*\b(?:apps?|targets?)\b/.test(input)) {
      return route('remote.listTargets', { routeSource: 'remote-command' }, 0.99);
    }

    const action = this._extractRemoteControlAction(input);
    if (!action) return null;

    const targetId = this._extractRemoteControlTarget(input);
    const hasRemoteCue = /\b(?:remote|remote\s+control|controller|dpad|d-pad|control\s+pad)\b/.test(input);
    const hasPressCue = /\b(?:press|tap|hit|click|select|send)\b/.test(input);
    const hasTargetCue = Boolean(targetId);
    if (!hasRemoteCue && !hasPressCue && !hasTargetCue) return null;
    if (targetId === 'powerpoint' && !hasRemoteCue && !hasPressCue) return null;

    return route('remote.control', {
      targetId: targetId || 'active',
      action,
      command: action,
      routeSource: 'remote-command'
    }, hasRemoteCue ? 0.99 : 0.94);
  }

  _extractRemoteControlAction(input) {
    const text = String(input || '').toLowerCase();
    if (/\b(?:full\s*screen|fullscreen|maximize\s+video|presentation\s+full)\b/.test(text)) return 'fullscreen';
    if (/\b(?:play\s*pause|play\/pause|pause|resume|play)\b/.test(text)) return 'playPause';
    if (/\b(?:previous|prev|go\s+back\s+one|backward)\b/.test(text)) return 'left';
    if (/\b(?:next|forward|advance)\b/.test(text)) return 'right';
    if (/\b(?:left)\b/.test(text)) return 'left';
    if (/\b(?:right)\b/.test(text)) return 'right';
    if (/\b(?:up)\b/.test(text)) return 'up';
    if (/\b(?:down)\b/.test(text)) return 'down';
    if (/\b(?:ok|okay|enter|select|click|tap|center|middle)\b/.test(text)) return 'center';
    if (/\b(?:back|escape|esc|close\s+menu)\b/.test(text)) return 'back';
    return null;
  }

  _extractRemoteControlTarget(input) {
    const text = String(input || '').toLowerCase();
    if (/\b(?:youtube|you\s*tube|yt)\b/.test(text)) return 'youtube';
    if (/\b(?:powerpoint|power\s*point|ppt|pptx|presentation|slide\s*show)\b/.test(text)) return 'powerpoint';
    if (/\b(?:instagram|insta)\b/.test(text)) return 'instagram';
    if (/\bspotify\b/.test(text)) return 'spotify';
    if (/\b(?:active|current|selected)\b.*\b(?:app|window|target)\b/.test(text)) return 'active';
    return '';
  }

  _resolveNaturalConditionIntent(rawText, preparedInput = {}) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim().toLowerCase();
    const input = `${raw} ${corrected}`.replace(/\s+/g, ' ').trim();
    if (!input) {
      return null;
    }

    if (/\b(?:search|google|look\s+up)\s+(?:for\s+)?\S/.test(input)) {
      return null;
    }

    const route = (intentId, entities = {}, confidence = 0.97) => {
      const intent = this.intentRegistry.get(intentId);
      return intent ? { intent, confidence, entities } : null;
    };
    const search = (query, confidence = 0.94) => route('browser.search', { query: String(query || raw || corrected).trim() }, confidence);
    const openApp = (appName, confidence = 0.95) => route('app.open', { appName }, confidence);

    if (!this._looksLikeNonOpenXPhotoSurface(input) && (
      /\b(?:open|show|view|launch)\b.*\b(?:openx\s+)?(?:gallery|galary|gallary|galleary|photos?|photo\s+library|memories)\b/.test(input) ||
      /\b(?:openx\s+)?(?:gallery|galary|gallary|galleary)\b/.test(input)
    )) {
      return route('visualMemory.openGallery', { view: 'timeline' }, 0.99);
    }

    if (/\bumbrella\b/.test(input) &&
      /\b(?:need|take|bring|carry|rain|raining|weather|forecast)\b/.test(input)) {
      return search('weather forecast do I need an umbrella today', 0.97);
    }

    if (/\b(?:screen|display|monitor|brightness|bright)\b/.test(input) &&
      /\b(?:maximum|max|full|hundred|100)\b/.test(input)) {
      return route('brightness.set', { value: 100 }, 0.99);
    }

    if (/\b(?:screen|display|monitor|brightness|bright)\b/.test(input) &&
      /\b(?:minimum|min|zero|0)\b/.test(input)) {
      return route('brightness.set', { value: 0 }, 0.99);
    }

    if (/\b(?:speaker|speakers|sound|audio|volume|vol)\b/.test(input) &&
      /\b(?:maximum|max|full|hundred|100)\b/.test(input)) {
      return route('volume.set', { value: 100 }, 0.99);
    }

    if (/\b(?:speaker|speakers|sound|audio|volume|vol)\b/.test(input) &&
      /\b(?:minimum|min|zero|0)\b/.test(input)) {
      return route('volume.set', { value: 0 }, 0.99);
    }

    if (/\b(?:screen|display|monitor|brightness|light)\b/.test(input) &&
      /\b(?:hurts?|hurting|pain|strain|eye\s*strain|eyes?|too\s+bright|very\s+bright|glare|harsh|dazzling|burning)\b/.test(input)) {
      return route('brightness.down', { value: 35 }, 0.99);
    }

    if (/\b(?:screen|display|monitor|brightness)\b/.test(input) &&
      /\b(?:too\s+dark|very\s+dark|dim|hard\s+to\s+see|can(?:not|'t)?\s+see|brighter|brighten|little\s+brighter)\b/.test(input)) {
      return route('brightness.up', {}, 0.98);
    }

    if (/\b(?:everything|text|font|letters?|screen|display)\b/.test(input) &&
      /\b(?:too\s+small|small\s+to\s+read|hard\s+to\s+read|cannot\s+read|can't\s+read|make\s+.*bigger|increase\s+text|zoom\s+in)\b/.test(input)) {
      return openApp('ms-settings:easeofaccess-display', 0.95);
    }

    if (/\b(?:blue\s+light|night\s+light|night\s+mode|eye\s+comfort)\b/.test(input)) {
      return openApp('ms-settings:nightlight', 0.94);
    }

    if (/\b(?:speaker|speakers|sound|audio|volume|hear|hearing)\b/.test(input) &&
      /\b(?:can(?:not|'t)?\s+hear|no\s+sound|nothing\s+from|too\s+quiet|low|silent|inaudible)\b/.test(input)) {
      return route('volume.up', {}, 0.99);
    }

    if (/\b(?:too\s+loud|way\s+too\s+loud|very\s+loud|loud\s+in\s+here|reduce\s+noise|quieter|lower\s+the\s+sound)\b/.test(input)) {
      return route('volume.down', {}, 0.98);
    }

    if (/\b(?:peace\s+and\s+quiet|make\s+it\s+silent|silence\s+everything|quiet\s+please)\b/.test(input)) {
      return route('volume.mute', {}, 0.97);
    }

    if (/\b(?:reduce\s+distractions|focus|do\s+not\s+disturb|don't\s+disturb|dont\s+disturb|work\s+mode)\b/.test(input)) {
      return route('mode.start', { modeName: 'focus' }, 0.95);
    }

    if (/\b(?:coding|programming|developer|development|project)\b/.test(input) &&
      /\b(?:environment|setup|ready|continue|work\s+on|start\s+my\s+project|get\s+.*ready)\b/.test(input)) {
      return route('mode.start', { modeName: 'development' }, 0.98);
    }

    if (/\b(?:write|writing|notes?|note\s+taking|jot|idea|draft)\b/.test(input) &&
      /\b(?:mood|place|somewhere|help|write\s+down|take\s+notes?|start)\b/.test(input)) {
      return openApp('notepad', 0.97);
    }

    if (/\b(?:calculate|calculation|numbers?|math|quick\s+calculation)\b/.test(input) &&
      !this._extractCalculationExpression(input)) {
      return openApp('calculator', 0.97);
    }

    if (/\b(?:forgot\s+what\s+time|what\s+time|time\s+is\s+it|current\s+time)\b/.test(input)) {
      return route('system.time', {}, 0.98);
    }

    if (/\b(?:what\s+date|date\s+today|day\s+is\s+it|today's\s+date|todays\s+date)\b/.test(input)) {
      return route('system.date', {}, 0.96);
    }

    if (/\b(?:battery|charge|power\s+left|laptop\s+survive|survive\s+another|plug\s+in)\b/.test(input)) {
      return route('system.battery', {}, 0.98);
    }

    if (/\b(?:unread\s+emails?|anyone\s+email|email\s+me|emails?\s+today|check\s+.*emails?)\b/.test(input)) {
      return route('browser.open', { url: 'https://mail.google.com/mail/u/0/#inbox' }, 0.94);
    }

    if (/\b(?:send\s+an?\s+email|draft\s+.*email|quick\s+email|email\s+to\s+my\s+manager)\b/.test(input)) {
      return route('browser.open', { url: 'mailto:' }, 0.94);
    }

    if (/\b(?:don't\s+let\s+me\s+forget|dont\s+let\s+me\s+forget|need\s+to\s+remember|remember\s+something\s+later)\b/.test(input)) {
      const reminderText = input.replace(/^.*?(?:forget|remember)\s+/i, '').replace(/[?.!]+$/g, '').trim() || 'this';
      const timeExpression = /\bthis\s+evening\b/.test(input)
        ? 'this evening'
        : /\blater\s+today\b/.test(input)
          ? 'later today'
          : '';
      return route('reminder.set', { reminderText, timeExpression }, 0.96);
    }

    if (/\b(?:keep\s+track\s+of\s+time|wake\s+me\s+up\s+in\s+thirty\s+minutes|wake\s+me\s+up\s+in\s+30\s+minutes)\b/.test(input)) {
      return route('timer.set', { duration: 30 * 60 * 1000 }, 0.95);
    }

    if (/\b(?:compare\s+.*files|organize\s+my\s+downloads|desktop\s+is\s+a\s+mess|clean\s+up\s+unnecessary\s+files|running\s+out\s+of\s+storage|taking\s+up\s+.*disk\s+space)\b/.test(input)) {
      if (/\b(?:running\s+out\s+of\s+storage|disk\s+space|taking\s+up)\b/.test(input)) {
        return route('system.disk', {}, 0.96);
      }
      return route('file.smartFind', { query: raw || corrected, location: /\bdesktop\b/.test(input) ? 'desktop' : 'downloads' }, 0.94);
    }

    if (/\b(?:anything\s+unusual|computer\s+slow|laptop\s+slow|fan\s+running|slowing\s+down|system\s+health)\b/.test(input)) {
      return route('system.insight', { insightType: 'systemSlowdown' }, 0.96);
    }

    if (/\b(?:using\s+all\s+the\s+memory|using\s+.*memory|most\s+memory)\b/.test(input)) {
      return route('system.insight', { insightType: 'topMemoryApp' }, 0.96);
    }

    if (/\b(?:internet\s+(?:is\s+)?acting|connection\s+feels\s+slow|internet\s+speed|how\s+fast\s+my\s+internet|check\s+.*internet\s+speed)\b/.test(input)) {
      return search('internet speed test', 0.95);
    }

    if (/\b(?:connected\s+to\s+wi\s*fi|connected\s+to\s+wifi|reconnect\s+.*internet|reconnect\s+.*wi\s*fi)\b/.test(input)) {
      return openApp('ms-settings:network-wifi', 0.95);
    }

    if (/\b(?:check\s+something\s+on\s+the\s+internet|use\s+the\s+internet|browse\s+the\s+internet|open\s+the\s+internet)\b/.test(input)) {
      return route('browser.open', { url: 'https://www.google.com' }, 0.96);
    }

    if (/\b(?:directions?|nearby|near\s+me|restaurant|atm|petrol|gas\s+station|coffee|map)\b/.test(input)) {
      return search(raw || corrected, 0.95);
    }

    if (/\b(?:hungry|something\s+to\s+order|compare\s+prices|track\s+.*order|laptop\s+deals|stock\s+market|gold\s+price|dollar\s+in\s+rupees|business\s+news|review\s+my\s+finances)\b/.test(input)) {
      return search(raw || corrected, 0.94);
    }

    if (/\b(?:make\s+that\s+easier\s+to\s+understand|summarize\s+that\s+in\s+one\s+minute|help\s+me\s+get\s+start(?:ed)?)\b/.test(input)) {
      return search(raw || corrected, 0.9);
    }

    if (/\b(?:printer|printing|print\s+.*document|print\s+.*copy|scan\s+some\s+paperwork|scanner)\b/.test(input)) {
      return openApp('ms-settings:printers', 0.94);
    }

    if (/\b(?:turn\s+.*document\s+into\s+a\s+pdf|merge\s+.*pdfs?|extract\s+pages|convert\s+.*image\s+.*pdf|read\s+.*document\s+out\s+loud|translate\s+this\s+into|correct\s+.*spelling|summarize\s+.*report)\b/.test(input)) {
      return search(raw || corrected, 0.93);
    }

    if (/\b(?:find\s+information|learn|tutorial|course|resources?|explain|teach\s+me|coding\s+challenge|beginner-friendly|beginner\s+friendly|interview\s+questions|technical\s+questions|quiz\s+me|test\s+my|sql|java\s+knowledge|preparing\s+for\s+an\s+interview)\b/.test(input)) {
      return search(raw || corrected, 0.94);
    }

    if (/\b(?:deleted|recycle\s+bin|recover\s+what\s+i\s+just\s+deleted|accidentally\s+deleted|restore\s+deleted)\b/.test(input)) {
      return openApp('shell:RecycleBinFolder', 0.95);
    }

    if (/\b(?:meeting|join\s+call|video\s+call|conference)\b/.test(input) &&
      /\b(?:join|open|start|soon|application|app)\b/.test(input)) {
      return openApp('zoom', 0.94);
    }

    if (/\b(?:meetings?\s+today|calendar|schedule\s+this\s+afternoon|event\s+for\s+tomorrow|before\s+the\s+meeting)\b/.test(input)) {
      return openApp('ms-outlook:', 0.91);
    }

    if (/\b(?:share\s+a\s+file|upload\s+this\s+document|back\s+up\s+.*files|make\s+a\s+copy|save\s+this\s+somewhere\s+safe)\b/.test(input)) {
      return route('file.smartFind', { query: raw || corrected, openResult: false }, 0.9);
    }

    if (/\b(?:unnecessary\s+notifications|focus\s+for\s+the\s+next\s+hour|laptop\s+into\s+work\s+mode|done\s+working|close\s+everything|wrap\s+up|need\s+a\s+break|get\s+start(?:ed)?|work\s+on\s+next|pending\s+tasks|leave\s+unfinished|plan\s+.*day|previous\s+workspace|where\s+i\s+left\s+off|last\s+thing\s+i\s+worked\s+on|pick\s+up\s+where)\b/.test(input)) {
      if (/\b(?:work\s+mode|focus|distractions)\b/.test(input)) {
        return route('mode.start', { modeName: 'focus' }, 0.95);
      }
      if (/\b(?:previous\s+workspace|where\s+i\s+left\s+off|last\s+thing\s+i\s+worked\s+on|pick\s+up\s+where)\b/.test(input)) {
        return route('file.smartFind', { query: raw || corrected, sortBy: 'recent', openResult: true }, 0.93);
      }
      return search(raw || corrected, 0.9);
    }

    if (/\b(?:i\s+can't\s+find|search\s+my\s+computer|look\s+everywhere|most\s+recent\s+version|similar\s+documents)\b/.test(input)) {
      return route('file.smartFind', { query: raw || corrected, sortBy: 'recent' }, 0.93);
    }

    if (/^(?:open|launch|start)\s+(?:apple\s+music|spotify|vlc|itunes|music)\b/.test(input)) {
      return null;
    }

    if (/\b(?:something\s+calmer|calmer\s+music|upbeat\s+and\s+motivating|energetic|similar\s+to\s+this|background\s+music|music\s+for\s+coding|helps\s+me\s+focus|favorite\s+playlist|favourite\s+playlist)\b/.test(input)) {
      let query = raw || corrected;
      if (/\bsomething\s+calmer|calmer\s+music\b/.test(input)) query = 'calm relaxing music';
      else if (/\bupbeat\s+and\s+motivating|energetic\b/.test(input)) query = 'upbeat motivating music';
      else if (/\bsimilar\s+to\s+this\b/.test(input)) query = 'music similar to current song';
      else if (/\bbackground\s+music|music\s+for\s+coding|helps\s+me\s+focus\b/.test(input)) query = 'coding focus music';
      else if (/\bfavo(?:u)?rite\s+playlist\b/.test(input)) query = 'favorite playlist';
      return route('media.play', { mediaQuery: query, mediaPlatform: 'youtube' }, 0.95);
    }

    if (/\b(?:podcasts?|music|playlist|play\s+something|listen\s+to|watch\s+something|movie\s+for\s+tonight|trending\s+right\s+now|next\s+episode|funny\s+videos|entertaining|open\s+a\s+game|bored)\b/.test(input) &&
      !/\b(?:pause|stop|next|previous|resume)\b/.test(input)) {
      const query = raw || corrected;
      return route('media.play', { mediaQuery: query, mediaPlatform: 'youtube' }, 0.93);
    }

    return null;
  }

  _shouldPreserveStructuralCommand(rawText) {
    const text = String(rawText || '').toLowerCase();
    const fileCommand = /\b(?:folder|directory|file|document)\b/.test(text) &&
      /\b(?:open|show|launch|start|find|locate|search|move|copy|rename|delete|create)\b/.test(text);
    const presentationCommand = /\b(?:pptx?|presentation|presentations|slide\s+deck|slides?)\b/.test(text) &&
      /\b(?:open|show|launch|start|find|locate|search|pull\s+up|play|present)\b/.test(text);
    // A rename command commonly omits the word "file" (for example,
    // "Rename Notes to Meeting Notes"). Preserve its original wording so the
    // noisy-voice repair path cannot turn the action verb into "remember".
    const renameCommand = /^\s*rename\s+.+?\s+to\s+.+/i.test(String(rawText || ''));
    const phoneTransferCommand = PHONE_TRANSFER_ACTION_PATTERN.test(text) &&
      PHONE_TRANSFER_TARGET_WORD_PATTERN.test(text) &&
      PHONE_TRANSFER_FILE_EVIDENCE_PATTERN.test(text);
    const scheduleCommand = /\b(?:timer|countdown|pomodoro|alarm|reminder|remind)\b/.test(text) &&
      /\b(?:set|start|create|add|pause|resume|reset|stop|cancel|delete|show|list|snooze|wake|remind)\b/.test(text);
    const networkCommand = /\b(?:wifi|wi\s*fi|bluetooth|blue\s*tooth)\b/.test(text) &&
      /\b(?:open|show|check|connect|disconnect|forget|enable|disable|turn|switch|settings|status)\b/.test(text);
    const appListCommand = /^(?:open|launch|start|run|close|quit|exit|terminate|switch|focus)\s+[a-z0-9 ._-]+(?:\s+(?:and|then|also|plus)\s+[a-z0-9 ._-]+)+$/i.test(String(rawText || '').trim()) &&
      !/\b(?:file|folder|document|song|video|music|search|find|remind|timer|alarm)\b/i.test(text);
    const knownWebOpenCommand = this._looksLikeKnownWebOpenRequest(rawText);
    return fileCommand || presentationCommand || renameCommand || phoneTransferCommand || scheduleCommand || networkCommand || appListCommand || knownWebOpenCommand;
  }

  _resolveCapabilityCommandIntent(rawText, preparedInput = {}, options = {}) {
    const intent = this.intentRegistry.get('assistant.capability');
    if (!intent) {
      return null;
    }

    const raw = String(rawText || '').trim();
    const input = Normalizer.normalizeText(preparedInput?.correctedText || raw);
    const original = raw || input;
    const capability = this._classifyCapabilityCommand(input, original, {
      allowGeneric: options.allowGeneric !== false
    });
    if (!capability) {
      return null;
    }

    return {
      intent,
      confidence: capability.confidence || 0.92,
      entities: {
        capability: capability.capability,
        operation: capability.operation,
        target: capability.target || this._extractCapabilityTarget(input),
        rawCommand: original
      }
    };
  }

  _classifyCapabilityCommand(input, rawText = '', options = {}) {
    const text = `${String(input || '').trim().toLowerCase()} ${String(rawText || '').trim().toLowerCase()}`
      .replace(/\s+/g, ' ')
      .trim();
    const raw = String(rawText || '').trim();
    if (!text) {
      return null;
    }

    const matchers = [
      ['network', /\b(?:internet speed|speed test|connect .*wi\s*fi|connected to wi\s*fi|reconnect .*wi\s*fi|forget .*wi\s*fi|available wi\s*fi|wi\s*fi networks?|airplane mode|network usage|check .*internet|internet .*acting|connection feels slow|connected to wifi|reconnect .*internet)\b/],
      ['recycle-bin', /\b(?:recycle bin|deleted files?|restore .*deleted|recover .*deleted|accidentally deleted|just deleted)\b/],
      ['screen-recording', /\b(?:screen recording|record screen|stop recording)\b/],
      ['archive', /\b(?:compress|zip file|zip folder|extract .*zip|unzip|backup .*folder|back up .*files?|duplicate .*file|share .*file|make a copy|save .*somewhere safe)\b/],
      ['windows-update', /\b(?:windows updates?|pending updates?|update history|pause updates?|resume updates?)\b/],
      ['security', /\b(?:windows security|virus scan|firewall|quick scan)\b/],
      ['printer', /\b(?:printers?|print jobs?|print this|print .*copy|printing job|default printer|printer working|connect to the printer)\b/],
      ['personalization', /\b(?:night light|dark mode|light mode|wallpaper|screen .*eyes|too small to read|screen .*brighter|eyes hurt|hurting my eyes)\b/],
      ['clipboard', /\b(?:clipboard|copy this text|paste into current window)\b/],
      ['camera', /\b(?:open camera|take a photo|record a video|switch camera|saved photos)\b/],
      ['storage-cleanup', /\b(?:temporary files|free up disk space|clean .*files|unnecessary files|desktop is a mess|organize .*downloads|compare .*files|largest folders|downloads taking .*space|running out of storage|taking up .*disk space)\b/],
      ['email', /\b(?:unread emails?|starred emails?|draft .*email|check .*emails?|send an email|email .*manager|anyone email|emailed me)\b/],
      ['cloud-sync', /\b(?:sync my files|sync status|upload this file|upload this document|sync errors|pause file syncing|resume syncing|download the latest version)\b/],
      ['startup', /\b(?:startup programs?|startup apps?|startup settings|boot time)\b/],
      ['hardware', /\b(?:system temperature|cpu temperature|gpu temperature|overheating|hardware information|running so hot|unusual is happening|survive another couple of hours)\b/],
      ['document-tools', /\b(?:convert .*pdfs?|convert .*word|image .*pdfs?|turn .*document .*pdf|merge .*pdfs?|split .*pdfs?|extract pages|summarize .*document|summarize .*page|summarize .*report|check spelling|spelling mistakes|read .*aloud|read .*out loud|translate .*text|translate this into|key points|save .*summary|save .*notes|save it to notes)\b/],
      ['scanner', /\b(?:scan .*document|scan .*paperwork|scanner settings|scanned files|scan multiple pages)\b/],
      ['calendar', /\b(?:today'?s events|upcoming events|meeting reminder|add an event|next meeting|meeting schedule|meetings today|schedule this afternoon|event for tomorrow|before the meeting|forget .*meeting)\b/],
      ['contacts', /\b(?:open contacts|search .*contact|add .*contact|recent contacts|export .*contacts)\b/],
      ['shopping', /\b(?:track my order|track .*online order|compare prices|search for a laptop|laptop deals|before i buy|something to order)\b/],
      ['finance', /\b(?:exchange rates?|dollars to rupees|gold price|silver price|stock market summary|review my finances|business news)\b/],
      ['maps', /\b(?:directions to work|directions to .*restaurant|nearby restaurants|nearby atms?|nearby petrol pumps?|coffee shop nearby|place to eat nearby)\b/],
      ['linkedin', /\b(?:linkedin notifications|my notifications|check .*notifications|my profile|job recommendations|remote jobs)\b/],
      ['github', /\b(?:pull requests?|open issues|clone .*repository|repository readme|login to github|my repositories|latest repository)\b/],
      ['docker', /\b(?:docker desktop|running containers|stop all containers|development environment|container logs)\b/],
      ['learning', /\b(?:beginner-friendly|from scratch|good .*course|devops resources|interview|coding challenge|technical questions|test my .*knowledge|quiz me|sql|java knowledge|easier to understand|beginner)\b/],
      ['local-file-natural', /\b(?:downloaded something recently|save .*document yesterday|files .*worked on|show .*files .*week|find it|looking for|search my computer|look everywhere|most recent version|similar documents|last thing i worked on)\b/],
      ['streaming', /\b(?:subscriptions|watch later|latest video|continue watching|trending shows|watchlist|action movies|last show|shuffle .*playlist|movie for tonight|watch something|what'?s trending|next episode|podcasts?|educational|teach me something|interesting)\b/],
      ['messaging', /\b(?:unread messages|new messages|missed messages|missed calls|open my messages|texted me|message me|talk to my friends|search .*chat|specific conversation|share a file|pin this chat|archive this conversation|direct messages|mute all notifications|unnecessary notifications)\b/],
      ['meeting', /\b(?:start a meeting|join .*meeting|share my screen|voice channel|team notifications|shared files)\b/],
      ['window', /\b(?:restore .*windows?|bring .*to front|focus on)\b/],
      ['system-power', /\b(?:sign out|hibernate|cancel shutdown|cancel restart|shutdown .*in \d+|restart .*in \d+)\b/],
      ['stopwatch', /\b(?:stopwatch|pause the stopwatch|resume the stopwatch|reset the stopwatch)\b/],
      ['workflow-step', /\b(?:annotate|archive|attach|back\s+up|backup|bookmark|categorize|collect|compare|details?|download|drink|estimate|evaluate|export|favorites?|generate|group|impact|import|install|installed|label\s+it|notifications?|pin\s+it|record(?:\s+(?:video|tutorial|demo|meeting))?|recommend|report|return\s+everything|review|save|saved|scan|store|study\s+notes|suggest|update|verify)\b/],
      ['workflow-step', /^(?:details?|optimization|summary report)$/],
      ['context-followup', /^(?:minimize it|maximize it|close it|cancel everything|cancel the search|start again|explain it simply|explain it simple|explain the first result|explain it like|make that easier|real-world example|summarize that|summarize it(?: .*)?|what is this website about)\b/],
      ['intent-shortcut', /\b(?:i want to code|coding environment ready|programming|continue working on my project|usual(?:ly)? need|previous workspace|left off|i want to write notes|write something|take notes|write down an idea|calculate some numbers|quick calculation|i need a browser|internet|speakers|hear anything|too loud|too dark|screen is too bright|volume is too low|developer mode|gaming mode|work mode|focus mode|stream mode|peace and quiet|reduce distractions|focus .*hour|done working|wrap up|save my work|shut things down safely|need a break|open a game|pending tasks|unfinished|plan .*day|what should i work on|help me get started|i am bored|suggest something)\b/],
      ['file-batch', /\b(?:create five text files|create subfolders)\b/],
      ['local-command', /\b(?:navigate to project folder|start development server|load my project|write hello world|save the file|run it|login to)\b/]
    ];

    for (const [capability, regex] of matchers) {
      if (regex.test(text)) {
        return {
          capability,
          operation: this._extractCapabilityOperation(text),
          target: raw
        };
      }
    }

    if (options.allowGeneric !== true) {
      return null;
    }

    if (/^(?:show\s+me|search\s+for|open|close|find|create|delete|move|copy|rename|send|set|play|start|stop)[.!?]*$/i.test(raw)) {
      return null;
    }

    const genericOperation = text.match(/\b(?:add|adjust|answer|archive|backup|bookmark|cancel|capture|change|check|clean|clear|close|compress|connect|copy|create|delete|disable|dismiss|display|duplicate|edit|enable|end|export|extract|fast[\s-]+forward|find|generate|import|install|jump|kill|launch|lock|make|mark|maximize|merge|minimize|move|mute|notify|open|organize|pause|play|prepare|record|reject|remove|rename|reset|restore|resume|save|search|send|set|share|show|shut|sign|sort|start|stop|switch|sync|take|turn|unarchive|unmute|verify|zip)\b/i);
    if (genericOperation && raw.split(/\s+/).filter(Boolean).length >= 2) {
      return {
        capability: 'desktop-automation',
        operation: genericOperation[0].toLowerCase(),
        target: raw
      };
    }

    return null;
  }

  _capabilityCommandAllowsMulti(capability, rawText) {
    if (!capability) {
      return true;
    }

    const capabilityName = String(capability.capability || '');
    if (!['workflow-step', 'document-tools', 'local-command', 'desktop-automation'].includes(capabilityName)) {
      return false;
    }

    const text = String(rawText || '').trim();
    if (!/[,;]|\b(?:and then|then|after that|afterwards|and|also|plus)\b/i.test(text)) {
      return false;
    }

    const actionSegments = text
      .split(/\s*(?:;|,|\b(?:and then|then|after that|afterwards|and|also|plus)\b)\s*/i)
      .map(segment => segment.trim())
      .filter(Boolean)
      .filter(segment => /^(?:open|launch|start|run|search|google|look\s+up|find|save|saved|tell|ask|read|show|create|write|record|download|export|summarize|remind|set)\b/i.test(segment));

    return actionSegments.length >= 2;
  }

  _extractCapabilityOperation(text) {
    const operationMatch = String(text || '').match(/\b(open|show|check|connect|disconnect|forget|reconnect|empty|restore|start|stop|pause|resume|enable|disable|turn|change|clear|copy|paste|save|saved|take|record|switch|clean|free|draft|sync|upload|downloads?|measure|convert|merge|split|scan|add|export|translate|read|summarize|track|compare|find|search|join|share|bring|focus|sign|hibernate|cancel|suggest|explain|login|clone|create|run|write|pin|archive|analyze|organize|schedule|bookmark|categorize|evaluate|report|mute|rename|print|install)\b/i);
    return operationMatch
      ? operationMatch[1].toLowerCase().replace(/^saved$/, 'save').replace(/^downloads?$/, 'download')
      : 'handle';
  }

  _extractCapabilityTarget(text) {
    return String(text || '')
      .replace(/\b(?:open|show|check|connect|disconnect|forget|reconnect|empty|restore|start|stop|pause|resume|enable|disable|turn|change|clear|copy|paste|save|saved|take|record|switch|clean|free|draft|sync|upload|downloads?|measure|convert|merge|split|scan|add|export|translate|read|summarize|track|compare|find|search|join|share|bring|focus|sign|hibernate|cancel|suggest|explain|login|clone|create|run|write|pin|archive|analyze|organize|schedule|bookmark|categorize|evaluate|report|mute|rename|print|install)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _resolveSemanticFrameIntent(rawText, preparedInput = {}) {
    const frame = preparedInput.semanticFrame || {};
    const corrected = String(preparedInput.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim();
    const action = frame.actionVerb || '';
    const domain = frame.domain || 'unknown';
    const targetText = String(frame.targetText || '').trim();
    const value = Number.isFinite(Number(frame.value)) ? Number(frame.value) : null;

    if (!corrected || frame.questionWord) {
      return null;
    }

    const utility = this._resolveSemanticUtilityIntent(action, domain, value);
    if (utility) {
      return utility;
    }

    const window = this._resolveSemanticWindowIntent(action, domain, targetText, raw, corrected);
    if (window) {
      return window;
    }

    const local = this._resolveSemanticLocalFileIntent(action, domain, raw, corrected, preparedInput);
    if (local) {
      return local;
    }

    const app = this._resolveSemanticAppIntent(action, domain, targetText, raw);
    if (app) {
      return app;
    }

    return null;
  }

  _resolveCommandFrameIntent(rawText, preparedInput = {}) {
    const frame = preparedInput.commandFrame || this.commandFrameParser.parse(rawText, preparedInput);
    if (!frame?.action || frame.validation?.status === 'unknown') {
      return null;
    }

    if (frame.domain === 'media') {
      const intentByAction = {
        stop: 'media.stop',
        pause: 'media.pause',
        resume: 'media.resume',
        next: 'media.next',
        previous: 'media.previous',
        mute: 'media.mute',
        unmute: 'media.unmute'
      };
      const intentId = intentByAction[frame.action];
      const intent = intentId ? this.intentRegistry.get(intentId) : null;
      return intent
        ? {
            intent,
            confidence: 0.99,
            entities: {
              target: frame.targetText || null,
              routeSource: 'command-frame'
            }
          }
        : null;
    }

    return null;
  }

  _resolveNaturalLanguageRouteIntent(rawText, preparedInput = {}) {
    const route = this.naturalLanguageRouter.resolveIntent(rawText, preparedInput);
    if (!route) {
      return null;
    }

    const frame = route.semanticFrame || null;
    if (!frame || frame.validation?.status !== 'passed') {
      return null;
    }

    const safeDomains = new Set(['brightness', 'browser-tab', 'media', 'schedule', 'volume']);
    if (!safeDomains.has(frame.domain)) {
      return null;
    }
    if (frame.domain === 'media' && ['media.play', 'media.search'].includes(frame.intentId)) {
      return null;
    }

    return {
      intent: route.intent,
      confidence: route.confidence,
      entities: route.entities,
      routeValidation: frame.validation,
      semanticFrame: frame
    };
  }

  _resolveSemanticUtilityIntent(action, domain, value) {
    const isVolume = domain === 'volume';
    const isBrightness = domain === 'brightness';
    if (!isVolume && !isBrightness) {
      return null;
    }

    const prefix = isVolume ? 'volume' : 'brightness';
    let intentId = '';
    if (action === 'set' && value !== null) {
      intentId = `${prefix}.set`;
    } else if (['increase', 'raise'].includes(action)) {
      intentId = `${prefix}.up`;
    } else if (['decrease', 'lower'].includes(action)) {
      intentId = `${prefix}.down`;
    } else if (isVolume && action === 'mute') {
      intentId = 'volume.mute';
    } else if (isVolume && action === 'unmute') {
      intentId = 'volume.unmute';
    }

    const intent = intentId ? this.intentRegistry.get(intentId) : null;
    if (!intent) {
      return null;
    }

    return value !== null && intentId.endsWith('.set')
      ? { intent, confidence: 0.94, entities: { value } }
      : { intent, confidence: 0.9 };
  }

  _resolveSemanticWindowIntent(action, domain, targetText, rawText, correctedText) {
    if (domain !== 'window' && !['maximize', 'minimize'].includes(action)) {
      return null;
    }

    const wantsMaximize = action === 'maximize' || /\b(?:fullscreen|maximize|bigger|larger)\b/.test(correctedText);
    const wantsMinimize = action === 'minimize' || /\b(?:minimize|smaller|hide|hidden)\b/.test(correctedText);
    const intentId = wantsMaximize ? 'window.maximize' : wantsMinimize ? 'window.minimize' : '';
    const intent = intentId ? this.intentRegistry.get(intentId) : null;
    if (!intent) {
      return null;
    }

    const extracted = this.entityExtractor.extract(intent, rawText);
    const correctedEntities = this.entityExtractor.extract(intent, correctedText);
    const windowName = String(extracted.windowName || correctedEntities.windowName || targetText || '')
      .replace(/\b(?:bigger|larger|smaller|hidden|hide|maximize|minimize|fullscreen|full\s+screen|window)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      intent,
      confidence: 0.94,
      entities: windowName ? { windowName } : {}
    };
  }

  _resolveSemanticLocalFileIntent(action, domain, rawText, correctedText, preparedInput = {}) {
    if (domain !== 'local-file') {
      return null;
    }

    const input = `${correctedText} ${rawText}`.toLowerCase();
    if (!/\b(?:file|files|folder|folders|directory|directories|desktop|downloads|documents|pictures|pdf|pdfs|image|images|photo|photos)\b/.test(input)) {
      return null;
    }

    const isList = /^(?:show|list|tell|display)\b/.test(correctedText) ||
      /\b(?:what|which)\b.*\b(?:files|folders|items|contents)\b/.test(input);
    const isSearch = ['search', 'find'].includes(action) || /\b(?:look|find|search|locate)\b/.test(correctedText);
    const folderOnlySearch = isSearch &&
      /\b(?:folder|folders|directory|directories)\b/.test(input) &&
      !/\b(?:file|files|pdf|pdfs|image|images|photo|photos)\b/.test(input);
    const intentId = isList ? 'file.list' : folderOnlySearch ? 'folder.search' : isSearch ? 'file.search' : '';
    const intent = intentId ? this.intentRegistry.get(intentId) : null;
    if (!intent) {
      return null;
    }

    if (intentId === 'file.list') {
      const path = preparedInput.query?.localLocation || this._extractLocalListLocation(rawText, correctedText);
      return { intent, confidence: 0.92, entities: path ? { path } : {} };
    }

    const extractedQuery = this._extractLocalFileSearchQuery(rawText, correctedText);
    const requestedType = preparedInput.query?.requestedFileType || '';
    const noisyLocalQuery = /^(?:look|search|find)\b|\b(?:inside|in|on|from|downloads?|documents?|desktop|pictures?|folders?)\b/.test(extractedQuery);
    const query = requestedType && (!extractedQuery || noisyLocalQuery)
      ? requestedType
      : extractedQuery;
    return query
      ? { intent, confidence: 0.92, entities: { query } }
      : null;
  }

  _resolveSemanticAppIntent(action, domain, targetText, rawText) {
    if (domain !== 'app' || !targetText) {
      return null;
    }

    const intentMap = {
      open: 'app.open',
      launch: 'app.open',
      start: 'app.open',
      run: 'app.open',
      close: 'app.close',
      switch: 'app.switch',
      focus: 'app.switch'
    };
    const intentId = intentMap[action];
    const intent = intentId ? this.intentRegistry.get(intentId) : null;
    if (!intent) {
      return null;
    }

    const extracted = this.entityExtractor.extract(intent, rawText);
    if (!extracted.appName) {
      return null;
    }

    return {
      intent,
      confidence: 0.9,
      entities: { appName: extracted.appName }
    };
  }

  _isIncompleteCommand(rawCommandText, preparedInput = {}) {
    const raw = String(rawCommandText || '').trim();
    const corrected = String(preparedInput?.correctedText || raw).trim().toLowerCase();
    if (!corrected) {
      return true;
    }

    if (this._classifyCapabilityCommand(corrected, raw)) {
      return false;
    }

    if (/^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|how\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+your\s+name|whats\s+your\s+name)\b/i.test(corrected)) {
      return false;
    }
    if (/^(?:what|who|when|where|why|how|which|is|are|do|does|can|could|should|would)\b/i.test(corrected)) {
      return false;
    }

    const standaloneCommands = new Set([
      'cancel',
      'cancel the search',
      'continue',
      'explain the first result',
      'help',
      'mute',
      'next',
      'pause',
      'previous',
      'resume',
      'skip',
      'stop',
      'unmute',
      'volume down',
      'volume up'
    ]);
    if (standaloneCommands.has(corrected)) {
      return false;
    }

    const tokens = Array.isArray(preparedInput?.tokens) && preparedInput.tokens.length
      ? preparedInput.tokens
      : Normalizer.tokenize(corrected);
    if (!tokens.length) {
      return true;
    }

    const actionAliases = new Set([
      'ask',
      'attach',
      'call',
      'close',
      'copy',
      'create',
      'delete',
      'draft',
      'extract',
      'find',
      'google',
      'launch',
      'look',
      'message',
      'minimize',
      'move',
      'open',
      'read',
      'remind',
      'rename',
      'run',
      'search',
      'send',
      'set',
      'share',
      'show',
      'start',
      'switch',
      'tell',
      'text',
      'turn'
    ]);
    const actionIndex = tokens.findIndex(token => actionAliases.has(token));
    if (actionIndex < 0) {
      return false;
    }

    const ignorableTargetTokens = new Set([
      'a',
      'an',
      'any',
      'for',
      'from',
      'it',
      'me',
      'my',
      'now',
      'of',
      'on',
      'one',
      'please',
      'some',
      'that',
      'the',
      'them',
      'there',
      'this',
      'to',
      'up',
      'with',
      'you',
      'your'
    ]);
    const targetTokens = tokens
      .slice(actionIndex + 1)
      .filter(token => !ignorableTargetTokens.has(token));

    if (targetTokens.length > 0) {
      return false;
    }

    const action = tokens[actionIndex];
    if (action === 'remind' && /^remind\s+me\b/i.test(corrected)) {
      return true;
    }

    return [
      'attach',
      'ask',
      'call',
      'close',
      'copy',
      'create',
      'delete',
      'draft',
      'extract',
      'find',
      'google',
      'launch',
      'look',
      'message',
      'minimize',
      'move',
      'open',
      'read',
      'rename',
      'run',
      'search',
      'send',
      'set',
      'share',
      'show',
      'start',
      'switch',
      'tell',
      'text',
      'turn'
    ].includes(action);
  }

  async _completeIntent(commandId, intentResult, rawCommandText, source, preparedInput = null, options = {}) {
    let entities;
    try {
      entities = intentResult.entities || this.entityExtractor.extract(
        intentResult.intent,
        rawCommandText
      );
    } catch (error) {
      this.logger.error('Entity extraction failed during intent completion', {
        error: error.message,
        intent: intentResult?.intent?.id,
        input: rawCommandText
      });
      return {
        commandId,
        success: false,
        error: 'Entity extraction failed',
        response: this._buildResponse('error', 'executionFailed', { error: error.message }),
        intent: intentResult?.intent?.id || null,
        confidence: intentResult?.confidence || 0,
        entities: {}
      };
    }
    if (this.learningStore?.adaptEntities) {
      entities = this.learningStore.adaptEntities(intentResult.intent.id, entities, {
        rawCommandText,
        source
      });
    }
    let actionValidation;
    try {
      actionValidation = this.actionValidation.validate(intentResult.intent, entities);
    } catch (error) {
      this.logger.error('Action validation failed during intent completion', {
        error: error.message,
        intent: intentResult?.intent?.id,
        input: rawCommandText
      });
      return {
        commandId,
        success: false,
        error: 'Action validation failed',
        response: this._buildResponse('error', 'executionFailed', { error: error.message }),
        intent: intentResult?.intent?.id || null,
        confidence: intentResult?.confidence || 0,
        entities
      };
    }
    const missingRequired = actionValidation.missing;
    const languageUnderstanding = this._buildLanguageUnderstanding(
      preparedInput || this._safePrepareInput(rawCommandText),
      intentResult,
      missingRequired,
      missingRequired.length > 0 ? 'incomplete' : 'passed'
    );

    if (missingRequired.length > 0) {
      this._recordRoutingEvidence({
        input: rawCommandText,
        source,
        intent: intentResult.intent.id,
        success: false,
        preparedInput,
        validationStatus: 'incomplete'
      });
      const isCommunicationIntent = ['message.send', 'email.compose', 'call.start'].includes(intentResult.intent.id);
      const capability = isCommunicationIntent
        ? null
        : this._resolveCapabilityCommandIntent(rawCommandText, preparedInput, { allowGeneric: false });
      if (capability) {
        return this._completeIntent(commandId, capability, rawCommandText, source, preparedInput, options);
      }

      return {
        commandId,
        success: false,
        error: `Missing required entities: ${missingRequired.join(', ')}`,
        response: this._buildResponse('error', 'missingEntities', {
          entities: { names: missingRequired.join(', ') },
          intent: intentResult.intent
        }),
        intent: intentResult.intent.id,
        confidence: intentResult.confidence,
        entities,
        needsClarification: true,
        validation: actionValidation,
        languageUnderstanding
      };
    }

    if (actionValidation.valid === false) {
      const firstError = Array.isArray(actionValidation.errors) && actionValidation.errors.length > 0
        ? actionValidation.errors[0]
        : null;
      const message = firstError?.message || 'The command details are not valid.';
      this._recordRoutingEvidence({
        input: rawCommandText,
        source,
        intent: intentResult.intent.id,
        success: false,
        preparedInput,
        validationStatus: 'failed'
      });

      return {
        commandId,
        success: false,
        error: message,
        response: this._buildResponse('error', 'executionFailed', { error: message }),
        intent: intentResult.intent.id,
        confidence: intentResult.confidence,
        entities,
        validation: actionValidation,
        languageUnderstanding: this._buildLanguageUnderstanding(
          preparedInput || this._safePrepareInput(rawCommandText),
          intentResult,
          [],
          'failed'
        )
      };
    }

    const externalPermissionCheck = this._validateExternalPermission(
      options.permissionGuard,
      intentResult.intent,
      entities
    );
    if (!externalPermissionCheck.allowed) {
      return {
        commandId,
        success: false,
        error: 'Permission denied',
        response: externalPermissionCheck.response || this._buildResponse('error', 'permissionDenied'),
        intent: intentResult.intent.id,
        confidence: intentResult.confidence,
        entities,
        requiresConfirmation: false,
        permissionLevel: intentResult.intent.permissionLevel,
        languageUnderstanding
      };
    }

    const permissionIntent = this._buildPermissionIntent(intentResult.intent, entities);
    const permissionCheck = this.permissionValidator.validate(permissionIntent, entities, source);

    if (!permissionCheck.allowed) {
      return {
        commandId,
        success: false,
        error: 'Permission denied',
        response: permissionCheck.response || this._buildResponse('error', 'permissionDenied'),
        intent: intentResult.intent.id,
        confidence: intentResult.confidence,
        entities,
        requiresConfirmation: permissionCheck.requiresConfirmation,
        permissionLevel: permissionIntent.permissionLevel,
        languageUnderstanding
      };
    }

    if (permissionCheck.requiresConfirmation) {
      return {
        commandId,
        success: true,
        requiresConfirmation: true,
        confirmationMessage: permissionCheck.confirmationMessage,
        intent: intentResult.intent.id,
        confidence: intentResult.confidence,
        entities,
        response: this._buildResponse('confirmation', 'confirmAction', {
          action: intentResult.intent.description,
          details: permissionCheck.confirmationMessage,
          risk: permissionCheck.risk,
          consequence: permissionCheck.consequence,
          intent: permissionIntent
        }),
        languageUnderstanding
      };
    }
    return this._execute(commandId, intentResult, entities, rawCommandText, source, languageUnderstanding, options);
  }

  _buildPermissionIntent(intent, entities = {}) {
    if (!intent) return intent;

    if (intent.id === 'system.bluetooth' && typeof entities.enabled === 'boolean' &&
      this.config?.permissions?.levels?.medium) {
      return {
        ...intent,
        permissionLevel: 'medium',
        description: entities.enabled ? 'Turn Bluetooth on' : 'Turn Bluetooth off'
      };
    }

    if (intent.id === 'assistant.capability' && entities.capability === 'network' &&
      /\b(?:connect|connected|disconnect|forget|enable|disable|turn|switch)\b/i.test(`${entities.operation || ''} ${entities.rawCommand || ''}`) &&
      this.config?.permissions?.levels?.medium) {
      return {
        ...intent,
        permissionLevel: 'medium',
        description: 'Change network settings'
      };
    }

    return intent;
  }

  _buildMultiCommandPlan(rawText, source) {
    const text = String(rawText || '').trim();
    if (!text) {
      return null;
    }
    const hasExplicitConnector = /\b(?:and|then|after that|afterwards)\b|[;]/i.test(text);
    const hasImplicitMultiCommand = !hasExplicitConnector && this._hasImplicitMultiCommand(text);
    if (!hasExplicitConnector && !hasImplicitMultiCommand) {
      return null;
    }

    if (/\b(?:upbeat\s+and\s+motivating|calm\s+and\s+relaxing|funny\s+and\s+interesting|educational\s+and\s+useful)\b/i.test(text)) {
      return null;
    }

    const coordinatedUtilityPlan = this._splitCoordinatedUtilitySetCommand(text);
    if (coordinatedUtilityPlan) {
      return coordinatedUtilityPlan;
    }

    if (this._looksLikeSingleMediaPlatformRequest(text)) {
      return null;
    }

    if (this._looksLikeSingleMediaTitleRequest(text)) {
      return null;
    }

    if (this._looksLikeSingleMultiTimeReminderRequest(text)) {
      return null;
    }

    if (/\b(?:wifi|wi\s*fi)\b/i.test(text) &&
      /\b(?:connect|connected|disconnect|forget|enable|disable|turn\s+on|turn\s+off|switch\s+on|switch\s+off)\b/i.test(text)) {
      return null;
    }

    const politeGoAhead = text.match(/^(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:kindly\s+)?go\s+ahead\s+and\s+(.+)$/i);
    if (politeGoAhead?.[1] && !/\b(?:and|then|after that|afterwards|also|plus)\b|[;]/i.test(politeGoAhead[1])) {
      return null;
    }

    const preparedWholeText = this._safePrepareInput(text);
    preparedWholeText.semanticParse = this._safeNaturalLanguageParse(text, preparedWholeText);
    const wholeLocalInfo = this._resolveLocalInfoIntent(text, preparedWholeText);
    if (wholeLocalInfo?.intent?.id === 'system.processes' && wholeLocalInfo.entities?.queryApp) {
      return null;
    }

    const carriedAppTargetPlan = this._splitCarriedAppTargetsWithTrailingCommands(text);
    if (carriedAppTargetPlan) {
      return carriedAppTargetPlan;
    }

    const semanticFrames = Array.isArray(preparedWholeText.semanticParse?.frames)
      ? preparedWholeText.semanticParse.frames
      : [];
    const executableSemanticClauses = semanticFrames
      .filter(frame => frame.validation?.status === 'passed' && frame.intentId)
      .map(frame => frame.text)
      .filter(Boolean);
    if (executableSemanticClauses.length >= 2 && executableSemanticClauses.length === semanticFrames.length) {
      return executableSemanticClauses.slice(0, 6);
    }

    let clauses = text
      .split(/\s*(?:;|,|\b(?:and then|then|after that|afterwards|and|also|plus|add|additionally|furthermore|plus)\b)\s*/i)
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (clauses.length > 0 && this._isPoliteLeadInClause(clauses[0])) {
      clauses = clauses.slice(1);
    }

    if (clauses.length < 2) {
      if (this._hasImplicitMultiCommand(text)) {
        return this._splitImplicitMultiCommand(text);
      }
      return null;
    }

    clauses = this._normalizeMultiClauses(clauses);

    const actionableClauses = clauses.filter(clause => this._clauseLooksActionable(clause, source));
    if (actionableClauses.length < 2) {
      if (!hasExplicitConnector && this._hasImplicitMultiCommand(text)) {
        return this._splitImplicitMultiCommand(text);
      }
      return null;
    }

    return clauses;
  }

  _hasImplicitMultiCommand(text) {
    const normalized = String(text || '').toLowerCase();
    const actionPairs = [
      [/(?:open|launch|start|close|quit)\s+\w+/, /(?:search|google|find|look)\s+(?:for\s+)?\w+/],
      [/(?:search|google|find|look)\s+(?:for\s+)?\w+/, /(?:open|launch|play)\s+\w+/],
      [/(?:open|launch|start)\s+\w+/, /(?:search|google)\s+\w+/],
      [/(?:search|find)\s+\w+/, /(?:and|then|also)\s+\w+/],
      [/\w+\s+(?:and|then|also)\s+\w+/, /\b(?:open|close|search|find|play|set|turn|send|call|remind)\b/]
    ];
    for (const [pattern1, pattern2] of actionPairs) {
      if (pattern1.test(normalized) && pattern2.test(normalized)) {
        return true;
      }
    }
    return false;
  }

  _splitImplicitMultiCommand(text) {
    const implicitBrowserSearch = String(text || '').trim().match(
      /^(open|launch|start)\s+(chrome|chrom|chromem|cheome|edge|firefox|browser)\s+((?:search|google|look\s+up|find\s+on\s+web)\b.+)$/i
    );
    if (implicitBrowserSearch?.[3]) {
      const browserName = this._normalizeBrowserContextName(implicitBrowserSearch[2]) || implicitBrowserSearch[2];
      return [`${implicitBrowserSearch[1]} ${browserName}`, implicitBrowserSearch[3].trim()];
    }

    const connectors = /\s+(?:and|then|also|plus|add|additionally|furthermore)\s+/gi;
    const parts = text.split(connectors).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(0, 6);
    }
    const simpleAnd = text.split(/\s+and\s+/i).map(p => p.trim()).filter(Boolean);
    if (simpleAnd.length >= 2) {
      return simpleAnd.slice(0, 6);
    }
    return null;
  }

  _splitCarriedAppTargetsWithTrailingCommands(text) {
    const clauses = String(text || '')
      .split(/\s*(?:;|,|\b(?:and then|then|after that|afterwards|and|also|plus|add|additionally|furthermore|plus)\b)\s*/i)
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (clauses.length < 2) {
      return null;
    }

    const verbsThatCanCarry = new Set([
      'open',
      'launch',
      'start',
      'run',
      'close',
      'quit',
      'exit',
      'terminate',
      'minimize',
      'maximize',
      'switch',
      'focus'
    ]);
    const verbMap = {
      launch: 'open',
      start: 'open',
      run: 'open',
      quit: 'close',
      exit: 'close',
      terminate: 'close',
      focus: 'switch to'
    };
    const trailingActionPattern = /\b(?:open|launch|start|run|close|quit|exit|terminate|minimize|maximize|switch|focus|search|google|look\s+up|find|play|pause|resume|unpause|stop|set|turn|send|share|transfer|copy|move|message|text|call|remind|notify|alert|create|delete|rename|save|show|list)\b/i;
    let carriedVerb = null;
    let changed = false;
    const result = [];

    for (const rawClause of clauses) {
      const prepared = this._safePrepareInput(rawClause);
      const corrected = String(prepared?.correctedText || rawClause || '').trim();
      const normalized = corrected.toLowerCase();
      const leadingVerb = normalized.match(/^(open|launch|start|run|close|quit|exit|terminate|minimize|maximize|switch|focus)\b/)?.[1] || '';
      const standaloneAction = normalized.match(/^(search|google|look\s+up|find|play|pause|resume|unpause|stop|set|turn|send|share|transfer|copy|move|message|text|call|remind|notify|alert|create|delete|rename|save|show|list)\b/);
      if (!leadingVerb && standaloneAction) {
        result.push(corrected);
        continue;
      }
      if (leadingVerb) {
        carriedVerb = verbsThatCanCarry.has(leadingVerb) ? (verbMap[leadingVerb] || leadingVerb) : null;
        result.push(corrected);
        continue;
      }

      if (!carriedVerb) {
        result.push(corrected);
        continue;
      }

      const boundary = this._findTrailingActionBoundary(corrected, trailingActionPattern);
      if (!boundary) {
        result.push(corrected);
        continue;
      }

      const target = this._cleanCarriedAppTarget(corrected.slice(0, boundary.index));
      const trailing = corrected.slice(boundary.index).trim();
      if (!target || !trailing || this._targetLooksLikeNonApp(target)) {
        result.push(corrected);
        continue;
      }

      result.push(`${carriedVerb} ${target}`);
      result.push(trailing);
      changed = true;
    }

    if (!changed || result.length < 2) {
      return null;
    }

    return this._normalizeMultiClauses(result).slice(0, 8);
  }

  _findTrailingActionBoundary(text, actionPattern) {
    const source = String(text || '');
    let match;
    const pattern = new RegExp(actionPattern.source, 'ig');
    while ((match = pattern.exec(source))) {
      if (match.index <= 0) {
        continue;
      }
      const before = source.slice(0, match.index).trim();
      const after = source.slice(match.index).trim();
      if (before && after) {
        return { index: match.index, action: match[0] };
      }
    }
    return null;
  }

  _cleanCarriedAppTarget(value) {
    return String(value || '')
      .replace(/^(?:the|a|an|my)\s+/i, '')
      .replace(/\s+(?:app|application|program|window)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _targetLooksLikeNonApp(target) {
    const text = String(target || '').trim().toLowerCase();
    if (!text || text.length > 80 || text.split(/\s+/).length > 5) {
      return true;
    }
    return /\b(?:volume|vol|brightness|bright|timer|alarm|reminder|file|folder|message|search|question|answer|percent|level)\b/.test(text);
  }

  _splitCoordinatedUtilitySetCommand(text) {
    const source = String(text || '').trim();
    const prepared = this._safePrepareInput(source);
    const correctedSource = String(prepared?.correctedText || source).trim();
    const match = correctedSource.match(
      /^(?:(?:please|kindly|can\s+you|could\s+you|would\s+you)\s+)?(?:set|change|make|put|keep|adjust|turn)\s+(?:the\s+)?(.+?)\s+(?:to|at)\s+(\d{1,3})(?:\s*%|\s+percent)?$/i
    ) || source.match(
      /^(?:(?:please|kindly|can\s+you|could\s+you|would\s+you)\s+)?(?:set|change|make|put|keep|adjust|turn)\s+(?:the\s+)?(.+?)\s+(?:to|at)\s+(\d{1,3})(?:\s*%|\s+percent)?$/i
    );
    if (!match?.[1] || !match?.[2]) {
      return null;
    }

    const value = Number(match[2]);
    if (!Number.isFinite(value)) {
      return null;
    }

    const targetText = match[1]
      .replace(/\b(?:level|levels|percent|percentage)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (/\b(?:to|at)\s+\d{1,3}(?:\s*%|\s+percent)?\b/.test(targetText)) {
      return null;
    }
    const targets = [];
    if (/\b(?:vol|volume|sound|audio)\b/.test(targetText)) {
      targets.push('volume');
    }
    if (/\b(?:brightness|bright|screen|display)\b/.test(targetText)) {
      targets.push('brightness');
    }

    const uniqueTargets = [...new Set(targets)];
    if (uniqueTargets.length < 2) {
      return null;
    }

    return uniqueTargets.map(target => `set ${target} to ${value}`);
  }

  _looksLikeSingleMediaPlatformRequest(text) {
    const source = String(text || '').trim().toLowerCase();
    return /^(?:open|launch|start)\s+(?:youtube|spotify|apple\s+music|amazon\s+music|soundcloud)\s+and\s+(?:play|stream|listen|watch)\b/.test(source);
  }

  _looksLikeSingleMediaTitleRequest(text) {
    const source = String(text || '').trim().toLowerCase();
    if (!/^(?:play|stream|listen\s+to|watch|queue|put\s+on|start\s+playing)\b/.test(source)) {
      return false;
    }
    if (!/\s+and\s+/.test(source)) {
      return false;
    }
    if (/\b(?:and then|then|after that|afterwards)\b|[;]/i.test(source)) {
      return false;
    }

    const parts = source.split(/\s+and\s+/i).map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) return false;
    const newActionPattern = /^(?:open|launch|start|run|close|quit|exit|terminate|minimize|maximize|switch|focus|search|google|find|look\s+up|set|turn|send|message|call|remind|notify|alert|create|delete|move|copy|rename|save|show|list|pause|resume|stop|skip|next|previous|volume|vol|brightness)\b/i;
    return parts.slice(1).every(part => !newActionPattern.test(part));
  }

  _looksLikeSingleMultiTimeReminderRequest(text) {
    const source = String(text || '').trim();
    if (!this._extractMultiTimeReminder(source, source)) {
      return false;
    }

    return !/\b(?:and|then|after\s+that|afterwards|also|plus)\s+(?:open|launch|start|run|close|quit|exit|terminate|search|google|look\s+up|find|play|pause|resume|unpause|stop|set|turn|send|share|transfer|copy|move|message|text|call|create|delete|rename|save|show|list)\b/i.test(source);
  }

  _normalizeMultiClauses(clauses) {
    const verbsThatCanCarry = new Set([
      'open',
      'launch',
      'start',
      'run',
      'close',
      'quit',
      'exit',
      'terminate',
      'minimize',
      'maximize',
      'switch',
      'focus'
    ]);
    let carriedVerb = null;

    return clauses.map(clause => {
      const originalClause = String(clause || '').trim();
      if (/^(?:save|compare|download|archive|organize|analyze|schedule|bookmark|categorize|evaluate)\b/i.test(originalClause)) {
        carriedVerb = null;
        return originalClause;
      }

      const prepared = this.nlp.prepare(clause);
      const corrected = String(prepared.correctedText || clause || '').trim();
      const normalized = corrected.toLowerCase();
      const verbMatch = normalized.match(/^(open|launch|start|run|close|quit|exit|terminate|minimize|maximize|switch|focus|pause|resume|unpause|stop|set|save|saved)\b/);
      const standaloneQuestionMatch = normalized.match(/^ask\s+(.+)$/);
      if (standaloneQuestionMatch?.[1] && /^(?:what|who|when|where|why|how|which)\b/i.test(standaloneQuestionMatch[1].trim())) {
        carriedVerb = null;
        return `search for ${standaloneQuestionMatch[1].trim()}`;
      }

      if (/^(?:ask|tell|send|message|text|search|google|look\s+up|find|show|list|what|who|when|where|why|how|which|remind|set|turn|save|saved)\b/.test(normalized)) {
        carriedVerb = null;
        const settingMatch = normalized.match(/^set\s+(?:the\s+)?(?:vol|volume|sound|audio|brightness|screen|display)\b/);
        if (settingMatch) {
          carriedVerb = 'set';
        }
        return corrected;
      }

      if (verbMatch) {
        if (verbsThatCanCarry.has(verbMatch[1])) {
          carriedVerb = verbMatch[1];
        }
        return corrected;
      }

      if (carriedVerb && /^[a-z0-9][a-z0-9\s.-]*$/i.test(corrected)) {
        if (carriedVerb === 'set' &&
          !/^(?:vol|volume|sound|audio|brightness|screen|display)\b/i.test(corrected)) {
          return corrected;
        }
        return `${carriedVerb} ${corrected}`;
      }

      return corrected;
    });
  }

  _extractModeCommandsFromData(data) {
    if (!data || !Array.isArray(data.commands)) {
      return [];
    }

    return data.commands
      .map(command => String(command || '').trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  _clauseLooksActionable(clause, source) {
    if (this._isPoliteLeadInClause(clause)) {
      return false;
    }

    const cacheKey = `${source || 'chat'}:${String(clause || '').trim().toLowerCase()}`;
    if (this.clauseActionableCache.has(cacheKey)) {
      const cached = this.clauseActionableCache.get(cacheKey);
      this.clauseActionableCache.delete(cacheKey);
      this.clauseActionableCache.set(cacheKey, cached);
      return cached;
    }

    const prepared = this._safePrepareInput(clause);
    const intentResult = this._resolveIntent(clause, prepared, source);
    const actionable = Boolean(intentResult && intentResult.confidence >= CONFIDENCE_THRESHOLD);
    this.clauseActionableCache.set(cacheKey, actionable);
    while (this.clauseActionableCache.size > 1024) {
      this.clauseActionableCache.delete(this.clauseActionableCache.keys().next().value);
    }
    return actionable;
  }

  _logRoutingDiagnostics(rawCommandText, preparedInput, intentResult) {
    if (this.config?.communication?.debug !== true && this.config?.assistant?.debugRouting !== true) {
      return;
    }

    const intent = intentResult?.intent || null;
    const messageIntent = this.intentRegistry.get('message.send');
    let messageEntities = {};
    if (messageIntent) {
      try {
        messageEntities = this.entityExtractor.extract(messageIntent, rawCommandText);
      } catch (_) {
        messageEntities = {};
      }
    }
    const messageCandidate = Boolean(
      messageEntities?.contactName ||
      messageEntities?.messageText ||
      messageEntities?.platform ||
      /\b(?:send|message|text|msg|telegram|signal|discord|messenger|instagram|say|ask|tell)\b/i.test(rawCommandText)
    );

    const helpWonReason = intent?.id === 'help' && messageCandidate
      ? this._explainMessageIntentLoss(messageEntities)
      : null;

    this.logger.debug('Routing diagnostics', {
      rawInput: rawCommandText,
      normalizedInput: preparedInput?.correctedText || '',
      detectedIntent: intent?.id || null,
      intentConfidence: Number(intentResult?.confidence || 0),
      extractedEntities: intentResult?.entities || {},
      chosenAction: intent?.action || null,
      selectedCommunicationProvider: intent?.id === 'message.send'
        ? (intentResult?.entities?.platform || this.config?.communication?.defaultProvider || null)
        : null,
      helpWonReason
    });
  }

  _explainMessageIntentLoss(messageEntities = {}) {
    const missing = [];
    if (!messageEntities.contactName) missing.push('contactName');
    if (!messageEntities.messageText) missing.push('messageText');
    if (missing.length > 0) {
      return `message.send missing ${missing.join(', ')}`;
    }
    return 'message.send parsed but a higher-priority resolver selected help';
  }

  _isPoliteLeadInClause(clause) {
    return /^(?:go\s+ahead|please|kindly|ok|okay|sure|can\s+you|could\s+you|would\s+you)$/i.test(String(clause || '').trim());
  }

  async _executeMultiCommand(commandId, clauses, source, options = {}) {
    const steps = [];
    let browserContext = null;

    for (const clause of clauses) {
      const routedClause = this._applyBrowserContextToSearchClause(clause, browserContext, source);
      let result = await this.process(routedClause, source, {
        allowMulti: false,
        permissionGuard: options.permissionGuard,
        phoneContext: options.phoneContext || null,
        signal: options.signal,
        executionContext: options.executionContext || null
      });
      if (!result.success && !result.requiresConfirmation) {
        const fallbackResult = await this._executeBareWorkflowStep(clause, source, options);
        if (fallbackResult) {
          result = fallbackResult;
        }
      }
      steps.push({
        commandId: result.commandId || null,
        input: clause,
        routedInput: routedClause,
        success: result.success,
        intent: result.intent,
        entities: result.entities,
        languageUnderstanding: result.languageUnderstanding || null,
        response: result.response,
        error: result.error || null,
        requiresConfirmation: Boolean(result.requiresConfirmation),
        confirmationMessage: result.confirmationMessage || null,
        permissionLevel: result.permissionLevel || null
      });
      browserContext = this._deriveBrowserContextFromResult(result, browserContext);

      if (result.requiresConfirmation || result.needsClarification) {
        const pendingIndex = steps.length - 1;
        const needsClarification = Boolean(result.needsClarification);
        return {
          commandId,
          success: false,
          intent: 'multi.command',
          confidence: 1,
          entities: { commands: clauses },
          steps,
          data: result.requiresConfirmation
            ? {
                pendingStepIndex: pendingIndex,
                pendingStep: steps[pendingIndex],
                completedSteps: steps.slice(0, pendingIndex),
                remainingCommands: clauses.slice(pendingIndex + 1)
              }
            : null,
          response: result.requiresConfirmation
            ? result.response
            : this._buildMultiCommandResponse(steps),
          needsClarification,
          validation: needsClarification ? result.validation || null : null,
          requiresConfirmation: result.requiresConfirmation,
          confirmationMessage: result.confirmationMessage,
          permissionLevel: result.permissionLevel
        };
      }
    }

    const failedSteps = steps.filter(step => !step.success);
    return {
      commandId,
      success: failedSteps.length === 0,
      intent: 'multi.command',
      confidence: 1,
      entities: { commands: clauses },
      steps,
      response: this._buildMultiCommandResponse(steps)
    };
  }

  _applyBrowserContextToSearchClause(clause, browserContext, source) {
    const text = String(clause || '').trim();
    if (!text || !browserContext?.browserName) {
      return clause;
    }
    if (this._extractBrowserNameHint(text)) {
      return clause;
    }

    const prepared = this.nlp.prepare(text);
    const intentResult = this._resolveIntent(text, prepared, source);
    if (intentResult?.intent?.id !== 'browser.search' || intentResult.entities?.openInBrowser) {
      return clause;
    }

    return `${text} in ${browserContext.browserName}`;
  }

  _deriveBrowserContextFromResult(result, previousContext = null) {
    if (!result?.success) {
      return previousContext;
    }

    const intent = String(result.intent || '');
    const entities = result.entities || {};
    const candidate = entities.browserName || entities.appName || entities.targetApp || '';
    const browserName = this._normalizeBrowserContextName(candidate);

    if (browserName) {
      return { browserName };
    }

    if (intent === 'app.open' || intent === 'app.switch' || intent === 'browser.open') {
      return null;
    }

    return previousContext;
  }

  _normalizeBrowserContextName(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (/\bchrome\b|google\s+chrome/.test(normalized)) return 'chrome';
    if (/\b(?:chrom|chromem|cheome)\b/.test(normalized)) return 'chrome';
    if (/\b(?:edge|msedge|microsoft\s+edge)\b/.test(normalized)) return 'edge';
    if (/\bfirefox\b|mozilla\s+firefox/.test(normalized)) return 'firefox';
    if (normalized === 'browser') return 'browser';
    return '';
  }

  async _executeBareWorkflowStep(clause, source, options = {}) {
    const text = String(clause || '').trim();
    if (!text) {
      return null;
    }

    const operation = this._extractCapabilityOperation(text);
    const safeWorkflowOperations = new Set([
      'analyze',
      'archive',
      'bookmark',
      'categorize',
      'compare',
      'download',
      'evaluate',
      'export',
      'organize',
      'read',
      'report',
      'rename',
      'save',
      'schedule',
      'search',
      'summarize'
    ]);
    if (!safeWorkflowOperations.has(operation)) {
      return null;
    }

    const intent = this.intentRegistry.get('assistant.capability');
    if (!intent) {
      return null;
    }

    const entities = {
      capability: 'workflow-step',
      operation,
      target: text,
      rawCommand: text
    };

    return this._execute(
      IdGenerator.generate(),
      { intent, confidence: 0.8, entities },
      entities,
      text,
      source,
      null,
      options
    );
  }

  _buildMultiCommandResponse(steps) {
    const completedSteps = steps.filter(step => step.success);
    const completed = completedSteps.length;
    const failed = steps.find(step => !step.success);
    const completedSummary = this._summarizeMultiCommandSteps(completedSteps);
    if (failed) {
      const failedSummary = this._summarizeFailedMultiCommandStep(failed) || failed.input || 'one request';
      const reason = this._formatMultiFailureReason(failed, this._stripResponseHonorific(failed.response || failed.error || 'I could not finish it'));
      return completedSummary
        ? `Done, sir. I ${completedSummary}, but I could not ${failedSummary} because ${reason}.`
        : `I could not ${failedSummary} because ${reason}, sir.`;
    }

    return completedSummary
      ? `Done, sir. I ${completedSummary}.`
      : `Done, sir. I completed ${completed} command${completed === 1 ? '' : 's'}.`;
  }

  _summarizeMultiCommandSteps(steps = []) {
    const remaining = Array.isArray(steps) ? [...steps] : [];
    if (remaining.length === 0) return '';

    const utilitySummary = this._summarizeUtilitySetSteps(remaining);
    const summaries = utilitySummary.summary ? [utilitySummary.summary] : [];
    const consumed = new Set(utilitySummary.consumed);
    const appActionSummary = this._summarizeAppActionSteps(remaining, consumed);
    if (appActionSummary.summary) {
      summaries.push(appActionSummary.summary);
      appActionSummary.consumed.forEach(index => consumed.add(index));
    }

    remaining.forEach((step, index) => {
      if (consumed.has(index)) return;
      const summary = this._summarizeMultiCommandStep(step);
      if (summary) summaries.push(summary);
    });

    return this._joinHumanList(summaries);
  }

  _summarizeAppActionSteps(steps = [], alreadyConsumed = new Set()) {
    const apps = [];
    steps.forEach((step, index) => {
      if (alreadyConsumed.has(index) || !['app.open', 'app.close', 'app.switch'].includes(step?.intent)) return;
      const name = this._formatDisplayName(this._entityValue(step, 'appName') || this._entityValue(step, 'targetApp') || step.input || '');
      if (name) {
        apps.push({ index, name, intent: step.intent });
      }
    });
    const uniqueIntents = new Set(apps.map(item => item.intent));
    if (uniqueIntents.size !== 1) {
      return { summary: '', consumed: new Set() };
    }

    const uniqueNames = [];
    const consumed = new Set();
    apps.forEach(item => {
      if (!uniqueNames.includes(item.name)) {
        uniqueNames.push(item.name);
      }
      consumed.add(item.index);
    });
    const intent = apps[0]?.intent;
    const verb = intent === 'app.close'
      ? 'closed'
      : intent === 'app.switch'
        ? 'switched to'
        : 'opened';

    return uniqueNames.length >= 2
      ? { summary: `${verb} ${this._joinHumanList(uniqueNames)}`, consumed }
      : { summary: '', consumed: new Set() };
  }

  _summarizeUtilitySetSteps(steps = []) {
    const utility = [];
    steps.forEach((step, index) => {
      if (!['volume.set', 'brightness.set'].includes(step?.intent)) return;
      const value = this._entityValue(step, 'value');
      if (value === null || value === undefined || value === '') return;
      utility.push({ index, intent: step.intent, value: Number(value) });
    });

    const hasVolume = utility.find(item => item.intent === 'volume.set');
    const hasBrightness = utility.find(item => item.intent === 'brightness.set');
    if (!hasVolume || !hasBrightness || hasVolume.value !== hasBrightness.value) {
      return { summary: '', consumed: new Set() };
    }

    return {
      summary: `set the volume and brightness to ${hasVolume.value}%`,
      consumed: new Set([hasVolume.index, hasBrightness.index])
    };
  }

  _summarizeMultiCommandStep(step = {}) {
    const intent = String(step.intent || '');
    const entity = name => this._entityValue(step, name);

    if (intent === 'volume.set') return `set the volume to ${entity('value')}%`;
    if (intent === 'brightness.set') return `set the brightness to ${entity('value')}%`;
    if (intent === 'volume.up') return 'raised the volume';
    if (intent === 'volume.down') return 'lowered the volume';
    if (intent === 'volume.mute') return 'muted the audio';
    if (intent === 'volume.unmute') return 'unmuted the audio';
    if (intent === 'brightness.up') return 'increased the brightness';
    if (intent === 'brightness.down') return 'lowered the brightness';
    if (intent === 'media.play') {
      const query = entity('mediaQuery') || entity('query') || entity('title') || 'your media';
      const platform = this._formatDisplayName(entity('mediaPlatform') || entity('platform') || 'YouTube');
      return `started ${this._quoteHumanValue(query)} on ${platform}`;
    }
    if (intent === 'media.pause') return 'paused playback';
    if (intent === 'media.resume') return 'resumed playback';
    if (intent === 'media.stop') return 'stopped playback';
    if (intent === 'media.next') return 'skipped to the next track';
    if (intent === 'media.previous') return 'went back to the previous track';
    if (intent === 'app.open') return `opened ${this._formatDisplayName(entity('appName') || entity('targetApp') || step.input || 'the app')}`;
    if (intent === 'app.close') return `closed ${this._formatDisplayName(entity('appName') || entity('targetApp') || 'the app')}`;
    if (intent === 'app.switch') return `switched to ${this._formatDisplayName(entity('appName') || entity('targetApp') || 'the app')}`;
    if (intent === 'browser.search') return `searched for ${this._quoteHumanValue(entity('query') || step.input || 'that')}`;
    if (intent === 'browser.open') return `opened ${this._formatDisplayName(entity('browserName') || entity('url') || 'the browser')}`;
    if (intent === 'timer.set') {
      const duration = entity('duration');
      return duration ? `started a ${duration} minute timer` : 'started the timer';
    }
    if (intent === 'alarm.set') return `set an alarm for ${entity('timeExpression') || 'the requested time'}`;
    if (intent === 'reminder.set') {
      const text = entity('reminderText') || 'that';
      const time = entity('timeExpression');
      const duration = entity('duration');
      const when = time ? ` at ${time}` : duration ? ` in ${duration} minute${duration === 1 ? '' : 's'}` : '';
      return `set a reminder to ${text}${when}`;
    }

    return this._stripResponseHonorific(step.response || '').replace(/[.!?]+$/g, '').trim();
  }

  _summarizeFailedMultiCommandStep(step = {}) {
    const intent = String(step.intent || '');
    const entity = name => this._entityValue(step, name);

    if (intent === 'app.open') return `open ${this._formatDisplayName(entity('appName') || entity('targetApp') || 'the app')}`;
    if (intent === 'app.close') return `close ${this._formatDisplayName(entity('appName') || entity('targetApp') || 'the app')}`;
    if (intent === 'app.switch') return `switch to ${this._formatDisplayName(entity('appName') || entity('targetApp') || 'the app')}`;
    if (intent === 'volume.set') return `set the volume to ${entity('value')}%`;
    if (intent === 'brightness.set') return `set the brightness to ${entity('value')}%`;
    if (intent === 'browser.search') return `search for ${this._quoteHumanValue(entity('query') || step.input || 'that')}`;
    if (intent === 'media.play') return `play ${this._quoteHumanValue(entity('mediaQuery') || entity('query') || 'that')}`;
    return String(step.input || '').replace(/\s+/g, ' ').trim();
  }

  _formatMultiFailureReason(step = {}, reason = '') {
    const clean = String(reason || 'it did not complete').replace(/[.!?]+$/g, '').trim();
    const rawAppName = String(this._entityValue(step, 'appName') || this._entityValue(step, 'targetApp') || '').trim();
    const appName = this._formatDisplayName(rawAppName);
    if (appName) {
      const appPattern = new RegExp(`^${this._escapeRegExp(appName)}\\b`, 'i');
      if (appPattern.test(clean)) {
        return clean.replace(appPattern, appName);
      }
      if (rawAppName) {
        const rawPattern = new RegExp(`^${this._escapeRegExp(rawAppName)}\\b`, 'i');
        if (rawPattern.test(clean)) {
          return clean.replace(rawPattern, appName);
        }
      }
    }
    return clean.charAt(0).toLowerCase() + clean.slice(1);
  }

  _escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _entityValue(step = {}, name) {
    const entities = step.entities || {};
    const data = step.data || {};
    return entities[name] ?? data[name] ?? data?.data?.[name] ?? null;
  }

  _stripResponseHonorific(value) {
    return String(value || '')
      .replace(/\s*,?\s*(?:sir|master|boss|commander)\s*[.!?]?$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _formatDisplayName(value) {
    const source = String(value || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';
    const normalized = source.toLowerCase();
    const names = {
      instagram: 'Instagram',
      instagran: 'Instagram',
      linkedin: 'LinkedIn',
      linkdin: 'LinkedIn',
      youtube: 'YouTube',
      chrome: 'Chrome',
      edge: 'Edge',
      firefox: 'Firefox',
      spotify: 'Spotify',
      whatsapp: 'WhatsApp'
    };
    if (names[normalized]) return names[normalized];
    return source.split(' ').map(part => {
      if (/^[A-Z0-9]{2,}$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(' ');
  }

  _quoteHumanValue(value) {
    const source = String(value || '').replace(/\s+/g, ' ').trim();
    if (!source) return 'that';
    return `"${source}"`;
  }

  _joinHumanList(items = []) {
    const clean = items.map(item => String(item || '').trim()).filter(Boolean);
    if (clean.length <= 1) return clean[0] || '';
    if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
    return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
  }

  _recordRoutingEvidence(entry = {}) {
    if (!this.learningStore?.recordRoutingEvidence) {
      return null;
    }

    const semanticParse = entry.semanticParse ||
      entry.preparedInput?.semanticParse ||
      entry.languageUnderstanding?.semanticParse ||
      null;
    return this.learningStore.recordRoutingEvidence({
      input: entry.input,
      source: entry.source,
      intent: entry.intent,
      success: entry.success,
      routeSource: entry.routeSource,
      validationStatus: entry.validationStatus,
      semanticParse
    });
  }

  async confirmAndExecute(commandId, intentId, entities, options = {}) {
    const intent = this.intentRegistry.get(intentId);
    if (!intent) {
      return {
        commandId,
        success: false,
        error: 'Intent not found',
        response: this._buildResponse('error', 'unknownCommand')
      };
    }

    const verification = this._verifyResolvedIntent(
      options.originalInput || '',
      intent,
      entities
    );

    if (!verification.verified && options.allowPartialVerification !== true) {
      return {
        commandId,
        success: false,
        error: 'Command verification failed',
        response: this._buildResponse('error', 'commandVerificationFailed', {
          warnings: verification.warnings,
          unmatchedTokens: verification.unmatchedTokens
        }),
        intent: intent.id,
        confidence: verification.confidence,
        entities,
        requiresConfirmation: true,
        verification
      };
    }

    if (verification.warnings.length > 0) {
      this.logger.warn(`Command verification warnings for ${commandId}:`, verification.warnings);
    }

    const externalPermissionCheck = this._validateExternalPermission(
      options.permissionGuard,
      intent,
      entities
    );
    if (!externalPermissionCheck.allowed) {
      return {
        commandId,
        success: false,
        error: 'Permission denied',
        response: externalPermissionCheck.response || this._buildResponse('error', 'permissionDenied'),
        intent: intent.id,
        confidence: 1,
        entities,
        requiresConfirmation: false,
        permissionLevel: intent.permissionLevel
      };
    }

    const permissionIntent = this._buildPermissionIntent(intent, entities);
    const permissionCheck = this.permissionValidator.validate(permissionIntent, entities, options.source || 'confirmation');
    if (!permissionCheck.allowed) {
      return {
        commandId,
        success: false,
        error: 'Permission denied',
        response: permissionCheck.response || this._buildResponse('error', 'permissionDenied'),
        intent: intent.id,
        confidence: 1,
        entities,
        requiresConfirmation: false,
        permissionLevel: permissionIntent.permissionLevel
      };
    }

    return this._execute(commandId, { intent, confidence: 1.0 }, entities, '', options.source || 'confirmation', null, options);
  }

  _validateExternalPermission(permissionGuard, intent, entities) {
    if (typeof permissionGuard !== 'function') return { allowed: true };
    try {
      const result = permissionGuard(intent, entities);
      return result?.allowed === false ? result : { allowed: true };
    } catch (error) {
      this.logger.warn('External permission guard failed', { error: error.message, intent: intent?.id });
      return { allowed: false, response: 'Permission denied.' };
    }
  }

  async _execute(commandId, intentResult, entities, rawCommandText = '', source = 'chat', languageUnderstanding = null, executionOptions = {}) {
    try {
      const signal = executionOptions.signal || executionOptions.executionContext?.signal || null;
      throwIfAborted(signal);
      if (intentResult.intent.id === 'assistant.capability') {
        let capabilityData = { action: 'capability.recognized', ...entities };
        if (this.automationEngine && typeof this.automationEngine.execute === 'function') {
          try {
            const markerResult = await Promise.resolve(this.automationEngine.execute(intentResult.intent.action, entities, {
              commandId,
              intent: intentResult.intent.id,
              input: rawCommandText,
              source,
              languageUnderstanding,
              signal,
              executionContext: executionOptions.executionContext || null,
              capabilityMarkerOnly: true
            }));
            if (markerResult?.data) capabilityData = markerResult.data;
          } catch (error) {
            if (isCancellationError(error)) throw error;
            this.logger.warn('Capability marker execution failed', { error: error.message, input: rawCommandText });
          }
        }
        this._recordRoutingEvidence({
          input: rawCommandText,
          source,
          intent: intentResult.intent.id,
          success: true,
          languageUnderstanding,
          routeSource: entities?.routeSource || null,
          validationStatus: 'recognized'
        });
        return {
          commandId,
          success: true,
          needsClarification: false,
          intent: intentResult.intent.id,
          confidence: intentResult.confidence,
          entities,
          response: this._buildResponse('success', intentResult.intent.id, {
            entities,
            result: { success: true, data: capabilityData },
            intent: intentResult.intent,
            input: rawCommandText,
            source
          }),
          error: null,
          languageUnderstanding,
          validation: null,
          verification: null,
          confirmation: { required: false, message: '' },
          data: capabilityData
        };
      }

      const result = await this.nle.execute(intentResult.intent.action, entities, {
        commandId,
        intent: intentResult.intent.id,
        input: rawCommandText,
        source,
        languageUnderstanding,
        contextualRewrite: languageUnderstanding?.contextualRewrite || null,
        conversation: executionOptions.conversation || null,
        phoneContext: executionOptions.phoneContext || null,
        signal,
        executionContext: executionOptions.executionContext || null
      });
      throwIfAborted(signal);
      const confirmation = this.actionConfirmation.confirm(result);
      this.logger.info(`Execution result: ${commandId}`, {
        success: result.success,
        error: result.error || null,
        needsClarification: Boolean(result.needsClarification),
        validation: result.validation?.status || result.data?.validation?.status || null,
        verification: result.verification?.status || result.data?.verification?.status || null,
        launchMethod: result.data?.launchMethod || null,
        matchedWindow: result.data?.matchedWindow || null
      });
      this._recordRoutingEvidence({
        input: rawCommandText,
        source,
        intent: intentResult.intent.id,
        success: Boolean(result.success),
        languageUnderstanding,
        routeSource: entities?.routeSource || (intentResult.semanticFrame ? 'natural-language-router' : null),
        validationStatus: result.success ? 'passed' : 'execution-failed'
      });

      const modeCommandSteps = [];
      if (result.success && intentResult.intent.id === 'mode.start') {
        const modeCommands = this._extractModeCommandsFromData(result.data);
        for (const command of modeCommands) {
          throwIfAborted(signal);
          const stepResult = await this.process(command, source, {
            allowMulti: true,
            signal,
            executionContext: executionOptions.executionContext || null
          });
          modeCommandSteps.push({
            input: command,
            success: stepResult.success,
            intent: stepResult.intent,
            entities: stepResult.entities,
            steps: stepResult.steps || null,
            response: stepResult.response,
            error: stepResult.error || null
          });
        }
      }

      const responseData = modeCommandSteps.length > 0
        ? { ...(result.data || {}), commandSteps: modeCommandSteps }
        : result.data;
      const responseResult = { ...result, data: responseData };

      return {
        commandId,
        success: result.success && modeCommandSteps.every(step => step.success),
        needsClarification: Boolean(result.needsClarification),
        intent: intentResult.intent.id,
        confidence: intentResult.confidence,
        entities,
        response: result.needsClarification
          ? (result.error || 'Please clarify which target to use.')
          : result.success
          ? this._buildResponse('success', intentResult.intent.id, {
              entities,
              result: responseResult,
              intent: intentResult.intent,
              input: rawCommandText,
              source
            })
          : this._buildResponse('error', 'executionFailed', {
              error: result.error,
              intent: intentResult.intent,
              entities
        }),
        error: result.error || null,
        languageUnderstanding,
        validation: result.validation || result.data?.validation || null,
        verification: result.verification || result.data?.verification || null,
        confirmation,
        data: responseData || result.data || null
      };
    } catch (err) {
      if (isCancellationError(err)) {
        throw err;
      }
      this.logger.error(`Execution error: ${commandId}`, err);
      return {
        commandId,
        success: false,
        error: err.message,
        response: this._buildResponse('error', 'executionFailed', { error: err.message })
      };
    }
  }

  _matchIntent(preparedInput) {
    const normalized = (preparedInput.intentText || preparedInput.correctedText || '').trim();
    if (!normalized) return null;
    const revision = this.intentRegistry?.getRevision?.() || 0;
    const cacheKey = `${revision}:${normalized}`;
    if (this.matchIntentCache.has(cacheKey)) {
      const cached = this.matchIntentCache.get(cacheKey);
      this.matchIntentCache.delete(cacheKey);
      this.matchIntentCache.set(cacheKey, cached);
      return cached;
    }

    const exactMatches = this.intentRegistry.getPatterns();
    let bestExactMatch = null;
    let bestPatternLength = -1;

    for (const [pattern, intentIds] of exactMatches.entries()) {
      if (normalized === pattern || normalized.startsWith(`${pattern} `)) {
        if (pattern.length > bestPatternLength) {
          const intent = this.intentRegistry.get(intentIds[0]);
          if (intent) {
            bestExactMatch = { intent, confidence: 1.0 };
            bestPatternLength = pattern.length;
          }
        }
      }
    }

    if (bestExactMatch) {
      return this._rememberRouterCache(this.matchIntentCache, cacheKey, bestExactMatch);
    }

    if (this._shouldSkipFuzzyIntentMatch(preparedInput, normalized)) {
      return this._rememberRouterCache(this.matchIntentCache, cacheKey, null);
    }

    let bestMatch = null;
    for (const candidate of this.nlp.getPreparedIntentPatterns()) {
      const confidence = this.nlp.scorePattern(preparedInput, candidate.prepared);
      if (!bestMatch ||
        confidence > bestMatch.confidence ||
        (confidence === bestMatch.confidence && candidate.length > bestMatch.patternLength)) {
        bestMatch = {
          intent: candidate.intent,
          patternLength: candidate.length,
          confidence
        };
      }
    }
    if (!bestMatch || bestMatch.confidence < CONFIDENCE_THRESHOLD) {
      return this._rememberRouterCache(this.matchIntentCache, cacheKey, null);
    }

    return this._rememberRouterCache(this.matchIntentCache, cacheKey, {
      intent: bestMatch.intent,
      confidence: bestMatch.confidence
    });
  }

  _shouldSkipFuzzyIntentMatch(preparedInput, normalizedText = '') {
    const query = preparedInput?.query || {};
    const semanticFrame = preparedInput?.semanticFrame || {};
    const intentPhrase = semanticFrame.intentPhrase || preparedInput?.intentPhrase || {};
    if (query.actionVerb ||
      query.isQuestion ||
      query.isKnowledgeQuestion ||
      query.isLocalFileQuestion ||
      semanticFrame.actionVerb ||
      intentPhrase.action) {
      return false;
    }

    const text = String(normalizedText || preparedInput?.correctedText || '').toLowerCase();
    if (/\b(?:open|launch|start|run|close|quit|exit|terminate|minimize|maximize|switch|focus|search|google|look\s+up|find|locate|show|list|play|pause|resume|stop|set|turn|send|share|transfer|copy|move|message|text|call|remind|notify|alert|create|delete|rename|save|download|install|scan|sync|clean|clear)\b/.test(text)) {
      return false;
    }

    const domain = String(intentPhrase.domain || semanticFrame.domain || '').toLowerCase();
    return domain === 'conversation' || domain === 'unknown';
  }

  _buildLanguageUnderstanding(preparedInput, intentResult, missingRequired = [], status = 'passed') {
    const intent = intentResult?.intent || null;
    const missing = Array.isArray(missingRequired) ? missingRequired : [];
    const commandFrame = preparedInput?.commandFrame || null;
    const semanticParse = preparedInput?.semanticParse || null;
    const appLanguage = preparedInput?.appLanguage || null;
    const browserLanguage = preparedInput?.browserLanguage || null;
    const selectedSemanticFrame = intentResult?.semanticFrame || (
      semanticParse?.frames?.find?.(frame => frame.intentId === intent?.id) || null
    );
    return {
      status,
      normalizedText: preparedInput?.normalizedText || '',
      correctedText: preparedInput?.correctedText || '',
      intentText: preparedInput?.intentText || '',
      discourse: preparedInput?.discourse || null,
      intentPhrase: preparedInput?.intentPhrase || null,
      contextualRewrite: preparedInput?.contextualRewrite || null,
      resolvedContext: this._summarizeResolvedContext(preparedInput?.resolvedContext),
      commandFrame: commandFrame ? {
        action: commandFrame.action || null,
        actionToken: commandFrame.actionToken || null,
        targetText: commandFrame.targetText || '',
        domain: commandFrame.domain || 'unknown',
        appRouteAllowed: Boolean(commandFrame.appRouteAllowed),
        tokenRoles: commandFrame.tokenRoles || [],
        relations: commandFrame.relations || [],
        validation: commandFrame.validation || null
      } : null,
      semanticParse: semanticParse ? {
        version: semanticParse.version || 'semantic-frame-v1',
        multiIntent: Boolean(semanticParse.multiIntent),
        relations: semanticParse.relations || [],
        validation: semanticParse.validation || null,
        frames: (semanticParse.frames || []).map(frame => ({
          text: frame.text || '',
          action: frame.action || null,
          actionToken: frame.actionToken || null,
          targetText: frame.targetText || '',
          intentPhrase: frame.intentPhrase || null,
          domain: frame.domain || 'unknown',
          intentId: frame.intentId || null,
          confidence: Number(frame.confidence || 0),
          entities: frame.entities || {},
          tokenRoles: frame.tokenRoles || [],
          relations: frame.relations || [],
          validation: frame.validation || null
        })),
        selectedFrame: selectedSemanticFrame ? {
          text: selectedSemanticFrame.text || '',
          action: selectedSemanticFrame.action || null,
          domain: selectedSemanticFrame.domain || 'unknown',
          intentId: selectedSemanticFrame.intentId || null,
          validation: selectedSemanticFrame.validation || null
        } : null
      } : null,
      appLanguage: appLanguage ? {
        version: appLanguage.version,
        action: appLanguage.action,
        targetText: appLanguage.targetText,
        forceNewWindow: Boolean(appLanguage.forceNewWindow),
        requestedOperation: appLanguage.requestedOperation,
        confidence: Number(appLanguage.confidence || 0),
        tokenRoles: appLanguage.tokenRoles || [],
        validation: appLanguage.validation || null
      } : null,
      browserLanguage: browserLanguage ? {
        version: browserLanguage.version,
        operation: browserLanguage.operation,
        browserName: browserLanguage.browserName,
        entities: browserLanguage.entities || {},
        confidence: Number(browserLanguage.confidence || 0),
        validation: browserLanguage.validation || null
      } : null,
      queryType: preparedInput?.query?.type || 'unknown',
      actionVerb: preparedInput?.query?.actionVerb || null,
      intent: intent?.id || null,
      action: intent?.action || null,
      confidence: Number(intentResult?.confidence || 0),
      missingEntities: missing,
      validation: {
        status: missing.length > 0 ? 'failed' : 'passed',
        reason: missing.length > 0
          ? `Missing required entities: ${missing.join(', ')}`
          : 'Intent and required entities are complete'
      }
    };
  }

  _summarizeResolvedContext(resolvedContext) {
    if (!resolvedContext) return null;
    return {
      confidence: Number(resolvedContext.confidence || 0),
      topic: resolvedContext.topic?.label || null,
      references: Array.isArray(resolvedContext.resolvedReferences)
        ? resolvedContext.resolvedReferences.slice(0, 5).map(reference => ({
            reference: reference.reference || '',
            target: reference.target || '',
            targetType: reference.targetType || '',
            confidence: Number(reference.confidence || 0)
          }))
        : [],
      currentApplication: resolvedContext.workingMemory?.currentApplication || null,
      currentFile: resolvedContext.workingMemory?.currentFile || null,
      currentBrowser: resolvedContext.workingMemory?.currentBrowser || null
    };
  }

  _shouldUseNoisyRepair(preparedInput, rawText, source) {
    if (this._looksLikeScheduleRequest(rawText)) {
      return false;
    }

    if (/\b(?:setup|session|workspace|focus\s+mode|everything\s+i\s+need|apps?\s+i\s+use)\b/i.test(String(rawText || ''))) {
      return false;
    }

    if (/^\s*(?:what|who|when|where|why|how|which)\b/i.test(String(rawText || ''))) {
      return false;
    }

    if (/\b(?:ipl|cricket|score|scores|live|today'?s?|latest|current|standings?|fifa|world\s+cup|match(?:es)?|fixtures?|schedule|news|release\s+date|premiere|price|best\s+movies?|top\s+movies?)\b/i.test(String(rawText || ''))) {
      return false;
    }

    if (/\b(?:youtube|you\s+tube|spotify|music|songs?|tracks?|playlist|videos?|watch\s+later|subscriptions?|trending|currently\s+playing)\b/i.test(String(rawText || ''))) {
      return false;
    }

    if (/^\s*(?:open|show|search|look\s+up|google)\b.*\b(?:in|on)\s+(?:chrome|browser|edge|firefox)\s*$/i.test(String(rawText || ''))) {
      return false;
    }

    // Speech recognition can join the target's final word with "in"
    // (for example, "jiohotstarin chrome"). Keep the original phrase so the
    // browser-language parser can repair that boundary without losing the
    // requested site or tab name.
    if (/^\s*(?:open|show|search|look\s+up|google)\b.*[a-z0-9]{8,}in\s+(?:chrome|browser|edge|firefox)\s*$/i.test(String(rawText || ''))) {
      return false;
    }

    if (/\b(?:play|stream|listen\s+to|watch|queue|put\s+on|start\s+playing)\b.+\b(?:youtube|spotify|soundcloud|gaana|jiosaavn|amazon\s+music|apple\s+music)\b/i.test(String(rawText || ''))) {
      return false;
    }

    if (this._resolveLocalInfoIntent(rawText, preparedInput)) {
      return false;
    }

    const repaired = String(preparedInput?.repairedCommandText || '').trim();
    const corrected = String(preparedInput?.correctedText || rawText || '').trim();
    if (!repaired || repaired === corrected) {
      return false;
    }

    const hasLocalScope = /\b(?:on|in)\s+(?:my\s+)?(?:laptop|pc|computer|system|device|windows)\b|\b(?:local|offline|this\s+(?:laptop|pc|computer|system|device))\b/i;
    if (hasLocalScope.test(corrected) && !hasLocalScope.test(repaired)) {
      return false;
    }

    if (/\.[A-Za-z0-9]{1,10}\b/.test(String(rawText || ''))) {
      return false;
    }

    if (Number(preparedInput?.actionTokenCount || 0) > 1) {
      return false;
    }

    return Number(preparedInput?.noiseTokenCount || 0) > 0
      || Number(preparedInput?.repairContextTokenCount || 0) > 0;
  }

  _looksLikeScheduleRequest(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return false;

    const hasScheduleAction = /\b(?:remind|reminder|notify|alert|alarm|timer)\b/i.test(text) ||
      /\b(?:set|create|add|schedule)\b.*\b(?:reminder|alarm|timer)\b/i.test(text);
    if (!hasScheduleAction) return false;

    const hasScheduleTime = /\b(?:today|tomorrow|tonight|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night|\d{1,2}(?:(?::|\s+)\d{1,2})?\s*(?:am|pm)|\d+\s*(?:seconds?|minutes?|mins?|hours?|hrs?))\b/i.test(text);
    return hasScheduleTime;
  }

  _resolveYouTubeMediaIntent(rawText, preparedInput = {}) {
    const raw = String(rawText || '').trim();
    const rawLower = raw.toLowerCase();
    const correctedLower = String(preparedInput?.correctedText || raw).trim().toLowerCase();
    const corrected = `${rawLower} ${correctedLower}`
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!corrected) return null;
    const sources = [rawLower, correctedLower, corrected].filter(Boolean);
    const has = (pattern) => sources.some(source => pattern.test(source));

    const route = (intentId, entities = {}, confidence = 0.98) => {
      const intent = this.intentRegistry.get(intentId);
      return intent ? { intent, confidence, entities } : null;
    };
    const openUrl = (url, confidence = 0.98, options = {}) => route('browser.open', { url, ...options }, confidence);
    const play = (query, confidence = 0.98) => route('media.play', {
      mediaQuery: query,
      mediaPlatform: 'youtube'
    }, confidence);
    const siteSearch = (query, confidence = 0.97) => route('browser.siteSearch', {
      site: 'youtube',
      query
    }, confidence);

    if ([rawLower, correctedLower].some(source => /^(?:open|launch|start)\s+(?:my\s+)?youtube$/.test(source))) {
      return null;
    }

    if ([rawLower, correctedLower].some(source => /^(?:go\s+to)\s+(?:my\s+)?youtube$|^(?:open|go\s+to|launch|start)\s+(?:my\s+)?youtube\s+homepage$/.test(source))) {
      return openUrl('https://www.youtube.com/');
    }

    if ([rawLower, correctedLower].some(source => /^(?:open|go\s+to|launch|start)\s+(?:a\s+)?(?:new|another|fresh)\s+youtube(?:\s+(?:tab|homepage))?$/.test(source))) {
      return openUrl('https://www.youtube.com/', 1, {
        newTab: true,
        routeSource: 'youtube-browser-language-v1'
      });
    }

    if (has(/\b(?:youtube.*subscriptions?|subscriptions?\s+on\s+youtube|channels?\s+i\s+follow|videos\s+from\s+channels?\s+i\s+follow|missed\s+.*subscriptions?|videos?\s+from\s+my\s+subscriptions?)\b/)) {
      return openUrl('https://www.youtube.com/feed/subscriptions', 0.97);
    }

    if (has(/\b(?:youtube\s+watch\s+history|watch\s+history|continue\s+watching|where\s+i\s+left\s+off)\b/)) {
      if (has(/\bcontinue\s+watching|left\s+off\b/)) {
        return openUrl('https://www.youtube.com/feed/history', 0.95);
      }
      return openUrl('https://www.youtube.com/feed/history', 0.97);
    }

    if (has(/\b(?:watch\s+later|watchlater)\b/)) {
      return openUrl('https://www.youtube.com/playlist?list=WL', 0.97);
    }

    if (has(/\b(?:trending\s+videos|show\s+trending|trending\s+on\s+youtube|what'?s\s+trending\s+on\s+youtube|people\s+are\s+watching\s+right\s+now|popular\s+tech\s+videos|videos\s+people\s+are\s+watching)\b/)) {
      if (has(/\btech\b/)) {
        return siteSearch('popular tech videos', 0.95);
      }
      return openUrl('https://www.youtube.com/feed/trending', 0.97);
    }

    for (const source of [rawLower, correctedLower]) {
      const youtubeSearch = source.match(/^(?:search|find|look\s+for)\s+(?:youtube\s+)?(?:for\s+)?(.+?)(?:\s+on\s+youtube|\s+in\s+youtube)?$/);
      if (youtubeSearch && /\byoutube\b/.test(source)) {
        const query = this._cleanSiteSearchQuery(youtubeSearch[1]);
        if (query) return siteSearch(query, 0.98);
      }
    }

    if (has(/\b(?:find|show)\s+.*\b(?:videos?\s+related\s+to\s+this|videos?\s+related\s+to\s+this\s+one|related\s+videos?)\b/)) {
      return siteSearch('videos related to current YouTube video', 0.93);
    }

    if (has(/\b(?:play|open)\s+(?:the\s+)?(?:first\s+)?youtube\s+(?:result|video)\b/) ||
      has(/\b(?:can\s+you\s+)?play\s+the\s+first\s+video\s+that\s+comes\s+up\b/)) {
      return play('first YouTube result', 0.95);
    }

    if (has(/\b(?:latest|newest)\s+(?:video|upload)\s+from\s+this\s+channel\b/)) {
      return play('latest video from this channel', 0.94);
    }

    if (has(/\b(?:watch|watching|video|videos|youtube)\b/) &&
      has(/\b(?:something\s+interesting|something\s+funny|funny|educational|learn\s+something\s+new|ai|docker|programming\s+tutorial|coding\s+tutorials?|java\s+tutorial|kubernetes\s+course|course\s+for\s+beginners|tech\s+videos?)\b/)) {
      return play(this._buildYouTubeMediaQuery(raw || corrected), 0.96);
    }

    if (has(/^\s*(?:i'?m\s+looking\s+for|i\s+am\s+looking\s+for|find|show|can\s+you\s+find)\b/) &&
      has(/\b(?:java\s+tutorial|kubernetes\s+course|programming\s+tutorial|coding\s+tutorial|docker|ai)\b/)) {
      return play(this._buildYouTubeMediaQuery(raw || corrected), 0.94);
    }

    if (has(/\b(?:find\s+something\s+educational\s+to\s+watch|show\s+me\s+videos\s+people\s+are\s+watching\s+right\s+now)\b/)) {
      return play(this._buildYouTubeMediaQuery(raw || corrected), 0.94);
    }

    return null;
  }

  _buildYouTubeMediaQuery(value) {
    const cleaned = String(value || '')
      .replace(/[?.!]+$/g, '')
      .replace(/\b(?:can\s+you|please|i\s+want\s+to|i\s+feel\s+like|i'?m\s+looking\s+for|i\s+am\s+looking\s+for|find\s+me|find|show\s+me|show|on\s+youtube|youtube|video|videos|something|that|good)\b/gi, ' ')
      .replace(/\b(?:watch|watching|learn)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'interesting YouTube videos';
  }

  /**
   * Detect playback control intents (next, previous, pause, resume)
   * explicitly based on preprocessed and spelling-corrected text.
   * Runs first to ensure controls like "play next song" or "play nexr sony"
   * are not treated as "play <query>" search requests.
   * @param {string} rawText
   * @param {object} preparedInput
   * @returns {{ intent, confidence }|null}
   */
  _resolveExplicitMediaControlIntent(rawText, preparedInput) {
    const textToUse = `${String(rawText || '')} ${String(preparedInput?.correctedText || rawText || '')}`
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!textToUse) return null;

    if (/\.[A-Za-z0-9]{1,10}\b/.test(String(rawText || ''))) {
      return null;
    }

    const mediaRoute = (intentId) => {
      const intent = this.intentRegistry.get(intentId);
      return intent ? { intent, confidence: 1 } : null;
    };

    if (/\b(?:exit|leave|close)\s+(?:fullscreen|full\s+screen)\b/.test(textToUse)) {
      return mediaRoute('media.exitFullscreen');
    }

    if (/\b(?:open|close|launch|start|run|quit|exit|terminate)\b/.test(textToUse)) {
      return null;
    }

    if (/\b(?:my\s+resume|resume\s+(?:file|document|docx|pdf)|where\s+did.*\bresume\b|find.*\bresume\b|open.*\bresume\b)\b/.test(textToUse)) {
      return null;
    }

    if (/\b(?:show|what(?:'s| is)?|which)\b.*\b(?:currently\s+playing|playing\s+(?:song|track|video)|song\s+is\s+playing|song\s+.*playing|current\s+song)\b/.test(textToUse)) {
      return mediaRoute('media.status');
    }

    if (/\b(?:mute)\b.*\b(?:youtube|video|music|song|track|audio|media)\b|\b(?:mute)\s+(?:audio|media)\b/.test(textToUse)) {
      return mediaRoute('media.mute');
    }

    if (/\b(?:unmute)\b.*\b(?:youtube|video|music|song|track|audio|media)\b|\b(?:unmute)\s+(?:audio|media)\b/.test(textToUse)) {
      return mediaRoute('media.unmute');
    }

    if (/\b(?:increase|raise|turn\s+up|make)\b.*\b(?:youtube|video|music|song|track|media)\b.*\b(?:volume|sound|louder|quiet)\b|\bturn\s+(?:the\s+)?(?:music|video|media|song)\s+up\b|\b(?:this\s+video|video|music)\s+is\s+too\s+quiet\b/.test(textToUse)) {
      return mediaRoute('media.volumeUp');
    }

    if (/\b(?:decrease|lower|turn\s+down|reduce)\b.*\b(?:youtube|video|music|song|track|media)\b.*\b(?:volume|sound)\b|\bturn\s+(?:the\s+)?(?:sound|music|video|media|song)\s+down\b|\b(?:this\s+video|video|music)\s+is\s+too\s+loud\b/.test(textToUse)) {
      return mediaRoute('media.volumeDown');
    }

    if (/\b(?:switch|make|put)\b.*\b(?:youtube|video|media|player)\b.*\b(?:fullscreen|full\s+screen)\b|\b(?:fullscreen|full\s+screen)\s+(?:mode|youtube|video|media)\b|\bfill\s+the\s+whole\s+screen\b/.test(textToUse)) {
      return mediaRoute('media.fullscreen');
    }

    if (/\b(?:replay|rewind)\b.*\b(?:that\s+part|this\s+part|video|song|track|media)\b|\bcan\s+you\s+replay\s+that\s+part\b/.test(textToUse)) {
      return mediaRoute('media.replay');
    }

    if (/\b(?:skip\s+this\s+video|don'?t\s+like\s+it|do\s+not\s+like\s+it|don'?t\s+feel\s+like\s+listening\s+to\s+this\s+track|do\s+not\s+feel\s+like\s+listening\s+to\s+this\s+track)\b/.test(textToUse)) {
      return mediaRoute('media.next');
    }

    if (/\b(?:repeat|loop|keep)\b.*\b(?:current\s+song|this\s+song|song\s+on\s+repeat|track)\b/.test(textToUse)) {
      return mediaRoute('media.repeat');
    }

    if (/\bshuffle\b.*\b(?:songs?|playlist|everything|tracks?|playback|media)\b|\bshuffle\s+everything\b/.test(textToUse)) {
      return mediaRoute('media.shuffle');
    }

    if (/\b(?:add|save)\b.*\b(?:song|track)\b.*\b(?:favorites?|favourites?|liked)\b|\b(?:i\s+really\s+like\s+this\s+song|like\s+this\s+song|favorite\s+this\s+song)\b/.test(textToUse)) {
      return mediaRoute('media.favorite');
    }

    if (/\b(?:like)\b.*\b(?:youtube\s+)?video\b/.test(textToUse)) {
      return mediaRoute('media.like');
    }

    if (/\bsubscribe\b.*\b(?:channel|this)\b/.test(textToUse)) {
      return mediaRoute('media.subscribe');
    }

    if (/\b(?:stop)\b.*\b(?:when\s+this\s+song\s+ends|after\s+this\s+song)\b/.test(textToUse)) {
      return mediaRoute('media.stop');
    }

    // Check for next/skip
    if (/\b(next\s*song|next\s*track|next\s+video|skip\s*this\s+video|skip\s*song|skip\s*track|play\s+next|skip)\b/i.test(textToUse) ||
      /\bi\s+(?:don'?t|do\s+not)\s+feel\s+like\s+listening\s+to\s+this\s+track\b/.test(textToUse)) {
      const intent = this.intentRegistry.get('media.next');
      if (intent) return { intent, confidence: 1 };
    }

    // Check for previous/back
    if (/\b(previous\s*song|previous\s*track|previous\s+video|go\s*back|go\s+back\s+to\s+the\s+previous\s+song|take\s+me\s+back\s+to\s+the\s+previous\s+video|play\s+previous|prev\s+song|previous)\b/i.test(textToUse)) {
      const intent = this.intentRegistry.get('media.previous');
      if (intent) return { intent, confidence: 1 };
    }

    // Check for pause
    if (/\b(pause|pause\s*(?:the\s*)?(?:youtube\s*)?video|pause\s*music|pause\s*song|pause\s*playback|pause\s+the\s+music\s+for\s+a\s+moment)\b/i.test(textToUse)) {
      const intent = this.intentRegistry.get('media.pause');
      if (intent) return { intent, confidence: 1 };
    }

    // Check for resume
    if (/\b(resume|resume\s*(?:the\s*)?(?:youtube\s*)?video|resume\s*music|resume\s*song|resume\s*playback|resume\s+whatever\s+was\s+playing|continue\s+playing\s+music\s+from\s+where\s+i\s+stopped|play\s+again|unpause|carry\s+on)\b/i.test(textToUse) &&
        !/\b(find|search|locate)\b/i.test(textToUse)) {
      const intent = this.intentRegistry.get('media.resume');
      if (intent) return { intent, confidence: 1 };
    }

    // Check for continue - but not when part of find/search commands
    if (/\b(continue)\b/i.test(textToUse) && !/\b(find|search|locate)\b/i.test(textToUse)) {
      const intent = this.intentRegistry.get('media.resume');
      if (intent) return { intent, confidence: 1 };
    }

    if (/\b(stop\s*music|stop\s*song|stop\s*playback|stop\s*media)\b/i.test(textToUse)) {
      const intent = this.intentRegistry.get('media.stop');
      if (intent) return { intent, confidence: 1 };
    }

    return null;
  }

  /**
   * Detect "play / stream / listen to" requests and route them to media.play.
   * This resolver runs first in the pipeline so that "play X on YouTube"
   * is never misidentified as browser.open or app.open.
   * @param {string} rawText
   * @returns {{ intent, confidence }|null}
   */
  _resolveExplicitMediaIntent(rawText, preparedInput) {
    const input = String(rawText || '').trim();
    if (!input) return null;

    const correctedText = String(preparedInput?.correctedText || input).trim().toLowerCase();
    if (/\.[A-Za-z0-9]{1,10}\b/.test(input)) {
      return null;
    }
    if (/^(?:remind|set\s+reminder)\b/i.test(correctedText)) {
      return null;
    }

    const isMediaRequest =
      /^(?:play|stream|listen\s+to|watch|queue|put\s+on|start\s+playing)\b/i.test(correctedText) ||
      /\b(?:play|stream|listen|watch|queue|put\s+on|start\s+playing)\b/i.test(correctedText);
    if (!isMediaRequest) return null;

    const mediaIntent = this.intentRegistry.get('media.play');
    if (!mediaIntent) return null;

    const entities = this.entityExtractor.extract(mediaIntent, input);
    if (!entities.mediaQuery) {
      entities.mediaQuery = this._defaultMediaQuery(correctedText);
    }
    if (!entities.mediaPlatform && /\byoutube\b/.test(correctedText)) {
      entities.mediaPlatform = 'youtube';
    }
    if (!entities.mediaPlatform) {
      entities.mediaPlatform = /\bspotify\b/.test(correctedText) ? 'spotify' : 'youtube';
    }
    if (!entities.mediaQuery) return null;

    return { intent: mediaIntent, confidence: 0.99, entities };
  }

  _defaultMediaQuery(text) {
    const input = String(text || '').toLowerCase();
    if (/\b(?:playlist|favorite|favourite|liked)\b/.test(input)) return 'liked songs playlist';
    if (/\brelaxing|calmer|calm\b/.test(input)) return 'relaxing music';
    if (/\bworkout|energetic|upbeat|motivating\b/.test(input)) return 'workout music';
    if (/\bcoding|focus|background\b/.test(input)) return 'coding focus music';
    if (/\bjazz\b/.test(input)) return 'jazz music';
    if (/\bpop\b/.test(input)) return 'pop music';
    if (/\brock\b/.test(input)) return 'rock music';
    if (/\bvideo\b/.test(input)) return 'interesting video';
    if (/\bmusic|song|track|playlist\b/.test(input)) return 'music';
    return null;
  }

  _resolveMediaIntent(rawText, source) {
    if (/\.[A-Za-z0-9]{1,10}\b/.test(String(rawText || ''))) {
      return null;
    }

    if (/\b(?:my\s+resume|resume\s+(?:file|document|docx|pdf)|where\s+did.*\bresume\b|find.*\bresume\b|open.*\bresume\b)\b/i.test(String(rawText || ''))) {
      return null;
    }

    if (/^\s*(?:remind|set\s+reminder)\b/i.test(String(rawText || ''))) {
      return null;
    }

    if (/^\s*(?:close|quit|exit|terminate|stop)\b/i.test(String(rawText || '')) &&
      /\b(?:app|application|chrome|edge|firefox|browser|youtube|spotify|google\s+chat|discord|teams)\b/i.test(String(rawText || ''))) {
      return null;
    }

    const routed = this.mediaRouter.route(rawText, { source });
    if (!routed.success) {
      return null;
    }

    const intent = this.intentRegistry.get(routed.payload.action);
    if (!intent) {
      return null;
    }

    return {
      intent,
      confidence: routed.payload.confidence,
      entities: {
        mediaQuery: routed.payload.mediaQuery,
        mediaPlatform: routed.payload.mediaPlatform,
        query: routed.payload.query,
        platform: routed.payload.platform,
        genre: routed.payload.genre,
        source: routed.payload.source
      }
    };
  }

  _resolveExplicitWindowIntent(rawText, preparedInput) {
    const correctedText = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!correctedText) {
      return null;
    }

    if (/\b(?:minimize|collapse|hide|shrink)\b/.test(correctedText)) {
      const intent = this.intentRegistry.get('window.minimize');
      if (intent) {
        if (/\b(?:all|everything)\s+(?:windows?|apps?|applications?|folders?)\b|\b(?:windows?|apps?|applications?|folders?)\s+(?:all|everything)\b/.test(correctedText)) {
          return {
            intent,
            confidence: 1,
            entities: { windowName: 'all windows', allWindows: true }
          };
        }
        const target = this._cleanWindowTarget(preparedInput?.semanticFrame?.targetText || correctedText);
        return {
          intent,
          confidence: 1,
          entities: target ? { windowName: target } : undefined
        };
      }
    }

    if (/\b(?:maximize|fullscreen|expand|enlarge)\b/.test(correctedText)) {
      const intent = this.intentRegistry.get('window.maximize');
      if (intent) {
        if (/\b(?:all|everything)\s+(?:windows?|apps?|applications?|folders?)\b|\b(?:windows?|apps?|applications?|folders?)\s+(?:all|everything)\b/.test(correctedText)) {
          return {
            intent,
            confidence: 1,
            entities: { windowName: 'all windows', allWindows: true }
          };
        }
        const target = this._cleanWindowTarget(preparedInput?.semanticFrame?.targetText || correctedText);
        return {
          intent,
          confidence: 1,
          entities: target ? { windowName: target } : undefined
        };
      }
    }

    return null;
  }

  _cleanWindowTarget(value) {
    return String(value || '')
      .replace(/\b(?:minimize|maximize|collapse|expand|hide|shrink|fullscreen|full\s+screen|bigger|larger|smaller|hidden|please|kindly|now)\b/gi, ' ')
      .replace(/^(?:the|a|an)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _resolveScreenshotIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!input) {
      return null;
    }

    if (/\b(?:show|open|view)\b.*\b(?:latest|last|recent|newest)\b.*\bscreenshots?\b/.test(input)) {
      const fileIntent = this.intentRegistry.get('file.open');
      return fileIntent
        ? { intent: fileIntent, confidence: 1, entities: { filename: 'screenshot in pictures' } }
        : null;
    }

    if (!/\b(?:screenshot|screen\s+shot|capture\s+screen|screen\s+capture|snap\s+screen)\b/.test(input)) {
      return null;
    }

    const intent = this.intentRegistry.get('system.screenshot');
    return intent ? { intent, confidence: 1, entities: {} } : null;
  }

  _resolveWorkspaceSetupIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim().toLowerCase();
    const input = `${raw} ${corrected}`.replace(/\s+/g, ' ').trim();
    if (!input) {
      return null;
    }

    if (/\b(?:music|song|track|playlist|video|youtube|watch|listening)\b/.test(input)) {
      return null;
    }

    const modeIntent = this.intentRegistry.get('mode.start');
    const appIntent = this.intentRegistry.get('app.open');
    if (/\b(?:app|application)\s+i\s+use\s+most\s+for\s+coding\b/.test(raw) ||
      /\b(?:app|application)\s+i\s+use\s+most\s+for\s+coding\b/.test(corrected)) {
      return appIntent
        ? { intent: appIntent, confidence: 0.98, entities: { appName: 'code' } }
        : null;
    }

    const modeMap = [
      { modeName: 'development', pattern: /\b(?:coding|development|developer|project)\b/ },
      { modeName: 'work', pattern: /\b(?:work\s+setup|workspace|work\s+session)\b/ },
      { modeName: 'study', pattern: /\b(?:study\s+session|study\s+setup)\b/ },
      { modeName: 'research', pattern: /\b(?:research\s+session|research\s+setup|computer\s+for\s+research)\b/ },
      { modeName: 'focus', pattern: /\b(?:focus\s+mode|close\s+distractions|prepare\s+my\s+workspace)\b/ },
      { modeName: 'communication', pattern: /\b(?:communication\s+apps?|chat\s+apps?|messaging\s+apps?)\b/ },
      { modeName: 'daily', pattern: /\b(?:apps?\s+i\s+use\s+daily|daily\s+apps?)\b/ }
    ];

    if (!/\b(?:open|start|prepare|launch|activate|close)\b/.test(input) &&
      !/\b(?:focus\s+mode|close\s+distractions)\b/.test(input)) {
      return null;
    }

    const matched = modeMap.find(entry => entry.pattern.test(input));
    return matched && modeIntent
      ? { intent: modeIntent, confidence: 0.96, entities: { modeName: matched.modeName } }
      : null;
  }

  _resolveSystemInsightIntent(rawText, preparedInput) {
    const input = this._normalizeSystemCommandText(preparedInput?.correctedText || rawText);
    const intent = this.intentRegistry.get('system.insight');
    if (!intent || !input) {
      return null;
    }

    if (/\b(?:which|what)\b.*\b(?:app|process)\b.*\b(?:most\s+memory|using\s+the\s+most\s+memory|memory)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'topMemoryApp' } };
    }

    if (/\b(?:which|what)\b.*\b(?:process|app)\b.*\b(?:most\s+cpu|cpu)\b|\bconsuming\s+the\s+most\s+cpu\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'topCpuProcess' } };
    }

    if (/\b(?:gpu\s+usage|gpu\s+information|gpu\s+details)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'gpuUsage' } };
    }

    if (/\b(?:cpu\s+temperature|gpu\s+temperature|system\s+temperature|overheating|running\s+so\s+hot)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'temperature' } };
    }

    if (/\b(?:ram\s+details|memory\s+details|memory\s+consumption|ram\s+consumption)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'memoryUsage' } };
    }

    if (/\b(?:network\s+usage|network\s+speed|internet\s+speed|active\s+network\s+connections?)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'networkUsage' } };
    }

    if (/\b(?:device\s+specifications|computer\s+specifications|hardware\s+information|complete\s+system\s+report|device\s+diagnostics|system\s+performance|system\s+health|quick\s+system\s+check)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'systemSummary' } };
    }

    if (/\b(?:slowing\s+down|fan\s+running|fan\s+so\s+fast|computer\s+slow|laptop\s+slow)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'systemSlowdown' } };
    }

    if (/\b(?:taking\s+up\s+space|storage\s+usage|what\s+uses\s+space|largest\s+folders?)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'storageUsage' } };
    }

    if (/\b(?:recently|newly|last)\s+installed\s+(?:apps?|applications?|programs?)\b/.test(input)) {
      return { intent, confidence: 1, entities: { insightType: 'recentlyInstalledApps' } };
    }

    return null;
  }

  _resolvePresentationControlIntent(rawText, preparedInput = {}) {
    const raw = String(rawText || '').trim().toLowerCase();
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const input = `${raw} ${corrected}`.replace(/\s+/g, ' ').trim();
    if (!input) {
      return null;
    }

    if (/^(?:what|who|where|when|why|how|which)\b/.test(input)) {
      return null;
    }

    const mentionsPresentationSurface =
      /\b(?:power\s*point|powerpoint|power\s+paint|pptx?|presentation|presentations|slide\s*show|slideshow|slides?)\b/.test(input);
    const mentionsCurrentSlide =
      /\b(?:from|on|at)\s+(?:the\s+)?(?:current|active|this)\s+slide\b/.test(input) ||
      /\b(?:current|active|this)\s+slide\b/.test(input);
    const mentionsBeginning =
      /\b(?:from|at)\s+(?:the\s+)?(?:start|beginning|first\s+slide|slide\s+one)\b/.test(input) ||
      /\b(?:start|begin|run|play|present)\s+(?:the\s+)?(?:slide\s*show|slideshow|presentation)\s+(?:from\s+)?(?:start|beginning|first\s+slide|slide\s+one)\b/.test(input);
    const mentionsSlideshow =
      /\b(?:slide\s*show|slideshow|present\s+mode|presentation\s+mode|presenting)\b/.test(input);
    const mentionsNextSlide =
      /\b(?:next|advance|forward)\s+(?:slide|page)\b/.test(input) ||
      /\b(?:go|move|jump)\s+(?:to\s+)?(?:the\s+)?next\s+(?:slide|page)\b/.test(input);
    const mentionsPreviousSlide =
      /\b(?:previous|prev)\s+(?:slide|page)\b/.test(input) ||
      /\b(?:go|move|jump)\s+back\s+(?:one\s+)?(?:slide|page)?\b/.test(input) ||
      /\b(?:go|move|jump)\s+(?:to\s+)?(?:the\s+)?(?:previous|prev)\s+(?:slide|page)\b/.test(input);
    const slideNumber = this._extractPresentationSlideNumber(input);
    const hasAction =
      /\b(?:start|open|play|run|begin|launch|present|show|go|goto|jump|move|advance|next|previous|prev|back)\b/.test(input) ||
      mentionsCurrentSlide ||
      mentionsBeginning ||
      Number.isFinite(slideNumber);

    if (!hasAction) {
      return null;
    }

    if (!mentionsPresentationSurface && !mentionsCurrentSlide && !mentionsBeginning &&
      !mentionsNextSlide && !mentionsPreviousSlide && !Number.isFinite(slideNumber)) {
      return null;
    }

    if (!mentionsSlideshow && !mentionsCurrentSlide && !mentionsBeginning &&
      !mentionsNextSlide && !mentionsPreviousSlide && !Number.isFinite(slideNumber)) {
      return null;
    }

    if (!mentionsBeginning && !mentionsCurrentSlide &&
      (mentionsNextSlide || mentionsPreviousSlide || Number.isFinite(slideNumber))) {
      const intentId = Number.isFinite(slideNumber)
        ? 'presentation.goto'
        : mentionsPreviousSlide
          ? 'presentation.previous'
          : 'presentation.next';
      const intent = this.intentRegistry.get(intentId);
      return intent
        ? {
            intent,
            confidence: 0.98,
            entities: {
              appName: 'powerpoint',
              presentationApp: 'powerpoint',
              windowName: 'powerpnt',
              ...(Number.isFinite(slideNumber) ? { slideNumber } : {}),
              routeSource: 'presentation-control'
            }
          }
        : null;
    }

    const intent = this.intentRegistry.get('presentation.start');
    if (!intent) {
      return null;
    }

    const mode = mentionsCurrentSlide ? 'current' : 'beginning';
    return {
      intent,
      confidence: 0.98,
      entities: {
        appName: 'powerpoint',
        presentationApp: 'powerpoint',
        windowName: 'powerpnt',
        mode,
        requestedOperation: mode === 'current'
          ? 'start-presentation-from-current-slide'
          : 'start-presentation-from-beginning',
        routeSource: 'presentation-control'
      }
    };
  }

  _extractPresentationSlideNumber(input) {
    const text = String(input || '').toLowerCase();
    const numericPatterns = [
      /\b(?:go|goto|jump|move|switch|open|show|take\s+me)\s+(?:to\s+)?(?:the\s+)?(?:slide\s+)?(?:number\s+)?(\d{1,4})(?:st|nd|rd|th)?(?:\s+slide)?\b/,
      /\bslide\s+(?:number\s+)?(\d{1,4})(?:st|nd|rd|th)?\b/,
      /\b(\d{1,4})(?:st|nd|rd|th)?\s+slide\b/
    ];

    for (const pattern of numericPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = Number(match[1]);
        return value > 0 && value <= 9999 ? value : null;
      }
    }

    const wordNumbers = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
      sixth: 6,
      seventh: 7,
      eighth: 8,
      ninth: 9,
      tenth: 10,
      eleventh: 11,
      twelfth: 12,
      thirteenth: 13,
      fourteenth: 14,
      fifteenth: 15,
      sixteenth: 16,
      seventeenth: 17,
      eighteenth: 18,
      nineteenth: 19,
      twentieth: 20
    };
    const wordMatch = text.match(/\b(?:go|goto|jump|move|switch|open|show|take\s+me)\s+(?:to\s+)?(?:the\s+)?([a-z]+)\s+slide\b/) ||
      text.match(/\b([a-z]+)\s+slide\b/);
    const value = wordNumbers[wordMatch?.[1]];
    return Number.isFinite(value) ? value : null;
  }

  _resolvePresentationFileIntent(rawText, preparedInput = {}) {
    const raw = String(rawText || '').trim().toLowerCase();
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const input = `${raw} ${corrected}`.replace(/\s+/g, ' ').trim();
    if (!input) {
      return null;
    }

    if (this._resolvePresentationControlIntent(rawText, preparedInput)) {
      return null;
    }

    const hasAction = /^(?:open|show|find|locate|search|look\s+for|pull\s+up|launch)\b/.test(input);
    if (!hasAction) {
      return null;
    }

    const hasPresentationCue =
      /\b(?:pptx?|presentation|presentations|power\s*point\s+file|powerpoint\s+file|slide\s+deck|deck|slides?)\b/.test(input) ||
      /[^\s]+\.(?:pptx?|key)\b/i.test(input);
    if (!hasPresentationCue) {
      return null;
    }

    const intent = this.intentRegistry.get('file.smartFind');
    if (!intent) {
      return null;
    }

    const openResult = /^(?:open|show|pull\s+up|launch)\b/.test(input);
    return {
      intent,
      confidence: 0.97,
      entities: {
        query: this._extractPresentationFileQuery(raw || corrected || input),
        location: this._extractSmartFileLocation(input),
        fileType: 'presentation',
        sortBy: this._extractSmartFileSort(input),
        timeFilter: this._extractSmartFileTime(input),
        openResult,
        routeSource: 'presentation-file'
      }
    };
  }

  _extractPresentationFileQuery(input) {
    return String(input || '')
      .replace(/^(?:open|show|find|locate|search|look\s+for|pull\s+up|launch)(?:\s+(?:for|up))?\s+/i, '')
      .replace(/^(?:some|any|a|an|the|my)\s+/i, '')
      .replace(/\b(?:pptx?|presentation|presentations|power\s*point|powerpoint|slide\s+deck|deck|slides?|file|files)\b/gi, ' ')
      .replace(/\b(?:latest|newest|recent|recently|modified|edited|downloaded|created|open|show)\b/gi, ' ')
      .replace(/\b(?:from|in|on)\s+(?:my\s+)?(?:desktop|downloads?|documents?|folders?|computer|pc|laptop)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _resolveSmartFileIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim().toLowerCase();
    const input = `${raw} ${corrected}`.replace(/\s+/g, ' ').trim();
    if (!input) {
      return null;
    }

    if (/[^\s]+\.[A-Za-z0-9]{1,10}\b/.test(input)) {
      return null;
    }

    const hasFileCue = /\b(?:file|files|pdf|pdfs|document|documents|resume|resumes|screenshot|screenshots|image|images|photo|photos|picture|pictures|presentation|presentations|download|downloaded|downloads|interview|interviews|project|projects|shortcut|shortcuts)\b/.test(input);
    const hasSmartCue = /\b(?:newest|latest|largest|recent|recently|edited|modified|opened|downloaded|created|today|yesterday|morning|last\s+week|6\s+months|duplicate|duplicates|contains|containing|mentioning|related\s+to|where\s+did|where\s+is|save|saved|worked\s+on)\b/.test(input);
    if (!hasFileCue || !hasSmartCue) {
      return null;
    }
    if (/\bfind\s+all\s+pdfs?\s+downloaded\b/.test(input) || /\bduplicates?\s+files?\b/.test(input)) {
      return null;
    }

    const intent = this.intentRegistry.get('file.smartFind');
    if (!intent) {
      return null;
    }

    const entities = this._buildSmartFileEntities(input);
    return entities
      ? { intent, confidence: 0.98, entities }
      : null;
  }

  _resolveFormFillIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim().toLowerCase();
    const input = `${raw} ${corrected}`.replace(/\s+/g, ' ').trim();
    if (!input) {
      return null;
    }

    const formAwareInput = input.replace(/\bfrom\b/g, 'form');
    const hasFormAction = /\b(?:fill|complete|autofill|auto\s+fill|submit|validate|check|verify)\b/.test(input);
    const hasFormTarget = /\b(?:form|forms|details|application|registration|signup|sign\s+up|google\s+form|google\s+forms)\b/.test(formAwareInput);
    if (!hasFormAction || !hasFormTarget) {
      return null;
    }

    const intent = this.intentRegistry.get('form.fill');
    if (!intent) {
      return null;
    }

    const action = /\b(?:submit|send)\b/.test(input)
      ? 'submit'
      : /\b(?:validate|check|verify)\b/.test(input)
        ? 'validate'
        : 'fill';
    const targetMatch = formAwareInput.match(/\b(?:form|forms|application|registration|signup|sign\s+up)\s+(?:for|on|in|at)\s+(.+)$/);
    const targetForm = targetMatch?.[1]
      ? targetMatch[1].replace(/\b(?:please|now)\b/g, '').trim()
      : '';
    const url = this._extractUrl(rawText || corrected);

    return {
      intent,
      confidence: 1,
      entities: {
        action,
        command: rawText,
        url,
        targetForm,
        userFacts: this.learningStore?.getAllUserFacts?.() || {}
      }
    };
  }

  _buildSmartFileEntities(input) {
    const entities = {
      query: '',
      location: this._extractSmartFileLocation(input),
      fileType: this._extractSmartFileType(input),
      sortBy: this._extractSmartFileSort(input),
      timeFilter: this._extractSmartFileTime(input),
      openResult: /\b(?:open|play|watch)\b/.test(input),
      groupDuplicates: /\bduplicates?\b/.test(input)
    };

    entities.query = this._extractSmartFileQuery(input, entities);
    if (!entities.query && /\bresumes?\b/.test(input)) {
      entities.query = 'resume';
    }
    if (!entities.query && /\binterviews?\b/.test(input)) {
      entities.query = 'interview';
    }
    if (!entities.query && /\bopenx\b/.test(input)) {
      entities.query = 'openx';
    }

    return entities;
  }

  _extractSmartFileLocation(input) {
    if (/\bdownloads?\b/.test(input)) return 'downloads';
    if (/\bdesktop\b/.test(input)) return 'desktop';
    if (/\bdocuments?\b/.test(input)) return 'documents';
    if (/\bpictures?|photos?\b/.test(input)) return 'pictures';
    if (/\bvideos?\b/.test(input)) return 'videos';
    if (/\bmusic\b/.test(input)) return 'music';
    return '';
  }

  _extractSmartFileType(input) {
    if (/\bpdfs?\b/.test(input)) return 'pdf';
    if (/\b(?:images?|photos?|pictures?|screenshots?)\b/.test(input)) return 'image';
    if (/\b(?:videos?|movies?)\b/.test(input)) return 'video';
    if (/\b(?:songs?|music|audio)\b/.test(input)) return 'audio';
    if (/\b(?:presentations?|slides?)\b/.test(input)) return 'presentation';
    if (/\b(?:zip|archive)\b/.test(input)) return 'archive';
    if (/\b(?:documents?|resume|resumes)\b/.test(input)) return 'document';
    return '';
  }

  _extractSmartFileSort(input) {
    if (/\blargest\b|\bbigger\b|\bmore\s+than\s+\d+\s*(?:mb|gb)\b/.test(input)) return 'sizeDesc';
    if (/\bcreated\b|\bdownloaded\b/.test(input)) return 'createdDesc';
    if (/\bopened\b|\baccessed\b/.test(input)) return 'accessedAsc';
    return 'modifiedDesc';
  }

  _extractSmartFileTime(input) {
    if (/\btoday\b/.test(input)) return 'today';
    if (/\byesterday\b/.test(input)) return 'yesterday';
    if (/\bthis\s+morning\b|\bmorning\b/.test(input)) return 'thisMorning';
    if (/\blast\s+week\b/.test(input)) return 'lastWeek';
    if (/\b6\s+months\b|\bsix\s+months\b/.test(input)) return 'olderThan6MonthsAccess';
    return '';
  }

  _extractSmartFileQuery(input, entities) {
    if (/\bscreenshots?\b/.test(input)) return 'screenshot';
    if (/\bresumes?\b/.test(input)) return 'resume';
    if (/\binterviews?\b/.test(input)) return 'interview';
    if (/\bproject\s+files?\b/.test(input)) return 'project';
    if (/\bapi\s+keys?\b/.test(input)) return 'api key';
    const afterFor = input.match(/\b(?:for|containing|mentioning|related\s+to)\s+([a-z0-9 ._-]+)$/i);
    if (afterFor?.[1]) {
      return afterFor[1]
        .replace(/\b(?:on|in)\s+(?:my\s+)?(?:computer|pc|downloads?|documents?|desktop|folder|folders)$/i, '')
        .trim();
    }
    if (entities.fileType || entities.timeFilter || entities.sortBy !== 'modifiedDesc' || entities.groupDuplicates) {
      return '';
    }
    return '';
  }

  _resolveExplicitFolderIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!input || !/\b(?:folder|folders|directory|directories|desktop|downloads|documents|pictures|music|videos|home)\b/.test(input)) {
      return null;
    }
    const hasFolderWord = /\b(?:folder|folders|directory|directories)\b/.test(input);
    const opensKnownFolderOnly = /^(?:open|show|launch|start|go\s+to)\s+(?:desktop|downloads?|documents?|pictures?|videos?|home)$/i.test(input);
    if (!hasFolderWord && !opensKnownFolderOnly) {
      return null;
    }

    const configs = [
      { intentId: 'folder.create', pattern: /^(?:create|new|make|add)\b/ },
      { intentId: 'folder.open', pattern: /^(?:open|show|launch|start|go\s+to)\b/ },
      { intentId: 'folder.delete', pattern: /^(?:delete|remove|erase)\b/ },
      { intentId: 'folder.search', pattern: /^(?:locate|find|search|look(?:\s+(?:inside|in|for))?)\b/ }
    ];

    for (const config of configs) {
      if (!config.pattern.test(input)) {
        continue;
      }
      if (config.intentId === 'folder.search' &&
        /\b(?:file|files|pdf|pdfs|document|documents|docx?|xlsx?|pptx?|csv|json|image|images|photo|photos|picture|pictures|video|videos|screenshot|screenshots)\b/.test(input)) {
        continue;
      }
      const intent = this.intentRegistry.get(config.intentId);
      if (!intent) {
        continue;
      }
      const rawEntities = this.entityExtractor.extract(intent, rawText);
      const correctedEntities = this.entityExtractor.extract(intent, input);
      const entities = { ...correctedEntities, ...rawEntities };
      if (config.intentId === 'folder.search') {
        entities.query = this._extractLocalFileSearchQuery(rawText, input) || entities.query || entities.folderName;
      }
      const missing = this._checkRequiredEntities(intent, entities);
      if (missing.length === 0) {
        return { intent, confidence: 1, entities };
      }
    }

    return null;
  }

  _resolveExplicitFolderMoveIntent(rawText, preparedInput) {
    const correctedText = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!correctedText) {
      return null;
    }

    if (!/\bmove\s+(?:the\s+)?(?:folder|directory)\b/.test(correctedText)) {
      return null;
    }

    const intent = this.intentRegistry.get('folder.move');
    if (!intent) {
      return null;
    }

    const entities = this.entityExtractor.extract(intent, rawText);
    if (!entities.source || !entities.destination) {
      return null;
    }

    return { intent, confidence: 1 };
  }

  _resolvePhoneTransferIntent(rawText, preparedInput, source = 'chat') {
    const input = String(preparedInput?.correctedText || rawText || '').trim();
    const raw = String(rawText || '').trim();
    if (!input) {
      return null;
    }

    const lower = input.toLowerCase();
    const sourceIsPhone = source === 'phone';
    if (sourceIsPhone &&
      EXPLICIT_APP_DOMAIN_PATTERN.test(`${raw} ${input}`) &&
      !EXPLICIT_NOT_APP_PATTERN.test(`${raw} ${input}`) &&
      /^(?:open|launch|start|run|switch|focus|activate|go\s+to)\b/i.test(lower)) {
      return null;
    }
    if (sourceIsPhone && /^(?:open|launch|start|run|play|watch)\b/i.test(lower)) {
      return null;
    }
    const phoneFetchRequest = sourceIsPhone &&
      PHONE_ORIGIN_FETCH_PATTERN.test(lower) &&
      PHONE_TRANSFER_FILE_EVIDENCE_PATTERN.test(`${raw} ${input}`);
    if (!PHONE_TRANSFER_ACTION_PATTERN.test(lower) && !phoneFetchRequest) {
      return null;
    }

    const rawPhoneTargetMatch = raw.match(PHONE_TRANSFER_TRAILING_TARGET_PATTERN);
    const inputPhoneTargetMatch = input.match(PHONE_TRANSFER_TRAILING_TARGET_PATTERN);
    const phoneTargetMatch = rawPhoneTargetMatch || inputPhoneTargetMatch;
    if (!phoneTargetMatch && !sourceIsPhone) {
      return null;
    }

    const intent = this.intentRegistry.get('phone.sendFile');
    if (!intent) {
      return null;
    }

    const sourceCandidate = rawPhoneTargetMatch
      ? raw.slice(0, rawPhoneTargetMatch.index).trim()
      : inputPhoneTargetMatch
        ? input.slice(0, inputPhoneTargetMatch.index).trim()
        : raw || input;
    const sourceText = this._cleanPhoneTransferSource(sourceCandidate);
    if (!phoneTargetMatch && !PHONE_TRANSFER_FILE_EVIDENCE_PATTERN.test(sourceText)) {
      return null;
    }
    const sourceForKind = `${sourceText} ${raw} ${input}`;

    const transferKind = /\b(?:folder|folders|directory|directories)\b/i.test(sourceForKind)
      ? 'folder'
      : /\b(?:image|images|photo|photos|picture|pictures|screenshot|screenshots|pic|pics)\b/i.test(sourceForKind)
        ? 'image'
        : 'file';

    const normalizedSource = sourceText
      .replace(/^(?:me\s+)?/i, '')
      .replace(/^(?:the|a|an|my)\s+/i, '')
      .replace(/\s+(?:file|files)$/i, '')
      .trim();

    const pathValue = normalizedSource || sourceText;
    if (!pathValue) {
      return null;
    }

    return {
      intent,
      confidence: source === 'phone' ? 1 : 0.94,
      entities: {
        path: pathValue,
        transferKind
      }
    };
  }

  _cleanPhoneTransferSource(value) {
    return String(value || '')
      .trim()
      .replace(PHONE_TRANSFER_ACTION_PATTERN, '')
      .replace(PHONE_ORIGIN_FETCH_PATTERN, '')
      .replace(/^(?:and\s+)?(?:send|share|transfer|copy|push|get|bring)?\s*/i, '')
      .replace(/^(?:me\s+|the\s+|a\s+|an\s+|my\s+)+/i, '')
      .replace(/^(?:file|document)\s+(?:called|named)\s+/i, '')
      .replace(/\s+and\s+(?:send|share|transfer|copy|push|get|bring)\s+(?:it\s+)?(?:to\s+)?(?:me|here)$/i, '')
      .replace(/\s+(?:from|in|on|at)\s+(?:my\s+)?(?:computer|pc|laptop|system|desktop)$/i, ' in desktop')
      .replace(/\s+(?:from|in|on|at)\s+(?:my\s+)?(?:downloads?)$/i, ' in downloads')
      .replace(/\s+(?:from|in|on|at)\s+(?:my\s+)?(?:documents?)$/i, ' in documents')
      .replace(/\s+(?:from|in|on|at)\s+(?:my\s+)?(?:pictures?|photos?)$/i, ' in pictures')
      .replace(/\s+(?:from|in|on|at)\s+(?:my\s+)?(?:videos?)$/i, ' in videos')
      .replace(/\s+(?:file|document)\s+(in\s+(?:desktop|downloads|documents|pictures|videos))$/i, ' $1')
      .replace(/\s+(?:here|to\s+me|for\s+me|on\s+this\s+(?:phone|device)|to\s+this\s+(?:phone|device))$/i, '')
      .replace(/\b(?:over|across)\s*$/i, '')
      .replace(/\s+(?:file|document)\s*$/i, '')
      .replace(/\s+(pdf|txt|docx?|xlsx?|pptx?|csv|json|xml|html?|js|ts|py|java|md|png|jpe?g|gif|webp|mp[34]|mkv|wav|zip|rar|apk)$/i, '.$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _resolveExplicitFileIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const rawLower = String(rawText || '').trim().toLowerCase();
    if (!input) {
      return null;
    }

    if (/\b(?:folder|directory)\b/.test(input)) {
      return null;
    }

    if (/^(?:open|show|launch|start|run)\s+(?:downloads|documents|desktop|pictures|music|videos|home)$/i.test(input)) {
      return null;
    }

    if (/^(?:search|search\s+for|look\s+up|google)\b/i.test(input) && this._looksLikeWebSearchQuery(input)) {
      return null;
    }

    if (/^(?:close|exit|dismiss)\b/.test(input) &&
      /\b(?:file|document|pdf|docx?|xlsx?|pptx?|txt|csv|json|js|ts|html|css|java|py|md|png|jpe?g|gif|mp4|mp3)\b|[^\s]+\.[A-Za-z0-9]{1,10}\b/i.test(`${input} ${rawText || ''}`)) {
      const windowIntent = this.intentRegistry.get('window.close');
      if (windowIntent) {
        const target = this._cleanWindowTarget(String(rawText || input)
          .replace(/^(?:close|exit|dismiss)\s+/i, '')
          .replace(/^(?:the|a|an|my)\s+/i, '')
          .replace(/^(?:file|document)\s+/i, '')
          .replace(/\s+(?:file|document)\s*$/i, '')
          .replace(/\s+(pdf|txt|docx?|xlsx?|pptx?|csv|json|xml|html?|js|ts|py|java|md|png|jpe?g|gif|webp|mp[34]|mkv|wav|zip|rar)$/i, '.$1'));
        return {
          intent: windowIntent,
          confidence: 0.98,
          entities: target ? { windowName: target } : {}
        };
      }
    }

    const configs = [
      { intentId: 'file.open', pattern: /^(?:open|show|play|watch)\b/ },
      { intentId: 'file.create', pattern: /^(?:create|new|make)\b/ },
      { intentId: 'file.delete', pattern: /^(?:delete|remove|erase)\b/ },
      { intentId: 'file.copy', pattern: /^copy\b/ },
      { intentId: 'file.move', pattern: /^(?:move|bring)\b/ },
      { intentId: 'file.search', pattern: /^(?:locate|find|search)\b/ }
    ];

    const canBeImplicitLocate = /^(?:locate)\b/.test(input) && this._extractLocalFileSearchQuery(rawText || input, input);
    if (!canBeImplicitLocate && !/\b(?:file|location|path)\b|[^\s]+\.[A-Za-z0-9]{1,10}\b/i.test(`${input} ${rawText || ''}`)) {
      return null;
    }

    for (const config of configs) {
      if (!config.pattern.test(input) && !config.pattern.test(rawLower)) {
        continue;
      }
      const intent = this.intentRegistry.get(config.intentId);
      if (!intent) {
        continue;
      }
      const rawEntities = this.entityExtractor.extract(intent, rawText);
      const correctedEntities = this.entityExtractor.extract(intent, input);
      const entities = { ...correctedEntities, ...rawEntities };
      if (correctedEntities.destination && correctedEntities.destination !== rawEntities.destination) {
        entities.destination = correctedEntities.destination;
      }
      if (correctedEntities.path && correctedEntities.path !== rawEntities.path) {
        entities.path = correctedEntities.path;
      }
      if (config.intentId === 'file.search') {
        entities.query = this._extractLocalFileSearchQuery(rawText, input) || entities.query;
      }
      const missing = this._checkRequiredEntities(intent, entities);
      if (missing.length === 0) {
        return { intent, confidence: 1, entities };
      }
    }

    return null;
  }

  _resolveExplicitModeIntent(rawText, preparedInput) {
    const correctedText = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!correctedText) {
      return null;
    }

    if (!/\b(?:start|open|launch|run|activate)\b/.test(correctedText) || !/\bmode\b/.test(correctedText)) {
      return null;
    }

    const intent = this.intentRegistry.get('mode.start');
    if (!intent) {
      return null;
    }

    const entities = this.entityExtractor.extract(intent, rawText);
    const correctedEntities = this.entityExtractor.extract(intent, correctedText);
    const modeName = entities.modeName || correctedEntities.modeName;
    if (!modeName) {
      return null;
    }

    return { intent, confidence: 1, entities: { modeName } };
  }

  _resolveExplicitAppDomainIntent(rawText, preparedInput = {}) {
    const raw = String(rawText || '').trim();
    const corrected = String(preparedInput?.correctedText || raw || '').trim();
    const lower = corrected.toLowerCase();
    if (!lower || /^(?:what|who|when|where|why|how|which)\b/.test(lower)) {
      return null;
    }

    if (!EXPLICIT_APP_DOMAIN_PATTERN.test(`${raw} ${corrected}`) || EXPLICIT_NOT_APP_PATTERN.test(lower)) {
      return null;
    }

    if (/\b(?:application\s+(?:form|file|document)|form\s+application)\b/i.test(`${raw} ${corrected}`)) {
      return null;
    }

    const actionMatch = lower.match(/^(?:please\s+|kindly\s+)?(?:can\s+you\s+|could\s+you\s+|would\s+you\s+)?(open|launch|start|run|close|quit|exit|terminate|switch|focus|activate|go\s+to)\b/i);
    if (!actionMatch) {
      return null;
    }

    const action = actionMatch[1].replace(/\s+/g, ' ');
    const intentId = ['close', 'quit', 'exit', 'terminate'].includes(action)
      ? 'app.close'
      : ['switch', 'focus', 'activate', 'go to'].includes(action)
        ? 'app.switch'
        : 'app.open';
    const intent = this.intentRegistry.get(intentId);
    if (!intent) {
      return null;
    }

    const appName = this._extractExplicitAppDomainTarget(raw || corrected, corrected);
    if (!appName) {
      return null;
    }

    const forceNewWindow = intentId === 'app.open' && this._hasExplicitNewKeyword(raw, lower);
    const entities = {
      appName,
      routeSource: 'explicit-app-domain',
      ...(intentId === 'app.open'
        ? {
            requestedOperation: forceNewWindow ? 'open-new-window' : 'open-or-focus',
            ...(forceNewWindow ? { forceNewWindow: true } : {})
          }
        : {})
    };
    return {
      intent,
      confidence: 1,
      entities: intentId === 'app.open'
        ? this._buildAppOpenFallbackEntities(appName, entities, { allowSearchFallback: true })
        : entities
    };
  }

  _extractExplicitAppDomainTarget(rawText, correctedText) {
    const source = String(rawText || correctedText || '').trim();
    const corrected = String(correctedText || source || '').trim();
    const candidates = [source, corrected].filter(Boolean);

    for (const value of candidates) {
      const patterns = [
        /^(?:please\s+|kindly\s+)?(?:can\s+you\s+|could\s+you\s+|would\s+you\s+)?(?:open|launch|start|run|close|quit|exit|terminate|switch|focus|activate|go\s+to)\s+(?:the\s+)?(?:app|apps|application|applications|program|programs|software)\s+(?:called|named|name\s+is\s+)?(.+)$/i,
        /^(?:please\s+|kindly\s+)?(?:can\s+you\s+|could\s+you\s+|would\s+you\s+)?(?:open|launch|start|run|close|quit|exit|terminate|switch|focus|activate|go\s+to)\s+(.+?)\s+(?:as\s+|like\s+)?(?:an?\s+|the\s+)?(?:app|application|program|software)(?:\s+not\s+(?:a\s+|an\s+|the\s+)?(?:file|folder|document|pdf|docx?))?$/i,
        /^(?:please\s+|kindly\s+)?(?:can\s+you\s+|could\s+you\s+|would\s+you\s+)?(?:open|launch|start|run|close|quit|exit|terminate|switch|focus|activate|go\s+to)\s+(.+?)\s+(?:it\s+is|it's|this\s+is|that\s+is)\s+(?:an?\s+|the\s+)?(?:app|application|program|software)(?:\s+not\s+(?:a\s+|an\s+|the\s+)?(?:file|folder|document|pdf|docx?))?$/i,
        /^(?:please\s+|kindly\s+)?(?:can\s+you\s+|could\s+you\s+|would\s+you\s+)?(?:open|launch|start|run|close|quit|exit|terminate|switch|focus|activate|go\s+to)\s+(.+?)\s+not\s+(?:a\s+|an\s+|the\s+)?(?:file|folder|document|pdf|docx?)$/i
      ];

      for (const pattern of patterns) {
        const match = value.match(pattern);
        if (!match?.[1]) {
          continue;
        }
        const clean = this._cleanExplicitAppDomainTarget(match[1]);
        if (clean) {
          return clean;
        }
      }
    }

    const intent = this.intentRegistry.get('app.open');
    if (!intent) {
      return '';
    }
    const extracted = this.entityExtractor.extract(intent, source);
    return this._cleanExplicitAppDomainTarget(extracted.appName || '');
  }

  _cleanExplicitAppDomainTarget(value) {
    return String(value || '')
      .replace(/\b(?:please|kindly|now|only)\b/gi, ' ')
      .replace(/\b(?:it\s+is|it's|this\s+is|that\s+is)\b/gi, ' ')
      .replace(/\b(?:as|like)\s+(?:an?\s+|the\s+)?(?:app|application|program|software)\b/gi, ' ')
      .replace(/\b(?:app|apps|application|applications|program|programs|software)\b/gi, ' ')
      .replace(/\bnot\s+(?:a\s+|an\s+|the\s+)?(?:file|folder|document|pdf|docx?)\b/gi, ' ')
      .replace(/\b(?:called|named|name\s+is)\b/gi, ' ')
      .replace(/[.,;:]+$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _resolveLiveKnowledgeIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim();
    const raw = String(rawText || corrected || '').trim();
    const input = corrected.toLowerCase();
    if (!input) {
      return null;
    }

    if (/^(?:open|close|launch|start|run|switch|focus|activate|set|turn|play|pause|resume|stop|create|delete|move|copy|rename|remind|search|google|look\s+up)\b/.test(input)) {
      return null;
    }

    const hasLiveCue = /\b(?:score|scores|live|today|latest|current|standings?|table|fixture|fixtures|schedule|news)\b/.test(input);
    const hasPublicTopic = /\b(?:ipl|cricket|fifa|world\s+cup|football|soccer|match|matches|team|teams|japan|react|node|javascript|ai)\b/.test(input);
    if (!hasLiveCue || !hasPublicTopic) {
      return null;
    }

    const intent = this.intentRegistry.get('browser.search');
    return intent
      ? { intent, confidence: 1, entities: { query: raw.toLowerCase(), openInBrowser: false } }
      : null;
  }

  _resolveExplicitAppIntent(rawText, preparedInput) {
    const correctedText = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!correctedText) {
      return null;
    }

    if (/\btimers?\b|\balarm\b|\bremind\b|\bset\s+(?:a\s+)?timer\b|\bset\s+(?:a\s+)?alarm\b/.test(correctedText)) {
      return null;
    }

    const appIntentConfigs = [
      {
        intentId: 'app.close',
        verbs: ['close', 'quit', 'exit', 'terminate', 'stop']
      },
      {
        intentId: 'app.switch',
        verbs: ['switch', 'focus', 'goto', 'go', 'activate']
      }
    ];

    for (const config of appIntentConfigs) {
      if (!this._containsActionVerb(correctedText, config.verbs)) {
        continue;
      }

      const intent = this.intentRegistry.get(config.intentId);
      if (!intent) {
        continue;
      }

      const extractedFromRaw = this.entityExtractor.extract(intent, rawText);
      const extractedFromCorrected = this.entityExtractor.extract(intent, correctedText);
      const explicitSwitchMatch = String(rawText || correctedText).match(/^(?:switch\s+to|go\s+to|focus\s+(?:on)?|activate)\s+(.+)$/i);
      const appName = extractedFromRaw.appName || extractedFromCorrected.appName ||
        (config.intentId === 'app.switch' && explicitSwitchMatch?.[1]
          ? explicitSwitchMatch[1].trim()
          : null);

      if (!appName) {
        continue;
      }

      const frame = preparedInput?.commandFrame || this.commandFrameParser.parse(rawText, preparedInput);
      if (config.intentId === 'app.close' && frame?.domain === 'media' && !frame.appRouteAllowed) {
        continue;
      }

      return { intent, confidence: 0.99, entities: { appName } };
    }

    return null;
  }

  _resolveAppLanguageIntent(rawText, preparedInput) {
    const frame = preparedInput?.appLanguage || this.appCommandLanguage.parse(
      rawText,
      preparedInput?.correctedText
    );
    if (!frame || frame.validation?.status !== 'passed') {
      return null;
    }
    if (frame.action === 'new-tab') {
      const intent = this.intentRegistry.get('app.newTab');
      return intent ? {
        intent,
        confidence: frame.confidence,
        entities: {
          appName: frame.targetText,
          requestedOperation: 'open-new-tab',
          routeSource: 'app-language-v1'
        },
        semanticFrame: {
          ...frame,
          domain: 'app',
          intentId: 'app.newTab'
        }
      } : null;
    }

    if (frame.action !== 'open' || !frame.forceNewWindow) {
      return null;
    }

    if (
      this._resolveExplicitModeIntent(rawText, preparedInput) ||
      this._resolveBrowserFollowupIntent(rawText, preparedInput) ||
      this._resolveKnownWebOpenIntent(rawText, preparedInput) ||
      this._resolveSiteSearchIntent(rawText, preparedInput) ||
      this._resolvePersonalPhotoIntent(rawText, preparedInput)
    ) {
      return null;
    }

    const intentId = frame.action === 'open'
      ? 'app.open'
      : frame.action === 'close'
        ? 'app.close'
        : frame.action === 'focus'
          ? 'app.switch'
          : null;
    const intent = intentId ? this.intentRegistry.get(intentId) : null;
    if (!intent) return null;

    const explicitAppCue = /\b(?:app|application|program)\b/i.test(String(rawText || ''));
    const normalizedTarget = String(frame.targetText || '').toLowerCase();
    if (frame.action === 'open' && WEBSITE_URL_MAP[normalizedTarget] && !explicitAppCue) {
      return null;
    }

    const syntheticCommand = `${frame.action === 'focus' ? 'focus' : frame.action} ${frame.targetText}`;
    const extracted = this.entityExtractor.extract(intent, syntheticCommand);
    let appName = /^(?:visual studio code|vs code|vscode)$/i.test(frame.targetText)
      ? frame.targetText
      : (extracted.appName || frame.targetText);
    if (!appName) return null;

    if (frame.action === 'open') {
      const compoundTarget = this._detectCompoundAppTarget(rawText, preparedInput?.correctedText, appName);
      if (compoundTarget) appName = compoundTarget;
    }

    const entities = {
      appName,
      requestedOperation: frame.requestedOperation,
      routeSource: 'app-language-v1',
      ...(frame.forceNewWindow ? { forceNewWindow: true } : {})
    };

    return {
      intent,
      confidence: frame.confidence,
      entities: intentId === 'app.open'
        ? this._buildAppOpenFallbackEntities(appName, entities)
        : entities,
      semanticFrame: {
        ...frame,
        domain: 'app',
        intentId
      }
    };
  }

  _resolveLearningRepairIntent(rawCommandText, preparedInput) {
    const directive = preparedInput?.learningDirective;
    if (directive?.kind !== 'repair-learning') return null;
    const intent = this.intentRegistry.get('assistant.learningRepair');
    if (!intent) return null;
    return {
      intent,
      confidence: 1,
      entities: {
        repairKind: directive.kind,
        ...(directive.correction ? { correction: directive.correction } : {})
      }
    };
  }

  _resolveExplicitOpenIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim();
    if (!input) return null;

    const lower = input.toLowerCase();

    if (/\btimers?\b|\balarm\b|\bremind\b|\bset\s+(?:a\s+)?timer\b|\bset\s+(?:a\s+)?alarm\b/.test(lower)) {
      return null;
    }

    const isOpenRequest = /^(open|launch|start|run|show|navigate to|go to)\b/i.test(lower);
    if (!isOpenRequest) {
      return null;
    }

    const browserIntent = this.intentRegistry.get('browser.open');
    if (browserIntent && /^(?:open|launch|start|show)\s+(?:my\s+)?browser\b/i.test(lower)) {
      return { intent: browserIntent, confidence: 1, entities: { url: 'about:blank' } };
    }

    if (browserIntent && this._looksLikeUrlRequest(rawText)) {
      return { intent: browserIntent, confidence: 1 };
    }

    const explicitWebCue = this._hasExplicitWebCue(lower);
    const websiteMatch = lower.match(/^(?:open|launch|start|go\s+to)\s+(?:the\s+)?(?:website\s+of\s+)?(.+)$/i);
    if (websiteMatch && websiteMatch[1]) {
      const targetWebsite = websiteMatch[1].trim().toLowerCase();
      const trustedWebsite = resolveTrustedWebTarget(targetWebsite);
      const websiteUrl = trustedWebsite?.url || WEBSITE_URL_MAP[targetWebsite];
      if (websiteUrl && explicitWebCue) {
        return { intent: browserIntent, confidence: 1, entities: { url: websiteUrl } };
      }
    }

    const targetAfterOpen = lower.replace(/^(?:open|launch|start|run|show|navigate to|go to)\s+/i, '').trim();
    const trustedTargetAfterOpen = targetAfterOpen ? resolveTrustedWebTarget(targetAfterOpen) : null;
    const urlAfterOpen = trustedTargetAfterOpen?.url || WEBSITE_URL_MAP[targetAfterOpen];
    if (targetAfterOpen && urlAfterOpen && explicitWebCue) {
      return { intent: browserIntent, confidence: 1, entities: { url: urlAfterOpen } };
    }
    if (targetAfterOpen && urlAfterOpen && !explicitWebCue) {
      const appIntent = this.intentRegistry.get('app.open');
      return appIntent
        ? {
            intent: appIntent,
            confidence: 1,
            entities: {
              appName: trustedTargetAfterOpen?.key || targetAfterOpen,
              webFallbackUrl: urlAfterOpen,
              webFallbackBrowser: 'chrome',
              ...(trustedTargetAfterOpen?.title ? { webFallbackTitle: trustedTargetAfterOpen.title } : {}),
              routeSource: 'app-local-first-url-map',
              requestedOperation: 'open-or-focus'
            }
          }
        : null;
    }

    const fileIntent = this.intentRegistry.get('file.open');
    if (fileIntent) {
      const fileEntities = this.entityExtractor.extract(fileIntent, rawText);
      if (fileEntities.filename && this._looksLikeFileReference(fileEntities.filename, rawText)) {
        return { intent: fileIntent, confidence: 1, entities: fileEntities };
      }
    }

    const browserSearchIntent = this.intentRegistry.get('browser.search');
    const browserSearchEntities = this._extractOpenInBrowserSearch(rawText, preparedInput);
    if (browserSearchIntent && browserSearchEntities) {
      return { intent: browserSearchIntent, confidence: 1, entities: browserSearchEntities };
    }

    const folderIntent = this.intentRegistry.get('folder.open');
    if (folderIntent && this._looksLikeFolderOpenRequest(rawText)) {
      const rawFolderEntities = this.entityExtractor.extract(folderIntent, rawText);
      const correctedFolderEntities = this.entityExtractor.extract(folderIntent, input);
      const folderEntities = { ...correctedFolderEntities, ...rawFolderEntities };
      if (correctedFolderEntities.folderName && correctedFolderEntities.folderName !== rawFolderEntities.folderName) {
        folderEntities.folderName = correctedFolderEntities.folderName;
      }
      if (folderEntities.folderName) {
        return { intent: folderIntent, confidence: 0.98, entities: folderEntities };
      }
    }

    return null;
  }

  _resolveFolderOpenInAppIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim();
    if (!input) {
      return null;
    }

    const match = input.match(/^(?:open|show|launch|start|navigate\s+to|go\s+to)\s+(.+?)\s+(?:folder|directory)\s+(?:in|with|using|on)\s+(.+)$/i) ||
      input.match(/^(?:open|show|launch|start|navigate\s+to|go\s+to)\s+(?:folder|directory)\s+(.+?)\s+(?:in|with|using|on)\s+(.+)$/i);
    if (!match?.[1] || !match?.[2]) {
      return null;
    }

    const openWith = this._normalizeFolderOpenApp(match[2]);
    if (!openWith) {
      return null;
    }

    const folderIntent = this.intentRegistry.get('folder.open');
    if (!folderIntent) {
      return null;
    }

    const folderName = String(match[1] || '')
      .replace(/^(?:the|a|an)\s+/i, '')
      .trim();
    return folderName
      ? { intent: folderIntent, confidence: 1, entities: { folderName, openWith } }
      : null;
  }

  _normalizeFolderOpenApp(value) {
    const target = String(value || '')
      .toLowerCase()
      .replace(/^(?:the|a|an)\s+/, '')
      .replace(/\b(?:app|application|editor|ide)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^(?:vs\s*code|vscode|visual\s+studio\s+code|code)$/.test(target)) {
      return 'code';
    }
    return '';
  }

  _resolveKnownWebOpenIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const match = input.match(/^(?:open|launch|start|go\s+to|pull\s+up|show\s+me|show)\s+(.+?)(?:\s+(?:website|site))?(?:\s+(?:in|on)\s+(?:chrome|browser|edge|firefox))?$/i);
    if (!match?.[1]) {
      return null;
    }

    const matchedTarget = String(match[1] || '').trim();
    const framedTarget = String(preparedInput?.semanticFrame?.targetText || '').trim();
    const requestedTarget = framedTarget || matchedTarget;
    if (this._looksLikeLocalPhotosTarget(requestedTarget, rawText)) {
      const appIntent = this.intentRegistry.get('app.open');
      return appIntent
        ? { intent: appIntent, confidence: 1, entities: { appName: 'photos' } }
        : null;
    }
    if (this._looksLikeOpenXGalleryTarget(requestedTarget, rawText)) {
      const visualIntent = this.intentRegistry.get('visualMemory.openGallery');
      return visualIntent
        ? { intent: visualIntent, confidence: 1, entities: { view: 'timeline' } }
        : null;
    }

    const query = preparedInput?.semanticFrame?.webTarget ||
      this._normalizeKnownWebTarget(framedTarget) ||
      this._normalizeKnownWebTarget(matchedTarget);
    if (!query) {
      return null;
    }

    const explicitWebCue = this._hasExplicitWebCue(input);
    if (explicitWebCue) {
      const intent = this.intentRegistry.get('browser.openFirstResult');
      return intent
        ? { intent, confidence: 1, entities: { query } }
        : null;
    }

    const target = resolveTrustedWebTarget(query);
    if (!target) {
      return null;
    }

    const intent = this.intentRegistry.get('app.open');
    return intent
      ? {
          intent,
          confidence: 1,
          entities: {
            appName: target.key,
            webFallbackUrl: target.url,
            webFallbackBrowser: 'chrome',
            webFallbackTitle: target.title,
            routeSource: 'app-local-first-web-fallback',
            requestedOperation: 'open-or-focus'
          }
        }
      : null;
  }

  _normalizeKnownWebTarget(value) {
    return normalizeWebTarget(value);
  }

  _looksLikeKnownWebOpenRequest(rawText) {
    const source = String(rawText || '').trim();
    const match = source.match(/^(?:open|launch|start|go\s+to|pull\s+up|show\s+me|show)\s+(.+?)(?:\s+(?:website|site))?(?:\s+(?:in|on)\s+(?:chrome|browser|edge|firefox))?$/i);
    if (!match?.[1]) {
      return false;
    }

    const target = match[1]
      .replace(/^(?:the|a|an)\s+/i, '')
      .trim();
    if (!target || this._looksLikeLocalPhotosTarget(target, source)) {
      return false;
    }

    return Boolean(this._normalizeKnownWebTarget(target));
  }

  _buildAppOpenFallbackEntities(appName, entities = {}, options = {}) {
    const cleanAppName = String(appName || '').trim();
    if (!cleanAppName) {
      return entities;
    }

    const trusted = resolveTrustedWebTarget(cleanAppName);
    if (trusted) {
      return {
        ...entities,
        appName: trusted.key,
        webFallbackUrl: trusted.url,
        webFallbackBrowser: entities.webFallbackBrowser || 'chrome',
        webFallbackTitle: trusted.title,
        routeSource: entities.routeSource || 'app-local-first-web-fallback'
      };
    }

    if (options.allowSearchFallback === true && this._isSafeAppWebSearchFallback(cleanAppName)) {
      return {
        ...entities,
        appName: cleanAppName,
        allowWebSearchFallback: true,
        webSearchFallbackQuery: cleanAppName,
        webFallbackBrowser: entities.webFallbackBrowser || 'chrome',
        routeSource: entities.routeSource || 'app-local-first-search-fallback'
      };
    }

    return {
      ...entities,
      appName: cleanAppName
    };
  }

  _isSafeAppWebSearchFallback(appName) {
    const normalized = Normalizer.normalizeText(appName);
    if (!normalized || normalized.length < 2) {
      return false;
    }
    if (/^(?:file|folder|directory|document|downloads?|desktop|pictures?|photos?|videos?|music|system|settings|control panel)$/.test(normalized)) {
      return false;
    }
    if (/^(?:ms-settings|shell|chrome|edge|about|file):/i.test(String(appName || '').trim())) {
      return false;
    }
    if (/\.[a-z0-9]{1,10}$/i.test(normalized)) {
      return false;
    }
    return true;
  }

  _hasExplicitWebCue(input) {
    return /\b(?:website|web\s+app|site|in\s+(?:chrome|browser|edge|firefox)|on\s+(?:chrome|browser|edge|firefox)|go\s+to|pull\s+up)\b/i
      .test(String(input || ''));
  }

  _looksLikeOpenXGalleryTarget(target, rawText) {
    const normalizedTarget = this._normalizePhotoSurfaceText(target);
    const normalizedRaw = this._normalizePhotoSurfaceText(rawText);
    if (this._looksLikeNonOpenXPhotoSurface(`${normalizedTarget} ${normalizedRaw}`)) {
      return false;
    }
    return /\b(?:openx\s+)?(?:gallery|galary|gallary|galleary|photos?|pictures?|photo\s+library|memories)\b/.test(normalizedTarget);
  }

  _looksLikeLocalPhotosTarget(target, rawText) {
    const normalizedTarget = this._normalizePhotoSurfaceText(target);
    const normalizedRaw = this._normalizePhotoSurfaceText(rawText);
    if (/\bgoogle\b/.test(normalizedTarget)) {
      return false;
    }
    if (!/\b(?:photos?|pictures?)\b/.test(normalizedTarget)) {
      return false;
    }
    return /\b(?:microsoft|windows)\s+photos?\b|\bphotos?\s+app\b|\b(?:on|in)\s+(?:my\s+)?(?:laptop|pc|computer|system|device|windows)\b|\b(?:local|offline|this\s+(?:laptop|pc|computer|system|device))\b/.test(normalizedRaw);
  }

  _normalizePhotoSurfaceText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\bphotesw?\b/g, 'photos')
      .replace(/\bphots\b/g, 'photos')
      .replace(/\bpics?\b/g, 'photos')
      .replace(/\bpictures?\b/g, 'photos')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _looksLikeNonOpenXPhotoSurface(input) {
    const normalized = this._normalizePhotoSurfaceText(input);
    return this._looksLikeExplicitLocalFilePhotoRequest(normalized) ||
      /\bgoogle\s+photos?\b/.test(normalized) ||
      /\b(?:microsoft|windows)\s+photos?\b/.test(normalized) ||
      /\bphotos?\s+(?:app|website|site|web\s+app)\b/.test(normalized) ||
      /\bphotos?\s+(?:on|in)\s+(?:my\s+)?(?:laptop|pc|computer|system|device|windows)\b/.test(normalized);
  }

  _looksLikeExplicitLocalFilePhotoRequest(input) {
    return /\b(?:duplicate|duplicates|duplicated)\s+(?:photos?|images?|pictures?|files?)\b/i.test(input) ||
      /\b(?:file|files|folder|folders|directory|directories|path|location|where\s+is|where\s+are|downloads?|desktop|documents?|pictures?\s+folder|photos?\s+folder|on\s+(?:my\s+)?(?:pc|computer|laptop|system))\b/i.test(input) ||
      /[^\s]+\.(?:png|jpe?g|webp|gif|bmp|pdf|docx?|xlsx?|pptx?|txt|zip|rar)\b/i.test(input);
  }

  _resolveExplicitCommunicationIntent(rawText, preparedInput) {
    const stripLeadIn = value => String(value || '').trim()
      .replace(/^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening))[\s,]+(?:(?:jaanu|jarvis|openx|assistant|sir|bro|boss)[\s,]+)?/i, '');
    const input = stripLeadIn(preparedInput?.correctedText || rawText);
    if (!input) return null;

    const lower = input.toLowerCase();
    if (/^(?:tell|ask)\s+me\s+(?:if|whether)\b/.test(lower)) {
      return null;
    }

    const emailIntent = this.intentRegistry.get('email.compose');
    if (emailIntent && /^(?:send\s+)?(?:email|mail)\b/i.test(lower)) {
      const entities = this._extractEmailComposeEntities(rawText);
      if (entities.contactName) {
        return { intent: emailIntent, confidence: 1, entities };
      }
    }

    const messageIntent = this.intentRegistry.get('message.send');
    if (messageIntent) {
      const entities = this.entityExtractor.extract(messageIntent, stripLeadIn(rawText));
      if (entities.contactName && entities.messageText) {
        return { intent: messageIntent, confidence: 1, entities };
      }
      if (/^(?:say|send|message|text|ask|tell|msg|massage|telegram|signal|discord|messenger|instagram)\b/i.test(lower) &&
        (entities.contactName || entities.messageText || entities.platform)) {
        return { intent: messageIntent, confidence: 0.98, entities };
      }
    }

    const callIntent = this.intentRegistry.get('call.start');
    if (callIntent && /^(?:call|dial|phone|ring)\b/i.test(lower)) {
      const entities = this.entityExtractor.extract(callIntent, stripLeadIn(rawText));
      if (entities.contactName) {
        return { intent: callIntent, confidence: 1, entities };
      }
    }

    return null;
  }

  _resolveExplicitAppOpenIntent(rawText, preparedInput) {
    const raw = String(rawText || '').trim();
    const correctedText = String(preparedInput?.correctedText || raw || '').trim().toLowerCase();
    if (!correctedText || !this._containsActionVerb(correctedText, ['open', 'launch', 'start', 'run'])) {
      return null;
    }

    if (/^(?:what|who|when|where|why|how|which)\b/.test(correctedText)) {
      return null;
    }

    if (this._looksLikeUrlRequest(rawText)) {
      return null;
    }

    const fileIntent = this.intentRegistry.get('file.open');
    if (fileIntent) {
      const fileEntities = this.entityExtractor.extract(fileIntent, rawText);
      if (fileEntities.filename && this._looksLikeFileReference(fileEntities.filename, rawText)) {
        return null;
      }
    }

    const folderIntent = this.intentRegistry.get('folder.open');
    if (folderIntent && this._looksLikeFolderOpenRequest(rawText)) {
      const folderEntities = this.entityExtractor.extract(folderIntent, rawText);
      if (folderEntities.folderName) {
        return null;
      }
    }

    const intent = this.intentRegistry.get('app.open');
    if (!intent) {
      return null;
    }

    const extractedFromRaw = this.entityExtractor.extract(intent, rawText);
    const extractedFromCorrected = this.entityExtractor.extract(intent, correctedText);
    const appName = extractedFromRaw.appName || extractedFromCorrected.appName;

    if (!appName) {
      return null;
    }

    const forceNewWindow = this._hasExplicitNewKeyword(raw, correctedText);
    const compoundTarget = this._detectCompoundAppTarget(raw, correctedText, appName);
    if (compoundTarget) {
      const entities = this._buildAppOpenFallbackEntities(compoundTarget, {
        appName: compoundTarget,
        requestedOperation: forceNewWindow ? 'open-new-window' : 'open-or-focus',
        ...(forceNewWindow ? { forceNewWindow: true } : {})
      });
      return {
        intent,
        confidence: 0.99,
        entities
      };
    }

    const entities = this._buildAppOpenFallbackEntities(appName, {
      appName,
      requestedOperation: forceNewWindow ? 'open-new-window' : 'open-or-focus',
      ...(forceNewWindow ? { forceNewWindow: true } : {})
    });
    return {
      intent,
      confidence: 0.99,
      entities
    };
  }

  _detectCompoundAppTarget(rawText, correctedText, baseAppName) {
    const raw = String(rawText || '').trim().toLowerCase();
    const corrected = String(correctedText || '').trim().toLowerCase();
    const normalizedApp = String(baseAppName || '').toLowerCase();

    const compoundSuffixes = {
      'settings': ['settings', 'setting'],
      'preferences': ['preferences', 'preference', 'prefs', 'pref'],
      'options': ['options', 'option'],
      'config': ['config', 'configuration']
    };

    const browserCompounds = {
      'chrome': 'chrome://settings',
      'edge': 'edge://settings',
      'firefox': 'about:preferences'
    };

    for (const [app, url] of Object.entries(browserCompounds)) {
      if (normalizedApp.includes(app)) {
        for (const variations of Object.values(compoundSuffixes)) {
          for (const variation of variations) {
            const pattern = new RegExp(`\\b${app}\\s+${variation}\\b`, 'i');
            if (pattern.test(raw) || pattern.test(corrected)) {
              return url;
            }
          }
        }
      }
    }

    const appSettingsPattern = new RegExp(`\\b(${Object.keys(compoundSuffixes).join('|')})\\b`, 'i');
    const cleanedRaw = raw.replace(/\b(open|launch|start|run|new)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanedCorrected = corrected.replace(/\b(open|launch|start|run|new)\b/g, ' ').replace(/\s+/g, ' ').trim();

    if (appSettingsPattern.test(cleanedRaw) || appSettingsPattern.test(cleanedCorrected)) {
      const parts = cleanedRaw.split(/\s+/).filter(p => !['a', 'an', 'the'].includes(p));
      const correctedParts = cleanedCorrected.split(/\s+/).filter(p => !['a', 'an', 'the'].includes(p));
      const allParts = [...new Set([...parts, ...correctedParts])];

      if (allParts.length >= 2 && allParts.includes(normalizedApp)) {
        const otherWords = allParts.filter(p => p !== normalizedApp);
        for (const word of otherWords) {
          for (const [, variations] of Object.entries(compoundSuffixes)) {
            if (variations.includes(word)) {
              return `${normalizedApp} ${word}`;
            }
          }
        }
      }
    }

    return null;
  }

  _hasExplicitNewKeyword(rawText, correctedText) {
    const raw = String(rawText || '').trim();
    const corrected = String(correctedText || '').trim().toLowerCase();

    const newPatterns = [
      /\bopen\s+(?:a\s+)?new\s+/i,
      /\blaunch\s+(?:a\s+)?new\s+/i,
      /\bstart\s+(?:a\s+)?new\s+/i,
      /\brun\s+(?:a\s+)?new\s+/i,
      /\bopen\s+another\s+/i,
      /\blaunch\s+another\s+/i,
      /\bstart\s+another\s+/i,
      /\brun\s+another\s+/i
    ];

    for (const pattern of newPatterns) {
      if (pattern.test(raw) || pattern.test(corrected)) {
        return true;
      }
    }

    return false;
  }

  _looksLikeUrlRequest(input) {
    const text = String(input || '').toLowerCase();
    return (
      /\b(?:website|url|browser)\b/.test(text) ||
      /(https?:\/\/|www\.)/i.test(text) ||
      /\b[a-z0-9-]+\.(?:com|org|net|io|ai|app|dev|edu|gov|co|in|me|info)(?:\/\S*)?\b/i.test(text)
    );
  }

  _looksLikeFileReference(filename, rawText) {
    const fileName = String(filename || '').trim();
    const text = String(rawText || fileName || '').toLowerCase();
    return /\.[A-Za-z0-9]{1,10}$/.test(fileName) ||
      /\b(?:file|document|pdf|docx?|xlsx?|pptx?|txt|csv|json|js|ts|html|css|java|py|md|png|jpe?g|gif|mp4|mp3)\b/i.test(text);
  }

  _extractOpenInBrowserSearch(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim();
    const match = input.match(/^open\s+(.+?)\s+(?:in|on)\s+(chrome|browser|edge|firefox)$/i);
    if (!match || !match[1]) {
      return null;
    }

    const query = match[1]
      .replace(/^(?:the|a|an)\s+/i, '')
      .trim();
    if (!query || this._looksLikeFileReference(query, rawText)) {
      return null;
    }

    return {
      query,
      openInBrowser: true,
      browserName: match[2].toLowerCase()
    };
  }

  _looksLikeFolderOpenRequest(input) {
    const text = String(input || '').trim().toLowerCase();
    if (/\b(folder|directory)\b/.test(text)) {
      return true;
    }

    const withoutVerb = text.replace(/^(open|launch|start|run|show|navigate to|go to)\s+/i, '').trim();
    if (!withoutVerb) {
      return false;
    }

    const tokenCount = withoutVerb.split(/\s+/).filter(Boolean).length;
    return tokenCount === 1;
  }

  _resolveExplicitSearchIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim();
    if (!input) return null;

    const lower = input.toLowerCase();
    const fileSearchIntent = this.intentRegistry.get('file.search');
    const browserSearchIntent = this.intentRegistry.get('browser.search');

    if (/^(search file|find file|look for file)\b/i.test(lower)) {
      return fileSearchIntent ? { intent: fileSearchIntent, confidence: 1 } : null;
    }

    if (/^(search for|search the web for|search web|search|google|look up|find on web)\b/i.test(lower)) {
      return browserSearchIntent
        ? { intent: browserSearchIntent, confidence: 1, entities: this._buildSearchEntities(rawText, preparedInput) }
        : null;
    }

    return null;
  }

  _resolveBareKnowledgeSearchIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!input || /^(?:what|who|when|where|why|how|which)\b/.test(input)) {
      return null;
    }
    if (/^(?:i\s+was|we\s+were|just\s+)?(?:talking|chatting|speaking)\s+about\b/.test(input) ||
      /\b(?:i\s+was|we\s+were)\s+(?:just\s+)?talking\s+about\b/.test(input)) {
      return null;
    }

    if (/^(?:open|close|launch|start|run|play|pause|resume|stop|send|message|call|create|delete|move|copy|rename|set|turn|switch|minimize|maximize|save|saved)\b/.test(input)) {
      return null;
    }

    const query = preparedInput?.query || {};
    if (query.isLocal) {
      return null;
    }

    const hasKnowledgeSignal = this._looksLikeWebSearchQuery(input) ||
      /\b(?:ipl|cricket|fifa|world\s+cup|match(?:es)?|fixtures?|schedule|score|scores|winner|winners|champion|champions|event|release|released|premiere|price|latest|current|today'?s?|news|best|top|list|movie|movies|paper|journal|research|documentation|docs|tutorials?|examples?|guide)\b/.test(input);
    if (!hasKnowledgeSignal) {
      return null;
    }

    const browserSearchIntent = this.intentRegistry.get('browser.search');
    if (!browserSearchIntent) {
      return null;
    }

    const entities = this._buildSearchEntities(rawText, preparedInput);
    return {
      intent: browserSearchIntent,
      confidence: 0.9,
      entities: {
        ...entities,
        query: String(rawText || input).trim().toLowerCase().replace(/\btoday\s+s\b/g, "today's")
      }
    };
  }

  _looksLikeWebSearchQuery(input) {
    const text = String(input || '').toLowerCase();
    return /\b(?:tutorials?|documentation|docs?|examples?|guide|learn|react|angular|node|javascript|typescript|python|java|api|framework|weather|news|score|scores|latest|best|capital|difference|meaning)\b/.test(text);
  }

  _resolveBrowserLanguageIntent(rawText, preparedInput) {
    const frame = preparedInput?.browserLanguage || this.browserCommandLanguage.parse(
      rawText,
      preparedInput?.correctedText
    );
    if (!frame || frame.validation?.status !== 'passed') return null;

    if (frame.operation === 'list-tabs') {
      const intent = this.intentRegistry.get('browser.listTabs');
      return intent ? {
        intent,
        confidence: frame.confidence,
        entities: {
          browserName: frame.browserName,
          responseMode: frame.entities.responseMode,
          routeSource: 'browser-language-v1'
        },
        semanticFrame: frame
      } : null;
    }

    if (frame.operation === 'new-tab') {
      const intent = this.intentRegistry.get('browser.open');
      return intent ? {
        intent,
        confidence: frame.confidence,
        entities: {
          url: 'about:newtab',
          browserName: frame.browserName,
          newTab: true,
          forceNewTab: true,
          routeSource: 'browser-language-v1'
        },
        semanticFrame: frame
      } : null;
    }

    if (frame.operation === 'open-named-tab') {
      const intent = this.intentRegistry.get('browser.openTab');
      return intent ? {
        intent,
        confidence: frame.confidence,
        entities: {
          browserName: frame.browserName,
          tabQuery: frame.entities.tabQuery,
          forceNewTab: Boolean(frame.entities.forceNewTab),
          routeSource: 'browser-language-v1'
        },
        semanticFrame: frame
      } : null;
    }

    if (frame.operation === 'open-browser-target') {
      const knownWeb = this._resolveKnownWebOpenIntent(rawText, preparedInput);
      if (knownWeb) return knownWeb;
      if (['open', 'show'].includes(frame.entities.action) && frame.entities.repairedBrowserJoin !== true) {
        const openFirstIntent = this.intentRegistry.get('browser.openFirstResult');
        return openFirstIntent ? {
          intent: openFirstIntent,
          confidence: frame.confidence,
          entities: {
            query: frame.entities.query,
            browserName: frame.browserName,
            openInBrowser: true,
            ...(frame.entities.newTab ? { newTab: true } : {}),
            routeSource: 'browser-language-v1'
          },
          semanticFrame: frame
        } : null;
      }
      const intent = this.intentRegistry.get('browser.search');
      return intent ? {
        intent,
        confidence: frame.confidence,
        entities: {
          query: frame.entities.query,
          browserName: frame.browserName,
          openInBrowser: true,
          ...(frame.entities.newTab ? { newTab: true } : {}),
          routeSource: 'browser-language-v1'
        },
        semanticFrame: frame
      } : null;
    }

    return null;
  }

  _resolveBrowserTabIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '')
      .trim()
      .toLowerCase()
      .replace(/\bphotes\b/g, 'photos')
      .replace(/\bchromem\b/g, 'chrome')
      .replace(/\bchromme\b/g, 'chrome')
      .replace(/\bchrom\b/g, 'chrome')
      .replace(/\btaqbs?\b/g, 'tabs');
    const rawInput = String(rawText || '')
      .trim()
      .toLowerCase()
      .replace(/\bphotes\b/g, 'photos')
      .replace(/\bchromem\b/g, 'chrome')
      .replace(/\bchromme\b/g, 'chrome')
      .replace(/\bchrom\b/g, 'chrome')
      .replace(/\btaqbs?\b/g, 'tabs');
    const tabInput = `${input} ${rawInput}`.replace(/\s+/g, ' ').trim();
    const browserMatch = (tabInput.match(/\b(?:in|on)\s+(?:the\s+)?(chrome|browser|edge|firefox)\b/));

    const directWebClose = input.match(
      /^(?:close|remove|shut|quit|exit)\s+(?:the\s+)?(.+?)(?:\s+(?:web\s+app|website|site|page))?(?:\s+(?:in|on)\s+(chrome|browser|edge|firefox))?$/i
    );
    if (directWebClose?.[1]) {
      const tabQuery = this._normalizeDirectWebTabCloseTarget(directWebClose[1]);
      if (tabQuery) {
        const intent = this.intentRegistry.get('browser.closeTab');
        return intent
          ? {
              intent,
              confidence: 1,
              entities: {
                browserName: directWebClose[2] || browserMatch?.[1] || 'chrome',
                tabQuery,
                routeSource: 'trusted-web-tab-close'
              }
            }
          : null;
      }
    }

    if (
      /^(?:what|which|show|list|tell)\b/.test(input) &&
      /\btabs?\b/.test(tabInput) &&
      /\b(?:open|opened|active|running|in|on|chrome|browser|edge|firefox)\b/.test(tabInput)
    ) {
      const intent = this.intentRegistry.get('browser.listTabs');
      return intent
        ? {
            intent,
            confidence: 1,
            entities: {
              browserName: browserMatch?.[1] || 'browser'
            }
          }
        : null;
    }

const newTabMatch = input.match(
      /^(?:open\s+)?(?:a\s+)?new\s+(?:(chrome|browser|edge|firefox)\s+)?tab(?:\s+(?:in|on)\s+(?:the\s+)?(chrome|browser|edge|firefox))?$/
    );
    if (newTabMatch) {
      const specifiedTarget = newTabMatch[1] || newTabMatch[2];
      if (!specifiedTarget && browserMatch?.[1]) {
        const browserName = browserMatch[1];
        if (!['chrome', 'browser', 'edge', 'firefox'].includes(browserName)) {
          return null;
        }
      }
      const intent = this.intentRegistry.get('browser.open');
      return intent
        ? {
            intent,
            confidence: 1,
            entities: {
              url: 'about:newtab',
              browserName: newTabMatch[1] || newTabMatch[2] || browserMatch?.[1] || 'browser',
              newTab: true
            }
          }
        : null;
    }

    if (browserMatch?.[1]) {
      const browserName = browserMatch[1].toLowerCase();
      if (!['chrome', 'browser', 'edge', 'firefox'].includes(browserName)) {
        return null;
      }
    }

    const targetedClose = input.match(/^(?:close|remove|shut)\s+(?:the\s+)?(.+?)\s+tabs?(?:\s+(?:in|on)\s+(chrome|browser|edge|firefox))?$/i);
    if (targetedClose?.[1]) {
      const tabQuery = this._normalizeBrowserTabQuery(targetedClose[1]);
      if (/^(?:current|active|empty|blank|first|1|one|selected|this)$/.test(tabQuery)) {
        const intent = this.intentRegistry.get('browser.closeTab');
        return intent
          ? {
              intent,
              confidence: 1,
              entities: {
                browserName: targetedClose[2] || browserMatch?.[1] || 'browser'
              }
            }
          : null;
      }

      if (tabQuery) {
        const intent = this.intentRegistry.get('browser.closeTab');
        return intent
          ? {
              intent,
              confidence: 1,
              entities: {
                browserName: targetedClose[2] || browserMatch?.[1] || 'browser',
                tabQuery
              }
            }
          : null;
      }
    }

    if (!/^(?:close|remove|shut)\s+(?:(?:the\s+)?(?:current|active|empty|blank|first|1|one|selected|this)\s+)?tab(?:\s+(?:in|on)\s+(?:chrome|browser|edge|firefox))?$/.test(input)) {
      return null;
    }

    const intent = this.intentRegistry.get('browser.closeTab');
    return intent
      ? {
          intent,
          confidence: 1,
          entities: {
            browserName: browserMatch?.[1] || 'browser'
          }
        }
        : null;
  }

  _normalizeBrowserTabQuery(value) {
    const cleaned = String(value || '')
      .toLowerCase()
      .replace(/\bphotes\b/g, 'photos')
      .replace(/\bgoogle\s+photo\b/g, 'google photos')
      .replace(/^(?:the|a|an)\s+/i, '')
      .replace(/\s+(?:tab|tabs|page|pages)$/i, '')
      .trim();
    if (!cleaned || /^(?:tab|tabs|page|pages)$/.test(cleaned)) {
      return '';
    }
    if (/^(?:first|1|one|current|active|selected|this|empty|blank)$/.test(cleaned)) {
      return cleaned;
    }
    return this._normalizeKnownWebTarget(cleaned) || cleaned;
  }

  _normalizeDirectWebTabCloseTarget(value) {
    const cleaned = String(value || '')
      .toLowerCase()
      .replace(/\bphotes\b/g, 'photos')
      .replace(/\bphots\b/g, 'photos')
      .replace(/\bgoogle\s+photo\b/g, 'google photos')
      .replace(/^(?:the|a|an)\s+/i, '')
      .replace(/\s+(?:tab|tabs|page|pages|window|windows)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) {
      return '';
    }

    if (/^(?:photos|instagram|facebook|fb)$/.test(cleaned)) {
      return '';
    }

    const target = resolveTrustedWebTarget(cleaned);
    return target?.key && DIRECT_WEB_TAB_CLOSE_TARGETS.has(target.key)
      ? target.key
      : '';
  }

  _extractEmailComposeEntities(input) {
    const source = String(input || '').trim();
    const normalized = source
      .replace(/^send\s+(?:an?\s+)?(?:email|mail)\s+/i, 'email ')
      .replace(/^mail\s+/i, 'email ')
      .trim();
    const contactMatch = normalized.match(/^email\s+(?:to\s+)?(.+?)(?:\s+(?:about|regarding|with\s+subject|subject)\s+(.+?))?(?:\s+(?:saying|body|message|that|and\s+say)\s+(.+))?$/i);
    if (!contactMatch?.[1]) {
      return {};
    }

    const contactName = contactMatch[1]
      .replace(/\s+(?:please|now)$/i, '')
      .trim();
    const subject = String(contactMatch[2] || '').trim();
    const body = String(contactMatch[3] || '').trim();
    return {
      contactName,
      subject,
      body
    };
  }

  _resolveSiteSearchIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim();
    const raw = String(rawText || corrected || '').trim();
    const explicitOpenOnly = /^(?:open|launch|start|go\s+to|pull\s+up|show(?:\s+me)?)\b/i.test(raw) &&
      !/\b(?:search|find|look\s+for|look\s+up)\b/i.test(raw);
    if (explicitOpenOnly) {
      return null;
    }
    const candidates = [corrected, raw].filter(Boolean);
    const intent = this.intentRegistry.get('browser.siteSearch');
    if (!intent) {
      return null;
    }

    const personalEmail = String(rawText || corrected || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .match(/^(?:search|find|show)\s+(?:my\s+)?emails?\s+(?:for|from|about)\s+(.+)$/i);
    if (personalEmail?.[1]) {
      return {
        intent,
        confidence: 1,
        entities: {
          site: 'gmail',
          query: personalEmail[1].trim()
        }
      };
    }

    for (const candidate of candidates) {
      const parsed = this._extractSiteSearch(candidate);
      if (parsed) {
        return {
          intent,
          confidence: 1,
          entities: parsed
        };
      }
    }

    return null;
  }

  _extractSiteSearch(input) {
    const normalized = String(input || '')
      .toLowerCase()
      .replace(/\bphotes\b/g, 'photos')
      .replace(/\bfo\b/g, 'for')
      .replace(/\bclass\s+mates\b/g, 'classmates')
      .replace(/\s+/g, ' ')
      .trim();
    const sitePattern = '(google photos?|photos|youtube|you tube|gmail|google mail|mail|google drive|drive|google maps?|maps|chrome settings?|browser settings|chatgpt|chat gpt)';
    const patterns = [
      new RegExp(`^(?:in|on|inside)\\s+${sitePattern}\\s+(?:search|find|look\\s+for|look\\s+up)\\s+(?:for\\s+)?(.+)$`, 'i'),
      new RegExp(`^(?:search|find|look\\s+for|look\\s+up|google)\\s+(?:for\\s+)?(.+?)\\s+(?:in|on|inside)\\s+${sitePattern}$`, 'i'),
      new RegExp(`^(?:search|find|look\\s+for|look\\s+up)\\s+${sitePattern}\\s+(?:for\\s+)?(.+)$`, 'i'),
      new RegExp(`^(?:open|show|go\\s+to)\\s+${sitePattern}\\s+(?:and\\s+)?(?:search|find|look\\s+for)\\s+(?:for\\s+)?(.+)$`, 'i')
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (!match) {
        continue;
      }

      const groups = match.slice(1).filter(Boolean);
      const site = groups.find(value => this._normalizeSiteSearchTarget(value));
      const query = groups.find(value => value !== site);
      const cleanQuery = this._cleanSiteSearchQuery(query);
      const normalizedSite = this._normalizeSiteSearchTarget(site);
      if (normalizedSite && cleanQuery) {
        return {
          site: normalizedSite,
          query: normalizedSite === 'google photos'
            ? this._refinePhotoSiteSearchQuery(cleanQuery)
            : cleanQuery
        };
      }
    }

    return null;
  }

  _normalizeSiteSearchTarget(value) {
    const target = String(value || '').trim().toLowerCase();
    const aliases = {
      photos: 'google photos',
      photo: 'google photos',
      'google photo': 'google photos',
      'google photos': 'google photos',
      youtube: 'youtube',
      'you tube': 'youtube',
      gmail: 'gmail',
      mail: 'gmail',
      'google mail': 'gmail',
      drive: 'google drive',
      'google drive': 'google drive',
      maps: 'google maps',
      'google map': 'google maps',
      'google maps': 'google maps',
      'chrome setting': 'chrome settings',
      'chrome settings': 'chrome settings',
      'browser settings': 'chrome settings',
      chatgpt: 'chatgpt',
      'chat gpt': 'chatgpt'
    };
    return aliases[target] || null;
  }

  _cleanSiteSearchQuery(value) {
    const cleaned = String(value || '')
      .replace(/^(?:for|the|a|an)\s+/i, '')
      .replace(/^(?:in|on)\s+(?:chrome|browser|edge|firefox)$/i, '')
      .replace(/\s+(?:please|in\s+chrome|on\s+chrome|in\s+browser|on\s+browser)$/i, '')
      .trim();
    return /[a-z0-9]/i.test(cleaned) ? cleaned : '';
  }

  _refinePhotoSiteSearchQuery(query) {
    const personalQuery = this._extractPersonalPhotoQuery(query);
    return personalQuery && personalQuery !== 'photos'
      ? personalQuery
      : query;
  }

  _resolveSystemSettingsIntent(rawText, preparedInput) {
    const input = this._normalizeSystemCommandText(preparedInput?.correctedText || rawText);
    const raw = this._normalizeSystemCommandText(rawText);
    const combined = `${input} ${raw}`.replace(/\s+/g, ' ').trim();
    if (!/\b(?:wifi|wi\s*fi|bluetooth|hotspot|mobile\s+hotspot)\b/.test(combined)) {
      return null;
    }

    const wifiStateChange = /\b(?:wifi|wi\s*fi)\b/.test(combined) &&
      /\b(?:connect|connected|disconnect|forget|enable|disable|turn\s+on|turn\s+off|switch\s+on|switch\s+off)\b/.test(combined);
    if (wifiStateChange) {
      const explicitRawWifiChange = /\b(?:connect|disconnect|forget|enable|disable|turn\s+on|turn\s+off|switch\s+on|switch\s+off)\b/.test(raw);
      const asksWifiStatus = !explicitRawWifiChange && (
        /\b(?:check|see|show|tell|what|is|are|status)\b.*\b(?:connected|signal|wifi|wi\s*fi)\b/.test(combined) ||
        /\bconnected\s+to\s+(?:wifi|wi\s*fi)\b/.test(combined)
      );
      const changesWifiState = !asksWifiStatus &&
        /\b(?:connect|disconnect|forget|enable|disable|turn\s+on|turn\s+off|switch\s+on|switch\s+off)\b/.test(combined);
      const capabilityIntent = this.intentRegistry.get('assistant.capability');
      if (changesWifiState && capabilityIntent && this.config?.permissions?.levels?.medium) {
        const operationMatch = combined.match(/\b(connect|disconnect|forget|enable|disable|turn\s+on|turn\s+off|switch\s+on|switch\s+off)\b/);
        return {
          intent: capabilityIntent,
          confidence: 1,
          entities: {
            capability: 'network',
            operation: operationMatch ? operationMatch[1].replace(/\s+/g, ' ') : 'change',
            target: 'wifi',
            rawCommand: rawText
          }
        };
      }
      const intent = this.intentRegistry.get('app.open');
      return intent
        ? { intent, confidence: 1, entities: { appName: 'ms-settings:network-wifi' } }
        : null;
    }

    if (/\bbluetooth\b/.test(input)) {
      const intent = this.intentRegistry.get('system.bluetooth');
      if (!intent) {
        return null;
      }

      const asksStatus = /\b(?:what|status|about|is|are)\b/.test(input);
      const turnsOn = /\b(?:(?:turn|switch|put)\s+on|enable|activate)\b|\b(?:turn|switch|put)\s+bluetooth\s+on\b/.test(input);
      const turnsOff = /\b(?:(?:turn|switch|put)\s+(?:off|of)|disable|deactivate)\b|\b(?:turn|switch|put)\s+bluetooth\s+(?:off|of)\b/.test(input);
      if (turnsOn && !asksStatus) {
        return { intent, confidence: 1, entities: { enabled: true } };
      }
      if (turnsOff && !asksStatus) {
        return { intent, confidence: 1, entities: { enabled: false } };
      }
      if (/^(?:what|tell|show|check|is|are)\b|\b(?:status|about|enabled|disabled|on|off)\b/.test(input)) {
        return { intent, confidence: 1, entities: {} };
      }
    }

    const isSettingsLikeRequest =
      /^(?:turn|switch|enable|disable|open|show|check)\b/.test(input) ||
      /\b(?:is|are)\s+(?:on|off|enabled|disabled)\b/.test(input);
    if (!isSettingsLikeRequest) {
      return null;
    }

    const target = /\bhotspot|mobile\s+hotspot\b/.test(input)
      ? 'ms-settings:network-mobilehotspot'
      : /\bbluetooth\b/.test(input)
        ? 'ms-settings:bluetooth'
        : 'ms-settings:network-wifi';
    const intent = this.intentRegistry.get('app.open');
    return intent
      ? { intent, confidence: 1, entities: { appName: target } }
      : null;
  }

  _resolveSystemPowerIntent(rawText, preparedInput) {
    const input = this._normalizeSystemCommandText(preparedInput?.correctedText || rawText);
    const raw = this._normalizeSystemCommandText(rawText);
    const combined = `${input} ${raw}`.replace(/\s+/g, ' ').trim();
    if (!combined) {
      return null;
    }

    if (/\b(?:timer|song|track|server|service|app|application|remind|reminder)\b/.test(combined)) {
      return null;
    }

    const restartIntent = this.intentRegistry.get('system.restart');
    const shutdownIntent = this.intentRegistry.get('system.shutdown');
    const sleepIntent = this.intentRegistry.get('system.sleep');
    const lockIntent = this.intentRegistry.get('system.lock');

    if (/\b(?:restart|reboot)\b/.test(combined)) {
      return restartIntent ? { intent: restartIntent, confidence: 1, entities: {} } : null;
    }

    if (/\b(?:shut\s*down|shutdown|power\s+off|cancel\s+(?:scheduled\s+)?shutdown)\b/.test(combined)) {
      return shutdownIntent ? { intent: shutdownIntent, confidence: 1, entities: {} } : null;
    }

    if (/\b(?:sleep|hibernate|put\s+(?:the\s+)?computer\s+to\s+sleep)\b/.test(combined)) {
      return sleepIntent ? { intent: sleepIntent, confidence: 1, entities: {} } : null;
    }

    if (/\b(?:lock\s+(?:the\s+)?(?:computer|screen|pc|laptop)|lock\s+workstation)\b/.test(combined)) {
      return lockIntent ? { intent: lockIntent, confidence: 1, entities: {} } : null;
    }

    return null;
  }

  _resolveBrowserFollowupIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!/^(?:click|open|go\s+to)\s+(?:the\s+)?(?:first|top(?:\s+(?:\d+|one|two|three|four|five))?)\s+(?:links?|results?|search\s+results?)\b/.test(input)) {
      return null;
    }

    const intent = this.intentRegistry.get('browser.openFirstResult');
    const queryMatch = input.match(/\b(?:for|of)\s+(.+)$/i);
    const countMatch = input.match(/\btop\s+(\d+|one|two|three|four|five)\b/i);
    const countWords = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5
    };
    const resultCount = countMatch?.[1]
      ? Number(countWords[countMatch[1]] || countMatch[1])
      : 1;
    const query = queryMatch?.[1]
      ? queryMatch[1].replace(/\s+(?:in|on)\s+(?:chrome|browser|edge|firefox)\s*$/i, '').trim()
      : '';
    return intent
      ? {
          intent,
          confidence: 1,
          entities: {
            ...(query ? { query } : {}),
            ...(resultCount > 1 ? { resultCount } : {})
          }
        }
      : null;
  }

  _resolvePlannerIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim();
    const raw = String(rawText || corrected || '').trim();
    const input = corrected.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!/\b(?:calendar|calender|calander|clander|timetable|time\s+table|time-table|daily\s+schedule)\b/.test(input)) {
      return null;
    }

    const target = /\b(?:timetable|time\s+table|time-table|daily\s+schedule)\b/.test(input) ? 'timetable' : 'calendar';
    if (/^(?:open|show|display|launch)\b/.test(input) && !/\b(?:add|update|put|schedule|create|save)\b/.test(input)) {
      const intent = this.intentRegistry.get(`${target}.open`);
      return intent ? { intent, confidence: 1, entities: {} } : null;
    }

    if (!/\b(?:add|update|put|schedule|create|save)\b/.test(input)) {
      return null;
    }

    const intent = this.intentRegistry.get(`${target}.add`);
    if (!intent) {
      return null;
    }

    const plannerText = this._extractPlannerText(raw, target);
    const entities = {
      plannerText,
      dateExpression: this._extractPlannerDateExpression(raw),
      timeExpression: this._extractPlannerTimeExpression(raw)
    };
    if (/\b(?:this|that)\b/i.test(raw) && !plannerText) {
      entities.reference = 'previous';
    }
    return { intent, confidence: 1, entities };
  }

  _extractPlannerText(rawText, target) {
    const targetPattern = target === 'timetable'
      ? '(?:timetable|time\\s+table|time-table|daily\\s+schedule)'
      : '(?:calendar|calender|calander|clander)';
    const patterns = [
      new RegExp(`^(?:add|put|save|schedule|create)\\s+(.+?)\\s+(?:to|in|on)\\s+(?:my\\s+)?${targetPattern}\\b`, 'i'),
      new RegExp(`^(?:add|put|save|schedule|create)\\s+(?:this|that)\\s+(?:to|in|on)\\s+(?:my\\s+)?${targetPattern}\\s*(.*)$`, 'i'),
      new RegExp(`^(?:update)\\s+(.+?)\\s+(?:to|in|on)\\s+(?:my\\s+)?${targetPattern}\\b`, 'i'),
      new RegExp(`^(?:update|add|put|save|schedule|create)\\s+(?:this|that)\\s+(?:to|in|on)?\\s*(?:my\\s+)?${targetPattern}\\s*(.*)$`, 'i')
    ];
    for (const pattern of patterns) {
      const match = String(rawText || '').match(pattern);
      if (!match?.[1]) continue;
      const cleaned = this._cleanPlannerText(match[1]);
      if (cleaned && !/^(?:this|that|it)$/i.test(cleaned)) return cleaned;
    }
    return '';
  }

  _cleanPlannerText(value) {
    return String(value || '')
      .replace(/\b(?:today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2}-\d{1,2}-\d{1,2})\b/gi, ' ')
      .replace(/\b(?:at|from|by)\s+\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm)?\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?]+$/g, '')
      .trim();
  }

  _extractPlannerDateExpression(value) {
    const match = String(value || '').match(/\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2}-\d{1,2}-\d{1,2})\b/i);
    return match?.[1] ? match[1].replace(/\s+/g, ' ').trim() : '';
  }

  _extractPlannerTimeExpression(value) {
    const text = String(value || '');
    const match = text.match(/\b(?:at|from|by)\s+(\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm)?)\b/i) ||
      text.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i) ||
      text.match(/\b(\d{1,2}\s*(?:am|pm))\b/i);
    return match?.[1] ? match[1].replace(/^(\d{1,2})\s+(\d{2})/, '$1:$2').replace(/\s+/g, ' ').trim() : '';
  }

  _resolveExplicitReminderIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim();
    const raw = String(rawText || input || '').trim();
    // Scheduling a power action is not an ordinary reminder: falling through
    // to the critical power intent ensures the user must confirm it.
    if (/\bschedule\s+(?:a\s+)?(?:restart|reboot|shut\s*down|shutdown|power\s+off|sleep|hibernate)\b/i.test(raw)) {
      return null;
    }
    const durationWords = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\\s*five)?|sixty)';
    const durationUnits = '(?:seconds?|secs?|minutes?|mins?|minits?|hours?|hrs?)';
    const rawReminderParts = this.entityExtractor.extractReminderParts(raw);
    const correctedReminderParts = this.entityExtractor.extractReminderParts(input);
    const multiTimeReminder = this._extractMultiTimeReminder(raw, input);
    const taskTimer = input.match(/^(?:set|create|add)\s+(?:a\s+)?timer\s+for\s+(.+?)\s+at\s+(\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm)?)$/i);
    const taskDurationTimer = input.match(new RegExp(
      `^(?:set|start|create|add)\\s+(?:a\\s+)?timer\\s+(?:for|of)\\s+(${durationWords}\\s*${durationUnits})\\s+(?:to|for)\\s+(.+)$`,
      'i'
    )) || input.match(new RegExp(
      `^(?:set|start|create|add)\\s+(?:a\\s+)?(${durationWords}\\s*${durationUnits})\\s+timer\\s+(?:to|for)\\s+(.+)$`,
      'i'
    )) || input.match(new RegExp(
      `^(?:set|start|create|add)\\s+(?:a\\s+)?timer\\s+(?:to|for)\\s+(.+?)\\s+in\\s+(${durationWords}\\s*${durationUnits})$`,
      'i'
    ));
    const delayedAction = this._extractDelayedAction(raw, input, durationWords, durationUnits);
    if (!delayedAction && !multiTimeReminder && !taskTimer && !taskDurationTimer && !rawReminderParts.timeExpression && !correctedReminderParts.timeExpression && !/^(?:(?:daily|every\s+(?:day|morning|evening|night|weekday|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\s+)?(?:remind|notify|alert|set\s+(?:a\s+)?(?:recurring\s+)?reminder|create\s+(?:a\s+)?(?:recurring\s+)?reminder|add\s+(?:a\s+)?(?:recurring\s+)?reminder|schedule\s+(?:a\s+)?(?:recurring\s+)?reminder)\b/i.test(input)) {
      return null;
    }

    const intent = this.intentRegistry.get('reminder.set');
    if (!intent) {
      return null;
    }

    const entities = this.entityExtractor.extract(intent, rawText);
    if (delayedAction) {
      entities.duration = delayedAction.duration;
      entities.timeExpression = delayedAction.timeExpression;
      entities.reminderText = delayedAction.reminderText;
      entities.reminderCategory = 'general';
      entities.scheduledAction = delayedAction.scheduledAction;
      entities.routeSource = 'delayed-action';
    }
    if (multiTimeReminder) {
      entities.timeExpression = multiTimeReminder.timeExpressions[0];
      entities.timeExpressions = multiTimeReminder.timeExpressions;
      entities.reminderText = multiTimeReminder.reminderText;
      entities.reminderCategory = multiTimeReminder.reminderCategory;
      entities.recurrence = multiTimeReminder.recurrence || entities.recurrence;
      entities.routeSource = 'multi-time-reminder';
    }
    if (!multiTimeReminder && rawReminderParts.timeExpression) entities.timeExpression = rawReminderParts.timeExpression;
    if (!multiTimeReminder && rawReminderParts.duration) entities.duration = rawReminderParts.duration;
    if (!delayedAction && !multiTimeReminder && rawReminderParts.reminderText) {
      entities.reminderText = rawReminderParts.reminderText;
      entities.reminderCategory = rawReminderParts.reminderCategory || this.entityExtractor._extractReminderCategory(rawReminderParts.reminderText);
    }
    if (!delayedAction && !multiTimeReminder && taskTimer) {
      entities.reminderText = taskTimer[1].trim();
      entities.timeExpression = taskTimer[2].replace(/^(\d{1,2})\s+(\d{2})/, '$1:$2').replace(/\s+/g, ' ').trim();
      entities.reminderCategory = this.entityExtractor._extractReminderCategory(taskTimer[1]);
    }
    if (!delayedAction && !multiTimeReminder && taskDurationTimer) {
      const durationText = taskDurationTimer[1].match(new RegExp(`^${durationWords}\\s*${durationUnits}$`, 'i'))
        ? taskDurationTimer[1]
        : taskDurationTimer[2];
      const reminderText = taskDurationTimer[2] && durationText === taskDurationTimer[1]
        ? taskDurationTimer[2]
        : taskDurationTimer[1];
      entities.duration = this.entityExtractor._extractDuration(durationText);
      entities.timeExpression = durationText;
      entities.reminderText = this.entityExtractor._stripReminderScheduleSuffix(reminderText) || String(reminderText || '').trim();
      entities.reminderCategory = this.entityExtractor._extractReminderCategory(entities.reminderText);
    }
    const correctedEntities = this.entityExtractor.extract(intent, input);
    if (!multiTimeReminder && !entities.timeExpression && correctedReminderParts.timeExpression) {
      entities.timeExpression = correctedReminderParts.timeExpression;
    }
    if (!multiTimeReminder && !entities.duration && correctedReminderParts.duration) {
      entities.duration = correctedReminderParts.duration;
    }
    if (!multiTimeReminder && !entities.reminderText && correctedReminderParts.reminderText) {
      entities.reminderText = correctedReminderParts.reminderText;
      entities.reminderCategory = correctedReminderParts.reminderCategory || this.entityExtractor._extractReminderCategory(correctedReminderParts.reminderText);
    }
    if (!multiTimeReminder && !entities.timeExpression && correctedEntities.timeExpression) {
      entities.timeExpression = correctedEntities.timeExpression;
    }
    if (!multiTimeReminder && !entities.duration && correctedEntities.duration) {
      entities.duration = correctedEntities.duration;
    }
    if (!multiTimeReminder && !entities.reminderText && correctedEntities.reminderText) {
      entities.reminderText = correctedEntities.reminderText;
    }
    entities.recurrence = entities.recurrence || rawReminderParts.recurrence || correctedReminderParts.recurrence || correctedEntities.recurrence || this._extractScheduleRecurrence(`${raw} ${input}`);
    entities.timeExpression = this._stripScheduleRecurrenceFromTimeExpression(entities.timeExpression);
    if (Array.isArray(entities.timeExpressions)) {
      entities.timeExpressions = entities.timeExpressions
        .map(timeExpression => this._stripScheduleRecurrenceFromTimeExpression(timeExpression))
        .filter(Boolean);
    }
    if (!entities.reminderText) {
      const scheduleOnlyFallbackPattern = new RegExp(
        `^(?:${durationWords}\\s*${durationUnits}|today|tomorrow(?:\\s+(?:morning|afternoon|evening|night))?|tonight|next\\s+week|(?:this|next)\\s+month\\s+\\d{1,2}|\\d{1,2}(?:st|nd|rd|th)?(?:\\s+(?:of\\s+)?(?:this|next)\\s+month|\\s+(?:this|next)\\s+month)|\\d{1,2}[\\/.-]\\d{1,2}(?:[\\/.-]\\d{2,4})?)$`,
        'i'
      );
      const fallbackText = input
        .replace(/^(?:(?:daily|every\s+(?:day|morning|evening|night|weekday|week))\s+)?(?:(?:remind|notify|alert)(?:\s+me)?|set\s+(?:a\s+)?(?:recurring\s+)?reminder|create\s+(?:a\s+)?(?:recurring\s+)?reminder|add\s+(?:a\s+)?(?:recurring\s+)?reminder|schedule\s+(?:a\s+)?(?:recurring\s+)?reminder)\s+(?:to\s+)?/i, '')
        .replace(/^(?:recurring\s+)?reminder\s*/i, '')
        .replace(new RegExp(`^(?:at|for|in|after)\\s+${durationWords}\\s*${durationUnits}\\s*`, 'i'), '')
        .replace(/^(?:at|for|in)\s+\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm)?(?:\s+(?:today|tomorrow))?\s*/i, '')
        .replace(/^(?:every\s+(?:day|morning|evening|night|weekday|week)|daily)\s*/i, '')
        .trim();
      if (fallbackText && !scheduleOnlyFallbackPattern.test(fallbackText) && !/^(?:me|myself|today|tomorrow|am|pm)$/i.test(fallbackText)) {
        entities.reminderText = fallbackText;
      }
    }

    if (entities.reminderText || entities.timeExpression || entities.duration || entities.recurrence) {
      return { intent, confidence: 1, entities };
    }

    return null;
  }

  _extractMultiTimeReminder(rawText, correctedText) {
    const sources = Array.from(new Set([
      String(rawText || '').trim(),
      String(correctedText || rawText || '').trim()
    ].filter(Boolean)));

    for (const source of sources) {
      const reminderParts = this.entityExtractor.extractReminderParts(source);
      if (!Array.isArray(reminderParts.timeExpressions) ||
        reminderParts.timeExpressions.length < 2 ||
        !reminderParts.reminderText) {
        continue;
      }

      return {
        reminderText: reminderParts.reminderText,
        timeExpressions: reminderParts.timeExpressions,
        recurrence: reminderParts.recurrence || this._extractScheduleRecurrence(source),
        reminderCategory: reminderParts.reminderCategory || this.entityExtractor._extractReminderCategory(reminderParts.reminderText)
      };
    }

    return null;
  }

  _extractDelayedAction(rawText, correctedText, durationWords, durationUnits) {
    const durationPattern = `(${durationWords}\\s*${durationUnits})`;
    const sources = Array.from(new Set([
      String(rawText || '').trim(),
      String(correctedText || rawText || '').trim()
    ].filter(Boolean)));

    for (const source of sources) {
      const patterns = [
        { pattern: new RegExp(`^(?:please\\s+)?(?:after|in)\\s+${durationPattern}\\s*,?\\s+(.+)$`, 'i'), durationIndex: 1, commandIndex: 2 },
        { pattern: new RegExp(`^(.+?)\\s+(?:after|in)\\s+${durationPattern}$`, 'i'), durationIndex: 2, commandIndex: 1 }
      ];

      for (const { pattern, durationIndex, commandIndex } of patterns) {
        const match = source.match(pattern);
        if (!match) {
          continue;
        }

        const durationText = String(match[durationIndex] || '').replace(/\s+/g, ' ').trim();
        const commandText = String(match[commandIndex] || '')
          .replace(/[?.!]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!durationText || !this._isSchedulableCommandText(commandText)) {
          continue;
        }

        const duration = this.entityExtractor._extractDuration(durationText);
        if (!duration || duration <= 0) {
          continue;
        }

        const scheduledAction = this._buildDelayedScheduledAction(commandText);
        if (!scheduledAction) {
          continue;
        }

        return {
          duration,
          timeExpression: durationText,
          reminderText: commandText,
          scheduledAction
        };
      }
    }

    return null;
  }

  _isSchedulableCommandText(value) {
    const command = String(value || '').trim();
    if (!command || /\b(?:shutdown|shut\s+down|restart|reboot|power\s+off|sleep|hibernate|delete|remove\s+(?:file|folder)|erase|move|copy|send|transfer|message|email|call)\b/i.test(command)) {
      return false;
    }
    return /^(?:open|launch|start|run|close|remove|shut|quit|exit|stop|play|watch|listen\s+to|pause|resume|continue|show|go|goto|jump|move|advance|next|previous|prev|back)\b/i.test(command);
  }

  _buildDelayedScheduledAction(commandText) {
    const command = String(commandText || '')
      .replace(/[?.!]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!command || /\b(?:shutdown|shut\s+down|restart|reboot|power\s+off|sleep|hibernate)\b/i.test(command)) {
      return null;
    }

    const prepared = { correctedText: command.toLowerCase() };
    const route = this._resolveScheduledActionRoute(command, prepared);
    if (!route?.intent?.id || !SCHEDULED_ACTION_INTENTS.has(route.intent.id)) return null;
    return {
      actionId: route.intent.action || route.intent.id,
      entities: this._sanitizeScheduledActionEntities(route.intent.id, route.entities || {})
    };
  }

  _resolveScheduledActionRoute(command, prepared) {
    const resolvers = [
      () => this._resolvePresentationControlIntent(command, prepared),
      () => this._resolveYouTubeMediaIntent(command, prepared),
      () => this._resolveKnownWebOpenIntent(command, prepared),
      () => this._resolveBrowserFollowupIntent(command, prepared),
      () => this._resolveBrowserLanguageIntent(command, prepared),
      () => this._resolveBrowserTabIntent(command, prepared),
      () => this._resolveExplicitMediaControlIntent(command, prepared),
      () => this._resolveMediaIntent(command, 'scheduled'),
      () => this._resolveExplicitMediaIntent(command, prepared),
      () => this._resolveExplicitFileIntent(command, prepared),
      () => this._resolveExplicitFolderIntent(command, prepared),
      () => this._resolveExplicitAppIntent(command, prepared),
      () => this._resolveExplicitOpenIntent(command, prepared),
      () => this._resolveExplicitAppOpenIntent(command, prepared)
    ];

    for (const resolve of resolvers) {
      const result = resolve();
      if (result?.intent?.id && SCHEDULED_ACTION_INTENTS.has(result.intent.id)) {
        return result;
      }
    }
    return null;
  }

  _sanitizeScheduledActionEntities(intentId, entities = {}) {
    const source = entities && typeof entities === 'object' ? entities : {};
    const cleanText = (value, max = 240) => String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    switch (intentId) {
      case 'app.open':
      case 'app.close':
        return {
          appName: cleanText(source.appName, 120),
          ...(source.forceNewWindow === true ? { forceNewWindow: true } : {}),
          ...(source.requestedOperation ? { requestedOperation: cleanText(source.requestedOperation, 60) } : {}),
          ...(source.allowWebSearchFallback === true ? { allowWebSearchFallback: true } : {}),
          ...(source.webFallbackUrl ? { webFallbackUrl: cleanText(source.webFallbackUrl, 240) } : {}),
          ...(source.webFallbackBrowser ? { webFallbackBrowser: cleanText(source.webFallbackBrowser, 40).toLowerCase() } : {})
        };
      case 'browser.open':
        return {
          url: cleanText(source.url, 240),
          ...(source.browserName ? { browserName: cleanText(source.browserName, 40).toLowerCase() } : {}),
          ...(source.newTab === true ? { newTab: true } : {})
        };
      case 'browser.openTab':
      case 'browser.closeTab':
        return {
          browserName: cleanText(source.browserName || 'browser', 40).toLowerCase(),
          ...(source.tabQuery ? { tabQuery: cleanText(source.tabQuery, 120) } : {}),
          ...(source.forceNewTab === true ? { forceNewTab: true } : {})
        };
      case 'file.open':
        return {
          filename: cleanText(source.filename || source.path, 240),
          ...(source.path ? { path: cleanText(source.path, 260) } : {})
        };
      case 'folder.open':
        return {
          folderName: cleanText(source.folderName || source.path, 240),
          ...(source.path ? { path: cleanText(source.path, 260) } : {})
        };
      case 'media.play':
        return {
          mediaQuery: cleanText(source.mediaQuery || source.query, 180),
          mediaPlatform: cleanText(source.mediaPlatform || source.platform || 'youtube', 40).toLowerCase()
        };
      case 'presentation.start':
        return {
          appName: 'powerpoint',
          windowName: cleanText(source.windowName || 'powerpnt', 80) || 'powerpnt',
          mode: /current/i.test(cleanText(source.mode, 40)) ? 'current' : 'beginning'
        };
      case 'presentation.next':
      case 'presentation.previous':
        return {
          appName: 'powerpoint',
          windowName: cleanText(source.windowName || 'powerpnt', 80) || 'powerpnt'
        };
      case 'presentation.goto':
        return {
          appName: 'powerpoint',
          windowName: cleanText(source.windowName || 'powerpnt', 80) || 'powerpnt',
          slideNumber: Math.trunc(Number(source.slideNumber))
        };
      default:
        return {};
    }
  }

  _resolveScheduleManagementIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!input) return null;
    const routes = [
      ['timer.clear', /^(?:delete|clear|cancel|stop)\s+all\s+(?:active\s+)?timers?$/],
      ['timer.pause', /^pause\s+(?:the\s+|my\s+)?(?:active\s+)?timer$/],
      ['timer.resume', /^resume\s+(?:the\s+|my\s+)?(?:active\s+)?timer$/],
      ['timer.reset', /^(?:reset|restart)\s+(?:the\s+|my\s+)?timer$/],
      ['timer.remaining', /^(?:how\s+much\s+time\s+(?:is\s+)?left|show\s+(?:the\s+)?remaining\s+time|time\s+left)$/],
      ['timer.list', /^(?:(?:show|list|what|tell|check)\b.*\b(?:active\s+)?timers?\b|(?:how\s+many|count|do\s+i\s+have|are\s+there|any)\b.*\b(?:active\s+)?timers?\b)/],
      ['timer.cancel', /^(?:stop|cancel|delete)\s+(?:the\s+|my\s+)?(?:active\s+)?timer$/],
      ['reminder.clear', /^(?:delete|clear|cancel)\s+all\s+(?:my\s+)?reminders?$/],
      ['reminder.list', /^(?:(?:show|list|tell|check|what(?:'s|\s+is|\s+are)?)\b.*\breminders?\b|(?:how\s+many|count|do\s+i\s+have|are\s+there|any)\b.*\breminders?\b|reminders?\b.*\b(?:today|tomorrow|active|upcoming|scheduled)\b)/],
      ['reminder.snooze', /^snooze\s+(?:this\s+|the\s+|my\s+)?reminder(?:\s+for\s+.+)?$/],
      ['reminder.cancel', /^(?:delete|cancel|stop)\s+(?:this\s+|the\s+|my\s+)?reminder$/],
      ['alarm.clear', /^(?:delete|clear|cancel|stop)\s+all\s+(?:my\s+)?alarms?$/],
      ['alarm.snooze', /^snooze\s+(?:the\s+|my\s+)?alarm(?:\s+for\s+.+)?$/],
      ['alarm.list', /^(?:(?:show|list|tell|check|what(?:'s|\s+is|\s+are)?)\b.*\b(?:active\s+)?alarms?\b|(?:how\s+many|count|do\s+i\s+have|are\s+there|any)\b.*\b(?:active\s+)?alarms?\b)/],
      ['alarm.cancel', /^(?:delete|cancel|stop|dismiss)\s+(?:this\s+|the\s+|my\s+)?alarm$/]
    ];
    for (const [intentId, pattern] of routes) {
      if (!pattern.test(input)) continue;
      const intent = this.intentRegistry.get(intentId);
      if (!intent) return null;
      const entities = this.entityExtractor.extract(intent, rawText);
      if (/\.(?:list)$/.test(intentId)) {
        if (/\btoday\b/.test(input)) entities.scope = 'today';
        else if (/\ball\b/.test(input)) entities.scope = 'all';
        else if (/\b(?:active|upcoming|scheduled)\b/.test(input)) entities.scope = 'active';
        if (/\b(?:how\s+many|count|do\s+i\s+have|are\s+there|any)\b/.test(input)) {
          entities.countOnly = true;
        }
      }
      return { intent, confidence: 1, entities };
    }
    return null;
  }

  _resolveStopwatchIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    if (!/\bstop\s*watch\b|\bstopwatch\b/.test(input)) return null;
    const routes = [
      ['stopwatch.pause', /^(?:pause|hold)\s+(?:the\s+|my\s+)?stop\s*watch$/],
      ['stopwatch.resume', /^(?:resume|continue)\s+(?:the\s+|my\s+)?stop\s*watch$/],
      ['stopwatch.reset', /^(?:reset|restart)\s+(?:the\s+|my\s+)?stop\s*watch$/],
      ['stopwatch.cancel', /^(?:stop|cancel|close)\s+(?:the\s+|my\s+)?stop\s*watch$/],
      ['stopwatch.elapsed', /^(?:show|check|what(?:'s| is)|tell)\b.*\bstop\s*watch\b/],
      ['stopwatch.start', /^(?:start|set|run|begin|open)\s+(?:a\s+|the\s+|my\s+)?stop\s*watch$/]
    ];
    for (const [intentId, pattern] of routes) {
      if (!pattern.test(input)) continue;
      const intent = this.intentRegistry.get(intentId);
      if (!intent) return null;
      return { intent, confidence: 1, entities: {} };
    }
    const intent = this.intentRegistry.get('stopwatch.start');
    return intent ? { intent, confidence: 0.9, entities: {} } : null;
  }

  _resolveExplicitAlarmIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim();
    const raw = String(rawText || corrected || '').trim();
    const combined = `${raw} ${corrected}`.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!/\b(?:set|start|create|run)\b.*\balarm\b|\balarm\b.*\b(?:for|at)\s+\d|\bwake\s+me\b/.test(combined)) {
      return null;
    }

    const intent = this.intentRegistry.get('alarm.set');
    if (!intent) {
      return null;
    }

    const entities = this.entityExtractor.extract(intent, raw);
    const correctedEntities = this.entityExtractor.extract(intent, corrected);
    entities.recurrence = entities.recurrence || correctedEntities.recurrence || this._extractScheduleRecurrence(combined);
    entities.timeExpression = this._stripScheduleRecurrenceFromTimeExpression(entities.timeExpression);
    if (entities.timeExpression) {
      return { intent, confidence: 1, entities };
    }

    const timeExprMatch = raw.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s+(?:today|tomorrow))?)\b/i);
    if (timeExprMatch?.[1]) {
      return {
        intent,
        confidence: 0.95,
        entities: {
          timeExpression: timeExprMatch[1].replace(/\s+/g, ' ').trim(),
          recurrence: this._extractScheduleRecurrence(combined) || undefined
        }
      };
    }

    return null;
  }

  _extractScheduleRecurrence(value) {
    const source = String(value || '').toLowerCase();
    const weekdayRecurrence = this._extractScheduleWeekdayRecurrence(source);
    if (weekdayRecurrence) return weekdayRecurrence;
    if (/\bevery\s+(?:one\s+)?hour\b|\bhourly\b/.test(source)) return 'hourly';
    if (/\bevery\s+(?:two|2)\s+hours?\b/.test(source)) return 'every-2-hours';
    if (/\bevery\s+weekday(?:\s+morning)?\b/.test(source)) return source.includes('morning') ? 'weekday-morning' : 'weekday';
    if (/\bevery\s+(?:day|morning|evening|night)\b|\bdaily\b/.test(source)) {
      if (source.includes('morning')) return 'daily-morning';
      if (source.includes('evening')) return 'daily-evening';
      if (source.includes('night')) return 'daily-night';
      return 'daily';
    }
    if (/\bevery\s+week\b|\bweekly\b/.test(source)) return 'weekly';
    return null;
  }

  _extractScheduleWeekdayRecurrence(value) {
    const source = String(value || '').toLowerCase();
    const everyMatch = source.match(/\bevery\s+(.+)$/i);
    if (!everyMatch?.[1]) return null;
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const days = [];
    for (const token of everyMatch[1].replace(/[,&/]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ')) {
      if (weekdays.includes(token)) {
        if (!days.includes(token)) days.push(token);
        continue;
      }
      if ((token === 'and' || token === 'on') && days.length > 0) continue;
      break;
    }
    return days.length > 0 ? `weekly:${days.join(',')}` : null;
  }

  _stripScheduleRecurrenceFromTimeExpression(value) {
    const source = String(value || '').trim();
    if (!source) return source;
    const cleaned = source
      .replace(/^every\s+(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:and\s+|on\s+)?|,\s*)?)+\s+(?:at\s+)?/i, '')
      .replace(/^(?:every\s+(?:day|morning|evening|night|weekday|week)|daily|weekly)\s+(?:at\s+)?/i, '')
      .replace(/^at\s+/i, '')
      .trim();
    if (/^(?:every\s+(?:hour|two\s+hours?|2\s+hours?)|hourly)$/i.test(cleaned)) return '';
    return cleaned;
  }

_resolveExplicitTimerIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim();
    const raw = String(rawText || corrected || '').trim();
    const combined = `${raw} ${corrected}`.toLowerCase().replace(/\s+/g, ' ').trim();
    const durationWords = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\\s*five)?|sixty)';
    const durationUnits = '(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)';
    const timerRequest = new RegExp(
      `\\b(?:set|start|create|run)\\b.*\\btimers?\\b|` +
      `\\btimers?\\b.*\\b(?:for|of|at)\\s+${durationWords}|` +
      `\\b(?:set|start|create)\\b.*\\bcountdown\\b|` +
      `\\b(?:pomodoro|study|focus|break)\\s+(?:timer|session)\\b|` +
      `^(?:add|set|start|give\\s+me)\\s+(?:a\\s+)?time\\s+for\\s+${durationWords}\\s*${durationUnits}\\b|` +
      `^time\\s+me\\s+for\\s+${durationWords}\\s*${durationUnits}\\b`,
      'i'
    );
    if (!timerRequest.test(combined)) {
      return null;
    }

    const intent = this.intentRegistry.get('timer.set');
    if (!intent) {
      return null;
    }

    const entities = this.entityExtractor.extract(intent, raw);
    const correctedEntities = this.entityExtractor.extract(intent, corrected);
    if (!entities.duration && correctedEntities.duration) entities.duration = correctedEntities.duration;
    if (!entities.timeExpression && correctedEntities.timeExpression) entities.timeExpression = correctedEntities.timeExpression;
    if (!entities.duration && /\bpomodoro\b/i.test(combined)) entities.duration = 25;
    if (entities.timeExpression || entities.duration) {
      return { intent, confidence: 1, entities };
    }

    const timeExprMatch = raw.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
    if (timeExprMatch && timeExprMatch[1]) {
      entities.timeExpression = timeExprMatch[1].replace(/\s+/g, '');
      return { intent, confidence: 0.95, entities };
    }

    const morningTimeMatch = raw.match(/\bin\s+(?:the\s+)?morning\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
    if (morningTimeMatch && morningTimeMatch[1]) {
      entities.timeExpression = `morning at ${morningTimeMatch[1].replace(/\s+/g, '')}`;
      return { intent, confidence: 0.95, entities };
    }

    return null;
  }

  _resolveLocalInfoIntent(rawText, preparedInput) {
    const input = this._normalizeSystemCommandText(preparedInput?.correctedText || rawText);
    const publicKnowledgeContext = /\b(?:ipl|cricket|fifa|world\s+cup|match(?:es)?|fixtures?|schedule|score|scores|winner|winners|champion|champions|event|release|released|premiere|price|news|movie|movies)\b/.test(input);
    const systemTimeIntent = this.intentRegistry.get('system.time');
    const systemDateIntent = this.intentRegistry.get('system.date');
    const systemStatusIntent = this.intentRegistry.get('system.status');
    const systemCpuIntent = this.intentRegistry.get('system.cpu');
    const systemMemoryIntent = this.intentRegistry.get('system.memory');
    const systemProcessesIntent = this.intentRegistry.get('system.processes');
    const systemBatteryIntent = this.intentRegistry.get('system.battery');
    const systemDiskIntent = this.intentRegistry.get('system.disk');

    if (/\b(?:time)\b/.test(input) && /^(?:what|when|tell|show|current|time)\b/.test(input)) {
      return systemTimeIntent ? { intent: systemTimeIntent, confidence: 1, entities: {} } : null;
    }

    if (!publicKnowledgeContext && /\b(?:date|day|today)\b/.test(input) && /^(?:what|which|tell|show|current|date|day)\b/.test(input)) {
      return systemDateIntent ? { intent: systemDateIntent, confidence: 1, entities: {} } : null;
    }

    if (/\b(?:cpu|processor)\b/.test(input) && /\b(?:usage|status|use|using|load|percent|percentage|how\s+much|current)\b/.test(input)) {
      return systemCpuIntent ? { intent: systemCpuIntent, confidence: 1, entities: {} } : null;
    }

    if (/\b(?:ram|memory)\b/.test(input) && /\b(?:usage|status|use|using|used|available|free|left|about|how\s+much|current)\b/.test(input)) {
      return systemMemoryIntent ? { intent: systemMemoryIntent, confidence: 1, entities: {} } : null;
    }

    if (/\b(?:battery|charge|power)\b/.test(input) && /\b(?:status|level|percent|percentage|remaining|left|how\s+much|current|battery|charge)\b/.test(input)) {
      return systemBatteryIntent ? { intent: systemBatteryIntent, confidence: 1, entities: {} } : null;
    }

    if (/\b(?:disk|storage|drive|space)\b/.test(input) && /\b(?:space|storage|disk|drive|free|left|available|usage|used|status|how\s+much)\b/.test(input)) {
      return systemDiskIntent ? { intent: systemDiskIntent, confidence: 1, entities: {} } : null;
    }

    if (
      !/^(?:open|launch|start|run)\b/.test(input) &&
      /\b(?:running|open|opened|active|background|visible|in\s+use|being\s+used|used)\b/.test(input) &&
      /\b(?:apps?|applications?|processes|programs?|system)\b/.test(input)
    ) {
      const target = /\b(?:apps?|applications?|programs?|windows?)\b/.test(input) && !/\bprocesses\b/.test(input)
        ? 'apps'
        : 'processes';
      const queryApp = target === 'apps' ? this._extractRunningAppQuery(input) : '';
      return systemProcessesIntent
        ? {
            intent: systemProcessesIntent,
            confidence: 1,
            entities: queryApp ? { target, queryApp } : { target }
          }
        : null;
    }

    const queryApp = this._extractRunningAppQuery(input);
    if (queryApp && /\b(?:is|are|check|tell|whether|if|see)\b/.test(input) && /\b(?:running|open|opened|active|visible|in\s+use|being\s+used|used)\b/.test(input)) {
      return systemProcessesIntent
        ? { intent: systemProcessesIntent, confidence: 1, entities: { target: 'apps', queryApp } }
        : null;
    }

    if (/\b(?:system|computer|pc|laptop|machine)\b/.test(input) && /\b(?:status|health|usage|running|about|info|information|performance|condition|doing)\b/.test(input)) {
      return systemStatusIntent ? { intent: systemStatusIntent, confidence: 1, entities: {} } : null;
    }

    return null;
  }

  _extractRunningAppQuery(input) {
    const text = this._normalizeSystemCommandText(input);
    const patterns = [
      /\bif\s+(.+?)\s+(?:is|are)\s+(?:running|open|opened|active)\b/,
      /\b(?:is|are)\s+(.+?)\s+(?:is|are)\s+(?:running|open|opened|active)\b/,
      /\b(?:is|are)\s+(.+?)\s+(?:running|open|opened|active)\b/,
      /\b(?:check|tell\s+me|see)\s+(?:if|whether)\s+(.+?)\s+(?:is|are)\s+(?:running|open|opened|active)\b/,
      /\b(?:check|tell\s+me|see)\s+(.+?)\s+(?:running|open|opened|active)\b/,
      /\b(.+?)\s+(?:is|are)\s+(?:running|open|opened|active)\b/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      const candidate = match?.[1]
        ?.replace(/\b(?:the|app|application|program|window|and|what|which|apps?|are|running|open|opened|active|tell|me|check|if|whether)\b/g, ' ')
        .replace(/\b(?:is|are)\s*$/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (candidate && /^[a-z0-9][a-z0-9 ._-]{1,40}$/i.test(candidate)) {
        return candidate;
      }
    }

    return '';
  }

  _normalizeSystemCommandText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\bblue\s+tooth\b/g, 'bluetooth')
      .replace(/\bblu\s+tooth\b/g, 'bluetooth')
      .replace(/\bblutooth\b/g, 'bluetooth')
      .replace(/\bmemry\b/g, 'memory')
      .replace(/\bmemeory\b/g, 'memory')
      .replace(/\bstroage\b/g, 'storage')
      .replace(/\bproceses\b/g, 'processes')
      .replace(/\bproccesses\b/g, 'processes')
      .replace(/\bproccess\b/g, 'process')
      .replace(/\bopend\b/g, 'opened')
      .replace(/\bin\s+user\b/g, 'in use')
      .replace(/\busing\b/g, 'in use')
      .replace(/\s+/g, ' ');
  }

  _resolveAssistantConversationIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim().toLowerCase();
    const combined = `${raw} ${corrected}`.trim();
    const variants = [corrected, raw, combined].filter(Boolean);

    if (variants.some(text => /^(?:what|who)\s+(?:is|am)\s+(?:my|i)\s+(?:name|called)\b|^do\s+you\s+know\s+my\s+name\b/.test(text))) {
      const intent = this.intentRegistry.get('assistant.userName');
      return intent ? { intent, confidence: 1, entities: {} } : null;
    }

    if (variants.some(text => /^(?:what|who)\s+(?:is|are)\s+(?:your|you)\s+(?:name|called)\b|^who\s+are\s+you\b/.test(text))) {
      const intent = this.intentRegistry.get('assistant.identity');
      return intent ? { intent, confidence: 1, entities: {} } : null;
    }

    const greetingStartsCommand = variants.some(text =>
      /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening))\b(?=.*\b(?:open|launch|start|run|send|message|text|ask|tell|call|dial|phone|ring|remind|remember|set|create|delete|close|search|find|play|pause|move|copy|rename|list|show|turn|increase|decrease|lower|raise)\b)/.test(text)
    );

    if (!greetingStartsCommand && (
      variants.some(text => /^(?:how\s+are\s+you|how\s+do\s+you\s+do|are\s+you\s+(?:ok|okay|ready))\b/.test(text)) ||
      variants.some(text => /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening))\b/.test(text))
    )) {
      const intent = this.intentRegistry.get('greeting');
      if (!intent) {
        return null;
      }

      const asksWellbeing = variants.some(text =>
        /\b(?:how\s+are\s+you|how\s+do\s+you\s+do|are\s+you\s+(?:ok|okay|ready))\b/.test(text)
      );
      const greetingType = asksWellbeing
        ? 'wellbeing'
        : /\bgood\s+morning\b/.test(combined)
        ? 'morning'
        : /\bgood\s+afternoon\b/.test(combined)
          ? 'afternoon'
          : /\bgood\s+evening\b/.test(combined)
            ? 'evening'
            : /^how\s+are\s+you\b/.test(combined)
              ? 'wellbeing'
              : /^hi\b/.test(combined)
                ? 'hi'
                : /^hey\b/.test(combined)
                  ? 'hey'
                  : 'hello';
      return { intent, confidence: 1, entities: { greetingType } };
    }

    if (
      /\b(?:what\s+can\s+you\s+do|what\s+can\s+i\s+say|show\s+help|help\s+me|how\s+do\s+you\s+help\s+me)\b/.test(combined) ||
      /\b(?:your\s+(?:work|job|role|purpose|capabilities|commands)|you\s+do\s+for\s+me)\b/.test(combined)
    ) {
      const intent = this.intentRegistry.get('help');
      return intent ? { intent, confidence: 1, entities: {} } : null;
    }

    return null;
  }

  _resolveCalculationIntent(rawText, preparedInput) {
    const input = String(rawText || preparedInput?.correctedText || '').trim();
    if (!input) {
      return null;
    }

    const expression = this._extractCalculationExpression(input) ||
      this._extractCalculationExpression(preparedInput?.correctedText);
    if (!expression) {
      return null;
    }

    const calculateIntent = this.intentRegistry.get('system.calculate');
    return calculateIntent
      ? { intent: calculateIntent, confidence: 1, entities: { expression } }
      : null;
  }

  _extractCalculationExpression(input) {
    const text = String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\behat\b/g, 'what')
      .replace(/\bteh\b/g, 'the');

    if (!text) {
      return null;
    }

    if (/https?:\/\//.test(text) || /\b(?:github|hacker\s*rank|linkedin|facebook|twitter|instagram|youtube|google|amazon|netflix|spotify)\b/i.test(text)) {
      return null;
    }

    const withoutLead = text
      .replace(/^(?:what\s+is|what's|calculate|solve|answer|find|tell\s+me)\s+/i, '')
      .replace(/^(?:the\s+)?(?:value|answer|result)\s+of\s+/i, '')
      .trim();

    const candidate = withoutLead || text;
    if (this._looksLikeCalculationExpression(candidate)) {
      return candidate;
    }

    const symbolSegments = candidate.match(/[-+*/%^().,\d\s]+/g) || [];
    const bestSegment = symbolSegments
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0)
      .sort((left, right) => right.length - left.length)
      .find(segment => this._looksLikeCalculationExpression(segment));

    return bestSegment || null;
  }

  _looksLikeCalculationExpression(candidate) {
    const text = String(candidate || '').trim();
    if (!text || !/\d/.test(text)) {
      return false;
    }

    const operatorWords = [
      'plus',
      'add',
      'minus',
      'subtract',
      'times',
      'multiply',
      'multiplied',
      'divide',
      'divided',
      'over',
      'power',
      'squared',
      'cubed',
      'root',
      'percent'
    ];
    const hasOperator = /[+\-*/%^]/.test(text) ||
      new RegExp(`\\b(?:${operatorWords.join('|')})\\b`, 'i').test(text);
    if (!hasOperator) {
      return false;
    }

    const allowedWords = [
      ...operatorWords,
      'by',
      'of',
      'to',
      'the',
      'square',
      'sqrt',
      'absolute',
      'abs'
    ];
    const wordMatches = text.match(/[a-z]+/gi) || [];
    return wordMatches.every(word => allowedWords.includes(word.toLowerCase())) &&
      /^[\d\s+\-*/%^().,%a-z]+$/i.test(text);
  }

  _resolveLocalFileListIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const query = preparedInput?.query || {};
    if (!/\b(?:file|files|folder|folders|items|contents|pdf|pdfs|images?|photos?|pictures?|videos?|audio|music)\b/.test(input)) {
      return null;
    }

    const listRequest = query.isLocalFileQuestion || (
      /^(?:what|which|show|list|tell)\b/.test(input) &&
      /\b(?:are|is|in|on|inside|under|from|files|folders|items|contents)\b/.test(input)
    );
    if (!listRequest) {
      return null;
    }

    const localLocation = query.localLocation || this._extractLocalListLocation(input);
    if (!localLocation) {
      return null;
    }

    const fileListIntent = this.intentRegistry.get('file.list');
    return fileListIntent
      ? { intent: fileListIntent, confidence: 1, entities: { path: localLocation, fileType: query.requestedFileType || null } }
      : null;
  }

  _resolveLocalFileSearchIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim();
    const lower = input.toLowerCase();
    if (!/^(?:locate|find|search|look(?:\s+(?:inside|in|for))?|where\s+is|where\s+are|what\s+is\s+the\s+location\s+of|show\s+me\s+where)\b/.test(lower)) {
      return null;
    }
    if (/^search(?:\s+for)?\b/i.test(lower) && this._looksLikeWebSearchQuery(lower)) {
      return null;
    }
    const extractedQuery = this._extractLocalFileSearchQuery(rawText || input, input);
    const requestedType = String(preparedInput?.query?.requestedFileType || '').trim().toLowerCase();
    const noisyLocalQuery = /^(?:look|search|find)\b|\b(?:inside|in|on|from|downloads?|documents?|desktop|pictures?|folders?)\b/.test(extractedQuery);
    const query = requestedType && (!extractedQuery || noisyLocalQuery)
      ? requestedType
      : extractedQuery;
    if (!query) {
      return null;
    }
    const fileEvidence = `${input} ${rawText || ''}`;
    const hasLocalFileEvidence =
      /\b(?:file|files|folder|folders|directory|location|path|pdf|pdfs|document|documents|docx?|xlsx?|pptx?|csv|json|image|images|photo|photos|picture|pictures|video|videos|screenshot|screenshots|downloaded|downloads|duplicate|duplicates)\b/i.test(fileEvidence) ||
      /[^\s]+\.[A-Za-z0-9]{1,10}\b/i.test(fileEvidence);
    if (!/^(?:locate)\b/i.test(input) && !hasLocalFileEvidence) {
      return null;
    }

    const folderOnlySearch = /\b(?:folder|folders|directory|directories)\b/i.test(fileEvidence) &&
      !/\b(?:file|files|pdf|pdfs|document|documents|docx?|xlsx?|pptx?|csv|json|image|images|photo|photos|picture|pictures|video|videos)\b/i.test(fileEvidence);
    const intent = this.intentRegistry.get(folderOnlySearch ? 'folder.search' : 'file.search');
    if (!intent) {
      return null;
    }

    return { intent, confidence: 1, entities: { query } };
  }

  _extractLocalFileSearchQuery(rawText, correctedText = rawText) {
    const clean = value => String(value || '')
      .trim()
      .replace(/^(?:locate|find|search|serch|seach|searh|saerch|serach)(?:\s+for)?\s+/i, '')
      .replace(/^look(?:\s+(?:inside|in|for))?\s+/i, '')
      .replace(/^(?:inside|in|from|on)\s+(?:my\s+)?(?:desktop|downloads?|documents?|pictures?|photos?|videos?|music|folders?)\s+(?:for\s+)?/i, '')
      .replace(/^(?:where\s+(?:is|are|i)|whare\s+i|what\s+is\s+the\s+location\s+of|show\s+me\s+where)\s+/i, '')
      .replace(/^(?:(?:the|a|an|my)\s+)?(?:file|folder|foldr|floder|foler|directory|diretory|dirctory)\s+/i, '')
      .replace(/^(?:the|a|an|my)\s+/i, '')
      .replace(/\s+(?:on|in)\s+(?:my\s+)?(?:computer|pc|laptop|system|files?|folders?)$/i, '')
      .replace(/\s+(?:file|folder|foldr|floder|foler|directory|diretory|dirctory|location|path)$/i, '')
      .replace(/\b([a-z0-9_-]+)\s+(pdf|txt|docx?|xlsx?|pptx?|csv|json|xml|html?|js|ts|py|java|md|png|jpe?g|gif|webp|mp[34]|mkv|wav|zip|rar)$/i, '$1.$2')
      .trim();

    const source = String(rawText || '').trim();
    const fallback = String(correctedText || '').trim();
    const sourceQuery = clean(source);
    const fallbackQuery = clean(fallback);
    const query = sourceQuery && sourceQuery !== source
      ? sourceQuery
      : fallbackQuery && fallbackQuery !== fallback
        ? fallbackQuery
        : sourceQuery;
    return query && !/^(?:file|folder|directory|location|path)$/i.test(query)
      ? query.toLowerCase()
      : '';
  }

  _resolveVisualPhotoSearchIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim().toLowerCase();
    const normalizedRaw = this._normalizePhotoSearchText(raw);
    const normalizedCorrected = this._normalizePhotoSearchText(corrected);
    const input = Array.from(new Set([normalizedRaw, normalizedCorrected].filter(Boolean))).join(' ');
    const queryInput = normalizedRaw || normalizedCorrected || input;
    if (!input) {
      return null;
    }

    if (this._isExplicitExternalPhotoSurface(input)) {
      return null;
    }

    if (/\bduplicates?\b/.test(input)) {
      return null;
    }

    if (/\b(?:microsoft\s+photos|windows\s+photos|photos\s+app)\b/.test(input)) {
      const intent = this.intentRegistry.get('app.open');
      return intent ? { intent, confidence: 0.92, entities: { appName: 'photos' } } : null;
    }

    const hasPhotoTerm = /\b(?:photos?|pictures?|images?|pics?|photo\s+memories|visual\s+memories)\b/.test(input);
    if (!hasPhotoTerm) {
      return null;
    }

    const hasSearchAction = /\b(?:find|show|search|look\s+for|look|get|bring|display)\b/.test(input);
    if (!hasSearchAction) {
      return null;
    }

    if (/^(?:open|show|view|launch|display)\s+(?:my\s+)?(?:openx\s+)?(?:gallery|galary|gallary|galleary|photos?|pictures?|photo\s+library|memories)$/.test(input)) {
      const intent = this.intentRegistry.get('visualMemory.openGallery');
      return intent ? { intent, confidence: 0.99, entities: { view: 'timeline' } } : null;
    }

    const hasVisualTarget = this._hasVisualPhotoSearchTarget(input);
    if (!hasVisualTarget && /\b(?:file|folder|directory|path)\b/.test(input)) {
      return null;
    }

    const intent = this.intentRegistry.get('visualMemory.search');
    return intent
      ? {
          intent,
          confidence: hasVisualTarget ? 0.95 : 0.9,
          entities: {
            query: this._extractVisualPhotoSearchQuery(queryInput),
            personalSearchType: 'photo'
          }
        }
      : null;
  }

  _normalizePhotoSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\bphotes\b/g, 'photos')
      .replace(/\bphots\b/g, 'photos')
      .replace(/\bpics?\b/g, 'photos')
      .replace(/\bclassmetes\b/g, 'classmates')
      .replace(/\bclassm[eai]tes\b/g, 'classmates')
      .replace(/\bmoanitains?\b/g, 'mountains')
      .replace(/\bbetchs?\b/g, 'beaches')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _isExplicitExternalPhotoSurface(input) {
    return /\bgoogle\s+photos?\b|\bphotos\.google\.com\b/.test(String(input || ''));
  }

  _hasVisualPhotoSearchTarget(input) {
    const text = String(input || '');
    if (/\b(?:dad|daddy|father|papa|appa|mom|mum|mummy|mother|mama|amma|parents?|brothers?|sisters?|grandpa|grandma|friend|friends|family|classmates?|me|myself|mine)\b/.test(text)) {
      return true;
    }
    if (/\b(?:latest|newest|recent|today|yesterday|this\s+week|last\s+week|this\s+month|last\s+month|on\s+\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/.test(text)) {
      return true;
    }
    if (/\b(?:of|with|containing|contains?|showing|near|at|in|from)\s+[a-z0-9]/.test(text)) {
      return true;
    }
    if (findVisualConcepts(text).length > 0) {
      return true;
    }
    return false;
  }

  _extractVisualPhotoSearchQuery(input) {
    const text = this._normalizePhotoSearchText(input)
      .replace(/^(?:please\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+)?(?:find|show|search|look\s+for|look|get|bring|display)\s+(?:me\s+)?/i, '')
      .replace(/\b(?:openx\s+)?(?:photo\s+memories|visual\s+memories)\b/g, 'photos')
      .trim();
    return text || 'photos';
  }

  _resolvePersonalPhotoIntent(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const raw = String(rawText || corrected || '').trim().toLowerCase();
    const input = this._normalizePhotoSearchText(`${raw} ${corrected}`);

    if (!/\b(?:find|show|open|search|look)\b/.test(input)) {
      return null;
    }

    if (!/\b(?:photos?|pictures?|images?)\b/.test(input)) {
      return null;
    }

    const relationshipCue = /\b(?:dad|daddy|father|papa|appa|mom|mum|mummy|mother|mama|amma|parents?|brothers?|sisters?)\b/.test(input);
    const personalCue = relationshipCue ||
      /\b(?:my|me|mine|class|classmates|friends?|family|recent|memories|google\s+photos?|photos\s+app|in\s+the\s+photos?)\b/.test(input);
    if (!personalCue) {
      return null;
    }

    const photoLibrary = this.learningStore?.getPreference?.('photoLibrary')?.value || '';
    const selfOrRelationshipCue = relationshipCue || /\b(?:me|myself|mine|family)\b/.test(input);
    const wantsGooglePhotos = this._isExplicitExternalPhotoSurface(input) ||
      (photoLibrary === 'googlePhotos' && !selfOrRelationshipCue);
    if (wantsGooglePhotos) {
      const intent = this.intentRegistry.get('browser.siteSearch');
      return intent
        ? {
            intent,
            confidence: 0.95,
            entities: {
              site: 'google photos',
              query: this._extractPersonalPhotoQuery(input)
            }
          }
        : null;
    }

    const wantsWindowsPhotos = /\b(?:microsoft\s+photos|windows\s+photos|photos\s+app)\b/.test(input) ||
      photoLibrary === 'windowsPhotos';
    if (wantsWindowsPhotos) {
      const intent = this.intentRegistry.get('app.open');
      return intent ? { intent, confidence: 0.92, entities: { appName: 'photos' } } : null;
    }

    const visualIntent = this.intentRegistry.get('visualMemory.search');
    if (visualIntent) {
      return {
        intent: visualIntent,
        confidence: 0.96,
        entities: {
          query: this._extractPersonalPhotoQuery(input),
          personalSearchType: 'photo'
        }
      };
    }

    const intent = this.intentRegistry.get('file.search');
    return intent
      ? {
          intent,
          confidence: 0.95,
          entities: {
            query: this._extractPersonalPhotoQuery(input),
            personalSearchType: 'photo'
          }
        }
      : null;
  }

  _extractPersonalPhotoQuery(input) {
    const text = String(input || '')
      .toLowerCase()
      .replace(/\bclassmetes\b/g, 'classmates')
      .replace(/\bclassm[eai]tes\b/g, 'classmates');
    const priorityTerms = [
      ['classmates', /\b(?:classmates?|class\s+mates?|college\s+friends?|school\s+friends?)\b/],
      ['friends', /\bfriends?\b/],
      ['me', /\b(?:me|myself|mine)\b/],
      ['dad', /\b(?:dad|daddy|father|papa|appa)\b/],
      ['mom', /\b(?:mom|mum|mummy|mother|mama|amma)\b/],
      ['parents', /\bparents?\b/],
      ['brother', /\bbrothers?\b/],
      ['sister', /\bsisters?\b/],
      ['family', /\bfamily\b/],
      ['recent', /\brecent\b/]
    ];
    const matched = priorityTerms
      .filter(([, pattern]) => pattern.test(text))
      .map(([term]) => term);
    return matched.length > 0
      ? Array.from(new Set(matched)).join(' ')
      : 'photos';
  }

  _extractLocalListLocation(input) {
    const locations = ['desktop', 'downloads', 'documents', 'pictures', 'music', 'videos', 'home'];
    for (const location of locations) {
      if (new RegExp(`\\b${location}\\b`, 'i').test(input)) {
        return location;
      }
    }

    return null;
  }

  _resolveGeneralQuestionSearchIntent(rawText, preparedInput) {
    const input = String(preparedInput?.correctedText || rawText || '').trim().toLowerCase();
    const query = preparedInput?.query || {};
    if (!/^(what|who|when|where|why|how|which)\b/.test(input) && !query.isKnowledgeQuestion) {
      return null;
    }

    const intentTokens = Array.isArray(preparedInput?.intentTokens) ? preparedInput.intentTokens : [];
    if (intentTokens.length === 0) {
      return null;
    }

    const browserSearchIntent = this.intentRegistry.get('browser.search');
    return browserSearchIntent
      ? { intent: browserSearchIntent, confidence: 0.92, entities: this._buildSearchEntities(rawText, preparedInput) }
      : null;
  }

  _buildSearchEntities(rawText, preparedInput) {
    const corrected = String(preparedInput?.correctedText || rawText || '').trim();
    const raw = String(rawText || corrected || '').trim();
    const isQuestion = /^(?:what|who|when|where|why|how|which)\b/i.test(corrected || raw);
    const rawSearchQuery = this._extractRawSearchQuery(raw);
    let query = isQuestion
      ? (corrected || raw)
      : (rawSearchQuery ||
        this.entityExtractor._extractQuery(corrected.toLowerCase(), corrected) ||
        this.entityExtractor._extractQuery(corrected.toLowerCase(), raw) ||
        raw ||
        corrected);
    const browserHintSource = `${raw} ${corrected}`.trim();
    const browserName = this._extractBrowserNameHint(browserHintSource);
    const openInBrowser = /\b(?:open|show|search|look\s+up|google).*\b(?:in|on)\s+(?:chrome|browser|edge|firefox)\b/i.test(browserHintSource)
      || /\bnew\s+tab\b/i.test(browserHintSource)
      || /\b(?:open|show)\s+(?:it|results?)\s+(?:in|on)\s+(?:chrome|browser|edge|firefox)\b/i.test(browserHintSource);

    query = String(query || '')
      .replace(/\s+(?:in|on)\s+new\s+tab(?:\s+(?:in|on)\s+(?:chrome|browser|edge|firefox))?\s*$/i, '')
      .replace(/\s+new\s+tab(?:\s+(?:in|on)\s+(?:chrome|browser|edge|firefox))?\s*$/i, '')
      .replace(/\s+(?:in|on)\s+(?:chrome|browser|edge|firefox)\s*$/i, '')
      .trim();

    return {
      query,
      openInBrowser,
      ...(browserName ? { browserName } : {})
    };
  }

  _extractBrowserNameHint(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    const browserMatch = text.match(/\b(?:in|on|with|using)\s+(?:the\s+)?(chrome|browser|edge|firefox)\b/);
    if (browserMatch?.[1]) return browserMatch[1];
    if (/\bnew\s+tab\s+(?:in|on)\s+(?:the\s+)?chrome\b/.test(text)) return 'chrome';
    if (/\bnew\s+tab\s+(?:in|on)\s+(?:the\s+)?edge\b/.test(text)) return 'edge';
    if (/\bnew\s+tab\s+(?:in|on)\s+(?:the\s+)?firefox\b/.test(text)) return 'firefox';
    return '';
  }

  _extractRawSearchQuery(rawText) {
    const text = String(rawText || '').trim();
    if (!text) {
      return '';
    }

    const match = text.match(/^(?:could\s+you\s+please\s+|can\s+you\s+please\s+|please\s+)?(?:search\s+for|search\s+the\s+web\s+for|search\s+web\s+for|search\s+web|search|google|look\s+up|find\s+on\s+web|tell\s+(?:me\s+)?about|give\s+me\s+details\s+(?:about|of))\s+(.+)$/i);
    if (!match?.[1]) {
      return '';
    }

    return match[1]
      .replace(/\s+(?:in|on)\s+new\s+tab(?:\s+(?:in|on)\s+(?:chrome|browser|edge|firefox))?\s*$/i, '')
      .replace(/\s+new\s+tab(?:\s+(?:in|on)\s+(?:chrome|browser|edge|firefox))?\s*$/i, '')
      .replace(/\s+(?:in|on)\s+(?:chrome|browser|edge|firefox)\s*$/i, '')
      .trim();
  }

  _suggestAlternatives(preparedInput) {
    const rankedPatterns = [];

    for (const candidate of this.nlp.getPreparedIntentPatterns()) {
      rankedPatterns.push({
        pattern: candidate.pattern,
        confidence: this.nlp.scorePattern(preparedInput, candidate.prepared)
      });
    }

    return rankedPatterns
      .sort((left, right) => right.confidence - left.confidence)
      .filter(candidate => candidate.confidence >= 0.25)
      .slice(0, 3)
      .map(candidate => candidate.pattern);
  }

  _containsActionVerb(text, verbs) {
    const normalizedText = String(text || '').trim().toLowerCase();
    if (!normalizedText) {
      return false;
    }

    const tokens = normalizedText.split(/\s+/).filter(Boolean);
    const candidates = new Set();
    const firstToken = tokens[0] || '';

    tokens.forEach((token, index) => {
      candidates.add(token);
      if (index < tokens.length - 1) {
        candidates.add(`${token} ${tokens[index + 1]}`);
      }
    });

    return Array.from(candidates).some(candidate => {
      if (verbs.includes(candidate)) {
        return true;
      }

      return false;
    }) || Boolean(Normalizer.findClosestOption(firstToken, verbs, {
      minSimilarity: 0.58,
      maxDistance: firstToken.length >= 5 ? 2 : 1
    }));
  }

  _checkRequiredEntities(intent, entities) {
    const missing = [];
    if (!intent.entities) return missing;

    intent.entities.forEach(def => {
      if (!def.required) return;

      const value = entities[def.name];
      if (value === null || value === undefined || value === '') {
        missing.push(def.name);
      }
    });

    return missing;
  }

  _shouldSuggestAlternatives(preparedInput = {}) {
    const tokens = Array.isArray(preparedInput.tokens) && preparedInput.tokens.length
      ? preparedInput.tokens
      : Normalizer.tokenize(preparedInput.correctedText || preparedInput.intentText || '');
    if (!tokens.length) {
      return false;
    }

    const actionTokens = new Set([
      'ask',
      'call',
      'close',
      'copy',
      'create',
      'delete',
      'fill',
      'find',
      'launch',
      'look',
      'message',
      'move',
      'open',
      'play',
      'read',
      'remind',
      'rename',
      'run',
      'search',
      'send',
      'set',
      'show',
      'start',
      'switch',
      'tell',
      'turn'
    ]);

    return tokens.some(token => actionTokens.has(token));
  }

  _extractUrl(value) {
    const match = String(value || '').match(/https?:\/\/[^\s"'<>]+/i);
    return match ? match[0].replace(/[.,;!?]+$/g, '') : '';
  }

  _buildResponse(type, template, context) {
    return this.responseGenerator.generate(type, template, context);
  }

  _trySearchFallback(rawCommandText, preparedInput) {
    const text = String(rawCommandText || '').trim();
    if (!text) return null;

    const browserSearchIntent = this.intentRegistry.get('browser.search');
    if (!browserSearchIntent) return null;

    const normalized = String(preparedInput?.correctedText || text).trim().toLowerCase();
    const explicitSearch = /^(?:search|google|look up|find on web|search the web|tell me about|what about)\b/i.test(normalized);
    const knowledgeQuestion = /^(?:what|who|when|where|why|how|which)\b/i.test(normalized) &&
      !/\b(?:running|open|opened|active|visible|in\s+use|being\s+used|used|system|computer|pc|laptop|file|folder|remind|reminders?|alarms?|timers?)\b/i.test(normalized);
    const hasKnowledgeSignal = this._looksLikeWebSearchQuery(normalized) ||
      /\b(?:ipl|cricket|fifa|world\s+cup|match(?:es)?|fixtures?|schedule|score|scores|winner|winners|champion|champions|event|release|released|premiere|price|latest|current|today'?s?|news|best|top|list|movie|movies|paper|journal|research|documentation|docs|tutorials?|examples?|guide)\b/.test(normalized);
    if (!explicitSearch && !(knowledgeQuestion && hasKnowledgeSignal)) {
      return null;
    }

    const searchQuery = text
      .replace(/^(?:search\s+for|search\s+the\s+web\s+for|search\s+web\s+for|search\s+web|search|google|look\s+up|find\s+on\s+web|find|what\s+is|who\s+is|where\s+is|tell\s+me|can\s+you|please|tell\s+me\s+about|what\s+about)\s+/i, '')
      .replace(/^(?:for|in)\s+/i, '')
      .trim();

    if (searchQuery && searchQuery.length > 1 && !/^(?:for|in|on|about|me|it|that|this)$/i.test(searchQuery)) {
      return {
        commandId: IdGenerator.generate(),
        success: true,
        intent: 'browser.search',
        confidence: 0.5,
        entities: { query: searchQuery },
        response: this._buildResponse('success', 'browser.search', {
          entities: { query: searchQuery },
          result: { data: { query: searchQuery } }
        })
      };
    }

    const helpIntent = this.intentRegistry.get('help');
    if (helpIntent && /^(?:how does this work|what can i say|help|commands|how to)\b/i.test(text)) {
      return {
        commandId: IdGenerator.generate(),
        success: true,
        intent: 'help',
        confidence: 0.6,
        entities: {},
        response: this._buildResponse('success', 'help', { entities: {} })
      };
    }

    return null;
  }

  _verifyResolvedIntent(rawInput, intent, entities) {
    if (!rawInput || !intent) {
      return { verified: true, confidence: 1.0, warnings: [] };
    }

    const text = String(rawInput || '').toLowerCase().trim();
    const tokens = Normalizer.tokenize(text);

    const stopWords = new Set([
      'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'please',
      'now', 'just', 'also', 'then', 'than', 'that', 'this', 'these', 'those'
    ]);

    const significantTokens = tokens.filter(t =>
      t.length > 1 && !stopWords.has(t) && !/^\d+$/.test(t)
    );

    const intentWords = new Set();
    const intentId = String(intent.id || '').toLowerCase();
    const intentAction = String(intent.action || '').toLowerCase();

    intentWords.add(intentId);
    intentWords.add(intentAction);

    if (entities) {
      for (const value of Object.values(entities)) {
        if (value && typeof value === 'string') {
          const valueTokens = Normalizer.tokenize(String(value).toLowerCase());
          valueTokens.forEach(t => intentWords.add(t));
        }
      }
    }

    const unmatchedTokens = significantTokens.filter(token => {
      for (const intentWord of intentWords) {
        if (intentWord.includes(token) || token.includes(intentWord)) {
          return false;
        }
        if (this._tokensSimilar(token, intentWord)) {
          return false;
        }
      }
      return true;
    });

    const warnings = [];
    if (unmatchedTokens.length > 0 && unmatchedTokens.length >= significantTokens.length * 0.4) {
      warnings.push(`Command contains unmatched words: ${unmatchedTokens.join(', ')}`);
    }

    let verificationConfidence = 1.0;
    if (unmatchedTokens.length > 0) {
      verificationConfidence = Math.max(0.3, 1.0 - (unmatchedTokens.length * 0.15));
    }

    return {
      verified: unmatchedTokens.length < significantTokens.length * 0.4,
      confidence: verificationConfidence,
      warnings,
      unmatchedTokens,
      matchedTokens: significantTokens.filter(t => !unmatchedTokens.includes(t))
    };
  }

  _tokensSimilar(a, b) {
    if (!a || !b || a.length < 3 || b.length < 3) return false;
    if (a === b) return true;

    let matches = 0;
    const maxComparisons = Math.min(a.length, b.length, 3);
    for (let i = 0; i < maxComparisons; i++) {
      if (a[i] === b[i]) matches++;
    }
    return matches >= 2;
  }
}

module.exports = ActionRouter;
