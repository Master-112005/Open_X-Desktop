# OpenX

Report date: 2026-07-21

Repository: `OpenX`

Package: `openx`

Current version: `10.0.0`

OpenX is a local-first Windows desktop assistant built with Electron, Node.js, and CommonJS. It combines deterministic assistant command routing, desktop automation, local voice, OpenX Chat, cloud/mobile pairing, local photo gallery, visual memory, learning, scheduling, security, and plugin execution into one desktop runtime.

OpenX is designed around one rule: user data and assistant state belong in the local OpenX data root unless a feature explicitly requires a different user-facing location.

```text
Managed OpenX data:
%USERPROFILE%\OpenX_Data\

Received files from mobile/cloud transfer:
%USERPROFILE%\Documents\OpenX\
```

## Repository Scan Summary

This README was updated from a filtered local scan of the OpenX repository.

| Item | Current value |
|---|---|
| Package manager | `npm@10.9.2` |
| Package entrypoint | `apps/desktop/electron/main.js` |
| Filtered source/config/doc/test file count | `1043` |
| Main language | JavaScript, CommonJS |
| Renderer languages | HTML, CSS, browser JavaScript |
| Windows helper language | PowerShell |
| Configuration/data formats | JSON, Markdown, NSIS config |
| Local model formats | ONNX and tokenizer/config files |
| Collapsed folders in the tree | `.git/`, `.agents/`, `.codex/`, `.code-review-graph/`, `dist/`, `graphify-out/`, `node_modules/` |

## What OpenX Does

- Understands typed, voice, cloud, and mobile commands through the same assistant pipeline.
- Opens, closes, switches, and verifies desktop apps and windows.
- Controls browsers, media, folders, files, system settings, volume, brightness, screenshots, recording, reminders, alarms, timers, planner items, and schedules.
- Supports natural multi-step commands such as opening multiple apps, closing recent app groups, and applying shared values to volume and brightness.
- Provides local OpenX Chat for real user-to-user messaging through OpenX Chat Server.
- Shows chat notifications and assistant actions through the Dynamic Island when the chat surface is not active.
- Stores local chat state and bounded message history in `OpenX_Data`.
- Provides local voice sessions with audio capture, preprocessing, STT, transcript normalization, Dynamic Island voice UI, and Windows SAPI TTS.
- Provides OpenX Gallery for local photos, favorites, recent photos, timeline browsing, people naming, relation metadata, and photo search.
- Uses Visual Memory for local photo indexing, metadata filtering, semantic/visual search foundations, face memory, people grouping, duplicate suppression, and future model-backed retrieval.
- Connects with OpenX Mobile and cloud relay for pairing, commands, presence, and file transfer.
- Keeps plugins behind assistant, validation, and automation boundaries.

## Technology Stack

| Area | Technology |
|---|---|
| Desktop shell | Electron `28.3.3` |
| Runtime | Node.js `>=18.18.0 <23`, npm `>=9` |
| Application language | JavaScript, CommonJS |
| Renderer UI | HTML, CSS, browser JavaScript |
| Windows automation helpers | PowerShell, Windows APIs, Node child processes |
| Voice STT | `sherpa-onnx-node` with local Parakeet ONNX files |
| Voice TTS | Windows SAPI |
| Realtime/client networking | `ws` WebSocket client |
| QR pairing | `qrcode` |
| Fuzzy search | `fuse.js` |
| Packaging | `electron-builder`, NSIS |
| Testing | Mocha, Chai |
| Browser/UI validation | Playwright |
| Linting | ESLint |
| Archive/file packaging | `archiver` |

## Local Models And Runtimes

OpenX uses local model files and local Windows runtimes where possible.

