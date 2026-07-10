# OpenX Engineering Report

Report date: 2026-07-10

Repository: `C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX`

Package: `openx@6.0.0`

Runtime: Electron 28, Node.js, CommonJS, Windows-first desktop automation

## Executive Summary

OpenX is a deterministic, local-first Windows desktop assistant. The same assistant core handles chat, voice, phone, cloud-delivered commands, plugin/API input, clipboard/OCR-style acquisition, and communication workflows. The architecture is staged: input acquisition, normalization, linguistic analysis, semantic analysis, entity understanding, memory/context, reasoning, planning, decision/validation, automation, verification/response, and learning.

The current codebase includes desktop automation, browser control, local file/folder operations, media control, scheduler and planner tools, phone pairing and transfer, cloud relay command/file transport, local voice sessions, plugin-backed integrations, renderer settings/activity surfaces, crash recovery, and a lazy WhatsApp communication provider.

## Recent Improvements And Inclusions

The latest important changes are now part of the assistant runtime and should be treated as current behavior:

- WhatsApp is lazily initialized. `CommunicationEngine.start()` registers providers only and no longer launches Playwright during assistant startup.
- WhatsApp browser resources are created only on the first WhatsApp operation through `WhatsAppSessionManager.ensureReady()` / `connect()`.
- WhatsApp uses a persistent browser profile under the OpenX data root, so login survives idle shutdown and later recreation.
- WhatsApp now has a default 5 minute idle timer. `touch()` resets it after each operation, and idle shutdown disposes the browser context, page handlers, context handlers, and timer.
- Pending WhatsApp drafts are restored after idle shutdown before final send confirmation, preserving the existing draft/confirmation flow.
- Voice diagnostics are bounded with `maxSessionHistory` and `maxTransitionLog`, reducing long-session memory growth.
- Voice event publishing isolates listener failures so one renderer or integration listener cannot break the session manager.
- Active-window polling uses an unref'd interval and isolates subscriber failures, reducing shutdown and UI smoothness blockers.
- Chat renderer performance work keeps message rendering bounded, coalesces scroll work, reduces expensive repaint behavior while typing, and limits settings/cloud polling to active settings use.
- Crash recovery has a bounded restart policy with persisted compact crash metadata in `apps/desktop/electron/crash-recovery.js`.
- Assistant routing improvements include safer rename correction handling, scheduled power-action confirmation, and multi-word rename parsing.

## Repository Scan

Filtered scan excludes generated, local-heavy, and tool-output directories:

```text
.git/
node_modules/
dist/
.code-review-graph/
.codex/
.cursor/
.agents/
graphify-out/
```

Current filtered counts:

| Metric | Count |
|---|---:|
| Filtered files | 683 |
| Filtered directories | 73 |
| JavaScript files | 640 |
| Test files | 70 |
| Markdown/docs files | 17 |
| Registered intents | 115 |
| Validated IPC channels | 47 |

Graphify architecture snapshot:

- 4,937 nodes
- 9,749 edges
- 158 detected communities
- Most connected abstractions: `ActionRouter`, `VoiceSessionManager`, `Assistant`, `CloudConnectionManager`, `ActiveLearningManager`, `MediaController`, `ContextManager`, `SchedulerController`, `normalizeText()`, `EntityExtractor`

## Runtime Command Flow

