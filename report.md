# OpenX Repository Report

Report date: 2026-07-21

Repository: `OpenX`

Package: `openx`

Version source: `package.json`

Current version: `10.0.0`

Branch / commit: `chatintegration` / `7c8a5fa`

## Scope Scanned

This report was regenerated from the current OpenX working tree. The scan covers source, renderer UI, assistant runtime, OpenX Chat client runtime, Visual Memory, AI Vision, chat, cloud/mobile, plugins, tests, scripts, documentation, model assets, and build metadata.

Excluded or collapsed generated/local-heavy folders:

- `.agents/`
- `.code-review-graph/`
- `.codex/`
- `.git/`
- `dist/`
- `graphify-out/`
- `node_modules/`

Current filtered scan size:

- `1066` files after exclusions.
- `807` files under `core/`.
- `114` files under `apps/`.
- `103` files under `tests/`.
- `11` files under `plugins/`.
- `11` files under `docs/`.

Top-level file distribution:

| Area | Files |
|---|---:|
| `core` | 807 |
| `apps` | 114 |
| `tests` | 103 |
| `docs` | 11 |
| `plugins` | 11 |
| `build` | 5 |
| `models` | 4 |
| `.gitignore` | 1 |
| `AGENTS.md` | 1 |
| `commands.md` | 1 |
| `config.js` | 1 |
| `eslint.config.mjs` | 1 |
| `package-lock.json` | 1 |
| `package.json` | 1 |
| `README.md` | 1 |
| `report.md` | 1 |
| `RULES.md` | 1 |
| `scripts` | 1 |

File type distribution:

| Extension | Files |
|---|---:|
| `.js` | 1009 |
| `.md` | 17 |
| `.json` | 9 |
| `.onnx` | 8 |
| `.html` | 5 |
| `.css` | 4 |
| `.data` | 2 |
| `.ini` | 2 |
| `.yml` | 2 |
| `.exe` | 1 |
| `.ico` | 1 |
| `.mjs` | 1 |
| `.nsh` | 1 |
| `.png` | 1 |
| `.ps1` | 1 |
| `.txt` | 1 |
| `[no-ext]` | 1 |

## Current Working Tree

The repository is actively modified. This report documents the current workspace state and does not revert or discard existing user/development changes.

Current tracked status snapshot:

- `M README.md`

## Product Purpose

OpenX is a local-first Windows desktop assistant. It combines deterministic assistant command understanding, desktop automation, local chat, OpenX Chat, cloud/mobile pairing, local gallery, Visual Memory, face memory, scheduling, security, settings, learning, and plugin execution.

The assistant is intentionally layered. It does not treat natural language, permissions, execution, verification, and response generation as one step. It separates each concern so commands can be understood, validated, executed, verified, and explained consistently across chat, chat, desktop UI, mobile/cloud, and plugin surfaces.

Primary design goals:

- Local-first storage and privacy.
- Deterministic command handling where possible.
- Shared assistant intelligence across desktop chat, chat, mobile, cloud, and OpenX Chat commands.
- Human-readable responses and logs.
- Lazy loading for heavy chat and Visual Memory resources.
- Bounded local histories and cleanup paths.
- Safe IPC and confirmation boundaries for privileged actions.

## Technology And Language Inventory

| Area | Technology |
|---|---|
| Desktop shell | Electron `28.3.3` |
| Runtime | Node.js `>=18.18.0 <23`, npm `>=9` |
| Main language | JavaScript, CommonJS |
| Renderer UI | HTML, CSS, browser JavaScript |
| Windows helper scripts | PowerShell |
| Text-to-text | `text-runtime-onnx-node` with local text model ONNX files |
| Text-to-text | Windows SAPI |
| Realtime networking | `ws` WebSocket client |
| QR generation | `qrcode` |
| Fuzzy search | `fuse.js` |
| Browser/UI validation | Playwright |
| Test framework | Mocha, Chai |
| Linting | ESLint |
| Packaging | `electron-builder`, NSIS |
| Archive/file tooling | `archiver` |

## Local Models And Runtime Assets

OpenX uses local model assets and local Windows runtime APIs for chat, visual memory, face analysis, OCR, and semantic image retrieval foundations.

| Asset/runtime | Purpose |
|---|---|
| text model ONNX under `models/text-model/` | Local text-to-text through text runtime ONNX. |
| Windows SAPI | Local text-to-text. |
| Windows FaceDetector bridge in `core/vision/runtime/windows-face-analysis.ps1` | Windows-local face detection and face-region quality/vector signals. |
| SCRFD ONNX | Face detection model asset for AI Vision / Visual Memory paths. |
| MobileFaceNet ONNX | Face embedding model asset for local face recognition/matching paths. |
| MobileCLIP ONNX | Image-text embedding model asset for semantic visual search paths. |
| PaddleOCR ONNX | Text-in-image/OCR model assets. |

Model and runtime files found:

- `core/assistant/capabilities/visual-memory/runtime/models/mobileclip/config.json`
- `core/assistant/capabilities/visual-memory/runtime/models/mobileclip/desktop.ini`
- `core/assistant/capabilities/visual-memory/runtime/models/mobileclip/mobileclip_s2.onnx`
- `core/assistant/capabilities/visual-memory/runtime/models/mobileclip/mobileclip_s2.onnx.data`
- `core/assistant/capabilities/visual-memory/runtime/models/mobilefacenet/MobileFaceNet.onnx`
- `core/assistant/capabilities/visual-memory/runtime/models/mobilefacenet/MobileFaceNet.onnx.data`
- `core/assistant/capabilities/visual-memory/runtime/models/mobilefacenet/desktop.ini`
- `core/assistant/capabilities/visual-memory/runtime/models/paddleocr/Recognition/inference (1).json`
- `core/assistant/capabilities/visual-memory/runtime/models/paddleocr/Recognition/inference.onnx`
- `core/assistant/capabilities/visual-memory/runtime/models/paddleocr/Recognition/inference.yml`
- `core/assistant/capabilities/visual-memory/runtime/models/paddleocr/detection/inference.json`
- `core/assistant/capabilities/visual-memory/runtime/models/paddleocr/detection/inference.onnx`
- `core/assistant/capabilities/visual-memory/runtime/models/paddleocr/detection/inference.yml`
- `core/assistant/capabilities/visual-memory/runtime/models/scrfd/2.5g_bnkps.onnx`
- `models/text-model/decoder.int8.onnx`
- `models/text-model/encoder.int8.onnx`
- `models/text-model/joiner.int8.onnx`
- `models/text-model/tokens.txt`

## Main Runtime Entrypoints And Important Methods

| File | Important classes/functions | Responsibility |
|---|---|---|
| `apps/desktop/electron/main.js` | `initializeAssistant`, `setupIPC`, `createChatWindow`, `createSettingsWindow`, `createPeopleChatWindow`, `createGalleryWindow`, `startDesktopChatRegistration`, `sendDesktopChatMessage`, `sendDesktopChatMessageToContact`, `processDesktopChatIncomingEnvelope`, `syncDesktopChatMailbox`, `startDesktopChatReceiveRuntime`, `ensureVisualMemoryRuntime`, `getLazyVisualMemoryApi`, `initializeCloudConnection`, `initializeCloudPairing`, `initializeCloudCommands`, `initializeCloudFileTransfers` | Main Electron process, app lifecycle, IPC, windows, assistant boot, desktop chat, live receive, mailbox sync, Dynamic Island, gallery, cloud, chat, data cleanup, and shutdown. |
| `apps/desktop/electron/security.js` | IPC validation helpers and allow-listing | Validates renderer payloads before privileged main-process handlers run. |
| `apps/desktop/preload.js` | `contextBridge` APIs, chat overlay DOM render helpers | Safe renderer bridge for assistant, settings, gallery, cloud, chat, chat, and UI commands. |
| `apps/desktop/renderer/chat/index.js` | assistant chat handlers, settings handlers, people chat handlers, app navigation handlers | Main desktop renderer for assistant chat, activity, apps, settings, profile, OpenX Chat, and Dynamic Island-adjacent UI state. |
| `apps/desktop/renderer/gallery/index.js` | gallery rendering, people scan, viewer, favorites, recent, search | Local Gallery UI. |
| `core/assistant/index.js` | `Assistant`, `processCommand`, `_processCommandDirect`, contextual rewrite and pending state methods | Main assistant facade. |
| `core/assistant/automation/ActionRouter.js` | `ActionRouter`, `process` | Natural command routing, multi-command splitting, intent/entity repair, and automation preparation. |
| `core/automation/index.js` | `AutomationEngine`, `execute` | Dispatches validated actions to automation controllers. |
| `core/assistant/Data.js` | `buildDataPaths`, `resolveDataRoot`, `ensureDataRoot`, `migrateLegacyData`, `readJsonFile`, `writeJsonAtomic`, `Logger`, `Validator`, `Normalizer`, `IdGenerator` | Central data-root, atomic JSON storage, migration, logging, validation, and helpers. |
| `core/assistant/response/ResponseGenerator.js` | `ResponseGenerator` | Human-readable assistant responses, confirmations, clarifications, success, partial failure, and errors. |
| `core/chat/ChatManager.js` | `ChatManager` | Local OpenX Chat runtime orchestration. |
| `core/chat/messages/MessageManager.js` | `MessageManager` | Message creation, validation, storage, routing, retry, ACK, and sync coordination. |
| `core/chat/crypto/CryptoManager.js` | `CryptoManager` | Local chat cryptography manager. |
| `core/chat/crypto/AESManager.js` | `AESManager` | AES-256-GCM encryption/decryption API. |
| `core/chat/crypto/HKDFManager.js` | `HKDFManager` | HKDF-SHA256 key derivation with context/domain separation. |
| `core/chat/crypto/IdentityManager.js` | `IdentityManager` | Identity key lifecycle. |
| `core/chat/crypto/KeyManager.js` | `KeyManager` | Device/session key lifecycle. |
| `core/chat/crypto/SecureStorageManager.js` | `SecureStorageManager` | Local secure key storage abstraction. |
| `core/chat/conversations/ConversationManager.js` | `ConversationManager` | Local conversations, search, pin/mute/archive, pagination, and storage coordination. |
| `core/chat/synchronization/SynchronizationManager.js` | `SynchronizationManager` | Cursor, sequence, ACK, recovery, and sync orchestration. |
| `core/cloud/CloudConnectionManager.js` | `connect`, `disconnect`, `reconnect`, `sendRelayPacket`, retry queue, secure packet handling | Cloud relay WebSocket lifecycle and packet transport. |
| `core/cloud/CloudPairingManager.js` | `createPairing`, `approvePairing`, `rejectPairing`, secure approval helpers | QR pairing and device trust flow. |
| `core/cloud/CloudFileTransferManager.js` | incoming prompt, accept/reject, chunk send/receive, hash verification, cleanup | Mobile/cloud file transfer lifecycle. |
| `core/cloud/CloudE2EE.js` | `generateSecret`, `deriveKey`, `encryptJson`, `decryptJson`, `SecurePacketChannel` | Cloud packet encryption helpers. |
| `apps/desktop/chat/integration/AssistantDispatcher.js` | `dispatch` | Sends normalized chat commands to `Assistant.processCommand`. |
| `apps/desktop/chat/integration/ChatAssistantBridge.js` | inputText event bridge | Connects chat session events to assistant dispatch. |
| `apps/desktop/chat/textInput/text inputEngine.js` | `text inputEngine` | Text recognition facade. |
| `apps/desktop/chat/normalization/Input TextProcessor.js` | `process` | Cleans and normalizes text input output before assistant routing. |
| `apps/desktop/chat/textOutput.js` | `TextToText` | Windows SAPI text output. |
| `core/assistant/capabilities/visual-memory/runtime/api/VisualMemoryAPI.js` | `start`, `getPhotos`, `searchMemories`, `scanGalleryPeople`, `matchFace`, `searchFaces` | Public Visual Memory API. |
| `core/assistant/capabilities/visual-memory/runtime/engine/VisualMemoryEngine.js` | `start`, `restart` | Visual-memory database, gallery, folders, metadata, query, filtering, intelligence, learning, and face memory. |
| `core/assistant/capabilities/visual-memory/runtime/query/VisualQueryParser.js` | visual query parsing | Converts photo/search language into structured visual constraints. |
| `core/assistant/capabilities/visual-memory/runtime/intelligence/ranking/MemoryRankingEngine.js` | memory ranking | Ranks photo/memory candidates by person, relation, date, semantic and metadata evidence. |
| `core/assistant/capabilities/visual-memory/runtime/faces/engine/FaceMemoryEngine.js` | `ingestUnknownFace`, `matchFace`, `searchFaces`, `splitIdentity` | Face memory, matching, grouping, identity assignment, and search. |
| `core/vision/engine/VisionEngine.js` | `VisionEngine` | AI Vision facade. |
| `core/vision/runtime/RuntimeManager.js` | runtime selection | Chooses and manages vision runtimes. |
| `core/vision/runtime/WindowsFaceRuntimeAdapter.js` | `analyze` | Node adapter for local Windows face analysis. |