| Model/runtime | Location | Purpose |
|---|---|---|
| Parakeet ONNX STT | `models/parakeet/encoder.int8.onnx`, `decoder.int8.onnx`, `joiner.int8.onnx`, `tokens.txt` | Local speech-to-text through Sherpa ONNX. |
| Windows SAPI | Windows runtime | Text-to-speech output. |
| Windows FaceDetector bridge | `core/vision/runtime/windows-face-analysis.ps1` | Local face detection and face-region signal extraction through Windows APIs. |
| SCRFD ONNX | `core/assistant/capabilities/visual-memory/runtime/models/scrfd/2.5g_bnkps.onnx` | Face detection model asset for visual-memory runtime paths. |
| MobileFaceNet ONNX | `core/assistant/capabilities/visual-memory/runtime/models/mobilefacenet/` | Face embedding model asset for local face matching paths. |
| MobileCLIP ONNX | `core/assistant/capabilities/visual-memory/runtime/models/mobileclip/` | Image-text embedding model asset for semantic visual search paths. |
| PaddleOCR ONNX | `core/assistant/capabilities/visual-memory/runtime/models/paddleocr/` | OCR model assets for future and runtime text-in-image analysis paths. |

## Main Runtime Entrypoints

| File | Important classes/functions | Responsibility |
|---|---|---|
| `apps/desktop/electron/main.js` | `initializeAssistant`, `setupIPC`, `createChatWindow`, `createSettingsWindow`, `createPeopleChatWindow`, `createGalleryWindow`, `initializeCloudConnection`, `initializeCloudPairing`, `initializeCloudCommands`, `initializeCloudFileTransfers`, `startDesktopChatRegistration`, `sendDesktopChatMessage`, `sendDesktopChatMessageToContact`, `processDesktopChatIncomingEnvelope`, `syncDesktopChatMailbox`, `ensureVisualMemoryRuntime`, `getLazyVisualMemoryApi` | Electron main process, window lifecycle, IPC, assistant boot, cloud, desktop chat, gallery, dynamic island, data migration, and cleanup. |
| `apps/desktop/electron/security.js` | IPC validators and channel allow-listing | Rejects invalid or unauthorized renderer payloads before they reach privileged main-process code. |
| `apps/desktop/preload.js` | `contextBridge` APIs, voice overlay render helpers | Safe bridge from renderer windows to main process. |
| `apps/desktop/renderer/chat/index.js` | `sendMessage`, settings handlers, chat app handlers, people chat handlers | Main assistant renderer, settings UI, apps surface, activity, OpenX Chat UI, dynamic state rendering. |
| `apps/desktop/renderer/gallery/index.js` | gallery view rendering, people scan, viewer, favorites, recent | Gallery renderer for photos, timeline, search, people, and image viewer. |
| `core/assistant/index.js` | `Assistant`, `processCommand` | Public assistant facade used by desktop chat, voice, phone, cloud, and other command sources. |
| `core/assistant/automation/ActionRouter.js` | `ActionRouter`, `process` | Converts natural language into executable intents and multi-command plans. |
| `core/automation/index.js` | `AutomationEngine`, `execute` | Dispatches validated intents to desktop automation controllers. |
| `core/assistant/response/ResponseGenerator.js` | `ResponseGenerator` | Builds user-facing responses, confirmations, clarifications, and summaries. |
| `core/assistant/Data.js` | `buildDataPaths`, `resolveDataRoot`, `readJsonFile`, `writeJsonAtomic`, `Logger` | Central OpenX data root, atomic JSON storage, migration helpers, and logging. |
| `core/chat/ChatManager.js` | `ChatManager` | Local OpenX Chat orchestration. |
| `core/chat/messages/MessageManager.js` | `MessageManager` | Message creation, validation, routing, storage, and sync path coordination. |
| `core/chat/crypto/CryptoManager.js` | `CryptoManager` | Local cryptographic framework for chat keys, sessions, replay protection, and secure storage. |
| `core/cloud/CloudConnectionManager.js` | `CloudConnectionManager` | Cloud relay WebSocket lifecycle and presence. |
| `core/cloud/CloudPairingManager.js` | `CloudPairingManager` | QR pairing token lifecycle and device approval. |
| `core/cloud/CloudFileTransferManager.js` | `CloudFileTransferManager` | Incoming and outgoing mobile/cloud file transfer lifecycle. |
| `core/assistant/capabilities/visual-memory/runtime/api/VisualMemoryAPI.js` | `VisualMemoryAPI`, `scanGalleryPeople` | Public Visual Memory API used by assistant, gallery, and desktop main process. |
| `core/assistant/capabilities/visual-memory/runtime/engine/VisualMemoryEngine.js` | `VisualMemoryEngine`, `start` | Visual-memory database, folders, metadata, gallery, query, filtering, intelligence, learning, and faces. |
| `core/vision/engine/VisionEngine.js` | `VisionEngine` | Vision runtime facade. |
| `core/vision/runtime/RuntimeManager.js` | `RuntimeManager` | Vision runtime selection and execution management. |
| `core/vision/runtime/WindowsFaceRuntimeAdapter.js` | `WindowsFaceRuntimeAdapter` | Node adapter around the Windows face-analysis PowerShell bridge. |
| `apps/desktop/voice/integration/VoiceAssistantBridge.js` | `VoiceAssistantBridge` | Sends voice transcripts into the assistant command path. |
| `apps/desktop/voice/stt/STTEngine.js` | `STTEngine` | Local speech recognition engine. |
| `apps/desktop/voice/tts.js` | `TextToSpeech` | Windows SAPI text-to-speech wrapper. |

