# OpenX Repository Report

Report date: 2026-07-09

Repository: `C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX`

Package: `openx@5.5.1`

Runtime: Electron 28, Node.js, CommonJS

## Summary

OpenX is a deterministic, local-first Windows desktop assistant. The app accepts commands from desktop chat, voice, phone, cloud relay, plugins, and future structured input sources, then routes them through the existing assistant boundary without changing the public `Assistant.processCommand(input, source, options)` contract.

The current codebase includes a staged assistant intelligence pipeline for input acquisition, language normalization, linguistic and semantic analysis, entity extraction, memory/context resolution, reasoning, planning, decision/validation, verification, response shaping, and learning.

`Assistant.processCommand()` now delegates to `AssistantEngine`, which owns the command-processing entry boundary. The pipeline still preserves current behavior through the existing router path while migration continues.

## Repository Scan

Filtered scan excludes generated or local-heavy directories:

```text
.git/
node_modules/
dist/
.code-review-graph/
.codex/
.cursor/
graphify-out/
```

Current filtered counts:

| Area | Files | Tests |
|---|---:|---:|
| `apps` | 114 | 0 |
| `build` | 5 | 0 |
| `core` | 447 | 0 |
| `docs` | 9 | 0 |
| `models` | 4 | 0 |
| `plugins` | 12 | 0 |
| `scripts` | 2 | 0 |
| `tests` | 67 | 67 |

Total filtered files: 670

Total filtered directories: 72

JavaScript files: 629

Test files: 67

## Verification

Commands run:

```powershell
npm run lint
npx mocha "tests/**/*.test.js" --timeout 20000
```

Results:

```text
ESLint: clean
Mocha: 842 passing
```

During verification, the full suite initially exposed one stale architecture test that still expected newer assistant subdirectories to be absent. That expectation conflicted with the current repo layout, so `tests/core/architecture-structure.test.js` was updated to accept the current architecture.

Lint also exposed small repo-level issues, now fixed:

- `core/assistant/acquisition/InputMetadataBuilder.js`: use `globalThis.Intl`
- `core/assistant/acquisition/LanguageDetector.js`: use `globalThis.Intl`
- `core/assistant/router.js`: removed unused `EXPLICIT_FILE_DOMAIN_PATTERN`
- `core/cloud/CloudCommandManager.js`: changed constant-condition `while (true)` to `for (;;)`

The error log lines printed during tests are expected negative-path assertions, including unknown actions, protected path deletion, parser failure simulation, timeout simulation, and plugin namespace rejection.

## Architecture

Primary runtime flow:

```text
Input source
  -> Assistant.processCommand()
  -> AssistantEngine
  -> InputSourceManager
  -> RawUserInput
  -> Assistant intelligence pipeline
  -> LanguageNormalizationStage
  -> LinguisticUnderstandingStage
  -> SemanticUnderstandingStage
  -> EntityUnderstandingStage
  -> MemoryContextStage
  -> GoalIntentReasoningStage
  -> TaskPlanningStage
  -> DecisionValidationAutomationStage
  -> VerificationResponseStage
  -> AssistantPassthroughStage
  -> LearningStage
  -> legacy assistant router and automation boundary
```

Important compatibility point:

`LearningStage` runs after pass-through and returns the original pass-through payload, so the current command input, source, options, router behavior, and response remain unchanged.

## Main Areas

| Area | Path | Responsibility |
|---|---|---|
| Desktop shell | `apps/desktop/` | Electron lifecycle, renderer windows, settings, preload APIs, permissions, voice UI |
| Voice | `apps/desktop/voice/` | Audio capture, preprocessing, STT, normalization, diagnostics, TTS, Dynamic Island UI |
| Assistant legacy core | `core/assistant/*.js` | Public command flow, NLP/NLU/parser/router/entities/responses/context/active learning |
| Assistant intelligence pipeline | `core/assistant/{acquisition,normalization,linguistic,semantic,entities,memory,reasoning,planning,decision,validation,automation,verification,response,learning}/` | Sidecar staged intelligence layers, immutable results, diagnostics, registries |
| Automation | `core/automation/` | App, browser, files, folders, media, scheduler, system, volume, brightness, windows |
| Phone | `core/phone/` | Pairing, session security, permissions, command routing, file transfer |
| Cloud | `core/cloud/` | Optional relay connection, cloud commands, cloud file transfer, presence, notifications |
| Context awareness | `core/context-awareness/` | Active window, app registry, process signals, modes |
| Plugins | `plugins/` | Plugin controller and restricted plugin packages |
| Tests | `tests/` | Automation, assistant, phone, voice, UI, learning, security, context regression coverage |

## Pipeline Ownership Migration

Current status:

