# OpenX Engineering Report

Report date: 2026-07-10

Repository: `C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX`

Package: `openx@5.5.1`

Runtime: Electron 28, Node.js, CommonJS

## Summary

OpenX is a deterministic, local-first Windows desktop assistant. The same assistant command path serves chat, voice, phone, and cloud-delivered text. The runtime is organized around input acquisition, language normalization, linguistic understanding, semantic understanding, entity understanding, memory/context, reasoning, planning, validation, automation, verification, response generation, and learning.

The assistant currently supports desktop automation, browser control, local file/folder work, media control, scheduler tools, planner entries, phone pairing and file transfer, optional cloud relay transport, local voice sessions, plugin-backed integrations, and renderer-based settings/activity surfaces.

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
| `core` | 445 | 0 |
| `docs` | 11 | 0 |
| `models` | 4 | 0 |
| `plugins` | 12 | 0 |
| `scripts` | 2 | 0 |
| `tests` | 69 | 69 |

Totals:

| Metric | Count |
|---|---:|
| Filtered files | 672 |
| Filtered directories | 72 |
| JavaScript files | 629 |
| Test files | 69 |
| Registered intents | 115 |
| Validated IPC channels | 41 |

## Runtime Command Flow

```text
Input text
  -> InputSourceManager.acquire()
  -> PipelineManager.process()
  -> LanguageNormalizationStage.execute()
  -> LinguisticUnderstandingStage.execute()
  -> SemanticUnderstandingStage.execute()
  -> EntityUnderstandingStage.execute()
  -> MemoryContextStage.execute()
  -> GoalIntentReasoningStage.execute()
  -> TaskPlanningStage.execute()
  -> DecisionValidationAutomationStage.execute()
  -> VerificationResponseStage.execute()
  -> AssistantExecutionStage.execute()
  -> LearningStage.execute()
  -> Assistant response object
```

The public assistant contract is:

```js
Assistant.processCommand(input, source, options)
```

Supported command sources include `chat`, `voice`, `phone`, and cloud packets routed through phone-compatible command context.

## Critical Entry Points