## Assistant Command Workflow

All command sources eventually enter the assistant through the same public call:

```js
Assistant.processCommand(text, source, options)
```

The command path is layered:

```text
chat / voice / cloud / mobile
  -> acquisition
  -> normalization
  -> linguistic understanding
  -> semantic understanding
  -> entity extraction
  -> context and memory resolution
  -> intent and goal reasoning
  -> planning
  -> validation and permission checks
  -> automation dispatch
  -> verification
  -> response generation
  -> context and learning update
  -> renderer, voice, dynamic island, cloud, or chat response
```

Important behavior:

- Noisy user text is normalized before routing.
- Context handles follow-ups such as `close it`, `close them`, `send that`, and recent app/file/search references.
- Multi-command splitting preserves app lists and shared values.
- Validation and confirmation are separate from understanding.
- Automation results are verified where possible.
- Responses are human-readable and summarize partial success or failure.
- Learning stores structured, bounded, local signals rather than raw private chat transcripts.

## OpenX Chat Workflow

OpenX desktop chat uses OpenX Chat Server for account, contact, delivery, mailbox, sync, and live WebSocket transport. The desktop keeps local state in `OpenX_Data` and uses bounded local message history.

```text
desktop chat UI
  -> secure preload API
  -> Electron main IPC validation
  -> local chat state
  -> OpenX Chat Server REST/WebSocket
  -> mailbox and live delivery
  -> local message store
  -> chat UI or Dynamic Island notification
```

Important desktop chat responsibilities:

- Register or log in with configured OpenX Chat Server.
- Register the current desktop as a device.
- Search or add real users through server discovery.
- Send messages to accepted contacts.
- Receive live messages over WebSocket.
- Sync missed messages from mailbox paths.
- Store local bounded chat history in `OpenX_Data`.
- Show Dynamic Island notifications only when appropriate.

The chat server remains the transport and account authority. The desktop remains the local UI, local encryption, and local state owner.

## Voice Workflow

```text
Alt+Space or voice UI
  -> audio capture
  -> preprocessing and VAD
  -> Sherpa/Parakeet STT
  -> transcript normalization
  -> Assistant.processCommand
  -> response
  -> Dynamic Island and optional TTS
```

Voice resource behavior:

- STT model files are validated at startup.
- Heavy voice runtime prewarm is skipped until first use by default.
- TTS uses Windows SAPI.
- Voice diagnostics record health, latency, errors, and runtime state.

## Visual Memory And Gallery Workflow

```text
open openx gallery
  -> lazy Visual Memory API
  -> gallery window
  -> local Pictures folder indexing
  -> timeline/favorites/recent/people/search views

find photos of mummy and daddy
  -> assistant visual query parsing
  -> relationship/person constraints
  -> metadata/person/date/filtering
  -> candidate ranking
  -> chat/gallery results
```

Key behavior:

- Visual Memory is lazy-loaded and does not start during normal assistant startup.
- Gallery indexes local Windows Pictures folders without copying photos into OpenX.
- Gallery previews use local file URLs instead of base64 IPC payloads.
- People scan uses local face detection and face grouping.
- Named people and relations remain user-controlled.
- Duplicate and weak face candidates are filtered before user-facing display.
- Semantic image search model assets are present for local image-text retrieval paths.