- `Assistant.processCommand()` delegates directly to `AssistantEngine`.
- `AssistantEngine` owns input acquisition, pipeline execution, fallback handling, and the bridge into the existing execution path.
- Dependency audit scanned 629 JavaScript files and 1,633 local `require()` edges.
- No direct circular dependency pairs were found in the scanned local dependency graph.
- Legacy modules are still intentionally retained because production and tests still depend on them.

Remaining legacy consumers:

| Legacy module | Current direct consumers |
|---|---|
| `core/assistant/parser.js` | `core/assistant/router.js`, parser/context/learning tests |
| `core/assistant/entities.js` | new entity extractors that reuse existing app/folder behavior |
| `core/assistant/intents.js` | `core/assistant/router.js`, intent/NLU tests |
| `core/assistant/responses.js` | `core/assistant/index.js`, `core/assistant/router.js`, voice response coordinator, response tests |
| `core/assistant/language.js` | NLP, NLU, parser |
| `core/assistant/nlu.js` | `core/assistant/router.js`, app/browser/NLU tests |

No legacy files were deleted. They should be removed only after each direct consumer is migrated to immutable pipeline outputs and full regression coverage remains green.

## Assistant Intelligence Modules

| Module | Directory | Immutable output |
|---|---|---|
| Entity understanding | `core/assistant/entities/` | `StructuredEntities` |
| Memory and context | `core/assistant/memory/`, `core/assistant/context/`, `core/assistant/references/` | `ResolvedContext` |
| Goal and intent reasoning | `core/assistant/reasoning/` | `ReasoningResult` |
| Task planning | `core/assistant/planning/` | `ExecutionBlueprint` |
| Decision, validation, automation | `core/assistant/decision/`, `core/assistant/validation/`, `core/assistant/automation/` | `AutomationResult` |
| Verification and response | `core/assistant/verification/`, `core/assistant/response/` | `VerificationResult`, `AssistantResponse` |
| Learning | `core/assistant/learning/` | `LearningResult` |

## Directory Tree

Generated from the current workspace with generated/heavy folders excluded. This tree includes both folders and files.