## Assistant Command Processing Deep Dive

Typical assistant command lifecycle:

```text
User input
  -> Assistant.processCommand()
  -> pending confirmation / clarification check
  -> schedule completion check
  -> learning and correction check
  -> direct context answer check
  -> contextual rewrite
  -> ActionRouter.process()
  -> normalization and noisy repair
  -> multi-command splitting
  -> intent and entity resolution
  -> validation and permission checks
  -> AutomationEngine.execute()
  -> controller execution
  -> verification
  -> ResponseGenerator
  -> context and learning update
  -> renderer / chat / dynamic island / mobile / cloud response
```

Key command examples handled by the architecture:

- `open chrome and instagram and whatsapp` -> multi-app open commands.
- `close them` -> resolves the previous successful app group.
- `set the volume and brightness to 40` -> shared value split into two utility commands.
- `play child in us song in youtube` -> media query extraction and YouTube routing.
- `i have a meeting at 6pm tomorrow remind me` -> reminder/scheduler routing instead of plain memory.
- `find photos of mummy and daddy` -> Visual Memory relation/person photo search instead of web search.
- `say hi to rishi` -> OpenX Chat contact lookup and message send path.

## Core Assistant Layers

| Layer | Main folder | Responsibility |
|---|---|---|
| Acquisition | `core/assistant/acquisition/` | Source adapters for chat, chat, cloud, phone, OCR, plugin, API, clipboard, and metadata. |
| Normalization | `core/assistant/normalization/` | Input cleaning, contractions, spelling, punctuation, time/date/number/unit/slang handling. |
| Linguistic | `core/assistant/linguistic/` | Tokenization, sentence splitting, POS, verbs, subjects, objects, clauses, pronouns, modifiers, questions. |
| Semantic | `core/assistant/semantic/` | Meaning, confidence, relationship analysis, web target detection, conversation classification. |
| Entities | `core/assistant/entities/` | Apps, files, folders, people, contacts, reminders, times, media, devices, websites, paths, windows. |
| Memory/context | `core/assistant/memory/`, `core/assistant/context/`, `core/assistant/references/` | Conversation history, follow-ups, recent apps/files/searches, pronouns, topics. |
| Reasoning | `core/assistant/reasoning/` | Goal and intent reasoning, confidence, conflicts, context reasoning. |
| Planning | `core/assistant/planning/` | Task plans, dependencies, parallelism, recovery plans. |
| Decision | `core/assistant/decision/` | Execute/confirm/clarify/policy/conflict decisions. |
| Validation | `core/assistant/validation/` | Safety, permissions, context readiness, constraints, entity validation. |
| Automation bridge | `core/assistant/automation/` | Route assistant outputs into automation execution. |
| Verification | `core/assistant/verification/` | App/browser/window/reminder/cloud/transfer/execution verification. |
| Response | `core/assistant/response/` | Chat, chat, notification, success/error/summary/clarification text. |
| Learning | `core/assistant/learning/` | Local personalization, alias/correction/preference/habit/workflow/feedback learning. |

## Automation Controllers

| Controller | File | Responsibility |
|---|---|---|
| Apps | `core/automation/apps.js` | Open, close, switch, focus, verify apps/windows. |
| Browser | `core/automation/browser.js` | Browser launch, URL/search/site workflows. |
| Files | `core/automation/files.js` | Search/open/copy/move/delete/archive files. |
| Folders | `core/automation/folders.js` | Search/open/create/copy/move/delete/list folders. |
| Media | `core/automation/media.js` | Media query parsing, YouTube/default platform routing, playback controls. |
| Planner | `core/automation/planner.js` | Planner/calendar/day-plan data. |
| Scheduler | `core/automation/scheduler.js` | Reminders, alarms, timers, snooze/stop, schedule alerts. |
| Screenshot/recording | `core/automation/screenshot-recording.js` | Screenshots and screen recording. |
| System | `core/automation/system.js` | System info, diagnostics, settings, power, task manager. |
| Volume | `core/automation/volume.js` | Volume set/up/down/mute/unmute. |
| Brightness | `core/automation/brightness.js` | Brightness set/up/down. |
| Windows | `core/automation/windows.js` | Window management. |
| Communications | `core/automation/communications.js` | Communication command foundation. |

## OpenX Chat Client Runtime

The OpenX desktop app includes a local chat client runtime under `core/chat` and desktop integration in `apps/desktop/electron/main.js` plus the chat renderer. It connects to OpenX Chat Server for account, contact, relationship, live delivery, mailbox, and sync transport while keeping local state in `OpenX_Data`.

Chat send workflow:

```text
OpenX Chat UI or assistant command
  -> sendDesktopChatMessage / sendDesktopChatMessageToContact
  -> local conversation lookup
  -> message validation
  -> local optimistic history entry
  -> encrypted transport payload
  -> OpenX Chat Server /messages/send
  -> live recipient route or mailbox fallback
  -> local status update and sync state
```

Chat receive workflow:

```text
WebSocket envelope or mailbox sync envelope
  -> processDesktopChatIncomingEnvelope
  -> decrypt / decode preview
  -> ensure local conversation
  -> append bounded local message history
  -> ACK contiguous mailbox sequence
  -> notify renderer
  -> Dynamic Island notification if chat is not active
  -> optional text output prompt for urgent/actionable messages
```

Important chat modules:

- `core/chat/crypto/`: identity keys, device keys, session keys, AES, HKDF, replay protection, random, rotation, secure storage.
- `core/chat/conversations/`: local conversation model, storage, search, sorting, pin, mute, archive, pagination.
- `core/chat/messages/`: message model, validation, pipeline, router, storage, retry, ACK, typing, compression.
- `core/chat/mailbox/`: mailbox client, sync, sequence, ACK, retry.
- `core/chat/synchronization/`: cursors, sequence recovery, conflict handling, retries, ACK.
- `core/chat/requests/`: contact requests, trust, nicknames, block handling.
- `core/chat/devices/`: device lifecycle, device registry, device metadata.
- `core/chat/connection/`: connection engine, heartbeat, presence, recovery, sessions, network monitor.
- `core/chat/infrastructure/`: memory, storage, connection, sync, metrics, monitoring, and performance optimization helpers.
- `core/chat/quality/`: production validation, crash recovery, release and performance reporting.

## Chat Runtime

Chat is built as a layered local runtime under `apps/desktop/chat`. The design keeps capture, preprocessing, text input, inputText normalization, assistant dispatch, text output, overlay UI, and diagnostics separate.

```text
Alt+Space / chat shortcut
  -> AudioCapture
  -> AudioPipeline and VAD
  -> text inputEngine / text runtime ONNX / text model
  -> Input TextProcessor
  -> AssistantDispatcher
  -> Assistant.processCommand
  -> ChatResponseHandler
  -> ChatExecutionCoordinator
  -> Windows SAPI text output and Dynamic Island overlay
```

Performance notes:

- text input model location is validated at startup.
- Heavy runtime prewarm is skipped until first use by default.
- Diagnostics avoid storing raw audio or private inputText content.
- chat output is generated through the assistant response pipeline.

## Visual Memory, Gallery, And AI Vision

Visual Memory is a local-first photo memory system. It supports local gallery browsing, local indexing, structured photo search, face memory, people naming, relation metadata, duplicate suppression, and AI Vision model integration points.

Gallery workflow:

```text
open openx gallery
  -> Assistant routes visualMemory.openGallery
  -> Electron opens Gallery renderer
  -> Visual Memory runtime is lazy-loaded
  -> Pictures folders are indexed
  -> photos are grouped by date
  -> file URLs are returned for previews
  -> favorites, recent, people, and viewer state are managed locally
```

People scan workflow:

```text
Gallery People -> Scan People
  -> gallery:scanPeople IPC validation
  -> VisualMemoryAPI.scanGalleryPeople
  -> VisionEngine
  -> WindowsFaceRuntimeAdapter or configured model runtime
  -> face detection and embedding extraction
  -> quality and false-positive filtering
  -> duplicate suppression
  -> FaceMemoryEngine grouping/matching
  -> unnamed and named people surface in Gallery
```

Photo search workflow:

```text
find latest photos of me and daddy
  -> VisualQueryParser extracts people, relations, date/recency, objects, places
  -> CandidateFilterEngine applies metadata/person/date filters
  -> MemoryRankingEngine ranks by exact people, relationship evidence, dates, recency, confidence, and diversity
  -> VisualMemoryStructuredResponse returns bounded photo cards/options
```

## Cloud, Pairing, Mobile, And File Transfer

Cloud/mobile support is optional. Local assistant automation works without relay connection. When enabled, OpenX connects to the cloud relay and uses managed pairing, command routing, presence, and file transfer flows.

Default relay URL from `config.js`:

```text
wss://openx-server.onrender.com/ws
```

Default OpenX Chat Server URL from `config.js`:

```text
https://openx-chat-server.onrender.com
```

File transfer destination rule:

- Managed transfer state belongs under `OpenX_Data`.
- User-visible received files belong under `%USERPROFILE%\Documents\OpenX`.

## Data Storage Rules

Central data paths are managed by `core/assistant/Data.js` and `config.js`. Deleting the OpenX data root should remove assistant runtime state, assistant chat history, OpenX Chat local history, learning, settings, visual memory state, and runtime metadata.

Managed data root:

```text
%USERPROFILE%\OpenX_Data\
```

| Data | Managed location |
|---|---|
| Settings | `OpenX_Data/settings.json` |
| Assistant chat history | `OpenX_Data/assistant-chat-history.json` |
| UI state | `OpenX_Data/ui-state.json` |
| Planner | `OpenX_Data/planner.json` |
| Schedules, alarms, timers, reminders | `OpenX_Data/schedules.json` |
| Learning | `OpenX_Data/learning/` |
| Logs | `OpenX_Data/logs/` |
| Chat diagnostics | `OpenX_Data/chat/diagnostics/` |
| Cloud state | `OpenX_Data/cloud/` |
| OpenX Chat local state | `OpenX_Data/chat/` |
| Electron/runtime profiles | `OpenX_Data/runtime/` |
| Visual memory | `OpenX_Data/visual-memory/` |
| Security state | `OpenX_Data/security/` |
| Screenshots | `OpenX_Data/screenshots/` |

External user-visible transfer destination:

```text
%USERPROFILE%\Documents\OpenX\
```

## Security And Privacy Boundaries

- Renderer windows use preload APIs instead of direct privileged Node access.
- IPC requests are validated in `apps/desktop/electron/security.js`.
- Main process owns privileged desktop automation and storage access.
- Confirmation and security-lock paths protect high-risk actions.
- Private chat keys remain local.
- Chat server transport should not receive private keys.
- Local photo indexing does not copy photos into OpenX by default.
- Visual Memory should not upload raw photos by default.
- Logs must avoid secrets, tokens, passwords, OTPs, private keys, raw key material, and private message content.
- Chat diagnostics store metadata and lengths, not raw audio or private inputText content.

## Plugin Runtime

Plugins live under `plugins/` and are loaded by the desktop runtime. Trusted plugin names are configured in `config.js`.

Current trusted plugins:

- `chrome`
- `discord`
- `sample_plugin`
- `youtube`

Plugin actions are registered with the assistant/automation layer and remain subject to routing, validation, and execution boundaries.

## Testing And Build Commands

| Command | Purpose |
|---|---|
| `npm start` | Start Electron desktop runtime. |
| `npm run dev` | Start Electron in development mode. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run all Mocha tests. |
| `npm run test:core` | Run core tests. |
| `npm run test:automation` | Run automation tests. |
| `npm run test:context` | Run context-awareness and human-context tests. |
| `npm run test:learning` | Run learning tests. |
| `npm run test:ui` | Run UI tests. |
| `npm run validate` | Run lint plus full tests. |
| `npm run build` | Build unpacked Electron app. |
| `npm run package` | Build Windows NSIS installer. |

## Package And Installer Configuration

- App ID: `com.openx.assistant`.
- Product name: `OpenX`.
- Package output directory: `dist/`.
- Build resources: `build/`.
- ASAR enabled.
- `text-runtime-onnx-node`, `playwright`, and `playwright-core` are unpacked from ASAR.
- text model ONNX model files are included as extra files.
- `build/openx-chrome-host.exe` is included for native messaging.
- NSIS installer is configurable and does not delete app data on uninstall by default.

## Test Coverage Map

| Folder | Coverage |
|---|---|
| `tests/core/` | Assistant, NLP, routing, learning, security, cloud, gallery, visual memory, chat, chat, settings, scheduler, validation, verification. |
| `tests/automation/` | Apps, browser, files, media, volume, brightness, communications, windows/session automation. |
| `tests/context-awareness/` | Context engine and mode engine. |
| `tests/ui/` | Renderer UI contracts for chat, gallery, planner, dynamic island, timer widget, schedule alerts. |
| `tests/media-handling/` | Media handling behavior. |

## Detailed System Architecture

OpenX is structured as several cooperating runtimes inside one Electron desktop application. The main process owns privileged work, the renderer owns user interaction, and `core/` owns assistant intelligence and non-UI domain logic.

The main architectural split is:

```text
Electron main process
  -> window lifecycle
  -> IPC validation
  -> assistant instance
  -> desktop automation
  -> chat runtime ownership
  -> cloud relay ownership
  -> chat server transport
  -> gallery / visual-memory bridge
  -> data-root migration and cleanup

Renderer process
  -> assistant chat UI
  -> apps/settings/activity surfaces
  -> OpenX Chat UI
  -> Gallery UI
  -> Planner UI
  -> chat capture UI
  -> safe preload APIs only

Core runtime
  -> NLP and routing
  -> validation / verification / response
  -> learning and context
  -> automation controllers
  -> OpenX Chat client modules
  -> cloud managers
  -> visual-memory and vision engines
```

The codebase deliberately avoids placing all assistant behavior in the Electron renderer. Renderer windows cannot directly run arbitrary filesystem, process, or automation code. They send structured requests over preload APIs, and the main process validates those payloads before invoking privileged work.

## Desktop Electron Runtime Detail

`apps/desktop/electron/main.js` is the largest coordination file. It does not only create windows; it is also the integration point between desktop UI, assistant core, OpenX Chat, Visual Memory, chat, cloud relay, file transfer, Dynamic Island, settings, security lock, crash recovery, and cleanup.

Important main-process responsibilities:

- Configure managed Electron profile storage inside `OpenX_Data/runtime/electron-profile`.
- Migrate legacy data into the managed data root.
- Register global shortcuts for assistant chat and chat.
- Create and recover renderer windows.
- Harden renderer sessions and permissions.
- Maintain assistant runtime singleton.
- Dispatch assistant commands from chat, chat, phone, cloud, and OpenX Chat.
- Start chat capture and chat overlay only when needed.
- Start Visual Memory only when a gallery or visual-memory path needs it.
- Connect to cloud relay only when enabled or requested.
- Manage file transfer prompts, progress, accept/reject, and final storage.
- Manage OpenX Chat registration/login, live WebSocket receive, mailbox sync, message send, and local history.
- Present schedule alerts, chat notifications, transfer prompts, and phone notifications through the Dynamic Island.
- Clean up timers, windows, sockets, chat runtime, and child processes during shutdown.

Key runtime protection mechanisms:

- `secureWindow(...)` wraps BrowserWindow instances with load failure, crash, and unresponsive recovery behavior.
- `registerIpcHandler(...)` centralizes IPC handler registration.
- `toIpcSafeValue(...)` converts values into renderer-safe payloads.
- `setupIPC()` registers all renderer-accessible commands.
- `teardownIPC()` removes handlers during shutdown/reload paths.
- `cleanupRuntime()` coordinates shutdown of assistant, chat, cloud, chat receive runtime, and windows.

## Renderer UI Surfaces

OpenX has multiple renderer surfaces. Each renderer has a narrow purpose and communicates through preload APIs.

| Renderer | Path | Purpose |
|---|---|---|
| Assistant/chat shell | `apps/desktop/renderer/chat/` | Main assistant chat, activity, apps list, settings, profile, OpenX Chat, registration, contact management, local message UI. |
| Gallery | `apps/desktop/renderer/gallery/` | Photos, favorites, recent, people, face naming/relation UI, search, viewer. |
| Planner | `apps/desktop/renderer/planner/` | Calendar, planner, schedule views. |
| Timer widget | `apps/desktop/renderer/timer-widget/` | Floating timer/reminder/alarm widget state. |
| Chat capture | `apps/desktop/renderer/chat-capture/` | Browser-side audio capture bridge when chat is active. |
| Chat overlay | `apps/desktop/chat/ui/` | Dynamic Island style chat state, inputText, actions, live schedule, notifications, chat prompts. |

The main assistant renderer under `apps/desktop/renderer/chat` now handles both the assistant window and OpenX Chat app. It contains logic for:

- Assistant command submission.
- Chat history rendering and clearing.
- Settings tabs and profile state.
- Apps surface navigation.
- Activity notifications.
- OpenX Chat setup.
- Username/password based chat account setup.
- Contact search and request flows.
- Accepted contact list.
- Conversation open/edit/delete.
- Local message rendering.
- Message status display.
- Dynamic UI updates from main process notifications.

## IPC And Preload Contract

`apps/desktop/preload.js` exposes narrow APIs through Electron `contextBridge`. Renderer code should use those APIs instead of requiring Node modules or directly touching local files.

Important preload-exposed capability groups:

- Assistant command processing.
- Chat history and UI state.
- Settings and profile updates.
- Security lock status and verification.
- Planner and schedule commands.
- Chat overlay/capture state.
- Cloud connection, pairing, devices, and transfer actions.
- Gallery photo, favorite, recent, people, and scan operations.
- OpenX Chat setup, contact, conversation, and message operations.

IPC validation is handled by `apps/desktop/electron/security.js`. It validates payload shape, channel ownership, lengths, IDs, usernames, passwords, gallery options, cloud transfer payloads, and other user input before main-process handlers execute.

Security intent:

```text
renderer payload
  -> preload API
  -> ipcMain handler
  -> security validation
  -> main-process domain function
  -> sanitized response
```

## NLP And Assistant Intelligence Detail

OpenX has a deterministic, layered NLP stack. The assistant does not depend on one model call to understand every command. Instead it combines rule-based normalization, structured extraction, semantic interpretation, context, and local learning.

### Acquisition

Acquisition normalizes different input sources into a consistent assistant input shape.

Important source adapters:

- Chat input.
- Chat inputTexts.
- Cloud/mobile commands.
- Phone context.
- Clipboard input.
- Plugin input.
- OCR input.
- API input.

Acquisition also attaches source metadata so later layers can distinguish a typed chat command from a phone/cloud/chat command without changing the public assistant command contract.

### Normalization

Normalization converts noisy user text into a more routeable command while preserving important meaning.

Important normalization responsibilities:

- Trim and normalize whitespace.
- Expand contractions.
- Normalize Unicode and punctuation.
- Normalize dates, times, numbers, and units.
- Repair common spelling mistakes.
- Handle slang and app/media aliases.
- Keep media titles intact when words like `and` belong to the title.
- Preserve app lists such as `chrome and instagram and whatsapp`.

### Linguistic Understanding

The linguistic layer builds a basic grammatical understanding of the command.

It handles:

- Tokenization.
- Sentence splitting.
- Verb detection.
- Subject and object detection.
- Modifier detection.
- Negation.
- Question detection.
- Pronoun detection.
- Clause analysis.
- Dependency-like relationships.

This makes later contextual rewrites safer because a pronoun such as `it` or `them` can be resolved only when there is a valid previous target.

### Semantic Understanding

The semantic layer interprets the likely intent and meaning class of the command.

It handles:

- Search vs automation distinction.
- Web target hints.
- Relationship and meaning analysis.
- Confidence scoring.
- Conversation classification.
- Natural language routing hints.