## Cloud And Mobile Workflow

Cloud relay support is optional and controlled by configuration and settings.

```text
OpenX Mobile / relay
  -> cloud connection manager
  -> pairing manager
  -> command manager or file transfer manager
  -> assistant / dynamic island / file storage
```

Cloud features:

- Relay WebSocket connection.
- QR pairing and approval/rejection.
- Cloud command execution through the assistant pipeline.
- Phone/mobile presence.
- File transfer prompts through the Dynamic Island.
- Received file storage under `%USERPROFILE%\Documents\OpenX\`.
- E2EE helpers for encrypted cloud packets.

Default relay URL:

```text
wss://openx-server.onrender.com/ws
```

Default OpenX Chat Server URL:

```text
https://openx-chat-server.onrender.com
```

## Data Storage

The central data contract is implemented in `core/assistant/Data.js` and consumed through `config.js`.

Managed data root:

```text
%USERPROFILE%\OpenX_Data\
```

Important managed data areas:

| Data | Location |
|---|---|
| Settings | `OpenX_Data/settings.json` |
| Assistant chat history | `OpenX_Data/assistant-chat-history.json` |
| UI state | `OpenX_Data/ui-state.json` |
| Planner | `OpenX_Data/planner.json` |
| Schedules, alarms, timers, reminders | `OpenX_Data/schedules.json` |
| Learning | `OpenX_Data/learning/` |
| Logs | `OpenX_Data/logs/` |
| Voice diagnostics | `OpenX_Data/voice/diagnostics/` |
| Cloud state | `OpenX_Data/cloud/` |
| Chat state | `OpenX_Data/chat/` |
| Runtime profiles | `OpenX_Data/runtime/` |
| Visual memory | `OpenX_Data/visual-memory/` |
| Security state | `OpenX_Data/security/` |
| Screenshots | `OpenX_Data/screenshots/` |

Intentional external location:

```text
%USERPROFILE%\Documents\OpenX\
```

This folder is used for user-visible received files from mobile/cloud transfer.

## Security And Privacy Boundaries

- Renderer windows use preload APIs instead of direct Node access.
- Main-process IPC validates payloads through `apps/desktop/electron/security.js`.
- Security-sensitive assistant operations can require confirmation or security lock.
- Private chat keys are local-only.
- Chat plaintext is not the server's responsibility.
- Local photos remain local by default.
- Visual Memory does not upload raw photos by default.
- Logs should avoid secrets, tokens, private keys, OTPs, raw key material, and private message content.
- Received files are kept in the user-visible Documents OpenX folder.
- Managed assistant state is deletable by removing `OpenX_Data`.

## Plugins

Plugins live under `plugins/` and are loaded through the plugin controller.

Current trusted plugin names in `config.js`:

- `sample_plugin`
- `youtube`
- `chrome`
- `discord`

Plugins can register custom actions and intents, but execution still goes through assistant routing and automation boundaries.

## Requirements

- Windows 10 or Windows 11
- Node.js `>=18.18.0 <23`
- npm `>=9`

## Install And Run

```powershell
npm install
npm start
```

Development mode:

```powershell
npm run dev
```

## Test And Validation

```powershell
npm run lint
npm test
npm run test:core
npm run test:automation
npm run test:context
npm run test:learning
npm run test:ui
```

Full validation:

```powershell
npm run validate
```

## Build And Package

Directory build:

```powershell
npm run build
```

NSIS installer:

```powershell
npm run package
```

Packaged app details:

- App ID: `com.openx.assistant`
- Product name: `OpenX`
- Target: Windows x64 NSIS
- ASAR enabled
- Sherpa ONNX and Playwright modules unpacked
- Parakeet model files included as extra files
- Native Chrome host included in package resources

## Documentation Map

| File | Purpose |
|---|---|
| `README.md` | Main project overview and current architecture. |
| `report.md` | Deep repository report and validation history. |
| `commands.md` | Command-language corpus and examples. |
| `RULES.md` | Local project rules. |
| `AGENTS.md` | Agent/development guidance. |
| `docs/architecture/overview.md` | Architecture overview. |
| `docs/architecture/production-finalization.md` | Production architecture notes. |
| `docs/architecture/repository-audit.md` | Repository audit notes. |
| `docs/modules/core-engine.md` | Core engine documentation. |
| `docs/modules/nlp-pipeline.md` | NLP pipeline documentation. |
| `docs/modules/settings.md` | Settings module documentation. |
| `docs/workflows/command-execution.md` | Command execution workflow. |
| `docs/plugins/development.md` | Plugin development guidance. |

## Filtered Directory Tree

Generated and dependency-heavy folders are listed by folder name only. Source, configuration, documentation, tests, scripts, and model folders are expanded enough to show ownership and structure without expanding dependency internals.

```text
OpenX/
|-- .agents/
|-- .code-review-graph/
|-- .codex/
|-- .git/
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
|       |   `-- voice-capture/
|       |       |-- index.html
|       |       `-- index.js
|       |-- voice/
|       |   |-- audio/
|       |   |-- config/
|       |   |-- diagnostics/
|       |   |-- integration/
|       |   |-- normalization/
|       |   |-- preprocessing/
|       |   |-- session/
|       |   |-- stt/
|       |   |-- ui/
|       |   |-- index.js
|       |   `-- tts.js
|       |-- permissions.js
|       |-- preload.js
|       |-- security-lock.js
|       `-- settings.js
|-- build/
|   |-- icon.ico
|   |-- icon.png
|   |-- ICON_README.md
|   |-- installer.nsh
|   `-- openx-chrome-host.exe
|-- core/
|   |-- assistant/
|   |   |-- acquisition/
|   |   |-- automation/
|   |   |-- capabilities/
|   |   |   `-- visual-memory/
|   |   |       |-- actions/
|   |   |       |-- capability/
|   |   |       |-- configuration/
|   |   |       |-- context/
|   |   |       |-- contracts/
|   |   |       |-- diagnostics/
|   |   |       |-- events/
|   |   |       |-- execution/
|   |   |       |-- lifecycle/
|   |   |       |-- responses/
|   |   |       |-- routing/
|   |   |       |-- runtime/
|   |   |       |   |-- api/
|   |   |       |   |-- contracts/
|   |   |       |   |-- database/
|   |   |       |   |-- diagnostics/
|   |   |       |   |-- engine/
|   |   |       |   |-- events/
|   |   |       |   |-- faces/
|   |   |       |   |   |-- collections/
|   |   |       |   |   |-- configuration/
|   |   |       |   |   |-- consent/
|   |   |       |   |   |-- diagnostics/
|   |   |       |   |   |-- embeddings/
|   |   |       |   |   |-- engine/
|   |   |       |   |   |-- enrollment/
|   |   |       |   |   |-- events/
|   |   |       |   |   |-- grouping/
|   |   |       |   |   |-- identities/
|   |   |       |   |   |-- lifecycle/
|   |   |       |   |   |-- matching/
|   |   |       |   |   |-- privacy/
|   |   |       |   |   |-- profiles/
|   |   |       |   |   |-- relationships/
|   |   |       |   |   |-- timelines/
|   |   |       |   |   |-- utils/
|   |   |       |   |   `-- validation/
|   |   |       |   |-- filtering/
|   |   |       |   |-- folders/
|   |   |       |   |-- gallery/
|   |   |       |   |   |-- accessibility/
|   |   |       |   |   |-- albums/
|   |   |       |   |   |-- collections/
|   |   |       |   |   |-- configuration/
|   |   |       |   |   |-- diagnostics/
|   |   |       |   |   |-- engine/
|   |   |       |   |   |-- events/
|   |   |       |   |   |-- favorites/
|   |   |       |   |   |-- filters/
|   |   |       |   |   |-- interactions/
|   |   |       |   |   |-- lifecycle/
|   |   |       |   |   |-- navigation/
|   |   |       |   |   |-- objects/
|   |   |       |   |   |-- people/
|   |   |       |   |   |-- places/
|   |   |       |   |   |-- recent/
|   |   |       |   |   |-- search/
|   |   |       |   |   |-- selection/
|   |   |       |   |   |-- similarity/
|   |   |       |   |   |-- timeline/
|   |   |       |   |   |-- utils/
|   |   |       |   |   |-- validation/
|   |   |       |   |   `-- viewer/
|   |   |       |   |-- intelligence/
|   |   |       |   |   |-- collections/
|   |   |       |   |   |-- confidence/
|   |   |       |   |   |-- configuration/
|   |   |       |   |   |-- context/
|   |   |       |   |   |-- diagnostics/
|   |   |       |   |   |-- engine/
|   |   |       |   |   |-- events/
|   |   |       |   |   |-- lifecycle/
|   |   |       |   |   |-- memories/
|   |   |       |   |   |-- ranking/
|   |   |       |   |   |-- reasoning/
|   |   |       |   |   |-- relationships/
|   |   |       |   |   |-- search/
|   |   |       |   |   |-- similarity/
|   |   |       |   |   |-- timelines/
|   |   |       |   |   |-- utils/
|   |   |       |   |   `-- validation/
|   |   |       |   |-- learning/
|   |   |       |   |-- lifecycle/
|   |   |       |   |-- metadata/
|   |   |       |   |-- models/
|   |   |       |   |   |-- mobileclip/
|   |   |       |   |   |-- mobilefacenet/
|   |   |       |   |   |-- paddleocr/
|   |   |       |   |   `-- scrfd/
|   |   |       |   |-- privacy/
|   |   |       |   |-- query/
|   |   |       |   |-- settings/
|   |   |       |   |-- thumbnails/
|   |   |       |   |-- utils/
|   |   |       |   `-- validation/
|   |   |       |-- sessions/
|   |   |       |-- utils/
|   |   |       |-- validation/
|   |   |       |-- verification/
|   |   |       |-- VisualMemoryCapabilityStage.js
|   |   |       `-- index.js
|   |   |-- context/
|   |   |-- contracts/
|   |   |-- decision/
|   |   |-- entities/
|   |   |-- events/
|   |   |-- learning/
|   |   |-- linguistic/
|   |   |-- memory/
|   |   |-- models/
|   |   |-- normalization/
|   |   |-- pipeline/
|   |   |-- planning/
|   |   |-- reasoning/
|   |   |-- references/
|   |   |-- response/
|   |   |-- semantic/
|   |   |-- utils/
|   |   |-- validation/
|   |   |-- verification/
|   |   |-- AssistantEngine.js
|   |   |-- Data.js
|   |   `-- index.js
|   |-- automation/
|   |   |-- common/
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
|   |   |-- conversations/
|   |   |-- crypto/
|   |   |-- devices/
|   |   |-- discovery/
|   |   |-- history/
|   |   |-- infrastructure/
|   |   |-- mailbox/
|   |   |-- messages/
|   |   |-- multidevice/
|   |   |-- quality/
|   |   |-- requests/
|   |   |-- security/
|   |   |-- state/
|   |   |-- synchronization/
|   |   |-- transfer/
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
|   |   |-- LogFormatter.js
|   |   `-- index.js
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
|   |-- context-awareness/
|   `-- vision/
|       |-- confidence/
|       |-- configuration/
|       |-- diagnostics/
|       |-- embeddings/
|       |-- engine/
|       |-- events/
|       |-- inference/
|       |-- lifecycle/
|       |-- managers/
|       |-- postprocessing/
|       |-- preprocessing/
|       |-- registry/
|       |-- runtime/
|       |-- validation/
|       `-- index.js
|-- dist/
|-- docs/
|   |-- architecture/
|   |-- modules/
|   |-- plugins/
|   |-- setup/
|   `-- workflows/
|-- graphify-out/
|-- models/
|   `-- parakeet/
|       |-- decoder.int8.onnx
|       |-- encoder.int8.onnx
|       |-- joiner.int8.onnx
|       `-- tokens.txt
|-- node_modules/
|-- plugins/
|   |-- chrome/
|   |-- discord/
|   |-- forms/
|   |-- sample_plugin/
|   |-- youtube/
|   `-- plugin-controller.js
|-- scripts/
|   `-- start-electron.js
|-- tests/
|   |-- automation/
|   |-- context-awareness/
|   |-- core/
|   |-- media-handling/
|   `-- ui/
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
