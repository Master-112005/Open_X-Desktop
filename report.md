# OpenX Implementation Report

Project: OpenX

Package version: 4.1.0

Platform: Windows desktop

Runtime: Electron 28, Node.js, CommonJS

Report date: 2026-07-04

## 1. Executive Summary

OpenX is a local-first Windows desktop assistant. It accepts commands from chat, OpenX Mobile, and the local voice subsystem, then routes all plain text through one assistant pipeline. The assistant is intentionally deterministic: it parses, validates, executes, verifies, and responds without changing the behavior of existing automation actions based on the input surface.

The current implementation includes:

- assistant NLP, NLU, parser, router, NLE, response, context, and learning layers;
- automation controllers for apps, browser, files, folders, media, scheduler, planner, system, volume, brightness, windows, screenshots, and communications;
- local voice capture, preprocessing, Sherpa-ONNX/Parakeet STT, transcript normalization, Dynamic Island voice UI, diagnostics, and TTS turn-taking;
- OpenX Mobile pairing, session validation, device permissions, phone command routing, and bidirectional file transfer;
- phone-origin file/folder fetching with desktop search context, structured choices, and safe confirmation before weak matches;
- calendar, timetable, reminders, recurring reminders, alarms, timers, stopwatch, snooze, and alert display;
- managed data storage under `OpenX_Data`;
- Electron IPC security, crash recovery, and renderer isolation;
- plugin isolation for Chrome, YouTube, Discord, forms, and communications;
- regression tests for core language, automation, UI, phone, security, voice, learning, and context behavior.

## 2. Codebase Scope

This report covers the OpenX desktop repository:

```text
C:\Users\rakes\Documents\PROJECTS\open\OpenX
```

Filtered project count:

- Files in report tree: 276
- Test files: 52
- Core files: 105
- Desktop app files: 114
- Plugin files: 13
- Root/config/documentation files: 10

The tree excludes local-only or generated noise:

```text
node_modules/
.git/
.codex/
.cursor/
.agents/
.code-review-graph/
.playwright-mcp/
.vscode/
dist/
release/
graphify-out/
OpenX_Data/
openx_data/
coverage/
*.log
*.tmp
```

## 3. High-Level Architecture

```text
Chat / phone / voice text
  -> NlpProcessor.prepare()
  -> NaturalLanguageRouter.parse()
  -> InputParser / CommandFrameParser
  -> EntityExtractor.extract()
  -> ActionRouter.process()
  -> validation and permission checks
  -> NaturalLanguageExecutor.execute()
  -> AutomationEngine.execute()
  -> action verification and confirmation
  -> ResponseGenerator.generate()
  -> context and active-learning updates
  -> OpenX_Data persistence
```

The assistant contract is:

```text
Assistant.processCommand(text, source)
```

The assistant must not need to know whether the text came from chat, phone, voice, or future APIs. Voice and phone integrations adapt their input into this same contract.

## 4. Main Module Responsibilities

| Module | Path | Responsibility |
|---|---|---|
| Assistant entry | `core/assistant/index.js` | Conversation lifecycle, clarification, confirmation, response flow, context, and active learning |
| NLP | `core/assistant/nlp/` | Text cleanup, spelling repair, command preparation, scoring, web target normalization |
| NLU | `core/assistant/nlu.js` | Semantic command interpretation, app/browser command language, context-aware parsing |
| Parser | `core/assistant/parser.js` | Input parsing and word-level command frames |
| Entities | `core/assistant/entities.js` | Apps, files, folders, paths, contacts, time, reminder, media, planner, and phone transfer entities |
| Router | `core/assistant/router.js` | Multi-command planning, intent resolution, fallback classification, confirmation, and routing |
| NLE | `core/assistant/nle.js` | Assistant-to-automation execution boundary |
| Responses | `core/assistant/responses.js` | Human-readable responses, search result summaries, error humanization, personality output |
| Context | `core/assistant/context.js`, `core/assistant/contest.js` | Session memory and context-engine bridge |
| Active learning | `core/assistant/Active-learning.js`, `core/assistant/active-learning/` | Corrections, preferences, aliases, user facts, usage stats, workflow memory |
| Data | `core/assistant/Data.js` | Data root, atomic JSON storage, migration, event bus, logging, redaction, retention |
| Automation | `core/automation/` | Desktop action controllers and verification helpers |
| Phone | `core/phone/` | Pairing, sessions, permissions, phone command routing, file transfer, security |
| Voice | `apps/desktop/voice/` | Audio, preprocessing, STT, transcript processing, session lifecycle, UI, diagnostics, TTS |
| Desktop | `apps/desktop/` | Electron lifecycle, IPC, windows, tray, shortcuts, settings, security, crash recovery |
| Plugins | `plugins/` | Restricted plugin packages and plugin action facades |