```text
Input source
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

The public assistant API is:

```js
Assistant.processCommand(input, source, options)
```

The lower-level pipeline facade is:

```js
AssistantEngine.processCommand(input, source, options)
PipelineManager.process({ input, source, options, rawUserInput })
PipelineEngine.run(context)
```

## Input Methods

OpenX has explicit acquisition adapters under `core/assistant/acquisition/`:

| Input method | Main adapter / entry point | Purpose |
|---|---|---|
| Chat text | `ChatAdapter` and `command:process` IPC | Renderer chat commands. |
| Voice | `VoiceAdapter`, `VoiceSessionManager`, `VoiceAssistantBridge` | Microphone/STT transcripts routed into the assistant. |
| Phone local | `PhoneAdapter`, `PhoneServer`, `PhoneCommandRouter` | Local WebSocket commands from OpenX Mobile. |
| Cloud relay | `CloudAdapter`, `CloudConnectionManager`, `CloudCommandManager` | Remote relay command packets routed through the phone-compatible path. |
| Plugin/API | `PluginAdapter`, `APIAdapter`, `PluginManager` | Plugin-supplied or direct API command input. |
| Clipboard | `ClipboardAdapter` | Clipboard-backed context acquisition. |
| OCR | `OCRAdapter` | OCR-derived input or metadata. |
| Attachments | `AttachmentResolver` | Normalizes file/attachment metadata for command context. |

All sources are normalized into a common assistant request shape before routing and automation.

## Critical Entry Points

| File | Important function / method | Responsibility |
|---|---|---|
| `core/assistant/index.js` | `Assistant.processCommand(input, source, options)` | Public assistant command API used by chat, voice, phone, cloud, tests, and plugin flows. |
| `core/assistant/index.js` | `Assistant._processCommandDirect(input, source, options)` | Handles pending confirmations, clarifications, schedule completion, feedback/learning flows, context questions, routing, and final response shaping. |
| `core/assistant/index.js` | `Assistant.confirmAndExecute(commandId, intentId, entities)` | Executes a protected pending command after user confirmation. |
| `core/assistant/index.js` | `Assistant.cancelPendingConfirmation()` | Cancels a pending protected action. |
| `core/assistant/index.js` | `Assistant.destroy()` | Clears pending state and destroys automation dependencies. |
| `core/assistant/AssistantEngine.js` | `AssistantEngine.processCommand()` | Acquires input and drives the configured assistant pipeline. |
| `core/assistant/pipeline/PipelineManager.js` | `process(...)` | Builds and coordinates the ordered assistant stages. |
| `core/assistant/pipeline/PipelineEngine.js` | `run(context)` | Executes stage objects and records diagnostics. |
| `core/assistant/automation/ActionRouter.js` | `process(inputText, source, options)` | Main executable intent router, including multi-command handling, clarifications, contextual rewrites, and entity extraction. |
| `core/assistant/automation/ActionRouter.js` | `_execute(...)` | Sends routed actions through validation, NLE, automation, verification, response, and learning evidence. |
| `core/assistant/semantic/NaturalLanguageRouter.js` | `parse(rawText, preparedInput)` | Builds semantic frames, roles, relationships, domains, intents, and extracted entities. |
| `core/assistant/semantic/NaturalLanguageRouter.js` | `resolveIntent(text)` | Converts natural text into an intent/entity result for router use. |
| `core/assistant/linguistic/NlpProcessor.js` | `prepare(text)` | Normalizes, repairs, tokenizes, detects question forms, and creates linguistic frame data. |
| `core/assistant/entities/EntityPipeline.js` | `run(semanticRepresentation, options)` | Runs extractors, normalizers, resolvers, validators, graph building, diagnostics, and structured output. |
| `core/assistant/entities/EntityContext.js` | `addEntity()` / `toStructuredEntities()` | Stores extracted entities and produces downstream immutable entity collections. |
| `core/assistant/entities/StructuredEntities.js` | constructor | Freezes structured entities, graph, relationships, diagnostics, metadata, timing, confidence, and extension slots. |
| `core/automation/index.js` | `AutomationEngine.execute(actionId, entities, context)` | Dispatches validated action IDs to automation controllers. |
| `core/assistant/automation/NaturalLanguageExecution.js` | `execute(actionId, entities, context)` | Boundary between assistant routing and automation execution. |
| `apps/desktop/electron/main.js` | `setupIPC()` | Registers trusted renderer IPC handlers for assistant, voice, settings, phone, cloud, communication, planner, schedule alerts, timer widget, TTS, and windows. |
| `apps/desktop/electron/security.js` | `IPC_VALIDATORS` | Validates every renderer IPC payload before main process handlers receive it. |
| `apps/desktop/preload.js` | `openxApi` | Exposes the safe renderer API through `contextBridge`. |
| `apps/desktop/settings.js` | `SettingsService` | Loads, validates, saves, resets, and builds runtime settings. |
| `apps/desktop/electron/crash-recovery.js` | `CrashRecoveryPolicy` | Bounds automatic restarts and persists compact crash metadata. |

## Assistant Intelligence Modules

| Directory | Purpose |
|---|---|
| `core/assistant/acquisition/` | Source adapters for chat, voice, phone, cloud, API, plugin, clipboard, OCR, attachments, and confidence. |
| `core/assistant/normalization/` | Text cleanup, spell repair, date/time/number/unit normalization, punctuation, whitespace, slang, Unicode, abbreviations, contractions. |
| `core/assistant/linguistic/` | Tokenization, sentence/clause analysis, subject/object/verb/modifier/negation/question/pronoun logic. |
| `core/assistant/semantic/` | Meaning representation, role labeling, relationship analysis, web target resolution, semantic routing. |
| `core/assistant/entities/` | Pluggable extractors, registry, normalization, resolution, validation, relationship graph, structured entities. |
| `core/assistant/memory/` | Working, session, dialogue, topic, conversation, and long-term memory context. |
| `core/assistant/context/` | Desktop, app, browser, clipboard, selection, screen, time, user, media, calendar, system, and window context. |
| `core/assistant/reasoning/` | Intent registry, pattern scoring, confidence, clarification, conflict, goal/intent/task reasoning. |
| `core/assistant/planning/` | Task graph, execution graph, dependency, parallel, recovery, and workflow planners. |
| `core/assistant/decision/` | Execution, confirmation, clarification, conflict, policy decisions, diagnostics, registry. |
| `core/assistant/validation/` | Permission, safety, entity, context, automation, confirmation, and constraint validation. |
| `core/assistant/automation/` | Router, dispatcher, automation context/result/diagnostics, NLE bridge, execution stages. |
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
| `EntityNormalizer.js` | Canonical entity mapping for apps, browsers, folders, websites, dates, times, and common values. |
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

The intent registry exposes 115 intent IDs. Major groups:

```text
app.*, browser.*, file.*, folder.*, media.*, volume.*, brightness.*,
timer.*, alarm.*, reminder.*, stopwatch.*, calendar.*, timetable.*,
system.*, window.*, phone.*, message/email/call, form.fill,
assistant.*, mode.start, greeting, thanks, help
```

Main controller ownership:

| Controller | Responsibilities |
|---|---|
| `AppController` | App open/close/switch/new tab, visible-window matching, Start menu fallback. |
| `BrowserController` | Browser open/search/site search/first-result/tab open/tab close/tab listing. |
| `FileController` | File create/open/delete/rename/copy/move/search/list/smart find. |
| `FolderController` | Folder create/open/delete/move/search and ambiguity choices. |
| `MediaController` | Playback, search, pause/resume/stop, platform actions, fullscreen, media volume. |
| `SchedulerController` | Reminders, alarms, timers, stopwatch, snooze, list, clear, due events. |
| `PlannerController` | Calendar/timetable open and entry creation. |
| `SystemController` | Status, time/date, calculations, CPU, memory, battery, disk, processes, insight, Bluetooth. |
| `WindowsController` | Window minimize/maximize/close, screen lock, sleep, restart, shutdown. |
| `CommunicationsController` | Message, email, call, WhatsApp draft preparation, and communication-engine handoff. |

## Communication And WhatsApp

The current communication stack lives under `core/communication/` and is separate from the older desktop WhatsApp plugin under `plugins/communications/`.

| File | Important function / method | Responsibility |
|---|---|---|
| `CommunicationEngine.js` | `constructor(options)` | Registers default providers, including WhatsApp, without launching browser resources. |
| `CommunicationEngine.js` | `start()` | Marks the communication engine started and returns health only. It does not connect providers. |
| `CommunicationEngine.js` | `prepareMessage(...)` | Ensures the selected provider is ready, composes a draft, and publishes communication events. |
| `CommunicationEngine.js` | `sendPrepared(draftId, providerId)` | Sends a previously prepared draft. |
| `CommunicationEngine.js` | `cancelPrepared(draftId, providerId)` | Cancels a prepared draft. |
| `WhatsAppSessionManager.js` | `ensureReady(options)` | Lazily starts Playwright/browser context when a WhatsApp operation needs it and waits for logged-in readiness. |
| `WhatsAppSessionManager.js` | `connect(options)` | Creates or reuses the persistent browser context and page. |
| `WhatsAppSessionManager.js` | `_launch(options)` | Calls `chromium.launchPersistentContext(profileDir, ...)` and loads WhatsApp Web. |
| `WhatsAppSessionManager.js` | `touch()` | Resets the idle timer after activity. |
| `WhatsAppSessionManager.js` | `_closeContext(options)` | Clears the idle timer, detaches Playwright handlers, drops page/context references, closes context, and emits disconnect. |
| `WhatsAppSessionManager.js` | `_detachResourceListeners(context, page)` | Removes context/page listeners for close, crash, and console events. |
| `WhatsAppSessionManager.js` | `hasPersistentSession()` | Detects saved browser profile state without launching the browser. |
| `WhatsAppProvider.js` | `searchContacts(recipient, options)` | Searches WhatsApp contacts and returns duplicate-contact choices without sending. |
| `WhatsAppProvider.js` | `composeMessage(recipient, messageText, options)` | Opens the selected chat, writes a draft, stores `preparedDrafts`, and requests final confirmation. |
| `WhatsAppProvider.js` | `send(draftId)` | Reopens/restores draft if idle shutdown occurred, then clicks send. |
| `WhatsAppProvider.js` | `cancel(draftId)` | Clears the draft and removes pending state. |
| `WhatsAppProvider.js` | `_restoreDraft(draft, page)` | Restores recipient and message after lazy browser recreation. |
| `WhatsAppSelectors.js` | `resolveElement(page, name, options)` | Resolves WhatsApp DOM targets through multiple selector candidates and diagnostics. |

WhatsApp lifecycle:

```text
Assistant startup
  -> CommunicationEngine constructor registers WhatsAppProvider
  -> CommunicationEngine.start() returns health only
  -> no Playwright process, no browser page, no WhatsApp RAM use