This is important for cases such as:

- `find photos of mummy and daddy` should route to Visual Memory.
- `open chatgpt` may open a web target if no local app exists.
- `play chaild in us song in youtube` should preserve the media query and route through YouTube.
- `i have a meeting at 6pm tomorrow remind me` should route to reminders, not plain learning/memory.

### Entity Extraction

Entity extraction creates structured values used by routing, validation, automation, and response.

Important entity domains:

- Applications.
- Browsers and websites.
- Files and folders.
- Contacts and people.
- Dates, times, durations.
- Reminders, alarms, timers.
- Volume and brightness.
- Media titles and platforms.
- Devices.
- Networks.
- Paths.
- Windows.
- Visual people, relationships, places, objects, and dates for photo search.

### Context And Reference Resolution

Context is what makes follow-up commands work.

Examples:

```text
open chrome and instagram and whatsapp
close them
```

The assistant records the successful app group and rewrites `close them` into individual app close commands.

```text
open chatgpt
close it
```

The assistant must know whether `chatgpt` was a real app or a web/tab target so it does not close the whole browser when the user only means the ChatGPT tab.

```text
find latest photo of me and dad
show the second one
```

Visual Memory results can become context for follow-up gallery/photo actions.

## Routing, Validation, Execution, And Verification

The command router and automation engine are separate on purpose.

```text
ActionRouter
  -> identify intent
  -> extract/repair entities
  -> split multi-command
  -> attach confidence/evidence
  -> decide if clarification/confirmation is needed

AutomationEngine
  -> call target controller
  -> execute local desktop action
  -> return structured result

Verification
  -> confirm app/window/browser/reminder/transfer state when possible
  -> report partial failure clearly
```

This separation avoids the common assistant bug where a command is understood but executed without enough safety checks.

Production-important patterns:

- Low-risk actions can execute directly.
- Medium/high/critical actions can require confirmation or security lock.
- Independent multi-command steps can continue after a partial failure.
- Response generation reports what actually happened rather than only saying `completed`.
- Verification failures become user-readable messages.

## Response And Personality System

`core/assistant/response/ResponseGenerator.js` turns structured execution results into user-facing text.

Response generation covers:

- Success.
- Failure.
- Partial success.
- Clarification.
- Confirmation.
- Suggestions.
- Summaries.
- Chat formatting.
- Chat formatting.
- Notification formatting.
- Personality/honorific handling.

Important behavior:

- A successful multi-command should summarize the actual completed work.
- A failed app close should explain which app could not be closed and why.
- A reminder should include the task and scheduled time.
- A YouTube/media action should be worded like an action, not a raw controller verification message.
- Chat-message assistant commands should report whether the message was sent, queued, or failed.

## Learning And Personalization Detail

The learning layer is local and structured. It is not an opaque retraining loop.

Learning modules include:

- Alias learning.
- Correction learning.
- Feedback learning.
- Habit learning.
- Pattern learning.
- Preference learning.
- Usage learning.
- Workflow learning.
- Active learning prompts.
- Personalization profile storage.

Learning rules:

- Do not store secrets.
- Do not store private identifiers as general learned facts.
- Prefer explicit corrections and explicit preferences over weak signals.
- Repeated successful behavior can strengthen a preference.
- Learned preferences cannot bypass validation, security, confirmation, or permissions.
- Learning is auditable and stored under `OpenX_Data/learning/`.

## OpenX Chat Detailed Client Architecture

OpenX Chat inside the desktop app has three layers:

```text
Desktop UI layer
  -> chat setup, contact search, request UI, conversation UI, message composer

Electron integration layer
  -> account/device state, server requests, WebSocket receive, mailbox sync, Dynamic Island notifications

core/chat domain layer
  -> crypto, messages, conversations, sync, requests, devices, state, transfer, quality, performance
```

### Account And Device State

Desktop chat stores local account and device state under `OpenX_Data/chat/`. The app can register or log in with the OpenX Chat Server, then register the current desktop as a device.

State includes:

- API base URL.
- Account ID.
- Username/profile metadata.
- Device ID.
- Device approval/trust state.
- Public key registration state.
- Local crypto state.
- Sync cursors.
- Conversation and message history.

### Contact And Conversation Flow

```text
User searches username/contact
  -> desktop validates input
  -> server discovery/request route
  -> request created or existing relationship returned
  -> trusted relationship saved locally
  -> local conversation created or reused
```

Conversation records keep enough metadata to find contacts by name or username and support assistant commands such as:

```text
say hi to rishi
ask charan to call me
send "I will be late" to sunil
```

### Message Send State

Message send state is intentionally visible to the user.

Possible states include:

- Local draft.
- Queued.
- Sending.
- Sent.
- Delivered.
- Failed.
- Retried.

The desktop keeps bounded local message history. The local cap protects memory and disk growth while allowing useful recent chat context.

### Message Receive State

OpenX Chat receive uses both live WebSocket and mailbox sync.

```text
live WebSocket connected
  -> message arrives immediately
  -> process envelope
  -> ACK sequence

live WebSocket disconnected
  -> message remains in mailbox
  -> syncDesktopChatMailbox polls with backoff
  -> missing envelope is processed
  -> ACK sequence when contiguous
```

This split is important because laptop sleep, network changes, and Render/cloud WebSocket resets can happen normally. The mailbox path is the recovery path.

### Dynamic Island Chat Behavior

Dynamic Island is used only when it helps the user.

Expected behavior:

- If OpenX Chat is open and active, new messages update the chat UI without a Dynamic Island interruption.
- If OpenX Chat is closed or hidden, incoming messages can appear in Dynamic Island.
- For action-like messages such as `call me`, OpenX can show a prompt and offer a small response action.
- Message prompts should identify sender and a short safe preview.

## Visual Memory Detailed Architecture

Visual Memory has a runtime API, engine, storage, gallery experience, query parser, candidate filtering, intelligence/ranking, face memory, learning, diagnostics, and privacy modules.

### Visual Memory Data Flow

```text
FolderManager
  -> discovers photo roots such as Pictures and nested folders

MetadataManager
  -> records dates, dimensions, source hints, folders, filenames

VisualMemoryDatabase
  -> stores photos, metadata, favorites, recent state, face memory state

GalleryManager / OpenXGalleryEngine
  -> creates timeline, favorites, recent, people, places, collections, viewer state

VisualQueryParser
  -> converts user text into structured visual constraints

CandidateFilterEngine
  -> filters by date, person, relationship, folder, screenshot/document, GPS/place, object/scene, count

MemoryRankingEngine
  -> ranks candidates by exact matches, relation evidence, recency, confidence, and diversity
```

### Visual Query Behavior

Visual query supports:

- People names.
- User references such as `me`.
- Relationship words such as father/daddy/papa and mother/mummy/amma.
- Multiple people in one photo.
- Latest/recent time constraints.
- Explicit dates and date ranges.
- Places and natural locations.
- Objects and scenes.
- Screenshots, documents, and receipts.
- Follow-up selection references.

Navigation-only commands such as `open openx gallery` should bypass heavy visual search.

### Face Memory Rules

Face Memory is local and user-controlled.

Rules:

- The system can group unknown faces locally.
- The system does not auto-name people.
- Named identities are created by the user.
- Relations such as daddy, mummy, grandpa, grandma, friend, and other are user-assigned.
- Named identities are preserved across rescans.
- Weak detections are suppressed.
- Object-like false positives are suppressed.
- Duplicate face candidates are removed before display.
- Search can use named people and relationship metadata.

### Face Scan And Duplicate Suppression

People scan performs several quality gates:

```text
photo input
  -> face detector
  -> face box validation
  -> embedding/vector validation
  -> confidence threshold
  -> face quality signals
  -> same-photo duplicate check
  -> cross-photo duplicate check
  -> known identity matching
  -> unknown grouping
  -> post-scan integrity pass
```

This avoids showing chairs, objects, cropped backgrounds, tiny faces, poor quality detections, and repeated copies of the same face as separate people.

## AI Vision Runtime Detail

The AI Vision layer under `core/vision` is model/runtime agnostic. It defines contracts for capabilities such as:

- Image embedding.
- Face detection.
- Face embedding.
- OCR.
- Photo search.
- Embedding storage.

Important modules:

- `VisionEngine`: public facade.
- `RuntimeManager`: runtime selection.
- `ResourceManager`: concurrency and pending inference control.
- `InferenceCoordinator`: maps tasks to configured models.
- `VisionPostprocessor`: normalizes model/runtime outputs.
- `EmbeddingManager`: vector normalization and embedding helpers.
- `ConfidenceEngine`: confidence aggregation.
- `WindowsFaceRuntimeAdapter`: Windows-local face analysis adapter.

The runtime is designed so Windows FaceDetector, SCRFD, MobileFaceNet, MobileCLIP, and OCR models can be used behind stable contracts without forcing Gallery UI changes.

## Cloud Relay And File Transfer Detail

Cloud relay modules under `core/cloud` support optional mobile/cloud connectivity.

### Cloud Connection

`CloudConnectionManager` owns:

- WebSocket connection lifecycle.
- Reconnect/backoff.
- Relay packet send/receive.
- Device state.
- Paired device list.
- Retryable packet queue.
- E2EE packet protection when configured.
- Status events for desktop UI.

### Pairing

`CloudPairingManager` owns:

- QR pair token creation.
- Pairing payload validation.
- Pending pair requests.
- Approval/rejection.
- Secure approval metadata.
- Pairing cleanup.

### Cloud Commands

`CloudCommandManager` receives assistant command packets and routes valid commands through `CloudCommandRouter`, which calls the same assistant command API used by local chat and chat:

```text
cloud command packet
  -> validate owner/device/request
  -> extract command text
  -> Assistant.processCommand(command, 'phone', options)
  -> serialize response
  -> relay response packet
```

### File Transfer

`CloudFileTransferManager` owns:

- Incoming transfer prompt.
- Accept/reject.
- Chunk receipt.
- Progress events.
- SHA-256/integrity verification.
- Temporary file handling.
- Final move to Documents/OpenX.
- Timeout and cleanup.
- Outgoing chunk send.

The user-facing file destination is intentionally not `OpenX_Data` because received files are user documents, not hidden assistant state.

## Scheduling, Planner, And Dynamic Island Detail

OpenX scheduling combines assistant parsing, scheduler automation, local data storage, UI rendering, and Dynamic Island alerts.

Supported schedule objects:

- Reminders.
- Alarms.
- Timers.
- Planner entries.
- Calendar/day-plan entries.
- Live schedule activity.

Flow:

```text
natural language schedule command
  -> date/time/duration extraction
  -> scheduler/planner controller
  -> local schedules/planner JSON
  -> timer/alert evaluation
  -> Dynamic Island or planner UI
  -> user action such as snooze/stop/open
```

Examples:

- `remind me to call mom at 9:30 pm`
- `set an alarm for tomorrow morning`
- `timer for 10 minutes`
- `i have a meeting at 6pm tomorrow remind me`