## 5. Critical Functions And Methods

### Assistant Core

| Function or method | File | Purpose |
|---|---|---|
| `Assistant.processCommand(input, source, options)` | `core/assistant/index.js` | Public command entry used by chat, phone, and voice. Owns clarification, confirmation, routing, execution, response, and learning flow. |
| `ActionRouter.process(inputText, source, options)` | `core/assistant/router.js` | Main route planner. Handles multi-command splitting, intent completion, contextual choices, fallback classification, and safe unsupported responses. |
| `NlpProcessor.prepare(text)` | `core/assistant/nlp/nlp.js` | Produces normalized, corrected, tokenized, and semantically framed input for routing. |
| `preprocessCommand(text)` | `core/assistant/nlp/preprocessor.js` | Applies phrase repair, lead-in stripping, repeated-token cleanup, token replacements, and command cleanup. |
| `NaturalLanguageRouter.parse(rawText, preparedInput)` | `core/assistant/nlu.js` | Converts language into structured command interpretations. |
| `InputParser.parse(text)` | `core/assistant/parser.js` | Builds parsed input structures from raw text. |
| `CommandFrameParser.parse(rawText, preparedInput)` | `core/assistant/parser.js` | Produces word-level command frames for relationship-aware parsing. |
| `EntityExtractor.extract(intent, text)` | `core/assistant/entities.js` | Extracts structured entities needed by automation and validation. |
| `NaturalLanguageExecutor.execute(actionId, entities, context)` | `core/assistant/nle.js` | Executes a normalized action through the automation engine. |
| `ResponseGenerator.generate(type, templateId, context)` | `core/assistant/responses.js` | Creates final user-facing text for confirmations, errors, summaries, and informational responses. |
| `ActiveLearningStore` and `ActiveLearningManager` methods | `core/assistant/Active-learning.js`, `core/assistant/active-learning/ActiveLearningManager.js` | Store corrections, aliases, usage patterns, preferences, user facts, and workflows without bypassing safety checks. |

### Data, Logging, And Persistence

| Function or method | File | Purpose |
|---|---|---|
| `resolveDataRoot(config)` | `core/assistant/Data.js` | Resolves the managed `OpenX_Data` root. |
| `buildDataPaths(config)` | `core/assistant/Data.js` | Builds paths for settings, schedules, planner, logs, voice diagnostics, phone data, media data, and transfer storage. |
| `ensureDataRoot(config)` | `core/assistant/Data.js` | Creates the managed data tree and migrates/cleans legacy locations. |
| `writeJsonAtomic(filePath, value, options)` | `core/assistant/Data.js` | Writes JSON safely with temporary files and optional backups. |
| `readJsonFile(filePath, fallbackValue, options)` | `core/assistant/Data.js` | Reads JSON with fallback and corrupt-file recovery. |
| `migrateLegacyData(config)` | `core/assistant/Data.js` | Moves legacy `.jarvis` and accidental root files into `OpenX_Data`. |
| `Logger._redact(value)` | `core/assistant/Data.js` | Redacts private values before writing logs. |
| `Logger._writeEntry(type, entry)` | `core/assistant/Data.js` | Writes bounded log entries with rotation and retention. |

### Automation