First WhatsApp command
  -> CommunicationsController._prepareWhatsAppMessage()
  -> CommunicationEngine.prepareMessage()
  -> WhatsAppProvider.ensureReady()
  -> WhatsAppSessionManager.ensureReady()
  -> launchPersistentContext(profileDir)
  -> search contact
  -> create draft
  -> request send/cancel confirmation

Idle period
  -> touch() timer expires after 5 minutes by default
  -> _closeContext()
  -> context/page/listeners/timer disposed
  -> persistent profile remains on disk

Next WhatsApp command
  -> ensureReady() recreates browser context
  -> saved profile restores login
  -> pending draft can be restored before send
```

## Renderer, IPC, And UI Surface

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
communication:cancelPrepared
communication:connect
communication:disconnect
communication:selectContact
communication:sendPrepared
communication:status
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

Renderer and smoothness notes:

- `apps/desktop/renderer/chat/index.js` keeps rendered messages bounded and coalesces scroll work.
- `apps/desktop/renderer/chat/index.css` applies paint containment to workspace, messages, and input areas.
- The composer avoids expensive blur repainting while the user is typing.
- Settings cloud status polling runs only while settings are open.
- Dynamic Island communication actions are driven by communication events from the main process.
- Voice overlay UI listens to `VoiceSessionManager` events and handles action feedback without bypassing the voice lifecycle manager.

## Voice System

Voice entry path:

```text
AudioCapture
  -> AudioPipeline / RNNoise / VAD
  -> SpeechSourceClassifier
  -> STTEngine / SherpaRuntime / Parakeet model
  -> TranscriptProcessor
  -> VoiceAssistantBridge
  -> AssistantDispatcher
  -> Assistant.processCommand()
  -> TTS / overlay response