```text
OpenX/
|-- apps/
|   +-- desktop/
|       |-- electron/
|       |   |-- crash-recovery.js
|       |   |-- main.js
|       |   +-- security.js
|       |-- renderer/
|       |   |-- chat/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   +-- index.js
|       |   |-- planner/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   +-- index.js
|       |   |-- settings/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   +-- index.js
|       |   |-- timer-widget/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   +-- index.js
|       |   +-- voice-capture/
|       |       |-- index.html
|       |       +-- index.js
|       |-- voice/
|       |   |-- audio/
|       |   |   |-- AudioBuffer.js
|       |   |   |-- AudioCapture.js
|       |   |   |-- AudioConfiguration.js
|       |   |   |-- AudioDeviceManager.js
|       |   |   |-- AudioErrors.js
|       |   |   |-- AudioEvents.js
|       |   |   |-- AudioFrame.js
|       |   |   |-- AudioPermissions.js
|       |   |   +-- index.js
|       |   |-- config/
|       |   |   +-- VoiceSettings.js
|       |   |-- diagnostics/
|       |   |   |-- DiagnosticsConfiguration.js
|       |   |   |-- DiagnosticsErrors.js
|       |   |   |-- DiagnosticsEvents.js
|       |   |   |-- DiagnosticsManager.js
|       |   |   |-- DiagnosticsReport.js
|       |   |   |-- ErrorTracker.js
|       |   |   |-- EventTimeline.js
|       |   |   |-- HealthMonitor.js
|       |   |   |-- index.js
|       |   |   |-- LatencyMonitor.js
|       |   |   |-- MetricsCollector.js
|       |   |   |-- PerformanceMonitor.js
|       |   |   |-- privacy.js
|       |   |   |-- ResourceMonitor.js
|       |   |   |-- SessionStatistics.js
|       |   |   |-- VoiceLogger.js
|       |   |   +-- VoiceMetrics.js
|       |   |-- integration/
|       |   |   |-- AssistantDispatcher.js
|       |   |   |-- AssistantInputAdapter.js
|       |   |   |-- index.js
|       |   |   |-- VoiceAssistantBridge.js
|       |   |   |-- VoiceExecutionCoordinator.js
|       |   |   |-- VoiceIntegrationConfiguration.js
|       |   |   |-- VoiceIntegrationErrors.js
|       |   |   |-- VoiceIntegrationEvents.js
|       |   |   +-- VoiceResponseHandler.js
|       |   |-- normalization/
|       |   |   |-- AcronymNormalizer.js
|       |   |   |-- ApplicationNormalizer.js
|       |   |   |-- CommandNormalizer.js
|       |   |   |-- DictionaryNormalizer.js
|       |   |   |-- index.js
|       |   |   |-- NormalizationConfiguration.js
|       |   |   |-- NormalizationErrors.js
|       |   |   |-- NormalizationEvents.js
|       |   |   |-- NormalizedTranscript.js
|       |   |   |-- TechnologyNormalizer.js
|       |   |   |-- TextCleaner.js
|       |   |   |-- TextValidator.js
|       |   |   |-- TranscriptNormalizer.js
|       |   |   +-- TranscriptProcessor.js
|       |   |-- preprocessing/
|       |   |   |-- AudioFrameProcessor.js
|       |   |   |-- AudioPipeline.js
|       |   |   |-- AudioProcessingErrors.js
|       |   |   |-- AudioProcessingEvents.js
|       |   |   |-- AudioProcessor.js
|       |   |   |-- index.js
|       |   |   |-- ProcessedAudioFrame.js
|       |   |   |-- ProcessingConfiguration.js
|       |   |   |-- RNNoiseProcessor.js
|       |   |   |-- SpeechSourceClassifier.js
|       |   |   +-- VoiceActivityDetector.js
|       |   |-- session/
|       |   |   |-- SessionEvents.js
|       |   |   |-- VoiceSession.js
|       |   |   |-- VoiceSessionManager.js
|       |   |   +-- VoiceStateMachine.js
|       |   |-- stt/
|       |   |   |-- DecoderState.js
|       |   |   |-- index.js
|       |   |   |-- ModelLoader.js
|       |   |   |-- ModelManager.js
|       |   |   |-- ParakeetEngine.js
|       |   |   |-- SherpaRuntime.js
|       |   |   |-- STTConfiguration.js
|       |   |   |-- STTEngine.js
|       |   |   |-- STTErrors.js
|       |   |   |-- STTEvents.js
|       |   |   |-- TranscriptAssembler.js
|       |   |   |-- TranscriptResult.js
|       |   |   +-- TranscriptSegment.js
|       |   |-- ui/
|       |   |   |-- index.js
|       |   |   |-- TranscriptPublisher.js
|       |   |   |-- VoiceAccessibility.js
|       |   |   |-- VoiceAnimationController.js
|       |   |   |-- VoiceConfiguration.js
|       |   |   |-- VoiceOverlay.js
|       |   |   |-- VoiceOverlayIPC.js
|       |   |   |-- VoiceStateRenderer.js
|       |   |   |-- VoiceStatusIndicator.js
|       |   |   |-- VoiceTheme.js
|       |   |   |-- VoiceUIErrors.js
|       |   |   |-- VoiceUIEvents.js
|       |   |   +-- VoiceWindowController.js
|       |   |-- index.js
|       |   +-- tts.js
|       |-- permissions.js
|       |-- phone-verification.js
|       |-- preload.js
|       +-- settings.js
|-- build/
|   |-- icon.ico
|   |-- icon.png
|   |-- ICON_README.md
|   |-- installer.nsh
|   +-- openx-chrome-host.exe
|-- core/
|   |-- assistant/
|   |   |-- acquisition/
|   |   |   |-- AcquisitionErrors.js
|   |   |   |-- APIAdapter.js
|   |   |   |-- AttachmentResolver.js
|   |   |   |-- BaseInputAdapter.js
|   |   |   |-- ChatAdapter.js
|   |   |   |-- ClipboardAdapter.js
|   |   |   |-- CloudAdapter.js
|   |   |   |-- index.js
|   |   |   |-- InputAdapterRegistry.js
|   |   |   |-- InputFactory.js
|   |   |   |-- InputMetadataBuilder.js
|   |   |   |-- InputSourceManager.js
|   |   |   |-- LanguageDetector.js
|   |   |   |-- OCRAdapter.js
|   |   |   |-- PhoneAdapter.js
|   |   |   |-- PluginAdapter.js
|   |   |   |-- SourceConfidenceCalculator.js
|   |   |   +-- VoiceAdapter.js
|   |   |-- active-learning/
|   |   |   |-- ActiveLearningManager.js
|   |   |   |-- AliasStore.js
|   |   |   |-- BaseStore.js
|   |   |   |-- CorrectionStore.js
|   |   |   |-- LearningGuard.js
|   |   |   |-- LearningLanguage.js
|   |   |   |-- PreferenceStore.js
|   |   |   |-- UsageStatsStore.js
|   |   |   +-- WorkflowStore.js
|   |   |-- automation/
|   |   |   |-- AutomationContext.js
|   |   |   |-- AutomationDiagnostics.js
|   |   |   |-- AutomationDispatcher.js
|   |   |   |-- AutomationErrors.js
|   |   |   |-- AutomationExecutionGraph.js
|   |   |   |-- AutomationLogger.js
|   |   |   |-- AutomationResult.js
|   |   |   |-- DecisionValidationAutomationManager.js
|   |   |   |-- DecisionValidationAutomationStage.js
|   |   |   +-- index.js
|   |   |-- context/
|   |   |   |-- ApplicationContext.js
|   |   |   |-- BrowserContext.js
|   |   |   |-- CalendarContext.js
|   |   |   |-- ClipboardContext.js
|   |   |   |-- DesktopContext.js
|   |   |   |-- index.js
|   |   |   |-- MediaContext.js
|   |   |   |-- ScreenContext.js
|   |   |   |-- SelectionContext.js
|   |   |   |-- SystemContext.js
|   |   |   |-- TimeContext.js
|   |   |   |-- UserContext.js
|   |   |   +-- WindowContext.js
|   |   |-- contracts/
|   |   |   |-- ErrorContract.js
|   |   |   |-- index.js
|   |   |   |-- LoggerContract.js
|   |   |   |-- PipelineConfigurationContract.js
|   |   |   |-- PipelineContextContract.js
|   |   |   |-- PipelineEventsContract.js
|   |   |   |-- PipelineResultContract.js
|   |   |   |-- PipelineStageContract.js
|   |   |   +-- StageResultContract.js
|   |   |-- decision/
|   |   |   |-- BaseDecision.js
|   |   |   |-- ClarificationDecision.js
|   |   |   |-- ConfirmationDecision.js
|   |   |   |-- ConflictDecision.js
|   |   |   |-- DecisionConfiguration.js
|   |   |   |-- DecisionContext.js
|   |   |   |-- DecisionDiagnostics.js
|   |   |   |-- DecisionEngine.js
|   |   |   |-- DecisionErrors.js
|   |   |   |-- DecisionLogger.js
|   |   |   |-- DecisionManager.js
|   |   |   |-- DecisionPipeline.js
|   |   |   |-- DecisionRegistry.js
|   |   |   |-- DecisionResult.js
|   |   |   |-- ExecutionDecision.js
|   |   |   |-- index.js
|   |   |   +-- PolicyDecision.js
|   |   |-- entities/
|   |   |   |-- AlarmExtractor.js
|   |   |   |-- ApplicationExtractor.js
|   |   |   |-- BaseEntityExtractor.js
|   |   |   |-- BrightnessExtractor.js
|   |   |   |-- BrowserExtractor.js
|   |   |   |-- ContactExtractor.js
|   |   |   |-- DateExtractor.js
|   |   |   |-- DeviceExtractor.js
|   |   |   |-- DurationExtractor.js
|   |   |   |-- EntityConfiguration.js
|   |   |   |-- EntityContext.js
|   |   |   |-- EntityDiagnostics.js
|   |   |   |-- EntityErrors.js
|   |   |   |-- EntityGraphBuilder.js
|   |   |   |-- EntityLogger.js
|   |   |   |-- EntityManager.js
|   |   |   |-- EntityNormalizer.js
|   |   |   |-- EntityPipeline.js
|   |   |   |-- EntityRegistry.js
|   |   |   |-- EntityRelationshipBuilder.js
|   |   |   |-- EntityResolver.js
|   |   |   |-- EntityUnderstandingStage.js
|   |   |   |-- EntityValidator.js
|   |   |   |-- FileExtractor.js
|   |   |   |-- FolderExtractor.js
|   |   |   |-- index.js
|   |   |   |-- LocationExtractor.js
|   |   |   |-- MediaExtractor.js
|   |   |   |-- NetworkExtractor.js
|   |   |   |-- PathExtractor.js
|   |   |   |-- PersonExtractor.js
|   |   |   |-- ReminderExtractor.js
|   |   |   |-- StructuredEntities.js
|   |   |   |-- TimeExtractor.js
|   |   |   |-- TimerExtractor.js
|   |   |   |-- VolumeExtractor.js
|   |   |   |-- WebsiteExtractor.js
|   |   |   +-- WindowExtractor.js
|   |   |-- events/
|   |   |   |-- index.js
|   |   |   |-- PipelineEventDispatcher.js
|   |   |   +-- PipelineEvents.js
|   |   |-- learning/
|   |   |   |-- AliasLearning.js
|   |   |   |-- BaseLearningModule.js
|   |   |   |-- ConversationLearning.js
|   |   |   |-- CorrectionLearning.js
|   |   |   |-- FeedbackLearning.js
|   |   |   |-- HabitLearning.js
|   |   |   |-- index.js
|   |   |   |-- LearningAnalytics.js
|   |   |   |-- LearningConfiguration.js
|   |   |   |-- LearningContext.js
|   |   |   |-- LearningDiagnostics.js
|   |   |   |-- LearningErrors.js
|   |   |   |-- LearningLogger.js
|   |   |   |-- LearningManager.js
|   |   |   |-- LearningPipeline.js
|   |   |   |-- LearningPolicy.js
|   |   |   |-- LearningRegistry.js
|   |   |   |-- LearningResult.js
|   |   |   |-- LearningStage.js
|   |   |   |-- LearningStorage.js
|   |   |   |-- LearningValidator.js
|   |   |   |-- PatternLearning.js
|   |   |   |-- PreferenceLearning.js
|   |   |   |-- UsageLearning.js
|   |   |   +-- WorkflowLearning.js
|   |   |-- linguistic/
|   |   |   |-- AnalyzerRegistry.js
|   |   |   |-- BaseAnalyzer.js
|   |   |   |-- ClauseAnalyzer.js
|   |   |   |-- DependencyParser.js
|   |   |   |-- index.js
|   |   |   |-- LinguisticConfiguration.js
|   |   |   |-- LinguisticContext.js
|   |   |   |-- LinguisticDiagnostics.js
|   |   |   |-- LinguisticErrors.js
|   |   |   |-- LinguisticGraph.js
|   |   |   |-- LinguisticLogger.js
|   |   |   |-- LinguisticManager.js
|   |   |   |-- LinguisticPipeline.js
|   |   |   |-- LinguisticUnderstandingStage.js
|   |   |   |-- ModifierDetector.js
|   |   |   |-- NegationDetector.js
|   |   |   |-- ObjectDetector.js
|   |   |   |-- POSTagger.js
|   |   |   |-- PronounResolver.js
|   |   |   |-- QuestionDetector.js
|   |   |   |-- SentenceSplitter.js
|   |   |   |-- SubjectDetector.js
|   |   |   |-- Tokenizer.js
|   |   |   +-- VerbDetector.js
|   |   |-- memory/
|   |   |   |-- BaseMemoryProvider.js
|   |   |   |-- ConversationMemory.js
|   |   |   |-- DialogueHistory.js
|   |   |   |-- index.js
|   |   |   |-- LongTermMemory.js
|   |   |   |-- MemoryConfiguration.js
|   |   |   |-- MemoryContext.js
|   |   |   |-- MemoryContextStage.js
|   |   |   |-- MemoryDiagnostics.js
|   |   |   |-- MemoryErrors.js
|   |   |   |-- MemoryLogger.js
|   |   |   |-- MemoryManager.js
|   |   |   |-- MemoryPipeline.js
|   |   |   |-- MemoryRegistry.js
|   |   |   |-- ResolvedContext.js
|   |   |   |-- SessionMemory.js
|   |   |   |-- TopicTracker.js
|   |   |   +-- WorkingMemory.js
|   |   |-- models/
|   |   |   |-- AssistantRequest.js
|   |   |   |-- AssistantResponse.js
|   |   |   |-- DiagnosticRecord.js
|   |   |   |-- ExecutionMetadata.js
|   |   |   |-- index.js
|   |   |   |-- PipelineMetadata.js
|   |   |   |-- ProcessedInput.js
|   |   |   |-- RawUserInput.js
|   |   |   |-- StageMetadata.js
|   |   |   +-- TimingInformation.js
|   |   |-- nlp/
|   |   |   |-- nlp.js
|   |   |   |-- preprocessor.js
|   |   |   |-- scorer.js
|   |   |   +-- web-targets.js
|   |   |-- normalization/
|   |   |   |-- AbbreviationExpander.js
|   |   |   |-- BaseNormalizer.js
|   |   |   |-- ContractionResolver.js
|   |   |   |-- DateNormalizer.js
|   |   |   |-- EmojiInterpreter.js
|   |   |   |-- index.js
|   |   |   |-- InputCleaner.js
|   |   |   |-- LanguageNormalizationStage.js
|   |   |   |-- LanguageSwitcher.js
|   |   |   |-- NormalizationConfiguration.js
|   |   |   |-- NormalizationContext.js
|   |   |   |-- NormalizationDiagnostics.js
|   |   |   |-- NormalizationErrors.js
|   |   |   |-- NormalizationLogger.js
|   |   |   |-- NormalizationManager.js
|   |   |   |-- NormalizationPipeline.js
|   |   |   |-- NormalizedInput.js
|   |   |   |-- NormalizerRegistry.js
|   |   |   |-- NumberNormalizer.js
|   |   |   |-- PunctuationNormalizer.js
|   |   |   |-- RepeatedWordCleaner.js
|   |   |   |-- SlangNormalizer.js
|   |   |   |-- SpellRepair.js
|   |   |   |-- TimeNormalizer.js
|   |   |   |-- UnicodeNormalizer.js
|   |   |   |-- UnitNormalizer.js
|   |   |   +-- WhitespaceNormalizer.js
|   |   |-- pipeline/
|   |   |   |-- AssistantPassthroughStage.js
|   |   |   |-- index.js
|   |   |   |-- PipelineBuilder.js
|   |   |   |-- PipelineConfiguration.js
|   |   |   |-- PipelineContext.js
|   |   |   |-- PipelineDiagnostics.js
|   |   |   |-- PipelineEngine.js
|   |   |   |-- PipelineError.js
|   |   |   |-- PipelineEvents.js
|   |   |   |-- PipelineLogger.js
|   |   |   |-- PipelineManager.js
|   |   |   |-- PipelineRegistry.js
|   |   |   |-- PipelineResult.js
|   |   |   |-- PipelineStage.js
|   |   |   +-- StageResult.js
|   |   |-- planning/
|   |   |   |-- BasePlanner.js
|   |   |   |-- DependencyPlanner.js
|   |   |   |-- ExecutionBlueprint.js
|   |   |   |-- ExecutionGraphBuilder.js
|   |   |   |-- ExecutionPlanner.js
|   |   |   |-- index.js
|   |   |   |-- ParallelPlanner.js
|   |   |   |-- PlannerOptimizer.js
|   |   |   |-- PlanningConfiguration.js
|   |   |   |-- PlanningContext.js
|   |   |   |-- PlanningDiagnostics.js
|   |   |   |-- PlanningErrors.js
|   |   |   |-- PlanningLogger.js
|   |   |   |-- PlanningManager.js
|   |   |   |-- PlanningPipeline.js
|   |   |   |-- PlanningRegistry.js
|   |   |   |-- RecoveryPlanner.js
|   |   |   |-- TaskGraphBuilder.js
|   |   |   |-- TaskPlanner.js
|   |   |   |-- TaskPlanningStage.js
|   |   |   +-- WorkflowPlanner.js
|   |   |-- reasoning/
|   |   |   |-- ActionReasoner.js
|   |   |   |-- BaseReasoner.js
|   |   |   |-- ClarificationEngine.js
|   |   |   |-- ConfidenceManager.js
|   |   |   |-- ConflictResolver.js
|   |   |   |-- ContextReasoner.js
|   |   |   |-- GoalIntentReasoningStage.js
|   |   |   |-- GoalReasoner.js
|   |   |   |-- index.js
|   |   |   |-- InferenceEngine.js
|   |   |   |-- IntentReasoner.js
|   |   |   |-- ReasoningConfiguration.js
|   |   |   |-- ReasoningContext.js
|   |   |   |-- ReasoningDiagnostics.js
|   |   |   |-- ReasoningErrors.js
|   |   |   |-- ReasoningGraphBuilder.js
|   |   |   |-- ReasoningLogger.js
|   |   |   |-- ReasoningManager.js
|   |   |   |-- ReasoningPipeline.js
|   |   |   |-- ReasoningRegistry.js
|   |   |   |-- ReasoningResult.js
|   |   |   +-- TaskReasoner.js
|   |   |-- references/
|   |   |   |-- AliasResolver.js
|   |   |   |-- ContextResolver.js
|   |   |   |-- ConversationResolver.js
|   |   |   |-- index.js
|   |   |   |-- PronounResolver.js
|   |   |   |-- ReferenceGraphBuilder.js
|   |   |   +-- ReferenceResolver.js
|   |   |-- response/
|   |   |   |-- AssistantResponse.js
|   |   |   |-- BaseResponseGenerator.js
|   |   |   |-- ChatFormatter.js
|   |   |   |-- ClarificationResponse.js
|   |   |   |-- ConfirmationResponse.js
|   |   |   |-- ErrorResponse.js
|   |   |   |-- index.js
|   |   |   |-- NaturalLanguageFormatter.js
|   |   |   |-- NotificationFormatter.js
|   |   |   |-- ResponseConfiguration.js
|   |   |   |-- ResponseContext.js
|   |   |   |-- ResponseDiagnostics.js
|   |   |   |-- ResponseErrors.js
|   |   |   |-- ResponseLogger.js
|   |   |   |-- ResponseManager.js
|   |   |   |-- ResponsePipeline.js
|   |   |   |-- ResponseRegistry.js
|   |   |   |-- SuggestionResponse.js
|   |   |   |-- SummaryResponse.js
|   |   |   +-- VoiceFormatter.js
|   |   |-- semantic/
|   |   |   |-- BaseSemanticAnalyzer.js
|   |   |   |-- ConfidenceEngine.js
|   |   |   |-- ConversationClassifier.js
|   |   |   |-- index.js
|   |   |   |-- MeaningResolver.js
|   |   |   |-- RelationshipAnalyzer.js
|   |   |   |-- SemanticConfiguration.js
|   |   |   |-- SemanticContext.js
|   |   |   |-- SemanticDiagnostics.js
|   |   |   |-- SemanticDictionary.js
|   |   |   |-- SemanticErrors.js
|   |   |   |-- SemanticGraphBuilder.js
|   |   |   |-- SemanticLogger.js
|   |   |   |-- SemanticManager.js
|   |   |   |-- SemanticNormalizer.js
|   |   |   |-- SemanticPipeline.js
|   |   |   |-- SemanticRegistry.js
|   |   |   |-- SemanticRepresentation.js
|   |   |   |-- SemanticRoleLabeler.js
|   |   |   |-- SemanticUnderstandingStage.js
|   |   |   +-- SimilarityEngine.js
|   |   |-- utils/
|   |   |   |-- AsyncHelpers.js
|   |   |   |-- ConfigurationLoader.js
|   |   |   |-- DeepClone.js
|   |   |   |-- ErrorHelpers.js
|   |   |   |-- IdGenerator.js
|   |   |   |-- index.js
|   |   |   |-- LoggerHelpers.js
|   |   |   |-- ObjectFreeze.js
|   |   |   |-- PerformanceTracker.js
|   |   |   |-- ServiceContainer.js
|   |   |   |-- Stopwatch.js
|   |   |   |-- Timer.js
|   |   |   +-- ValidationHelpers.js
|   |   |-- validation/
|   |   |   |-- AutomationValidator.js
|   |   |   |-- BaseValidator.js
|   |   |   |-- ConfirmationValidator.js
|   |   |   |-- ConstraintValidator.js
|   |   |   |-- ContextValidator.js
|   |   |   |-- EntityValidator.js
|   |   |   |-- index.js
|   |   |   |-- PermissionValidator.js
|   |   |   |-- SafetyValidator.js
|   |   |   |-- ValidationConfiguration.js
|   |   |   |-- ValidationContext.js
|   |   |   |-- ValidationDiagnostics.js
|   |   |   |-- ValidationErrors.js
|   |   |   |-- ValidationLogger.js
|   |   |   |-- ValidationManager.js
|   |   |   |-- ValidationPipeline.js
|   |   |   |-- ValidationRegistry.js
|   |   |   +-- ValidationResult.js
|   |   |-- verification/
|   |   |   |-- ApplicationVerifier.js
|   |   |   |-- BaseVerifier.js
|   |   |   |-- BrowserVerifier.js
|   |   |   |-- CloudVerifier.js
|   |   |   |-- ExecutionVerifier.js
|   |   |   |-- index.js
|   |   |   |-- ReminderVerifier.js
|   |   |   |-- TransferVerifier.js
|   |   |   |-- VerificationConfiguration.js
|   |   |   |-- VerificationContext.js
|   |   |   |-- VerificationDiagnostics.js
|   |   |   |-- VerificationErrors.js
|   |   |   |-- VerificationGraphBuilder.js
|   |   |   |-- VerificationLogger.js
|   |   |   |-- VerificationManager.js
|   |   |   |-- VerificationPipeline.js
|   |   |   |-- VerificationRegistry.js
|   |   |   |-- VerificationResponseManager.js
|   |   |   |-- VerificationResponseStage.js
|   |   |   |-- VerificationResult.js
|   |   |   +-- WindowVerifier.js
|   |   |-- Active-learning.js
|   |   |-- AssistantEngine.js
|   |   |-- contest.js
|   |   |-- context.js
|   |   |-- Data.js
|   |   |-- entities.js
|   |   |-- index.js
|   |   |-- intents.js
|   |   |-- language.js
|   |   |-- nle.js
|   |   |-- nlu.js
|   |   |-- parser.js
|   |   |-- personality.js
|   |   |-- responses.js
|   |   +-- router.js
|   |-- automation/
|   |   |-- common/
|   |   |   |-- action-confirm.js
|   |   |   |-- action-velidation.js
|   |   |   |-- action-verification.js
|   |   |   |-- launcher.js
|   |   |   |-- path-utils.js
|   |   |   +-- windows-session.js
|   |   |-- apps.js
|   |   |-- brightness.js
|   |   |-- browser.js
|   |   |-- communications.js
|   |   |-- files.js
|   |   |-- folders.js
|   |   |-- index.js
|   |   |-- media.js
|   |   |-- planner.js
|   |   |-- scheduler.js
|   |   |-- screenshot-recording.js
|   |   |-- system.js
|   |   |-- volume.js
|   |   +-- windows.js
|   |-- cloud/
|   |   |-- CloudCommandManager.js
|   |   |-- CloudConnectionManager.js
|   |   |-- CloudFileTransferManager.js
|   |   |-- CloudLogger.js
|   |   |-- CloudPairingManager.js
|   |   |-- CloudRequestQueue.js
|   |   |-- CloudResponseSerializer.js
|   |   +-- index.js
|   |-- context-awareness/
|   |   |-- active-window.js
|   |   |-- app-registry.js
|   |   |-- context-engine.js
|   |   |-- mode-engine.js
|   |   |-- process-monitor.js
|   |   +-- signals.js
|   +-- phone/
|       |-- DeviceRegistry.js
|       |-- FileTransferManager.js
|       |-- FileTransferProtocol.js
|       |-- IdentityVerificationService.js
|       |-- index.js
|       |-- PairingService.js
|       |-- PairingTokenManager.js
|       |-- PhoneCommandRouter.js
|       |-- PhoneConnectionManager.js
|       |-- PhoneServer.js
|       |-- QRPairingService.js
|       |-- SecurityManager.js
|       |-- SessionManager.js
|       |-- TransferHistory.js
|       +-- TransferIntegrity.js
|-- docs/
|   |-- architecture/
|   |   +-- overview.md
|   |-- modules/
|   |   |-- assistant-communication.md
|   |   |-- communications.md
|   |   |-- core-engine.md
|   |   |-- nlp-pipeline.md
|   |   +-- settings.md
|   |-- plugins/
|   |   +-- development.md
|   |-- setup/
|   |   +-- installation.md
|   +-- workflows/
|       +-- command-execution.md
|-- models/
|   +-- parakeet/
|       |-- decoder.int8.onnx
|       |-- encoder.int8.onnx
|       |-- joiner.int8.onnx
|       +-- tokens.txt
|-- plugins/
|   |-- chrome/
|   |   |-- index.js
|   |   +-- plugin.json
|   |-- communications/
|   |   +-- whatsapp-desktop.js
|   |-- discord/
|   |   |-- index.js
|   |   +-- plugin.json
|   |-- forms/
|   |   |-- index.js
|   |   +-- understanding.js
|   |-- sample_plugin/
|   |   |-- index.js
|   |   +-- plugin.json
|   |-- youtube/
|   |   |-- index.js
|   |   +-- plugin.json
|   +-- plugin-controller.js
|-- scripts/
|   |-- enable-phone-pairing-firewall.ps1
|   +-- start-electron.js
|-- tests/
|   |-- automation/
|   |   |-- apps.test.js
|   |   |-- automation.test.js
|   |   |-- browser.test.js
|   |   |-- communications.test.js
|   |   |-- file-management.test.js
|   |   |-- media.test.js
|   |   |-- volume-brightness.test.js
|   |   +-- windows-session.test.js
|   |-- context-awareness/
|   |   |-- context-awareness.test.js
|   |   +-- mode-engine.test.js
|   |-- core/
|   |   |-- active-learning-v2.test.js
|   |   |-- app-language.test.js
|   |   |-- architecture-structure.test.js
|   |   |-- assistant.test.js
|   |   |-- assistant-intelligence-pipeline.test.js
|   |   |-- browser-language.test.js
|   |   |-- cloud-command-manager.test.js
|   |   |-- cloud-connection.test.js
|   |   |-- cloud-file-transfer-manager.test.js
|   |   |-- command-corpus.test.js
|   |   |-- crash-recovery.test.js
|   |   |-- data-root.test.js
|   |   |-- decision-automation.test.js
|   |   |-- electron-security.test.js
|   |   |-- electron-shortcut.test.js
|   |   |-- entities.test.js
|   |   |-- entity-understanding.test.js
|   |   |-- human-context.test.js
|   |   |-- input-acquisition.test.js
|   |   |-- intents.test.js
|   |   |-- language-normalization.test.js
|   |   |-- learning.test.js
|   |   |-- learning-engine.test.js
|   |   |-- learning-repair.test.js
|   |   |-- linguistic-understanding.test.js
|   |   |-- logger.test.js
|   |   |-- media-youtube-corpus.test.js
|   |   |-- memory-context.test.js
|   |   |-- nlp.test.js
|   |   |-- nlu.test.js
|   |   |-- parser.test.js
|   |   |-- permissions.test.js
|   |   |-- phone.test.js
|   |   |-- phone-device-permissions.test.js
|   |   |-- phone-file-transfer.test.js
|   |   |-- phone-identity-verification.test.js
|   |   |-- phone-pairing.test.js
|   |   |-- phone-qr-pairing.test.js
|   |   |-- phone-security.test.js
|   |   |-- planner.test.js
|   |   |-- planning.test.js
|   |   |-- reasoning.test.js
|   |   |-- renderer-security.test.js
|   |   |-- responses.test.js
|   |   |-- router.test.js
|   |   |-- scheduler-alert.test.js
|   |   |-- security-critical.test.js
|   |   |-- semantic-understanding.test.js
|   |   |-- settings.test.js
|   |   |-- tts.test.js
|   |   |-- verification-response.test.js
|   |   +-- voice-subsystem.test.js
|   |-- media-handling/
|   |   +-- media-handling.test.js
|   +-- ui/
|       |-- chat-renderer.test.js
|       |-- planner-renderer.test.js
|       |-- schedule-alert-renderer.test.js
|       +-- timer-widget-renderer.test.js
|-- .gitignore
|-- AGENTS.md
|-- commands.md
|-- config.js
|-- eslint.config.mjs
|-- package.json
|-- package-lock.json
|-- README.md
|-- report.md
+-- RULES.md
```

## Current Status

The repository is verified at the current working tree state:

- lint passes;
- all tests pass;
- assistant intelligence sidecars are present;
- current assistant routing behavior remains backward compatible;
- report and architecture test now match the current directory layout.