| Function or method | File | Purpose |
|---|---|---|
| `AutomationEngine.execute(actionId, entities, context)` | `core/automation/index.js` | Central action registry and execution dispatcher. |
| `AutomationEngine.destroy()` | `core/automation/index.js` | Releases controller resources. |
| `AppController.open(appName, options)` | `core/automation/apps.js` | Opens or focuses applications. |
| `AppController.close(appName, options)` | `core/automation/apps.js` | Closes applications or windows with verification. |
| `FileController.open(filename, targetPath)` | `core/automation/files.js` | Opens resolved files and participates in file choice handling. |
| `FolderController.open(folderName, options)` | `core/automation/folders.js` | Opens resolved folders and supports ambiguous-folder choices. |
| `MediaController` playback methods | `core/automation/media.js` | Handles media play, search, pause, resume, track navigation, and platform mapping. |
| `SchedulerController` methods | `core/automation/scheduler.js` | Creates timers, alarms, reminders, recurrence, snooze, stopwatch, and schedule alerts. |
| `PlannerController.open(view)` | `core/automation/planner.js` | Opens the calendar/timetable planner window. |
| `validateActionEntities()` | `core/automation/common/action-velidation.js` | Prevents incomplete actions from executing. |
| `verifyActionResult()` | `core/automation/common/action-verification.js` | Checks postconditions and normalizes result evidence. |
| `confirmActionResult()` | `core/automation/common/action-confirm.js` | Converts execution evidence into confirmation data. |

### Phone And File Transfer

| Function or method | File | Purpose |
|---|---|---|
| `PhoneServer.start()` | `core/phone/PhoneServer.js` | Starts the WebSocket phone server. |
| `PhoneServer.stop()` | `core/phone/PhoneServer.js` | Stops clients, sessions, timers, and server resources. |
| `PhoneServer.sendToDevice(deviceId, payload)` | `core/phone/PhoneServer.js` | Sends messages or file-transfer payloads to a paired phone. |
| `PhoneServer._handleMessage(clientId, data)` | `core/phone/PhoneServer.js` | Validates and routes incoming phone messages. |
| `PhoneServer._authenticateRequest(clientId, client, payload)` | `core/phone/PhoneServer.js` | Validates session tokens, device IDs, and transfer metadata. |
| `PhoneServer._handleFileTransfer(clientId, payload)` | `core/phone/PhoneServer.js` | Handles complete file-transfer payloads. |
| `PhoneServer._handleChunkedFileTransfer(clientId, payload)` | `core/phone/PhoneServer.js` | Handles chunked transfer start, chunk, and complete events. |
| `PhoneServer._handleFileTransferReceipt(clientId, payload)` | `core/phone/PhoneServer.js` | Records mobile receive acknowledgements. |
| `FileTransferManager.sendFileToDevice(deviceId, sourcePath)` | `core/phone/FileTransferManager.js` | Sends desktop files/folders to a phone, zipping folders when needed. |
| `FileTransferManager.startIncomingTransfer(payload)` | `core/phone/FileTransferManager.js` | Starts a chunked phone-to-desktop transfer and creates a guarded temp file. |
| `FileTransferManager.receiveFileChunk(payload)` | `core/phone/FileTransferManager.js` | Validates chunk order/size and appends chunk data. |
| `FileTransferManager.completeIncomingTransfer(payload)` | `core/phone/FileTransferManager.js` | Verifies hash/size and moves the finished file to `Downloads\OpenX Received`. |
| `FileTransferProtocol.validateIncoming(payload)` | `core/phone/FileTransferProtocol.js` | Validates complete transfer payloads. |
| `FileTransferProtocol.decodeBase64(value, expectedSize)` | `core/phone/FileTransferProtocol.js` | Decodes and size-checks base64 payloads. |
| `TransferIntegrity.verify(data, expectedHash)` | `core/phone/TransferIntegrity.js` | Verifies transfer hashes. |
| `TransferHistory` methods | `core/phone/TransferHistory.js` | Stores recent transfer status and history. |
| `SecurityManager` and `SessionManager` methods | `core/phone/SecurityManager.js`, `core/phone/SessionManager.js` | Enforce secure phone request and session behavior. |

### Voice