The system must distinguish schedule commands from plain learning statements when time/date language and reminder intent are present.

## Performance And Resource Strategy

OpenX has several resource-control choices that matter for production use on normal laptops.

Startup resource controls:

- Visual Memory runtime is lazy-loaded.
- Chat runtime prewarm is skipped until first use by default.
- Gallery indexing can continue in the background.
- Electron profile state is centralized under `OpenX_Data/runtime`.
- Stale temp cleanup runs after startup instead of blocking the UI.

Runtime resource controls:

- Chat sessions start only on shortcut/use.
- Vision inference uses resource/concurrency management.
- People scan uses single-flight behavior so repeated scan requests reuse the active scan.
- Gallery images use local file URLs instead of base64 IPC payloads.
- Renderer lazy loading uses intersection-based image loading.
- Chat local history is bounded.
- Logs and diagnostics should be bounded/rotated.
- Cloud command and transfer queues have size/time limits.

UI performance principles:

- Keep renderer payloads small.
- Avoid sending large image bytes through IPC.
- Use file URLs for local gallery images.
- Avoid repeated timers when a window is closed.
- Disconnect observers and polling loops on unload.
- Keep Dynamic Island updates short and structured.

## Production Readiness Notes

Important strengths:

- Centralized data root.
- Safe received-file exception.
- IPC validation layer.
- Local-first assistant state.
- Lazy heavy runtimes.
- Clear separation between assistant understanding, validation, execution, verification, and response.
- OpenX Chat client split into crypto, messages, conversations, sync, mailbox, requests, devices, and connection modules.
- Visual Memory split into gallery, query, filtering, ranking, face memory, vision runtime, and diagnostics.
- Chat split into capture, preprocessing, text input, normalization, assistant dispatch, text output, UI, and diagnostics.

Important release checks before shipping:

- Run full `npm run validate`.
- Start the packaged Electron build on a clean Windows user profile.
- Delete `%USERPROFILE%\OpenX_Data` and confirm assistant/chat local history resets as expected.
- Confirm received files still go to `%USERPROFILE%\Documents\OpenX`.
- Confirm OpenX Chat can register/login, create device state, add contact, send message, receive message, and sync mailbox after reconnect.
- Confirm Dynamic Island chat notifications appear only when chat is not active.
- Confirm gallery opens quickly and indexes in background.
- Confirm Visual Memory people scan does not overuse CPU/RAM on a large Pictures folder.
- Confirm chat first-use startup works after lazy prewarm.
- Confirm app open/close behavior on a clean Windows install with missing optional apps.
- Confirm media play commands default correctly and do not depend on user-specific installed apps.
- Confirm cloud relay disabled startup does not repeatedly connect.
- Confirm production logs do not expose secrets, private keys, passwords, OTPs, raw message content, or private inputTexts.

## Important Current Risks And Follow-Up Areas

This report is descriptive, not a guarantee that every edge case is closed. The most important areas to keep testing are:

- Clean-machine app discovery and app close behavior.
- OpenX Chat delivery status transitions from queued to sent/delivered.
- WebSocket reconnect plus mailbox sync after network sleep/wake.
- Mobile-to-desktop command forwarding when mobile is paired.
- Large Gallery indexing performance.
- Face grouping accuracy on diverse real photo libraries.
- Reminder and alarm parsing for ambiguous times such as `9 30`.
- UI text fitting across different Windows display scaling settings.
- Production server connectivity and error reporting for chat and cloud endpoints.

## Current Documentation Update Validation

This report update is documentation-only. Runtime tests are not required for this markdown rewrite, but markdown whitespace validation should be run with:

```powershell
git diff --check -- report.md
```

## Full Filtered Directory Tree

The tree below includes all files and folders from the filtered scan. The generated/dependency/local-heavy folders are shown as folders with contents omitted.