| File | Method / function | Responsibility |
|---|---|---|
| `core/assistant/index.js` | `Assistant.processCommand(input, source, options)` | Public command API used by chat, voice, phone, cloud, tests, and plugin flows. |
| `core/assistant/index.js` | `Assistant._processCommandDirect(input, source, options)` | Handles pending confirmations, clarifications, schedule completion, learning input, context answers, routing, timeout guard, and final response shaping. |
| `core/assistant/AssistantEngine.js` | `AssistantEngine.processCommand(input, source, options)` | Acquires raw input and sends it through the configured assistant pipeline. |
| `core/assistant/pipeline/PipelineManager.js` | `process({ input, source, options, rawUserInput })` | Coordinates configured pipeline execution and result output. |
| `core/assistant/pipeline/PipelineEngine.js` | `process(context)` | Executes stage objects in deterministic order and records diagnostics. |
| `core/assistant/automation/ActionRouter.js` | `process(inputText, source, options)` | Main command router for executable intents, clarification, multi-command routing, contextual rewrites, and entity extraction. |
| `core/assistant/automation/ActionRouter.js` | `_execute(commandId, intentResult, entities, rawCommandText, source, languageUnderstanding, executionOptions)` | Executes routed intent through NLE/automation and attaches validation, verification, response, and learning evidence. |
| `core/assistant/semantic/NaturalLanguageRouter.js` | `parse(rawText, preparedInput)` | Builds semantic frames, token roles, relations, domains, intents, and extracted entities. |
| `core/assistant/semantic/NaturalLanguageRouter.js` | `resolveIntent(text)` | Converts natural sentence structure into an intent/entity result for router use. |
| `core/assistant/linguistic/NlpProcessor.js` | `prepare(text)` | Normalizes, repairs, tokenizes, builds intent text, detects query forms, and creates linguistic frame data. |
| `core/assistant/entities/EntityPipeline.js` | `run(semanticRepresentation, options)` | Runs registered extractors, normalization, resolution, validation, relationship building, graph building, diagnostics, and immutable structured output. |
| `core/assistant/entities/EntityContext.js` | `addEntity(type, entity)` / `toStructuredEntities()` | Stores extracted entities and produces the downstream entity object. |
| `core/assistant/entities/StructuredEntities.js` | constructor | Freezes structured entity collections, graph, relationships, diagnostics, metadata, timing, confidence, and extension slots. |
| `core/automation/index.js` | `AutomationEngine.execute(actionId, entities, context)` | Dispatches validated action IDs to app/browser/file/folder/media/scheduler/planner/system/phone/plugin controllers. |
| `core/assistant/automation/NaturalLanguageExecution.js` | `execute(actionId, entities, context)` | NLE boundary between assistant routing and automation execution. |
| `core/automation/scheduler.js` | `setReminder()`, `setAlarm()`, `setTimer()` | Creates scheduler entries, persistence, due events, snooze, cancel, list, clear, and stopwatch operations. |
| `core/automation/apps.js` | `AppController.open(appName, options)` | Resolves local app launches, existing windows, Start menu entries, known app mappings, and allowed web-app fallback context. |
| `core/automation/browser.js` | browser action methods | Opens URLs/searches/tabs, resolves browser names, and checks network requirements for internet actions. |
| `core/automation/files.js` | file action methods | Handles create/open/delete/rename/copy/move/search/list/smart-find with local path safety. |
| `core/automation/folders.js` | folder action methods | Handles create/open/delete/move/search and folder ambiguity choices. |
| `apps/desktop/electron/main.js` | `setupIPC()` | Registers trusted renderer IPC handlers for commands, settings, phone, cloud, planner, scheduler alerts, timer widget, TTS, and windows. |
| `apps/desktop/electron/security.js` | `IPC_VALIDATORS` | Validates every renderer IPC payload before the main process handler receives it. |
| `apps/desktop/preload.js` | `openxApi` | Exposes the safe renderer API through `contextBridge`. |
| `apps/desktop/settings.js` | `SettingsService` methods | Loads, validates, saves, resets, and builds runtime settings. |
| `core/phone/PhoneCommandRouter.js` | `routeCommand(assistant, command, context)` | Routes phone-origin commands into `Assistant.processCommand()`. |
| `core/phone/PhoneServer.js` | server lifecycle and message handlers | Hosts local phone WebSocket pairing, sessions, command messages, and file transfer coordination. |
| `core/cloud/CloudConnectionManager.js` | connection lifecycle methods | Manages relay socket state, reconnect, heartbeat, device registration, packets, presence, and notifications. |
| `core/cloud/CloudCommandManager.js` | command queue and packet handlers | Receives cloud command packets and routes them through the assistant command path. |
| `core/cloud/CloudFileTransferManager.js` | transfer methods | Handles metadata approval, chunked transfer, acknowledgements, progress, cancellation, timeout cleanup, and checksum verification. |

## Assistant Intelligence Modules

| Directory | Purpose |
|---|---|
| `core/assistant/acquisition/` | Source adapters for chat, voice, phone, API, plugin, clipboard, OCR, cloud, attachment metadata, and confidence. |
| `core/assistant/normalization/` | Text cleanup, spell repair, date/time/number/unit normalization, abbreviations, contractions, punctuation, whitespace, slang, Unicode handling. |
| `core/assistant/linguistic/` | Tokenization, sentence/clause analysis, subject/object/verb/modifier/negation/question/pronoun logic, NLP preparation. |
| `core/assistant/semantic/` | Meaning representation, role labeling, relationship analysis, web target resolution, semantic routing. |
| `core/assistant/entities/` | Pluggable extractors, registry, normalization, resolution, validation, relationship graph, structured entities. |
| `core/assistant/memory/` | Working, session, dialogue, topic, conversation, and long-term memory context. |
| `core/assistant/reasoning/` | Intent registry, pattern scoring, confidence, clarification, conflict, goal/intent/task reasoning. |
| `core/assistant/planning/` | Task graph, execution graph, dependency, parallel, recovery, and workflow planners. |
| `core/assistant/decision/` | Execution, confirmation, clarification, conflict, policy decisions, diagnostics, registry. |
| `core/assistant/validation/` | Permission, safety, entity, context, automation, confirmation, constraint validation. |
| `core/assistant/automation/` | Router, dispatcher, automation context/result/diagnostics, NLE bridge, execution stage. |
| `core/assistant/verification/` | Application, browser, cloud, reminder, transfer, window, execution verification and response integration. |
| `core/assistant/response/` | Response generator, personality, formatters, clarification/confirmation/error/suggestion/summary responses. |
| `core/assistant/learning/` | Feedback, correction, alias, preference, usage, habit, conversation, workflow learning with guarded storage. |