| Function or method | File | Purpose |
|---|---|---|
| `VoiceSessionManager.startSession(options)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Starts a persistent voice session. |
| `VoiceSessionManager.beginListening()` | `apps/desktop/voice/session/VoiceSessionManager.js` | Moves into listening state. |
| `VoiceSessionManager.processAudioFrame(audioFrame)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Delivers raw audio into preprocessing. |
| `VoiceSessionManager.recognizeProcessedFrame(processedFrame)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Sends accepted speech frames to STT. |
| `VoiceSessionManager.processTranscript(transcriptResult)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Normalizes and routes final transcripts. |
| `VoiceSessionManager.resumeListeningCycle(reason)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Resets the recognition stream and resumes the same session after a turn. |
| `VoiceSessionManager.cancelSession(reason)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Cancels an active voice session safely. |
| `VoiceSessionManager._createRecognitionCycle(reason)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Separates recognition cycle lifecycle from session lifecycle. |
| `VoiceSessionManager._flushAudioCaptureBuffer(reason)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Prevents stale audio from crossing recognition-cycle boundaries. |
| `VoiceSessionManager._shouldPublishPartialTranscript(text, payload)` | `apps/desktop/voice/session/VoiceSessionManager.js` | Suppresses duplicate/flickering partial transcript events. |
| `AudioCapture.start(options)` | `apps/desktop/voice/audio/AudioCapture.js` | Starts microphone PCM capture. |
| `AudioCapture.stop()` | `apps/desktop/voice/audio/AudioCapture.js` | Stops microphone capture. |
| `AudioProcessor.processFrame(audioFrame)` | `apps/desktop/voice/preprocessing/AudioProcessor.js` | Runs audio frames through preprocessing pipeline. |
| `STTEngine.partial(processedFrame)` | `apps/desktop/voice/stt/STTEngine.js` | Emits partial recognition hypotheses. |
| `STTEngine.final()` | `apps/desktop/voice/stt/STTEngine.js` | Produces a final utterance transcript. |
| `STTEngine.reset()` | `apps/desktop/voice/stt/STTEngine.js` | Resets recognition stream without rebuilding the whole voice session. |
| `TranscriptProcessor` methods | `apps/desktop/voice/normalization/TranscriptProcessor.js` | Cleans, validates, and normalizes transcripts. |
| `AssistantDispatcher.dispatch(commandText)` | `apps/desktop/voice/integration/AssistantDispatcher.js` | Sends normalized voice text to `Assistant.processCommand`. |
| `VoiceExecutionCoordinator.finishExecution(result)` | `apps/desktop/voice/integration/VoiceExecutionCoordinator.js` | Coordinates assistant result display, TTS, and resume-listening behavior. |
| `VoiceExecutionCoordinator.stopSpeaking(reason)` | `apps/desktop/voice/integration/VoiceExecutionCoordinator.js` | Stops current TTS output when user taps once during assistant speech. |
| `TextToSpeech.speak(text)` | `apps/desktop/voice/tts.js` | Speaks assistant responses through local Windows SAPI. |
| `TextToSpeech.stop()` | `apps/desktop/voice/tts.js` | Stops current speech. |
| `VoiceWindowController.show(view)` | `apps/desktop/voice/ui/VoiceWindowController.js` | Shows Dynamic Island voice UI. |
| `VoiceWindowController.updateAssistantResult(payload)` | `apps/desktop/voice/ui/VoiceWindowController.js` | Displays assistant replies, file/folder choices, reminders, alarms, and alert actions. |
| `VoiceWindowController._setSizeMode(mode, options)` | `apps/desktop/voice/ui/VoiceWindowController.js` | Smoothly changes Dynamic Island size. |
| `VoiceWindowController._moveToBounds(bounds, options)` | `apps/desktop/voice/ui/VoiceWindowController.js` | Animates window bounds for expansion/collapse. |

### Desktop, Security, And Crash Recovery