```text
OpenX/
|-- .agents/ (contents omitted)
|-- .code-review-graph/ (contents omitted)
|-- .codex/ (contents omitted)
|-- .git/ (contents omitted)
|-- .github/
|   `-- workflows/
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
|       |   |-- gallery/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   |-- planner/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   |-- timer-widget/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   `-- chat-capture/
|       |       |-- index.html
|       |       `-- index.js
|       |-- chat/
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
|       |   |   `-- ChatSettings.js
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
|       |   |   |-- ChatLogger.js
|       |   |   `-- ChatMetrics.js
|       |   |-- integration/
|       |   |   |-- AssistantDispatcher.js
|       |   |   |-- AssistantInputAdapter.js
|       |   |   |-- index.js
|       |   |   |-- ChatAssistantBridge.js
|       |   |   |-- ChatExecutionCoordinator.js
|       |   |   |-- ChatIntegrationConfiguration.js
|       |   |   |-- ChatIntegrationErrors.js
|       |   |   |-- ChatIntegrationEvents.js
|       |   |   `-- ChatResponseHandler.js
|       |   |-- normalization/
|       |   |   |-- AcronymNormalizer.js
|       |   |   |-- ApplicationNormalizer.js
|       |   |   |-- CommandNormalizer.js
|       |   |   |-- DictionaryNormalizer.js
|       |   |   |-- index.js
|       |   |   |-- NormalizationConfiguration.js
|       |   |   |-- NormalizationErrors.js
|       |   |   |-- NormalizationEvents.js
|       |   |   |-- NormalizedInput Text.js
|       |   |   |-- TechnologyNormalizer.js
|       |   |   |-- TextCleaner.js
|       |   |   |-- TextValidator.js
|       |   |   |-- Input TextNormalizer.js
|       |   |   `-- Input TextProcessor.js
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
|       |   |   |-- TextSourceClassifier.js
|       |   |   `-- ChatActivityDetector.js
|       |   |-- session/
|       |   |   |-- SessionEvents.js
|       |   |   |-- ChatSession.js
|       |   |   |-- ChatSessionManager.js
|       |   |   `-- ChatStateMachine.js
|       |   |-- textInput/
|       |   |   |-- DecoderState.js
|       |   |   |-- index.js
|       |   |   |-- ModelLoader.js
|       |   |   |-- ModelManager.js
|       |   |   |-- text modelEngine.js
|       |   |   |-- text runtimeRuntime.js
|       |   |   |-- text inputConfiguration.js
|       |   |   |-- text inputEngine.js
|       |   |   |-- text inputErrors.js
|       |   |   |-- text inputEvents.js
|       |   |   |-- Input TextAssembler.js
|       |   |   |-- Input TextResult.js
|       |   |   `-- Input TextSegment.js
|       |   |-- ui/
|       |   |   |-- index.js
|       |   |   |-- Input TextPublisher.js
|       |   |   |-- ChatAccessibility.js
|       |   |   |-- ChatAnimationController.js
|       |   |   |-- ChatConfiguration.js
|       |   |   |-- ChatOverlay.js
|       |   |   |-- ChatOverlayIPC.js
|       |   |   |-- ChatStateRenderer.js
|       |   |   |-- ChatStatusIndicator.js
|       |   |   |-- ChatTheme.js
|       |   |   |-- ChatUIErrors.js
|       |   |   |-- ChatUIEvents.js
|       |   |   `-- ChatWindowController.js
|       |   |-- index.js
|       |   `-- textOutput.js
|       |-- permissions.js
|       |-- preload.js
|       |-- security-lock.js
|       `-- settings.js
|-- build/
|   |-- ICON_README.md
|   |-- icon.ico
|   |-- icon.png
|   |-- installer.nsh
|   `-- openx-chrome-host.exe
|-- core/
|   |-- assistant/
|   |   |-- acquisition/
|   |   |   |-- AcquisitionErrors.js
|   |   |   |-- AcquisitionSanitizer.js
|   |   |   |-- APIAdapter.js
|   |   |   |-- AttachmentResolver.js
|   |   |   |-- BaseInputAdapter.js
|   |   |   |-- ChatAdapter.js
|   |   |   |-- ClipboardAdapter.js
|   |   |   |-- CloudAdapter.js
|   |   |   |-- index.js
|   |   |   |-- InputAdapterRegistry.js
|   |   |   |-- InputDiagnostics.js
|   |   |   |-- InputFactory.js
|   |   |   |-- InputMetadataBuilder.js
|   |   |   |-- InputSourceManager.js
|   |   |   |-- LanguageDetector.js
|   |   |   |-- OCRAdapter.js
|   |   |   |-- PhoneAdapter.js
|   |   |   |-- PluginAdapter.js
|   |   |   |-- SourceConfidenceCalculator.js
|   |   |   |-- SourceNormalizer.js
|   |   |   `-- ChatAdapter.js
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
|   |   |   `-- NaturalLanguageExecution.js
|   |   |-- capabilities/
|   |   |   |-- visual-memory/
|   |   |   |   |-- actions/
|   |   |   |   |   `-- VisualMemoryActionRegistry.js
|   |   |   |   |-- capability/
|   |   |   |   |   `-- VisualMemoryCapability.js
|   |   |   |   |-- configuration/
|   |   |   |   |   `-- VisualMemoryCapabilityConfiguration.js
|   |   |   |   |-- context/
|   |   |   |   |   `-- VisualMemoryContextContributor.js
|   |   |   |   |-- contracts/
|   |   |   |   |   `-- VisualMemoryCapabilityContracts.js
|   |   |   |   |-- diagnostics/
|   |   |   |   |   `-- VisualMemoryCapabilityDiagnostics.js
|   |   |   |   |-- events/
|   |   |   |   |   `-- VisualMemoryCapabilityEvents.js
|   |   |   |   |-- execution/
|   |   |   |   |   `-- VisualMemoryCapabilityExecutor.js
|   |   |   |   |-- lifecycle/
|   |   |   |   |   `-- VisualMemoryCapabilityLifecycle.js
|   |   |   |   |-- responses/
|   |   |   |   |   `-- VisualMemoryStructuredResponse.js
|   |   |   |   |-- routing/
|   |   |   |   |   `-- VisualMemoryCapabilityRouter.js
|   |   |   |   |-- runtime/
|   |   |   |   |   |-- api/
|   |   |   |   |   |   `-- VisualMemoryAPI.js
|   |   |   |   |   |-- contracts/
|   |   |   |   |   |   |-- APIContract.js
|   |   |   |   |   |   |-- index.js
|   |   |   |   |   |   `-- VisualMemoryContract.js
|   |   |   |   |   |-- database/
|   |   |   |   |   |   `-- VisualMemoryDatabase.js
|   |   |   |   |   |-- diagnostics/
|   |   |   |   |   |   `-- DiagnosticsManager.js
|   |   |   |   |   |-- engine/
|   |   |   |   |   |   `-- VisualMemoryEngine.js
|   |   |   |   |   |-- events/
|   |   |   |   |   |   `-- VisualMemoryEvents.js
|   |   |   |   |   |-- faces/
|   |   |   |   |   |   |-- collections/
|   |   |   |   |   |   |   `-- FaceCollectionManager.js
|   |   |   |   |   |   |-- configuration/
|   |   |   |   |   |   |   `-- FaceMemoryConfiguration.js
|   |   |   |   |   |   |-- consent/
|   |   |   |   |   |   |   `-- ConsentManager.js
|   |   |   |   |   |   |-- contracts/
|   |   |   |   |   |   |   `-- FaceMemoryContracts.js
|   |   |   |   |   |   |-- diagnostics/
|   |   |   |   |   |   |   `-- FaceMemoryDiagnostics.js
|   |   |   |   |   |   |-- embeddings/
|   |   |   |   |   |   |   `-- FaceEmbeddingStore.js
|   |   |   |   |   |   |-- engine/
|   |   |   |   |   |   |   `-- FaceMemoryEngine.js
|   |   |   |   |   |   |-- enrollment/
|   |   |   |   |   |   |   `-- FaceEnrollmentManager.js
|   |   |   |   |   |   |-- events/
|   |   |   |   |   |   |   `-- FaceMemoryEvents.js
|   |   |   |   |   |   |-- grouping/
|   |   |   |   |   |   |   `-- FaceGroupingEngine.js
|   |   |   |   |   |   |-- identities/
|   |   |   |   |   |   |   `-- IdentityManager.js
|   |   |   |   |   |   |-- lifecycle/
|   |   |   |   |   |   |   `-- FaceMemoryLifecycle.js
|   |   |   |   |   |   |-- matching/
|   |   |   |   |   |   |   `-- FaceMatchingEngine.js
|   |   |   |   |   |   |-- privacy/
|   |   |   |   |   |   |   `-- FacePrivacyManager.js
|   |   |   |   |   |   |-- profiles/
|   |   |   |   |   |   |   `-- PersonProfileManager.js
|   |   |   |   |   |   |-- relationships/
|   |   |   |   |   |   |   `-- FaceRelationshipManager.js
|   |   |   |   |   |   |-- timelines/
|   |   |   |   |   |   |   `-- FaceTimelineManager.js
|   |   |   |   |   |   |-- utils/
|   |   |   |   |   |   |   `-- face-utils.js
|   |   |   |   |   |   |-- validation/
|   |   |   |   |   |   |   `-- FaceMemoryValidator.js
|   |   |   |   |   |   `-- index.js
|   |   |   |   |   |-- filtering/
|   |   |   |   |   |   |-- AlbumFilter.js
|   |   |   |   |   |   |-- BaseCandidateFilter.js
|   |   |   |   |   |   |-- CameraFilter.js
|   |   |   |   |   |   |-- CandidateContracts.js
|   |   |   |   |   |   |-- CandidateFilterEngine.js
|   |   |   |   |   |   |-- CandidateFilteringStage.js
|   |   |   |   |   |   |-- CandidateFilterPipeline.js
|   |   |   |   |   |   |-- CandidatePool.js
|   |   |   |   |   |   |-- CandidateRanker.js
|   |   |   |   |   |   |-- CandidateValidator.js
|   |   |   |   |   |   |-- DateFilter.js
|   |   |   |   |   |   |-- DuplicateFilter.js
|   |   |   |   |   |   |-- filter-utils.js
|   |   |   |   |   |   |-- FolderFilter.js
|   |   |   |   |   |   |-- GPSFilter.js
|   |   |   |   |   |   |-- index.js
|   |   |   |   |   |   |-- MetadataFilter.js
|   |   |   |   |   |   |-- PersonCountFilter.js
|   |   |   |   |   |   `-- ScreenshotFilter.js
|   |   |   |   |   |-- folders/
|   |   |   |   |   |   `-- FolderManager.js
|   |   |   |   |   |-- gallery/
|   |   |   |   |   |   |-- accessibility/
|   |   |   |   |   |   |   `-- GalleryAccessibilityManager.js
|   |   |   |   |   |   |-- albums/
|   |   |   |   |   |   |   `-- GalleryAlbumManager.js
|   |   |   |   |   |   |-- collections/
|   |   |   |   |   |   |   `-- GalleryCollectionExperience.js
|   |   |   |   |   |   |-- configuration/
|   |   |   |   |   |   |   `-- GalleryExperienceConfiguration.js
|   |   |   |   |   |   |-- contracts/
|   |   |   |   |   |   |   `-- GalleryExperienceContracts.js
|   |   |   |   |   |   |-- diagnostics/
|   |   |   |   |   |   |   `-- GalleryExperienceDiagnostics.js
|   |   |   |   |   |   |-- engine/
|   |   |   |   |   |   |   `-- OpenXGalleryEngine.js
|   |   |   |   |   |   |-- events/
|   |   |   |   |   |   |   |-- EventGalleryExperience.js
|   |   |   |   |   |   |   `-- GalleryExperienceEvents.js
|   |   |   |   |   |   |-- favorites/
|   |   |   |   |   |   |   `-- FavoriteManager.js
|   |   |   |   |   |   |-- filters/
|   |   |   |   |   |   |   `-- GalleryFilterManager.js
|   |   |   |   |   |   |-- interactions/
|   |   |   |   |   |   |   `-- GalleryInteractionManager.js
|   |   |   |   |   |   |-- lifecycle/
|   |   |   |   |   |   |   `-- GalleryExperienceLifecycle.js
|   |   |   |   |   |   |-- navigation/
|   |   |   |   |   |   |   `-- GalleryNavigationManager.js
|   |   |   |   |   |   |-- objects/
|   |   |   |   |   |   |   `-- GalleryObjectsExperience.js
|   |   |   |   |   |   |-- people/
|   |   |   |   |   |   |   `-- GalleryPeopleExperience.js
|   |   |   |   |   |   |-- places/
|   |   |   |   |   |   |   `-- GalleryPlacesExperience.js
|   |   |   |   |   |   |-- recent/
|   |   |   |   |   |   |   `-- RecentManager.js
|   |   |   |   |   |   |-- search/
|   |   |   |   |   |   |   `-- GallerySearchExperience.js
|   |   |   |   |   |   |-- selection/
|   |   |   |   |   |   |   `-- SelectionManager.js
|   |   |   |   |   |   |-- similarity/
|   |   |   |   |   |   |   `-- GallerySimilarityExperience.js
|   |   |   |   |   |   |-- timeline/
|   |   |   |   |   |   |   `-- GalleryTimelineExperience.js
|   |   |   |   |   |   |-- utils/
|   |   |   |   |   |   |   `-- gallery-utils.js
|   |   |   |   |   |   |-- validation/
|   |   |   |   |   |   |   `-- GalleryExperienceValidator.js
|   |   |   |   |   |   |-- viewer/
|   |   |   |   |   |   |   `-- GalleryViewer.js
|   |   |   |   |   |   |-- GalleryManager.js
|   |   |   |   |   |   `-- index.js
|   |   |   |   |   |-- intelligence/
|   |   |   |   |   |   |-- collections/
|   |   |   |   |   |   |   `-- SmartCollectionManager.js
|   |   |   |   |   |   |-- confidence/
|   |   |   |   |   |   |   `-- MemoryConfidenceEngine.js
|   |   |   |   |   |   |-- configuration/
|   |   |   |   |   |   |   `-- MemoryIntelligenceConfiguration.js
|   |   |   |   |   |   |-- context/
|   |   |   |   |   |   |   `-- MemorySearchContext.js
|   |   |   |   |   |   |-- contracts/
|   |   |   |   |   |   |   `-- MemoryIntelligenceContracts.js
|   |   |   |   |   |   |-- diagnostics/
|   |   |   |   |   |   |   `-- MemoryIntelligenceDiagnostics.js
|   |   |   |   |   |   |-- engine/
|   |   |   |   |   |   |   `-- VisualMemoryIntelligenceEngine.js
|   |   |   |   |   |   |-- events/
|   |   |   |   |   |   |   |-- EventIntelligence.js
|   |   |   |   |   |   |   `-- MemoryIntelligenceEvents.js
|   |   |   |   |   |   |-- lifecycle/
|   |   |   |   |   |   |   `-- MemoryIntelligenceLifecycle.js
|   |   |   |   |   |   |-- memories/
|   |   |   |   |   |   |   `-- MemoryRecord.js
|   |   |   |   |   |   |-- ranking/
|   |   |   |   |   |   |   `-- MemoryRankingEngine.js
|   |   |   |   |   |   |-- reasoning/
|   |   |   |   |   |   |   `-- MemoryReasoningEngine.js
|   |   |   |   |   |   |-- relationships/
|   |   |   |   |   |   |   `-- RelationshipIntelligence.js
|   |   |   |   |   |   |-- search/
|   |   |   |   |   |   |   |-- MemorySearchEngine.js
|   |   |   |   |   |   |   `-- SearchSessionManager.js
|   |   |   |   |   |   |-- similarity/
|   |   |   |   |   |   |   `-- MemorySimilarityEngine.js
|   |   |   |   |   |   |-- timelines/
|   |   |   |   |   |   |   `-- TimelineIntelligence.js
|   |   |   |   |   |   |-- utils/
|   |   |   |   |   |   |   `-- intelligence-utils.js
|   |   |   |   |   |   |-- validation/
|   |   |   |   |   |   |   `-- MemorySearchValidator.js
|   |   |   |   |   |   |-- index.js
|   |   |   |   |   |   `-- MemoryIntelligenceStage.js
|   |   |   |   |   |-- learning/
|   |   |   |   |   |   |-- configuration/
|   |   |   |   |   |   |   `-- VisualMemoryLearningConfiguration.js
|   |   |   |   |   |   |-- contracts/
|   |   |   |   |   |   |   `-- VisualMemoryLearningContracts.js
|   |   |   |   |   |   |-- corrections/
|   |   |   |   |   |   |   `-- VisualMemoryCorrectionEngine.js
|   |   |   |   |   |   |-- dashboard/
|   |   |   |   |   |   |   `-- VisualMemoryLearningDashboard.js
|   |   |   |   |   |   |-- diagnostics/
|   |   |   |   |   |   |   `-- VisualMemoryLearningDiagnostics.js
|   |   |   |   |   |   |-- engine/
|   |   |   |   |   |   |   `-- VisualMemoryLearningEngine.js
|   |   |   |   |   |   |-- events/
|   |   |   |   |   |   |   `-- VisualMemoryLearningEvents.js
|   |   |   |   |   |   |-- feedback/
|   |   |   |   |   |   |   `-- VisualMemoryFeedbackEngine.js
|   |   |   |   |   |   |-- lifecycle/
|   |   |   |   |   |   |   `-- VisualMemoryLearningLifecycle.js
|   |   |   |   |   |   |-- preferences/
|   |   |   |   |   |   |   `-- VisualMemoryPreferenceEngine.js
|   |   |   |   |   |   |-- ranking/
|   |   |   |   |   |   |   `-- VisualMemoryRankingLearning.js
|   |   |   |   |   |   |-- recommendations/
|   |   |   |   |   |   |   `-- VisualMemoryRecommendationEngine.js
|   |   |   |   |   |   |-- utils/
|   |   |   |   |   |   |   `-- learning-utils.js
|   |   |   |   |   |   |-- validation/
|   |   |   |   |   |   |   `-- VisualMemoryLearningValidator.js
|   |   |   |   |   |   `-- index.js
|   |   |   |   |   |-- lifecycle/
|   |   |   |   |   |   `-- LifecycleManager.js
|   |   |   |   |   |-- metadata/
|   |   |   |   |   |   `-- MetadataManager.js
|   |   |   |   |   |-- models/
|   |   |   |   |   |   |-- mobileclip/
|   |   |   |   |   |   |   |-- config.json
|   |   |   |   |   |   |   |-- desktop.ini
|   |   |   |   |   |   |   |-- mobileclip_s2.onnx
|   |   |   |   |   |   |   `-- mobileclip_s2.onnx.data
|   |   |   |   |   |   |-- mobilefacenet/
|   |   |   |   |   |   |   |-- desktop.ini
|   |   |   |   |   |   |   |-- MobileFaceNet.onnx
|   |   |   |   |   |   |   `-- MobileFaceNet.onnx.data
|   |   |   |   |   |   |-- paddleocr/
|   |   |   |   |   |   |   |-- detection/
|   |   |   |   |   |   |   |   |-- inference.json
|   |   |   |   |   |   |   |   |-- inference.onnx
|   |   |   |   |   |   |   |   `-- inference.yml
|   |   |   |   |   |   |   `-- Recognition/
|   |   |   |   |   |   |       |-- inference (1).json
|   |   |   |   |   |   |       |-- inference.onnx
|   |   |   |   |   |   |       `-- inference.yml
|   |   |   |   |   |   `-- scrfd/
|   |   |   |   |   |       `-- 2.5g_bnkps.onnx
|   |   |   |   |   |-- privacy/
|   |   |   |   |   |   `-- PrivacyManager.js
|   |   |   |   |   |-- query/
|   |   |   |   |   |   |-- index.js
|   |   |   |   |   |   |-- VisualConstraintExtractor.js
|   |   |   |   |   |   |-- VisualQueryContext.js
|   |   |   |   |   |   |-- VisualQueryContracts.js
|   |   |   |   |   |   |-- VisualQueryEngine.js
|   |   |   |   |   |   |-- VisualQueryNormalizer.js
|   |   |   |   |   |   |-- VisualQueryParser.js
|   |   |   |   |   |   |-- VisualQueryResult.js
|   |   |   |   |   |   |-- VisualQueryUnderstandingStage.js
|   |   |   |   |   |   `-- VisualQueryValidator.js
|   |   |   |   |   |-- settings/
|   |   |   |   |   |   `-- SettingsManager.js
|   |   |   |   |   |-- thumbnails/
|   |   |   |   |   |   `-- ThumbnailManager.js
|   |   |   |   |   |-- utils/
|   |   |   |   |   |   |-- constants.js
|   |   |   |   |   |   |-- FileSystemUtils.js
|   |   |   |   |   |   `-- VisualConceptLexicon.js
|   |   |   |   |   |-- validation/
|   |   |   |   |   |   `-- VisualMemoryValidator.js
|   |   |   |   |   `-- index.js
|   |   |   |   |-- sessions/
|   |   |   |   |   `-- VisualMemorySessionManager.js
|   |   |   |   |-- utils/
|   |   |   |   |   `-- visual-memory-capability-utils.js
|   |   |   |   |-- validation/
|   |   |   |   |   `-- VisualMemoryCapabilityValidator.js
|   |   |   |   |-- verification/
|   |   |   |   |   `-- VisualMemoryVerificationManager.js
|   |   |   |   |-- index.js
|   |   |   |   `-- VisualMemoryCapabilityStage.js
|   |   |   `-- index.js
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
|   |   |   `-- WindowContext.js
|   |   |-- contracts/
|   |   |   |-- ErrorContract.js
|   |   |   |-- index.js
|   |   |   |-- LoggerContract.js
|   |   |   |-- PipelineConfigurationContract.js
|   |   |   |-- PipelineContextContract.js
|   |   |   |-- PipelineEventsContract.js
|   |   |   |-- PipelineResultContract.js
|   |   |   |-- PipelineStageContract.js
|   |   |   `-- StageResultContract.js
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
|   |   |   `-- PolicyDecision.js
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
|   |   |   |-- PersonLexicon.js
|   |   |   |-- ReminderExtractor.js
|   |   |   |-- StructuredEntities.js
|   |   |   |-- TimeExtractor.js
|   |   |   |-- TimerExtractor.js
|   |   |   |-- VolumeExtractor.js
|   |   |   |-- WebsiteExtractor.js
|   |   |   `-- WindowExtractor.js
|   |   |-- events/
|   |   |   |-- index.js
|   |   |   |-- PipelineEventDispatcher.js
|   |   |   `-- PipelineEvents.js
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
|   |   |   |-- LearningConstitution.js
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
|   |   |   |-- PersonalizationProfileStore.js
|   |   |   |-- PreferenceLearning.js
|   |   |   |-- PreferenceStore.js
|   |   |   |-- UsageLearning.js
|   |   |   |-- UsageStatsStore.js
|   |   |   |-- WorkflowLearning.js
|   |   |   `-- WorkflowStore.js
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
|   |   |   `-- VerbDetector.js
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
|   |   |   `-- WorkingMemory.js
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
|   |   |   `-- TimingInformation.js
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
|   |   |   `-- WhitespaceNormalizer.js
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
|   |   |   `-- StageResult.js
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
|   |   |   `-- WorkflowPlanner.js
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
|   |   |   `-- TaskReasoner.js
|   |   |-- references/
|   |   |   |-- AliasResolver.js
|   |   |   |-- ContextResolver.js
|   |   |   |-- ConversationResolver.js
|   |   |   |-- index.js
|   |   |   |-- PronounResolver.js
|   |   |   |-- ReferenceGraphBuilder.js
|   |   |   `-- ReferenceResolver.js
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
|   |   |   `-- ChatFormatter.js
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
|   |   |   `-- WebTargets.js
|   |   |-- utils/
|   |   |   |-- AsyncHelpers.js
|   |   |   |-- Cancellation.js
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
|   |   |   `-- ValidationHelpers.js
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
|   |   |   `-- ValidationResult.js
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
|   |   |   `-- WindowVerifier.js
|   |   |-- AssistantEngine.js
|   |   |-- Data.js
|   |   `-- index.js
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
|   |-- chat/
|   |   |-- connection/
|   |   |   |-- ConnectionConfiguration.js
|   |   |   |-- ConnectionEngine.js
|   |   |   |-- ConnectionEvents.js
|   |   |   |-- ConnectionLogger.js
|   |   |   |-- HeartbeatManager.js
|   |   |   |-- index.js
|   |   |   |-- NetworkMonitor.js
|   |   |   |-- PresenceManager.js
|   |   |   |-- RecoveryManager.js
|   |   |   `-- SessionManager.js
|   |   |-- conversations/
|   |   |   |-- ArchiveManager.js
|   |   |   |-- ConversationConfiguration.js
|   |   |   |-- ConversationEvents.js
|   |   |   |-- ConversationLogger.js
|   |   |   |-- ConversationManager.js
|   |   |   |-- ConversationModel.js
|   |   |   |-- ConversationService.js
|   |   |   |-- ConversationStorage.js
|   |   |   |-- ConversationValidation.js
|   |   |   |-- index.js
|   |   |   |-- IndexManager.js
|   |   |   |-- MuteManager.js
|   |   |   |-- PaginationManager.js
|   |   |   |-- PinManager.js
|   |   |   |-- SearchManager.js
|   |   |   |-- SearchService.js
|   |   |   `-- SortingManager.js
|   |   |-- crypto/
|   |   |   |-- AESManager.js
|   |   |   |-- CryptoConfiguration.js
|   |   |   |-- CryptoErrors.js
|   |   |   |-- CryptoEvents.js
|   |   |   |-- CryptoLogger.js
|   |   |   |-- CryptoManager.js
|   |   |   |-- CryptoValidation.js
|   |   |   |-- HKDFManager.js
|   |   |   |-- IdentityManager.js
|   |   |   |-- index.js
|   |   |   |-- KeyManager.js
|   |   |   |-- KeyRotationManager.js
|   |   |   |-- RandomManager.js
|   |   |   |-- ReplayProtectionManager.js
|   |   |   |-- SecureStorageManager.js
|   |   |   `-- SessionManager.js
|   |   |-- devices/
|   |   |   |-- DeviceConfiguration.js
|   |   |   |-- DeviceEvents.js
|   |   |   |-- DeviceLifecycle.js
|   |   |   |-- DeviceLogger.js
|   |   |   |-- DeviceManager.js
|   |   |   |-- DeviceRegistry.js
|   |   |   |-- DeviceService.js
|   |   |   |-- DeviceStatus.js
|   |   |   `-- index.js
|   |   |-- discovery/
|   |   |   |-- ContactDiscoveryManager.js
|   |   |   |-- DiscoveryConfiguration.js
|   |   |   |-- DiscoveryEvents.js
|   |   |   |-- DiscoveryLogger.js
|   |   |   |-- DiscoveryService.js
|   |   |   |-- DiscoveryValidation.js
|   |   |   `-- index.js
|   |   |-- history/
|   |   |   |-- HistorySynchronizationClient.js
|   |   |   |-- HistorySynchronizationConfiguration.js
|   |   |   |-- HistorySynchronizationEvents.js
|   |   |   |-- HistorySynchronizationManager.js
|   |   |   |-- HistorySynchronizationStorage.js
|   |   |   |-- HistoryTransferEngine.js
|   |   |   `-- index.js
|   |   |-- infrastructure/
|   |   |   |-- ConnectionOptimizer.js
|   |   |   |-- index.js
|   |   |   |-- InfrastructureEvents.js
|   |   |   |-- MemoryOptimizer.js
|   |   |   |-- MetricsManager.js
|   |   |   |-- MonitoringManager.js
|   |   |   |-- PerformanceManager.js
|   |   |   |-- StorageOptimizer.js
|   |   |   `-- SynchronizationOptimizer.js
|   |   |-- mailbox/
|   |   |   |-- AcknowledgementManager.js
|   |   |   |-- index.js
|   |   |   |-- MailboxClient.js
|   |   |   |-- MailboxConfiguration.js
|   |   |   |-- MailboxEvents.js
|   |   |   |-- MailboxLogger.js
|   |   |   |-- MailboxManager.js
|   |   |   |-- MailboxSyncManager.js
|   |   |   `-- SequenceManager.js
|   |   |-- messages/
|   |   |   |-- AcknowledgementManager.js
|   |   |   |-- CompressionManager.js
|   |   |   |-- index.js
|   |   |   |-- MessageClient.js
|   |   |   |-- MessageConfiguration.js
|   |   |   |-- MessageConstants.js
|   |   |   |-- MessageEvents.js
|   |   |   |-- MessageLogger.js
|   |   |   |-- MessageManager.js
|   |   |   |-- MessageModel.js
|   |   |   |-- MessagePipeline.js
|   |   |   |-- MessageRouter.js
|   |   |   |-- MessageStorage.js
|   |   |   |-- MessageValidation.js
|   |   |   |-- RetryManager.js
|   |   |   `-- TypingManager.js
|   |   |-- multidevice/
|   |   |   |-- DeviceConsistencyManager.js
|   |   |   |-- DeviceEvents.js
|   |   |   |-- DeviceLogger.js
|   |   |   |-- DeviceSynchronizationManager.js
|   |   |   |-- index.js
|   |   |   |-- MultiDeviceClient.js
|   |   |   |-- MultiDeviceConfiguration.js
|   |   |   |-- MultiDeviceManager.js
|   |   |   `-- SynchronizationCopyManager.js
|   |   |-- quality/
|   |   |   |-- CrashRecoveryManager.js
|   |   |   |-- index.js
|   |   |   |-- PerformanceReporter.js
|   |   |   |-- ProductionValidator.js
|   |   |   |-- QualityManager.js
|   |   |   `-- ReleaseLogger.js
|   |   |-- requests/
|   |   |   |-- BlockManager.js
|   |   |   |-- ContactRequestManager.js
|   |   |   |-- index.js
|   |   |   |-- NicknameManager.js
|   |   |   |-- RequestConfiguration.js
|   |   |   |-- RequestEvents.js
|   |   |   |-- RequestLogger.js
|   |   |   |-- RequestService.js
|   |   |   |-- RequestValidation.js
|   |   |   `-- TrustManager.js
|   |   |-- security/
|   |   |   |-- index.js
|   |   |   |-- RecoveryManager.js
|   |   |   |-- RegistrationPinManager.js
|   |   |   |-- SecurityClient.js
|   |   |   |-- SecurityEvents.js
|   |   |   |-- SecurityLogger.js
|   |   |   |-- SecurityManager.js
|   |   |   |-- SecurityPolicyManager.js
|   |   |   |-- SessionManager.js
|   |   |   `-- TrustManager.js
|   |   |-- state/
|   |   |   |-- ChatRuntimeStateMachine.js
|   |   |   `-- index.js
|   |   |-- synchronization/
|   |   |   |-- ACKManager.js
|   |   |   |-- ConflictManager.js
|   |   |   |-- index.js
|   |   |   |-- RecoveryManager.js
|   |   |   |-- RetryManager.js
|   |   |   |-- SequenceManager.js
|   |   |   |-- SynchronizationClient.js
|   |   |   |-- SynchronizationConfiguration.js
|   |   |   |-- SynchronizationCursor.js
|   |   |   |-- SynchronizationEngine.js
|   |   |   |-- SynchronizationEvents.js
|   |   |   |-- SynchronizationLogger.js
|   |   |   `-- SynchronizationManager.js
|   |   |-- transfer/
|   |   |   |-- BlobClient.js
|   |   |   |-- DownloadManager.js
|   |   |   |-- index.js
|   |   |   |-- IntegrityManager.js
|   |   |   |-- ThumbnailManager.js
|   |   |   |-- TransferConfiguration.js
|   |   |   |-- TransferEvents.js
|   |   |   |-- TransferLogger.js
|   |   |   |-- TransferManager.js
|   |   |   `-- UploadManager.js
|   |   |-- ChatConfiguration.js
|   |   |-- ChatConnectionManager.js
|   |   |-- ChatDataPaths.js
|   |   |-- ChatEventBus.js
|   |   |-- ChatEvents.js
|   |   |-- ChatHealthManager.js
|   |   |-- ChatLifecycleManager.js
|   |   |-- ChatLogger.js
|   |   |-- ChatManager.js
|   |   |-- ChatService.js
|   |   |-- ChatStatusManager.js
|   |   |-- ChatVersionManager.js
|   |   |-- index.js
|   |   `-- LogFormatter.js
|   |-- cloud/
|   |   |-- CloudCommandManager.js
|   |   |-- CloudCommandRouter.js
|   |   |-- CloudConnectionManager.js
|   |   |-- CloudE2EE.js
|   |   |-- CloudFileTransferManager.js
|   |   |-- CloudFileTransferProtocol.js
|   |   |-- CloudLogger.js
|   |   |-- CloudPairingManager.js
|   |   |-- CloudRequestQueue.js
|   |   |-- CloudResponseSerializer.js
|   |   |-- CloudTransferIntegrity.js
|   |   `-- index.js
|   |-- communication/
|   |   |-- CommunicationEngine.js
|   |   |-- CommunicationErrors.js
|   |   |-- CommunicationEvents.js
|   |   |-- CommunicationProvider.js
|   |   |-- CommunicationProviderManager.js
|   |   |-- CommunicationResult.js
|   |   |-- index.js
|   |   `-- OperationScheduler.js
|   |-- context-awareness/
|   |   |-- active-window.js
|   |   |-- app-registry.js
|   |   |-- context-engine.js
|   |   |-- mode-engine.js
|   |   |-- process-monitor.js
|   |   `-- signals.js
|   `-- vision/
|       |-- confidence/
|       |   `-- ConfidenceEngine.js
|       |-- configuration/
|       |   `-- VisionConfiguration.js
|       |-- contracts/
|       |   `-- VisionContracts.js
|       |-- diagnostics/
|       |   `-- VisionDiagnostics.js
|       |-- embeddings/
|       |   `-- EmbeddingManager.js
|       |-- engine/
|       |   `-- VisionEngine.js
|       |-- events/
|       |   `-- VisionEvents.js
|       |-- inference/
|       |   |-- InferenceCoordinator.js
|       |   `-- VisionResult.js
|       |-- lifecycle/
|       |   `-- VisionLifecycle.js
|       |-- managers/
|       |   `-- ResourceManager.js
|       |-- models/
|       |   `-- ModelManager.js
|       |-- postprocessing/
|       |   `-- VisionPostprocessor.js
|       |-- preprocessing/
|       |   `-- ImagePreprocessingPipeline.js
|       |-- registry/
|       |   `-- ModelRegistry.js
|       |-- runtime/
|       |   |-- RuntimeManager.js
|       |   |-- windows-face-analysis.ps1
|       |   `-- WindowsFaceRuntimeAdapter.js
|       |-- validation/
|       |   `-- VisionValidator.js
|       `-- index.js
|-- dist/ (contents omitted)
|-- docs/
|   |-- architecture/
|   |   |-- overview.md
|   |   |-- production-finalization.md
|   |   `-- repository-audit.md
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
|-- graphify-out/ (contents omitted)
|-- models/
|   `-- text-model/
|       |-- decoder.int8.onnx
|       |-- encoder.int8.onnx
|       |-- joiner.int8.onnx
|       `-- tokens.txt
|-- node_modules/ (contents omitted)
|-- plugins/
|   |-- chrome/
|   |   |-- index.js
|   |   `-- plugin.json
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
|   `-- start-electron.js
|-- tests/
|   |-- automation/
|   |   |-- action-confirm.test.js
|   |   |-- action-validation.test.js
|   |   |-- action-verification.test.js
|   |   |-- apps.test.js
|   |   |-- automation.test.js
|   |   |-- browser.test.js
|   |   |-- communications.test.js
|   |   |-- file-management.test.js
|   |   |-- launcher.test.js
|   |   |-- media.test.js
|   |   |-- path-utils.test.js
|   |   |-- screenshot-recording.test.js
|   |   |-- system.test.js
|   |   |-- volume-brightness.test.js
|   |   |-- windows-session.test.js
|   |   `-- windows.test.js
|   |-- context-awareness/
|   |   |-- context-awareness.test.js
|   |   `-- mode-engine.test.js
|   |-- core/
|   |   |-- acquisition-layer.test.js
|   |   |-- active-learning-v2.test.js
|   |   |-- app-language.test.js
|   |   |-- architecture-structure.test.js
|   |   |-- assistant-intelligence-pipeline.test.js
|   |   |-- assistant.test.js
|   |   |-- browser-language.test.js
|   |   |-- chat-connection-phase11.test.js
|   |   |-- chat-conversation-phase13.test.js
|   |   |-- chat-history-sync.test.js
|   |   |-- chat-infrastructure-phase15.test.js
|   |   |-- chat-multi-device.test.js
|   |   |-- chat-production-phase16.test.js
|   |   |-- chat-runtime-state.test.js
|   |   |-- chat-security-phase14.test.js
|   |   |-- chat-transfer-phase12.test.js
|   |   |-- cloud-command-manager.test.js
|   |   |-- cloud-connection.test.js
|   |   |-- cloud-desktop-ui.test.js
|   |   |-- cloud-file-transfer-manager.test.js
|   |   |-- cloud-pairing-manager.test.js
|   |   |-- command-corpus.test.js
|   |   |-- communication-engine.test.js
|   |   |-- context-providers.test.js
|   |   |-- contracts.test.js
|   |   |-- crash-recovery.test.js
|   |   |-- data-root.test.js
|   |   |-- decision-automation.test.js
|   |   |-- electron-config-ipc.test.js
|   |   |-- electron-security.test.js
|   |   |-- electron-shortcut.test.js
|   |   |-- entities.test.js
|   |   |-- entity-understanding.test.js
|   |   |-- face-memory.test.js
|   |   |-- gallery-recent.test.js
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
|   |   |-- models.test.js
|   |   |-- nlp.test.js
|   |   |-- nlu.test.js
|   |   |-- openx-gallery-experience.test.js
|   |   |-- parser.test.js
|   |   |-- performance-memory.test.js
|   |   |-- permissions.test.js
|   |   |-- pipeline-events.test.js
|   |   |-- planner.test.js
|   |   |-- planning.test.js
|   |   |-- reasoning.test.js
|   |   |-- reminder-extraction.test.js
|   |   |-- renderer-security.test.js
|   |   |-- response-layer.test.js
|   |   |-- responses.test.js
|   |   |-- router.test.js
|   |   |-- scheduler-alert.test.js
|   |   |-- security-critical.test.js
|   |   |-- security-lock.test.js
|   |   |-- semantic-understanding.test.js
|   |   |-- settings.test.js
|   |   |-- textOutput.test.js
|   |   |-- utils.test.js
|   |   |-- validation.test.js
|   |   |-- verification-response.test.js
|   |   |-- vision-engine.test.js
|   |   |-- visual-filtering.test.js
|   |   |-- visual-memory-capability.test.js
|   |   |-- visual-memory-intelligence.test.js
|   |   |-- visual-memory-learning.test.js
|   |   |-- visual-memory.test.js
|   |   |-- visual-query.test.js
|   |   `-- chat-subsystem.test.js
|   |-- media-handling/
|   |   `-- media-handling.test.js
|   `-- ui/
|       |-- chat-renderer.test.js
|       |-- gallery-renderer.test.js
|       |-- planner-renderer.test.js
|       |-- schedule-alert-renderer.test.js
|       `-- timer-widget-renderer.test.js
|-- .gitignore
|-- AGENTS.md
|-- commands.md
|-- config.js
|-- eslint.config.mjs
|-- package-lock.json
|-- package.json
|-- README.md
|-- report.md
`-- RULES.md
```