## Entity Understanding

Entity understanding converts semantic representation into immutable structured entities. It does not execute actions.

Critical files:

| File | Role |
|---|---|
| `EntityPipeline.js` | Runs extractors, processors, diagnostics, and final structured output. |
| `EntityRegistry.js` | Registers extractors, normalizers, resolvers, validators, providers, and custom entity types. |
| `BaseEntityExtractor.js` | Extractor lifecycle: `initialize()`, `supports()`, `extract()`, `validate()`, `cleanup()`, `destroy()`. |
| `EntityNormalizer.js` | Canonical entity mapping such as apps, browsers, folders, websites, dates, and times. |
| `EntityResolver.js` | Resolves known apps, folders, contacts, devices, and paths by identity only. |
| `EntityValidator.js` | Records quality status, missing values, duplicates, invalid paths/dates, and unknown entities. |
| `EntityRelationshipBuilder.js` | Stores entity-to-entity relationships such as reminder -> date -> time. |
| `EntityGraphBuilder.js` | Produces immutable entity graph nodes and relationships. |
| `StructuredEntities.js` | Freezes final entity output for downstream use. |

Current entity families:

```text
applications, browsers, websites, files, folders, paths, media, contacts,
people, devices, locations, dates, times, durations, reminders, alarms,
timers, windows, networks, volumeLevels, brightnessLevels
```

## Intent And Automation Surface

The intent registry currently exposes 115 intent IDs. Major groups:

```text
app.*, browser.*, file.*, folder.*, media.*, volume.*, brightness.*,
timer.*, alarm.*, reminder.*, stopwatch.*, calendar.*, timetable.*,
system.*, window.*, phone.*, message/email/call, form.fill,
assistant.*, mode.start, greeting, thanks, help
```

The automation engine maps executable actions to controller methods in `core/automation/index.js`. Main controller ownership:

| Controller | Responsibilities |
|---|---|
| `AppController` | App open/close/switch/new tab, visible-window matching, Start menu fallback. |
| `BrowserController` | Browser open/search/site search/tab open/tab close/tab listing. |
| `FileController` | File create/open/delete/rename/copy/move/search/list/smart find. |
| `FolderController` | Folder create/open/delete/move/search and clarification choices. |
| `MediaController` | Playback, search, pause/resume/stop, platform actions, media volume. |
| `SchedulerController` | Reminders, alarms, timers, stopwatch, snooze, list, clear, due events. |
| `PlannerController` | Calendar/timetable open and entry creation. |
| `SystemController` | Status, time/date, calculations, CPU/memory/battery/disk/process insight, Bluetooth. |
| `WindowsController` | Window minimize/maximize/close, screen lock, sleep, restart, shutdown. |
| `CommunicationsController` | Message, email, and call composition/start flows. |

## Renderer And IPC Surface

The renderer API is exposed through `apps/desktop/preload.js` and validated in `apps/desktop/electron/security.js`.

Validated IPC channels:

```text
app:quit
assistant:status
cloud:connect
cloud:disconnect
cloud:pairing:approve
cloud:pairing:reject
cloud:pairing:status
cloud:pairingQR:create
cloud:status
command:confirm
command:process
config:get
phone:device:disconnect
phone:device:permissions:update
phone:device:remove
phone:device:rename
phone:device:trust:update
phone:devices:list
phone:pairingQR:create
phone:server:status
planner:addEntry
planner:deleteEntry
planner:getEntries
schedule:alertAction
security:verifyAccess
settings:get
settings:reset
settings:save
timerWidget:close
timerWidget:getState
timerWidget:resetStopwatch
timerWidget:resumeStopwatch
timerWidget:stopStopwatch
tts:speak
tts:stop
voice:start
voiceOverlay:collapse
window:closePlanner
window:openChat
window:openPlanner
window:openSettings
```

Renderer performance notes:

- `apps/desktop/renderer/chat/index.js` caps rendered chat messages and coalesces scroll work.
- `apps/desktop/renderer/chat/index.css` applies paint containment to workspace/message/input areas.
- The composer avoids expensive blur repainting while the user types.
- Settings cloud status polling runs only while the settings panel is open.

## Storage And Persistence

Managed data root:

```text
%USERPROFILE%\OpenX_Data\
```

Important paths are built in `core/assistant/Data.js`:

| Path | Data |
|---|---|
| `settings.json` | Desktop and assistant settings. |
| `schedules.json` | Reminders, alarms, timers, stopwatch state. |
| `planner.json` | Calendar and timetable entries. |
| `learning/` | Alias, preference, correction, usage, workflow, and learning stores. |
| `logs/` | Local runtime logs. |
| `voice/diagnostics/` | Voice diagnostics and metrics. |
| `cloud/connection.log` | Cloud relay connection log. |
| `phone/` | Pairing, devices, permissions, transfer history. |
| `received/` | Phone/cloud received files. |
| `runtime/phone-transfer/` | Temporary transfer files. |
| `screenshots/` | Screenshot capture output. |

JSON persistence uses bounded reads and atomic writes through `readJsonFile()` and `writeJsonAtomic()`.

## Phone And Cloud

Phone local mode:

```text
OpenX Mobile
  -> local WebSocket
  -> PhoneServer
  -> PhoneCommandRouter
  -> Assistant.processCommand(text, 'phone', phoneContext)
  -> response packet
```

Cloud command mode:

```text
OpenX Mobile
  -> relay command packet
  -> CloudConnectionManager
  -> CloudCommandManager
  -> PhoneCommandRouter
  -> Assistant.processCommand(text, 'phone', phoneContext)
  -> relay response packet
```

Cloud file transfer:

```text
metadata packet
  -> receiver approval
  -> chunk packets
  -> per-chunk acknowledgement
  -> checksum verification
  -> completion acknowledgement
```

## Voice

Voice entry path:

```text
AudioCapture
  -> AudioPipeline / RNNoise / VAD
  -> STTEngine / SherpaRuntime / Parakeet model
  -> TranscriptProcessor
  -> VoiceAssistantBridge
  -> AssistantDispatcher
  -> Assistant.processCommand()
  -> TTS / overlay response
```

Critical voice modules:

| Directory | Role |
|---|---|
| `apps/desktop/voice/audio/` | Capture, device selection, audio frame contracts. |
| `apps/desktop/voice/preprocessing/` | RNNoise, VAD, frame processing, source classification. |
| `apps/desktop/voice/stt/` | Model loading, Sherpa runtime, decoder state, transcript assembly. |
| `apps/desktop/voice/normalization/` | Transcript cleanup, command normalization, dictionary/acronym/app normalization. |
| `apps/desktop/voice/session/` | Continuous session lifecycle and state machine. |
| `apps/desktop/voice/integration/` | Dispatch from transcript to assistant. |
| `apps/desktop/voice/ui/` | Overlay, status rendering, accessibility, animations. |
| `apps/desktop/voice/diagnostics/` | Metrics, health, latency, privacy filtering, event timeline. |

## Verification

Latest focused checks run for this report:

```powershell
npx mocha tests\ui\chat-renderer.test.js tests\core\electron-security.test.js tests\core\entities.test.js tests\core\nlu.test.js --timeout 60000 --exit
npx mocha tests\automation\automation.test.js tests\core\assistant.test.js --timeout 90000 --exit
node --check apps\desktop\electron\main.js
node --check apps\desktop\preload.js
node --check apps\desktop\electron\security.js
node --check apps\desktop\renderer\chat\index.js
node --check core\automation\index.js
node --check core\automation\apps.js
node --check core\automation\folders.js
node --check core\assistant\automation\ActionRouter.js
node --check core\assistant\semantic\NaturalLanguageRouter.js
node --check core\assistant\entities\EntityExtractor.js
node --check core\assistant\index.js
node --check core\assistant\linguistic\NlpProcessor.js
git diff --check
```

Results:

```text
UI / IPC / entities / NLU: 67 passing
Automation / assistant: 109 passing
Syntax checks: passing
Diff whitespace check: passing, with normal CRLF warnings on Windows
```

## Current Directory Tree