| Function or method | File | Purpose |
|---|---|---|
| Electron startup/lifecycle handlers | `apps/desktop/electron/main.js` | Own app lifecycle, tray, shortcuts, windows, assistant startup, phone server, voice runtime, and IPC registration. |
| `processCommand` preload bridge | `apps/desktop/preload.js` | Exposes a narrow validated renderer API for chat commands. |
| Voice overlay preload helpers | `apps/desktop/preload.js` | Render Dynamic Island assistant results and schedule controls. |
| IPC validation helpers | `apps/desktop/electron/security.js` | Validate renderer origins and payload schemas. |
| Crash recovery manager | `apps/desktop/electron/crash-recovery.js` | Handles renderer crash detection and bounded recovery. |
| `PermissionValidator` | `apps/desktop/permissions.js` | Applies permission levels, throttling, and sensitive-action checks. |
| `SettingsService` | `apps/desktop/settings.js` | Loads, normalizes, saves, and resets user settings. |

## 6. Voice Architecture

The voice subsystem remains local-only. It uses Sherpa-ONNX with local Parakeet model files under `models/parakeet/`.

Runtime path:

```text
Alt+Space or voice button
  -> VoiceSessionManager
  -> AudioCapture
  -> AudioProcessor
  -> RNNoiseProcessor / VoiceActivityDetector / SpeechSourceClassifier
  -> STTEngine
  -> SherpaRuntime / ParakeetEngine
  -> TranscriptAssembler
  -> TranscriptProcessor
  -> AssistantDispatcher
  -> Assistant.processCommand()
  -> VoiceExecutionCoordinator
  -> VoiceWindowController / TextToSpeech
  -> resume listening cycle
```

Important behavior:

- voice sessions can remain active across multiple utterances;
- recognition cycles are separate from the session lifecycle;
- stale audio is flushed between cycles;
- partial transcript noise is suppressed;
- TTS pauses recognition to avoid self-capture;
- user tap behavior can stop speech or cancel the current voice task;
- Dynamic Island UI displays listening, processing, execution, assistant results, file choices, reminder/alarm/timer alerts, and stop/snooze actions.

## 7. Phone And File Transfer Architecture

OpenX Mobile communicates with the desktop through the phone server in `core/phone/PhoneServer.js`.

Desktop-to-phone flow:

```text
Assistant command
  -> phone.sendFile automation action
  -> FileTransferManager.sendFileToDevice()
  -> PhoneServer.sendToDevice()
  -> mobile incoming-file payload
  -> mobile receipt
  -> TransferHistory update
```

Phone-to-desktop chunked flow:

```text
OpenX Mobile selected file
  -> file-transfer-start
  -> FileTransferManager.startIncomingTransfer()
  -> file-transfer-chunk events
  -> FileTransferManager.receiveFileChunk()
  -> file-transfer-complete
  -> FileTransferManager.completeIncomingTransfer()
  -> Downloads\OpenX Received
```

File transfer safeguards:

- device trust and session validation;
- per-device permission checks;
- file name sanitization;
- file size limits;
- transfer ID validation;
- ordered chunk validation;
- chunk size validation;
- SHA-256 verification;
- temporary file isolation;
- timeout cleanup for incomplete transfers;
- transfer history and receipts;
- stale transfer cleanup on disconnect.

## 8. Data Handling

Runtime data root:

```text
%USERPROFILE%\OpenX_Data\
```

Managed data categories:

- settings;
- learning and active-learning stores;
- schedules, timers, alarms, reminders, recurring reminders;
- planner/calendar entries;
- logs and crash recovery state;
- media runtime state;
- screenshots;
- voice diagnostics and health data;
- phone pairing/device/session state;
- file transfer history;
- received phone files;
- temporary phone-transfer archives.

Data handling principles:

- use `OpenX_Data` instead of project root files;
- write JSON atomically;
- back up important JSON before overwrite;
- recover from corrupt JSON with fallback data;
- redact private values in logs;
- migrate legacy `.jarvis` files when supported;
- clean accidental project-root schedules/planner files into managed storage.

## 9. Security And Safety Model

OpenX uses several safety layers:

- Electron renderer isolation through preload APIs;
- trusted renderer checks and IPC payload validation;
- confirmation gates for sensitive commands;
- required-entity validation before execution;
- postcondition verification after execution;
- plugin manifest validation and action namespace restrictions;
- phone pairing codes, identity verification, session tokens, permissions, and device trust;
- file transfer hash and size verification;
- private log redaction;
- local-only voice processing with no cloud speech API.