```

Important voice modules:

| Directory | Role |
|---|---|
| `apps/desktop/voice/audio/` | Capture, device selection, audio frame contracts. |
| `apps/desktop/voice/preprocessing/` | RNNoise, VAD, frame processing, source classification. |
| `apps/desktop/voice/stt/` | Model loading, Sherpa runtime, decoder state, transcript assembly. |
| `apps/desktop/voice/normalization/` | Transcript cleanup, command normalization, dictionary/acronym/app/technology normalization. |
| `apps/desktop/voice/session/` | Continuous session lifecycle and state machine. |
| `apps/desktop/voice/integration/` | Dispatch from transcript to assistant and TTS/session coordination. |
| `apps/desktop/voice/ui/` | Overlay, status rendering, accessibility, animations. |
| `apps/desktop/voice/diagnostics/` | Metrics, health, latency, privacy filtering, event timeline, resource monitoring. |

Important `VoiceSessionManager` methods:

```text
initialize()
warmUpResources()
prepareSession()
startSession()
beginListening()
beginProcessing()
beginExecution()
beginSpeaking()
completeSpeakingTurn()
finishSession()
failSession()
recoverFromError()
configureAudio()
initializeAudio()
startAudioCapture()
stopAudioCapture()
processAudioFrame()
initializeAudioProcessing()
processAudioFrame()
initializeSpeechToText()
startSpeechToText()
recognizeProcessedFrame()
finalizeSpeechToText()
processTranscript()
getStatus()
destroy()
```

Memory and stability details:

- Session history and transition logs are bounded.
- Speech pre-roll is bounded by `speechPrerollFrameLimit`.
- Runtime logging is rate-limited by `_logRuntimePipeline()`.
- Partial transcript publication suppresses duplicate, stale, and unstable partials.
- Empty final transcripts recover the recognition stream without closing the long-running voice session.

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

Important files:

| File | Responsibility |
|---|---|
| `core/phone/PhoneServer.js` | Local WebSocket pairing, sessions, commands, transfer coordination. |
| `core/phone/PhoneCommandRouter.js` | Routes phone-origin commands into the assistant. |
| `core/phone/FileTransferManager.js` | Local file transfer coordination. |
| `core/phone/TransferIntegrity.js` | File checksum/integrity validation. |
| `core/cloud/CloudConnectionManager.js` | Relay socket lifecycle, heartbeat, reconnect, presence, packets. |
| `core/cloud/CloudCommandManager.js` | Cloud command queue and assistant routing. |
| `core/cloud/CloudFileTransferManager.js` | Chunked cloud file transfer lifecycle. |

## Crash Recovery And Resource Lifecycle

Crash recovery is owned by `apps/desktop/electron/crash-recovery.js` and integrated from `apps/desktop/electron/main.js`.

Important methods:

| Method | Purpose |
|---|---|
| `readCrashTimestamps(now)` | Reads only valid recent crash timestamps inside the configured window. |
| `getState(now)` | Returns whether restart is blocked and how many restarts remain. |
| `requestRestart(now, metadata)` | Persists a crash attempt and returns whether automatic restart is allowed. |
| `markStable(now)` | Clears crash history after stable runtime or normal shutdown. |

Resource lifecycle improvements:

- Renderer recovery has a restart budget and delay.
- Recovery timers are tracked and cleared on shutdown.
- Voice shortcut recovery can reset after resume.
- WhatsApp browser lifecycle is independent of assistant startup and idles out when unused.
- Active-window polling does not keep the process alive on its own.

## Storage And Persistence

Managed data root:

```text
%USERPROFILE%\OpenX_Data\
```

Important paths built through `core/assistant/Data.js`:

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
| `communication/whatsapp/profile/` | Persistent WhatsApp browser profile and login state. |
| `communication/diagnostics/` | WhatsApp selector/state diagnostics. |

JSON persistence uses bounded reads and atomic writes through `readJsonFile()` and `writeJsonAtomic()`.

## Build, Runtime, And Packaging

Key scripts:

```text
npm start
npm run dev
npm run lint
npm test
npm run test:core
npm run test:automation
npm run test:context
npm run test:learning
npm run test:ui
npm run validate
npm run build
npm run package
```

Packaging includes:

- Electron app entry: `apps/desktop/electron/main.js`
- Source bundles: `apps/**/*`, `core/**/*`, `plugins/**/*`, `config.js`, `package.json`
- Parakeet model files from `models/parakeet/`
- Chrome native messaging host from `build/openx-chrome-host.exe`
- Playwright and Sherpa unpacked from ASAR for runtime compatibility

## Verification Status

Latest verification recorded for the current code state:

```powershell
npm run lint
npx mocha tests/core/communication-engine.test.js --exit --reporter min
npx mocha "tests/core/**/*.test.js" --exit --reporter min
git diff --check
graphify update .
```

Results:

```text
Lint: passing
Communication focused tests: 21 passing
Core tests: passing
Diff whitespace check: clean, with normal CRLF warnings on Windows
Graphify update: completed after code changes
```

## Current Directory Tree

Filtered current structure with required source, docs, build resources, models, plugins, scripts, and tests. Generated/local-heavy folders are excluded.

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
|       |   |-- security-unlock/
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
|   |-- communication/
|   |   |-- CommunicationEngine.js
|   |   |-- CommunicationErrors.js
|   |   |-- CommunicationEvents.js
|   |   |-- CommunicationProvider.js
|   |   |-- CommunicationProviderManager.js
|   |   |-- CommunicationResult.js
|   |   |-- index.js
|   |   |-- WhatsAppProvider.js
|   |   |-- WhatsAppSelectors.js
|   |   +-- WhatsAppSessionManager.js
|   |-- context-awareness/
|   |   |-- active-window.js
|   |   |-- app-registry.js
|   |   |-- context-engine.js
|   |   |-- mode-engine.js
|   |   |-- process-monitor.js
|   |   +-- signals.js
|   |-- phone/
|   |   |-- DeviceRegistry.js
|   |   |-- FileTransferManager.js
|   |   |-- FileTransferProtocol.js
|   |   |-- IdentityVerificationService.js
|   |   |-- index.js
|   |   |-- PairingService.js
|   |   |-- PairingTokenManager.js
|   |   |-- PhoneCommandRouter.js
|   |   |-- PhoneConnectionManager.js
|   |   |-- PhoneServer.js
|   |   |-- QRPairingService.js
|   |   |-- SecurityManager.js
|   |   |-- SessionManager.js
|   |   |-- TransferHistory.js
|   |   +-- TransferIntegrity.js
|   +-- security/
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
|   |   |-- assistant.test.js
|   |   |-- assistant-intelligence-pipeline.test.js
|   |   |-- browser-language.test.js
|   |   |-- cloud-command-manager.test.js
|   |   |-- cloud-connection.test.js
|   |   |-- cloud-file-transfer-manager.test.js
|   |   |-- command-corpus.test.js
|   |   |-- communication-engine.test.js
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
|   |   |-- performance-memory.test.js
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
|-- package.json
|-- package-lock.json
|-- README.md
|-- report.md
+-- RULES.md
```

Excluded from this tree:

```text
.git/
node_modules/
dist/
.code-review-graph/
.codex/
.cursor/
.agents/
graphify-out/
```