Filtered current structure with files shown under each folder:

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
|   |-- ICON_README.md
|   |-- icon.ico
|   |-- icon.png
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
|   |   |-- automation/
|   |   |   |-- ActionRouter.js
|   |   |   |-- AssistantExecutionStage.js
|   |   |   |-- AutomationContext.js
|   |   |   |-- AutomationDiagnostics.js
|   |   |   |-- AutomationDispatcher.js
|   |   |   |-- AutomationErrors.js
|   |   |   |-- AutomationExecutionGraph.js
|   |   |   |-- AutomationResult.js
|   |   |   |-- DecisionValidationAutomationManager.js
|   |   |   |-- DecisionValidationAutomationStage.js
|   |   |   |-- index.js
|   |   |   +-- NaturalLanguageExecution.js
|   |   |-- context/
|   |   |   |-- ApplicationContext.js
|   |   |   |-- BrowserContext.js
|   |   |   |-- CalendarContext.js
|   |   |   |-- ClipboardContext.js
|   |   |   |-- ContextManager.js
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
|   |   |   |-- EntityExtractor.js
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
|   |   |   |-- ActiveLearningManager.js
|   |   |   |-- ActiveLearningStore.js
|   |   |   |-- AliasLearning.js
|   |   |   |-- AliasStore.js
|   |   |   |-- BaseLearningModule.js
|   |   |   |-- BaseStore.js
|   |   |   |-- ConversationLearning.js
|   |   |   |-- CorrectionLearning.js
|   |   |   |-- CorrectionStore.js
|   |   |   |-- FeedbackLearning.js
|   |   |   |-- HabitLearning.js
|   |   |   |-- index.js
|   |   |   |-- LearningAnalytics.js
|   |   |   |-- LearningConfiguration.js
|   |   |   |-- LearningContext.js
|   |   |   |-- LearningDiagnostics.js
|   |   |   |-- LearningErrors.js
|   |   |   |-- LearningGuard.js
|   |   |   |-- LearningLanguage.js
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
|   |   |   |-- PreferenceStore.js
|   |   |   |-- UsageLearning.js
|   |   |   |-- UsageStatsStore.js
|   |   |   |-- WorkflowLearning.js
|   |   |   +-- WorkflowStore.js
|   |   |-- linguistic/
|   |   |   |-- AnalyzerRegistry.js
|   |   |   |-- BaseAnalyzer.js
|   |   |   |-- ClauseAnalyzer.js
|   |   |   |-- DependencyParser.js
|   |   |   |-- index.js
|   |   |   |-- InputParser.js
|   |   |   |-- LanguageAnalysis.js
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
|   |   |   |-- NlpProcessor.js
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
|   |   |-- normalization/
|   |   |   |-- AbbreviationExpander.js
|   |   |   |-- BaseNormalizer.js
|   |   |   |-- CommandPreprocessor.js
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
|   |   |   |-- IntentPatternScorer.js
|   |   |   |-- IntentReasoner.js
|   |   |   |-- IntentRegistry.js
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
|   |   |   |-- Personality.js
|   |   |   |-- ResponseConfiguration.js
|   |   |   |-- ResponseContext.js
|   |   |   |-- ResponseDiagnostics.js
|   |   |   |-- ResponseErrors.js
|   |   |   |-- ResponseGenerator.js
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
|   |   |   |-- NaturalLanguageRouter.js
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
|   |   |   |-- SimilarityEngine.js
|   |   |   +-- WebTargets.js
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
|   |   |-- AssistantEngine.js
|   |   |-- Data.js
|   |   +-- index.js
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
|   |   |-- overview.md
|   |   |-- production-finalization.md
|   |   +-- repository-audit.md
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
|   |   |-- assistant-intelligence-pipeline.test.js
|   |   |-- assistant.test.js
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
|   |   |-- learning-engine.test.js
|   |   |-- learning-repair.test.js
|   |   |-- learning.test.js
|   |   |-- linguistic-understanding.test.js
|   |   |-- logger.test.js
|   |   |-- media-youtube-corpus.test.js
|   |   |-- memory-context.test.js
|   |   |-- nlp.test.js
|   |   |-- nlu.test.js
|   |   |-- parser.test.js
|   |   |-- performance-memory.test.js
|   |   |-- permissions.test.js
|   |   |-- phone-device-permissions.test.js
|   |   |-- phone-file-transfer.test.js
|   |   |-- phone-identity-verification.test.js
|   |   |-- phone-pairing.test.js
|   |   |-- phone-qr-pairing.test.js
|   |   |-- phone-security.test.js
|   |   |-- phone.test.js
|   |   |-- planner.test.js
|   |   |-- planning.test.js
|   |   |-- reasoning.test.js
|   |   |-- reminder-extraction.test.js
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
|-- package-lock.json
|-- package.json
|-- README.md
|-- report.md
+-- RULES.md
```