## 10. Plugins

Plugin entry point:

```text
plugins/plugin-controller.js
```

Current plugin packages:

- `plugins/chrome/`
- `plugins/youtube/`
- `plugins/discord/`
- `plugins/forms/`
- `plugins/communications/`
- `plugins/sample_plugin/`

Plugin restrictions:

- manifests are required;
- action IDs must stay under plugin namespaces;
- permission levels must be declared;
- automation usage must be declared through `usesAutomation`;
- plugin paths are constrained to configured plugin directories.

## 11. Testing

Available scripts:

```powershell
npm test
npm run test:core
npm run test:automation
npm run test:context
npm run test:learning
npm run test:ui
npm run lint
npm run validate
```

Important test areas:

- command corpus classification;
- NLP/NLU/parser/router behavior;
- assistant clarification and confirmation;
- reminder/alarm/timer/stopwatch scheduling;
- file/folder search and choice handling;
- phone pairing, permissions, security, and transfer;
- voice session, STT, diagnostics, UI, and TTS behavior;
- Electron shortcut, IPC, renderer security, and crash recovery;
- automation controllers and common verification helpers.

## 12. Packaging

Build scripts:

```powershell
npm run build
npm run package
```

Packaging uses Electron Builder. The NSIS installer includes:

- `apps/**/*`
- `core/**/*`
- `plugins/**/*`
- `config.js`
- `package.json`
- local Parakeet model files;
- Chrome native messaging host binary.

Excluded from package files:

- tests;
- Markdown documentation;
- generated metadata;
- OS junk files;
- development-only output.

## 13. Full Filtered Directory Tree

```text
OpenX/
|-- apps/
|   `-- desktop/
|       |-- electron/
|       |   |-- crash-recovery.js
|       |   |-- main.js
|       |   `-- security.js
|       |-- renderer/
|       |   |-- chat/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   |-- planner/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   |-- settings/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   |-- timer-widget/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   `-- voice-capture/
|       |       |-- index.html
|       |       `-- index.js
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
|       |   |   `-- index.js
|       |   |-- config/
|       |   |   `-- VoiceSettings.js
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
|       |   |   `-- VoiceMetrics.js
|       |   |-- integration/
|       |   |   |-- AssistantDispatcher.js
|       |   |   |-- AssistantInputAdapter.js
|       |   |   |-- index.js
|       |   |   |-- VoiceAssistantBridge.js
|       |   |   |-- VoiceExecutionCoordinator.js
|       |   |   |-- VoiceIntegrationConfiguration.js
|       |   |   |-- VoiceIntegrationErrors.js
|       |   |   |-- VoiceIntegrationEvents.js
|       |   |   `-- VoiceResponseHandler.js
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
|       |   |   `-- TranscriptProcessor.js
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
|       |   |   `-- VoiceActivityDetector.js
|       |   |-- session/
|       |   |   |-- SessionEvents.js
|       |   |   |-- VoiceSession.js
|       |   |   |-- VoiceSessionManager.js
|       |   |   `-- VoiceStateMachine.js
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
|       |   |   `-- TranscriptSegment.js
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
|       |   |   `-- VoiceWindowController.js
|       |   |-- index.js
|       |   `-- tts.js
|       |-- permissions.js
|       |-- phone-verification.js
|       |-- preload.js
|       `-- settings.js
|-- build/
|   |-- icon.ico
|   |-- icon.png
|   |-- ICON_README.md
|   |-- installer.nsh
|   `-- openx-chrome-host.exe
|-- core/
|   |-- assistant/
|   |   |-- active-learning/
|   |   |   |-- ActiveLearningManager.js
|   |   |   |-- AliasStore.js
|   |   |   |-- BaseStore.js
|   |   |   |-- CorrectionStore.js
|   |   |   |-- LearningGuard.js
|   |   |   |-- LearningLanguage.js
|   |   |   |-- PreferenceStore.js
|   |   |   |-- UsageStatsStore.js
|   |   |   `-- WorkflowStore.js
|   |   |-- nlp/
|   |   |   |-- nlp.js
|   |   |   |-- preprocessor.js
|   |   |   |-- scorer.js
|   |   |   `-- web-targets.js
|   |   |-- Active-learning.js
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
|   |   `-- router.js
|   |-- automation/
|   |   |-- common/
|   |   |   |-- action-confirm.js
|   |   |   |-- action-velidation.js
|   |   |   |-- action-verification.js
|   |   |   |-- launcher.js
|   |   |   |-- path-utils.js
|   |   |   `-- windows-session.js
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
|   |   `-- windows.js
|   |-- context-awareness/
|   |   |-- active-window.js
|   |   |-- app-registry.js
|   |   |-- context-engine.js
|   |   |-- mode-engine.js
|   |   |-- process-monitor.js
|   |   `-- signals.js
|   `-- phone/
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
|       `-- TransferIntegrity.js
|-- docs/
|   |-- architecture/
|   |   `-- overview.md
|   |-- modules/
|   |   |-- assistant-communication.md
|   |   |-- communications.md
|   |   |-- core-engine.md
|   |   |-- nlp-pipeline.md
|   |   `-- settings.md
|   |-- plugins/
|   |   `-- development.md
|   |-- setup/
|   |   `-- installation.md
|   `-- workflows/
|       `-- command-execution.md
|-- models/
|   `-- parakeet/
|       |-- decoder.int8.onnx
|       |-- encoder.int8.onnx
|       |-- joiner.int8.onnx
|       `-- tokens.txt
|-- plugins/
|   |-- chrome/
|   |   |-- index.js
|   |   `-- plugin.json
|   |-- communications/
|   |   `-- whatsapp-desktop.js
|   |-- discord/
|   |   |-- index.js
|   |   `-- plugin.json
|   |-- forms/
|   |   |-- index.js
|   |   `-- understanding.js
|   |-- sample_plugin/
|   |   |-- index.js
|   |   `-- plugin.json
|   |-- youtube/
|   |   |-- index.js
|   |   `-- plugin.json
|   `-- plugin-controller.js
|-- scripts/
|   |-- enable-phone-pairing-firewall.ps1
|   `-- start-electron.js
|-- tests/
|   |-- automation/
|   |   |-- apps.test.js
|   |   |-- automation.test.js
|   |   |-- browser.test.js
|   |   |-- communications.test.js
|   |   |-- file-management.test.js
|   |   |-- media.test.js
|   |   |-- volume-brightness.test.js
|   |   `-- windows-session.test.js
|   |-- context-awareness/
|   |   |-- context-awareness.test.js
|   |   `-- mode-engine.test.js
|   |-- core/
|   |   |-- active-learning-v2.test.js
|   |   |-- app-language.test.js
|   |   |-- architecture-structure.test.js
|   |   |-- assistant.test.js
|   |   |-- browser-language.test.js
|   |   |-- command-corpus.test.js
|   |   |-- crash-recovery.test.js
|   |   |-- data-root.test.js
|   |   |-- electron-security.test.js
|   |   |-- electron-shortcut.test.js
|   |   |-- entities.test.js
|   |   |-- human-context.test.js
|   |   |-- intents.test.js
|   |   |-- learning.test.js
|   |   |-- learning-repair.test.js
|   |   |-- logger.test.js
|   |   |-- media-youtube-corpus.test.js
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
|   |   |-- renderer-security.test.js
|   |   |-- responses.test.js
|   |   |-- router.test.js
|   |   |-- scheduler-alert.test.js
|   |   |-- security-critical.test.js
|   |   |-- settings.test.js
|   |   |-- tts.test.js
|   |   `-- voice-subsystem.test.js
|   |-- media-handling/
|   |   `-- media-handling.test.js
|   `-- ui/
|       |-- chat-renderer.test.js
|       |-- planner-renderer.test.js
|       |-- schedule-alert-renderer.test.js
|       `-- timer-widget-renderer.test.js
|-- .gitignore
|-- AGENTS.md
|-- commands.md
|-- config.js
|-- eslint.config.mjs
|-- package.json
|-- package-lock.json
|-- README.md
|-- report.md
`-- RULES.md
```
