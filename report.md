# OpenX Repository Report

Report date: 2026-07-19

Repository: `OpenX`

Package: `openx`

Version source: `package.json`

Current version: `7.0.0`

Branch / commit: `chatintegration` / `1acb3af`

## Scope Scanned

- Desktop Electron app under `apps/desktop`.
- Assistant core under `core/assistant`.
- Cloud connection, E2EE, pairing, command, and file transfer modules under `core/cloud`.
- Automation, communication, context, response, learning, linguistic, semantic, validation, verification, memory, and pipeline layers under `core`.
- Desktop renderer UI, dynamic island, chat, planner, settings, security lock, and cloud pairing surfaces.
- Test suites under `tests`.
- Package/build configuration in `package.json`, `package-lock.json`, `config.js`, and Electron builder settings.

Approximate scan size from the 2026-07-19 refresh:

- `1058` filtered files in the working tree after excluding generated, dependency, cache, graph, and local-heavy folders.
- `884` files under `core`.
- `114` files under `apps`.
- `103` files under `tests`.
- `11` files under `docs`.
- `11` files under `plugins`.
- `4` files under top-level `models`.
- `5` files under `build`, `1` file under `scripts`, and `10` root-level config/docs/package files.
- `1009` JavaScript files, `16` Markdown files, `9` JSON files, `8` ONNX model/data files, `5` HTML files, `4` CSS files, plus PowerShell/config/build metadata files.
- Visual Memory, Gallery, AI Vision, OpenX Chat desktop integration, encrypted chat client modules, model assets, face memory, and face-search ranking now account for the largest active feature areas.

## Current Working Tree

The source working tree is actively modified. This documentation refresh updates `report.md` to reflect the current `7.0.0` package version, the latest assistant stabilization work, the OpenX desktop chat integration with OpenX Chat Server, the production email OTP contract, and the centralized OpenX chat data-root cleanup.

Recent stabilization areas covered by this report include:

- `apps/desktop/electron/main.js`
- `apps/desktop/electron/security.js`
- `apps/desktop/preload.js`
- `apps/desktop/renderer/chat/index.html`
- `apps/desktop/renderer/chat/index.js`
- `apps/desktop/renderer/chat/index.css`
- `core/chat/ChatConfiguration.js`
- `core/chat/ChatDataPaths.js`
- `core/chat/ChatManager.js`
- `core/chat/history/*`
- `core/chat/conversations/ConversationConfiguration.js`
- `core/chat/crypto/CryptoConfiguration.js`
- `core/chat/devices/DeviceConfiguration.js`
- `core/chat/mailbox/MailboxConfiguration.js`
- `core/chat/messages/MessageConfiguration.js`
- `core/chat/messages/MessageManager.js`
- `core/chat/multidevice/MultiDeviceConfiguration.js`
- `core/chat/requests/RequestConfiguration.js`
- `core/chat/synchronization/SynchronizationConfiguration.js`
- `core/chat/transfer/DownloadManager.js`
- `core/chat/transfer/TransferConfiguration.js`
- `core/chat/transfer/UploadManager.js`
- `core/chat/state/ChatRuntimeStateMachine.js`
- `core/chat/state/index.js`
- `core/assistant/Data.js`
- `core/chat/ChatStatusManager.js`
- `core/chat/ChatLifecycleManager.js`
- `core/chat/crypto/SecureStorageManager.js`
- `core/automation/media.js`
- `core/assistant/automation/ActionRouter.js`
- `core/assistant/entities/EntityExtractor.js`
- `core/assistant/index.js`
- `core/assistant/learning/ActiveLearningStore.js`
- `core/assistant/response/ResponseGenerator.js`
- `core/assistant/capabilities/visual-memory/runtime/api/VisualMemoryAPI.js`
- `core/assistant/capabilities/visual-memory/runtime/intelligence/context/MemorySearchContext.js`
- `core/assistant/capabilities/visual-memory/runtime/intelligence/ranking/MemoryRankingEngine.js`
- `core/assistant/capabilities/visual-memory/runtime/intelligence/utils/intelligence-utils.js`
- `core/assistant/entities/PersonLexicon.js`
- focused media, reminder, router, learning, response, visual-memory, and gallery tests under `tests/`
- focused Desktop Chat runtime state tests under `tests/core/chat-runtime-state.test.js`
- focused OpenX data-root tests under `tests/core/data-root.test.js`
- focused trusted-device history synchronization tests under `tests/core/chat-history-sync.test.js`
- focused chat renderer and Electron IPC security tests under `tests/ui` and `tests/core`

The report reflects the current workspace state and does not add a second directory tree.

## Validation Performed

Passed:

```powershell
npm run lint -- --quiet
```

Passed:

```powershell
npx mocha tests/core/assistant-intelligence-pipeline.test.js tests/core/command-corpus.test.js --timeout 240000
```

Result:

```text
6 passing
```

Passed focused app/context validation:

```powershell
npx mocha tests/core/assistant.test.js --grep "plural app follow-ups|polite references" --timeout 120000
npx mocha tests/core/router.test.js --grep "arbitrary app|app-list|close failure" --timeout 120000
```

Passed learning-model validation:

```powershell
npx mocha tests/core/learning-engine.test.js --timeout 180000
npx mocha tests/core/active-learning-v2.test.js --timeout 180000
npx mocha tests/core/learning.test.js --timeout 180000
```

Result:

```text
10 passing
9 passing
14 passing
```

Passed focused Visual Memory, Gallery, and performance-regression validation:

```powershell
node -c apps/desktop/electron/main.js
node -c apps/desktop/renderer/gallery/index.js
node -c core/assistant/capabilities/visual-memory/runtime/engine/VisualMemoryEngine.js
node -c core/assistant/capabilities/visual-memory/runtime/query/VisualQueryParser.js
```

Passed:

```powershell
npx eslint apps/desktop/electron/main.js apps/desktop/renderer/gallery/index.js core/assistant/capabilities/visual-memory/runtime/engine/VisualMemoryEngine.js core/assistant/capabilities/visual-memory/runtime/query/VisualQueryParser.js tests/core/visual-memory.test.js tests/core/visual-query.test.js
```

Passed:

```powershell
npx mocha tests/core/visual-memory.test.js tests/core/visual-query.test.js tests/core/openx-gallery-experience.test.js tests/core/visual-memory-capability.test.js --timeout 60000 --exit
```

Result:

```text
23 passing
```

Passed assistant smoke validation:

```text
open openx gallery -> visualMemory.openGallery -> OpenX Gallery is ready, sir.
```

Passed focused Gallery People and Windows face-runtime validation:

```powershell
node -c apps/desktop/renderer/gallery/index.js
node -c core/assistant/capabilities/visual-memory/runtime/api/VisualMemoryAPI.js
node -c core/assistant/capabilities/visual-memory/runtime/faces/grouping/FaceGroupingEngine.js
node -c core/assistant/capabilities/visual-memory/runtime/faces/embeddings/FaceEmbeddingStore.js
node -c core/assistant/capabilities/visual-memory/runtime/faces/identities/IdentityManager.js
node -c core/assistant/capabilities/visual-memory/runtime/gallery/people/GalleryPeopleExperience.js
node -c core/vision/runtime/WindowsFaceRuntimeAdapter.js
```

Passed:

```powershell
npx mocha tests/core/openx-gallery-experience.test.js tests/ui/gallery-renderer.test.js --timeout 10000
```

Result:

```text
8 passing
```

Passed focused lint:

```powershell
npx eslint core/vision/runtime/WindowsFaceRuntimeAdapter.js core/assistant/capabilities/visual-memory/runtime/api/VisualMemoryAPI.js core/assistant/capabilities/visual-memory/runtime/faces/grouping/FaceGroupingEngine.js core/assistant/capabilities/visual-memory/runtime/faces/embeddings/FaceEmbeddingStore.js core/assistant/capabilities/visual-memory/runtime/faces/identities/IdentityManager.js core/assistant/capabilities/visual-memory/runtime/gallery/people/GalleryPeopleExperience.js apps/desktop/renderer/gallery/index.js tests/core/openx-gallery-experience.test.js tests/ui/gallery-renderer.test.js
```

Passed direct runtime smoke path:

```text
WindowsFaceRuntimeAdapter -> Windows.Media.FaceAnalysis.FaceDetector -> faces/embeddings response shape
VisualMemoryAPI.scanGalleryPeople -> success=true, reason=completed
```

Known caveat:

- Full `tests/core/assistant.test.js` still has unrelated expectation failures around normalized casing, time punctuation, and feedback prompt behavior. Those failures existed outside the latest plural-app follow-up change and should be handled in a dedicated cleanup pass.

Latest focused validation from the 2026-07-17 scan and face-search update:

```powershell
node -c core\assistant\capabilities\visual-memory\runtime\api\VisualMemoryAPI.js
node -c core\assistant\capabilities\visual-memory\runtime\intelligence\context\MemorySearchContext.js
node -c core\assistant\capabilities\visual-memory\runtime\intelligence\ranking\MemoryRankingEngine.js
node -c core\assistant\capabilities\visual-memory\runtime\intelligence\utils\intelligence-utils.js
node -c core\assistant\entities\PersonLexicon.js
```

Passed focused lint:

```powershell
npx eslint core\assistant\capabilities\visual-memory\runtime\api\VisualMemoryAPI.js core\assistant\capabilities\visual-memory\runtime\intelligence\context\MemorySearchContext.js core\assistant\capabilities\visual-memory\runtime\intelligence\ranking\MemoryRankingEngine.js core\assistant\capabilities\visual-memory\runtime\intelligence\utils\intelligence-utils.js core\assistant\entities\PersonLexicon.js tests\core\visual-memory-intelligence.test.js
```

Passed focused face-search, visual-memory, gallery, routing, and entity validation:

```powershell
npx mocha tests\core\visual-memory-intelligence.test.js tests\core\visual-query.test.js tests\core\face-memory.test.js --timeout 120000
npx mocha tests\core\visual-memory-capability.test.js tests\core\openx-gallery-experience.test.js tests\core\visual-filtering.test.js tests\core\vision-engine.test.js --timeout 120000
npx mocha tests\core\router.test.js --grep "photo|visual|gallery|mummy|daddy|personal photo" --timeout 180000
npx mocha tests\core\entity-understanding.test.js tests\core\entities.test.js --timeout 120000
```

Result:

```text
33 passing
23 passing
3 passing
49 passing
```

### Latest Assistant Stabilization Validation - 2026-07-17

The latest production-stabilization pass focused on two user-visible assistant failures: media playback routing and natural reminder commands.

Passed focused media playback validation:

```powershell
npx mocha tests/automation/media.test.js tests/core/responses.test.js tests/media-handling/media-handling.test.js tests/core/media-youtube-corpus.test.js --timeout 180000 --reporter dot --exit
```

Result:

```text
76 passing
```

Passed focused router validation for YouTube/default-platform behavior:

```powershell
npx mocha tests/core/router.test.js --grep "natural playback|short title words|dulander|YouTube|youtube" --timeout 180000 --reporter dot --exit
```

Result:

```text
4 passing
```

Passed focused reminder, learning, and router validation:

```powershell
npx mocha tests/core/reminder-extraction.test.js tests/core/learning.test.js tests/core/router.test.js --grep "Reminder Extraction|Active Learning Store|reminder|trailing remind-me|schedule|alarm" --timeout 180000 --reporter dot --exit
```

Result:

```text
52 passing
```

Passed focused assistant calendar/reminder validation:

```powershell
npx mocha tests/core/assistant.test.js --grep "Calendar reading|unsupported personal|reminder|schedule" --timeout 180000 --reporter dot --exit
```

Result:

```text
6 passing
```

Passed focused lint:

```powershell
npx eslint core/automation/media.js core/assistant/entities/EntityExtractor.js core/assistant/automation/ActionRouter.js core/assistant/index.js core/assistant/learning/ActiveLearningStore.js core/assistant/response/ResponseGenerator.js tests/automation/media.test.js tests/core/media-youtube-corpus.test.js tests/core/responses.test.js tests/core/reminder-extraction.test.js tests/core/router.test.js tests/core/learning.test.js tests/media-handling/media-handling.test.js
```

Passed production smoke checks:

```text
play chaild in us song -> mediaQuery="chaild in us song", mediaPlatform="youtube"
play chaild in us song in youtube -> mediaQuery="chaild in us song", mediaPlatform="youtube"
i have a meeting at 6pm tomorrow remind me -> reminder.set, reminderText="meeting", timeExpression="6pm tomorrow"
```

### Latest OpenX Chat Desktop Integration Validation - 2026-07-18

The latest chat pass connected the desktop Chat app to the standalone `OpenX_Chat_Server` account, OTP, discovery, contact request, relationship, and encrypted-message routing APIs.

Passed desktop syntax validation:

```powershell
node -c apps\desktop\electron\main.js
node -c apps\desktop\renderer\chat\index.js
node -c apps\desktop\electron\security.js
node -c core\chat\state\ChatRuntimeStateMachine.js
node -c core\chat\ChatStatusManager.js
node -c core\chat\ChatLifecycleManager.js
node -c core\chat\crypto\SecureStorageManager.js
```

Passed full desktop lint:

```powershell
npm run lint -- --quiet
```

Passed focused desktop chat renderer and IPC security validation:

```powershell
npx mocha tests\core\chat-runtime-state.test.js tests\ui\chat-renderer.test.js tests\core\electron-security.test.js --timeout 60000 --reporter dot --exit
```

Result:

```text
40 passing
```

Related standalone Chat Server validation also passed:

```powershell
npm run check
npm test
```

Result:

```text
syntax ok: 259 files
86 passing
```

Graph refresh performed after desktop code edits:

```powershell
graphify update .
```

Result:

```text
1002 files extracted
8040 nodes
18057 edges
296 communities
```

### Latest Production Email OTP And Chat Data Root Validation - 2026-07-18

The latest production hardening pass removed desktop development OTP exposure, moved Chat auth from phone/SMS to email/Gmail OTP, and moved OpenX Chat runtime data under the centralized OpenX data root while preserving received-file storage in `Documents\OpenX`.

Passed Chat Server validation after the production email OTP change:

```powershell
npm run check
npm test
```

Result:

```text
syntax ok: 259 files
86 passing
```

Passed focused Chat Server OTP and logger validation:

```powershell
node --test tests\account-phase2.test.js tests\logger-format.test.js
```

Result:

```text
16 passing
```

Passed focused OpenX desktop/chat/data validation:

```powershell
node -c apps\desktop\electron\main.js
node -c apps\desktop\renderer\chat\index.js
node -c core\chat\ChatDataPaths.js
node -c core\chat\ChatManager.js
node -c core\chat\ChatConfiguration.js
node -c core\chat\messages\MessageManager.js
node -c core\chat\transfer\UploadManager.js
node -c core\chat\transfer\DownloadManager.js
node -c tests\ui\chat-renderer.test.js
node -c tests\core\data-root.test.js
```

Passed focused OpenX lint:

```powershell
npx eslint apps\desktop\electron\main.js apps\desktop\renderer\chat\index.js core\chat\ChatDataPaths.js core\chat\ChatManager.js core\chat\ChatConfiguration.js core\chat\messages\MessageManager.js core\chat\transfer\UploadManager.js core\chat\transfer\DownloadManager.js tests\ui\chat-renderer.test.js tests\core\data-root.test.js
```

Passed focused OpenX chat/data/security validation:

```powershell
npx mocha tests\core\data-root.test.js tests\core\chat-transfer-phase12.test.js tests\core\chat-security-phase14.test.js tests\core\chat-runtime-state.test.js tests\core\chat-production-phase16.test.js tests\core\chat-multi-device.test.js tests\core\chat-infrastructure-phase15.test.js tests\core\chat-conversation-phase13.test.js tests\core\chat-connection-phase11.test.js tests\core\electron-security.test.js tests\ui\chat-renderer.test.js --timeout 120000 --reporter dot --exit
```

Result:

```text
65 passing
```

Final stale-development-OTP string scans were clean in both `OpenX` and `OpenX_Chat_Server`.

Passed focused desktop email-OTP renderer and IPC validation after the desktop UI/API migration:

```powershell
node -c apps\desktop\electron\main.js
node -c apps\desktop\electron\security.js
node -c apps\desktop\renderer\chat\index.js
npx eslint apps\desktop\electron\main.js apps\desktop\electron\security.js apps\desktop\renderer\chat\index.js tests\ui\chat-renderer.test.js tests\core\electron-security.test.js
npx mocha tests\ui\chat-renderer.test.js tests\core\electron-security.test.js --timeout 120000
```

Result:

```text
38 passing
```

Graph refresh performed after desktop code edits:

```powershell
graphify update .
```

Result:

```text
8040 nodes
18057 edges
296 communities
```

### Latest Trusted-Device History Sync And Offline Chat Status Validation - 2026-07-19

The latest desktop Chat pass added a client-side trusted-device history synchronization module and reduced noisy startup warnings when OpenX Chat Server is offline.

Implemented desktop behavior:

- Local history sync metadata is stored in `OpenX_Data\chat-history-sync.json`.
- `ChatManager` now exposes `getHistorySynchronizationManager()`.
- The new history sync manager requests coordination from `POST /history-sync/request`.
- The local transfer engine accepts encrypted chunk metadata only and rejects plaintext message fields.
- Passive Chat status refresh uses a quiet offline path, so starting OpenX while OpenX Chat Server is stopped logs an informational offline state instead of warning that identity setup failed.
- User-triggered Chat actions still surface normal server-unreachable errors when the server is required.

Passed focused syntax validation:

```powershell
node -c core\chat\history\HistorySynchronizationManager.js
node -c core\chat\history\HistoryTransferEngine.js
node -c core\chat\history\HistorySynchronizationStorage.js
node -c core\chat\history\HistorySynchronizationClient.js
node -c core\chat\ChatManager.js
node -c apps\desktop\electron\main.js
```

Passed focused lint:

```powershell
npx eslint apps\desktop\electron\main.js core\assistant\Data.js core\chat\ChatManager.js core\chat\ChatConfiguration.js core\chat\index.js core\chat\history\HistorySynchronizationConfiguration.js core\chat\history\HistorySynchronizationClient.js core\chat\history\HistorySynchronizationStorage.js core\chat\history\HistoryTransferEngine.js core\chat\history\HistorySynchronizationManager.js core\chat\history\HistorySynchronizationEvents.js tests\core\chat-history-sync.test.js tests\core\data-root.test.js
```

Passed focused OpenX Chat validation:

```powershell
npx mocha tests\core\chat-history-sync.test.js tests\core\data-root.test.js tests\core\chat-conversation-phase13.test.js tests\core\chat-multi-device.test.js tests\core\chat-production-phase16.test.js --timeout 120000
```

Result:

```text
19 passing
```

Graph refresh performed after desktop history-sync edits:

```powershell
graphify update .
```

Result:

```text
8092 nodes
18718 edges
295 communities
```

## Major Current Capabilities Confirmed

### Assistant App Command Handling

- Single app commands route to `app.open`, `app.close`, or `app.switch`.
- Multi-app commands such as `open chrome and instagram and whatsapp` are preserved through noisy repair and routed as a multi-command.
- The assistant now records successful multi-app targets in context.
- Follow-up commands like `close them` resolve to the last app group:

```text
close chrome and close instagram and close whatsapp
```

- Multi-command responses now use natural wording:

```text
Done, sir. I closed Chrome, Instagram, and WhatsApp.
```

### Assistant NLP And Response Improvements

- Shared-value utility commands such as `set the vol and brighness to 40` split into volume and brightness commands without asking for a missing value.
- Multi-command summaries no longer default to `Completed 2 commands` when a clear human-readable summary is available.
- Failed app-close responses are humanized:

```text
Done, sir. I closed Chrome, but I could not close Instagram because Instagram still appears to be open.
```

### Dynamic Island And Notifications

- Desktop contains phone-notification normalization and grouped presentation logic in Electron main.
- Rapid phone notifications are grouped by source/app/package where possible.
- Dynamic island notification display is wired for `phone.notification`.

### OpenX Desktop Chat App

- The desktop Apps view now exposes a `Chat` app surface for people-to-people OpenX Chat.
- The Chat UI keeps the mobile-style conversation layout: list, search, All/Unread/Pinned filters, settings button, and a thread pane with back navigation.
- Chat setup is hidden from the filter row and opens through the Chat settings button.
- Chat setup supports server URL, email address, user-entered email OTP verification, and optional registration PIN.
- Existing registered email addresses no longer fail as duplicate registration. Desktop now asks the Chat Server to start an existing-account OTP login flow.
- New email addresses use the normal registration flow, with OTP generation, hashing, storage, Gmail delivery, expiration, and verification owned by the Chat Server.
- The desktop never receives, displays, logs, or stores the generated OTP. It only submits the code the user enters from email.
- After verification, the desktop registers or reuses a trusted desktop device through the Chat Server device API.
- Adding a user now performs real exact-email discovery instead of creating a fake local contact.
- Contact requests are sent through the Chat Server and appear as pending outgoing requests until accepted.
- Incoming and outgoing requests are visible in the Chat settings popup with refresh, accept, delete, and cancel controls.
- Accepted relationships are synchronized back into local desktop conversations.
- Messaging is blocked while a contact request is still pending.
- Trusted relationship messages are sent to `OpenX_Chat_Server` through the encrypted message endpoint with opaque ciphertext transport.
- Plain local preview/history remains in OpenX local chat storage for the current desktop UI. The server receives only opaque encrypted message payloads and metadata.

### Cloud Pairing, Devices, And File Transfer

- Desktop cloud pairing QR, approval/rejection, status, and device list paths are present.
- Desktop cloud file transfer manager is wired for incoming transfer prompts, progress, accept/reject, and presence updates.
- Desktop cloud E2EE helpers are present under `core/cloud/CloudE2EE.js`.
- Pair box metadata is consumed when displaying connected devices.

### Crash Recovery And Resource Handling

- Electron main has unresponsive-window tracking and crash recovery timers.
- Cleanup clears recovery and unresponsive timers during shutdown.
- Voice/runtime prewarm and overlay state are present.
- Startup voice runtime prewarm is now opt-in through `voice.preloadRuntime` or `OPENX_PREWARM_VOICE_RUNTIME=1`, reducing idle startup CPU and RAM use while keeping first-use voice activation available.
- Visual Memory runtime is now lazy-loaded and is not started during normal assistant startup unless a visual-memory or gallery path is actually used.

### Assistant Performance Update - 2026-07-15

The latest performance pass focused on reducing idle work, avoiding repeated initialization, and keeping gallery UI interactions smooth.

Confirmed blockers found:

- Visual Memory was being prepared too early for some assistant flows.
- Plain gallery-open commands could enter the Visual Query, Candidate Filtering, and Memory Intelligence path before opening the gallery.
- Repeated calls to the Visual Memory API could record repeated `started` diagnostics even when the engine was already running.
- Gallery first-load indexing could block the user from seeing the window quickly.
- Gallery image previews were using base64 data URLs, which increases renderer and IPC memory pressure for large image sets.
- Voice capture/overlay runtime was prewarmed automatically after startup, increasing idle memory usage for users who did not use voice immediately.

Changes implemented:

- `apps/desktop/electron/main.js` now exposes a lazy Visual Memory API proxy to the assistant.
- `core/assistant/capabilities/visual-memory/runtime/engine/VisualMemoryEngine.js` now treats repeated `start()` calls as idempotent.
- `core/assistant/capabilities/visual-memory/runtime/query/VisualQueryParser.js` skips navigation-only commands such as `open openx gallery`, `open photos`, and `show pictures` so they do not trigger memory search.
- `apps/desktop/electron/main.js` starts gallery indexing in the background when needed instead of awaiting a full refresh before returning gallery data.
- `apps/desktop/renderer/gallery/index.js` polls only while indexing is active and disconnects timers/observers on unload.
- `apps/desktop/electron/main.js` returns `file:` image URLs for gallery images instead of base64-encoding local image files.
- `apps/desktop/renderer/gallery/index.html` allows `file:` image sources through the gallery CSP.
- Voice runtime prewarm is now skipped until first use by default.

Performance impact:

- Lower startup memory use because Visual Memory and voice runtime do not initialize unless needed.
- Less CPU work for simple gallery open commands.
- Fewer duplicate lifecycle diagnostics and less repeated engine work.
- Lower gallery memory pressure because image files are streamed by Chromium from disk rather than copied through IPC as base64 strings.
- Better first gallery paint because indexing can continue in the background.

Behavior preserved:

- `open openx gallery` still routes to `visualMemory.openGallery`.
- Visual search requests still use the Visual Query and Memory Intelligence pipeline.
- Gallery still indexes the Windows Pictures folder and nested folders such as Screenshots.
- Voice still starts when the user invokes the configured shortcut.

### Gallery And People Scan Update - 2026-07-15

The current Gallery work moved OpenX closer to a local Google Photos / OneDrive Photos style experience while staying local-first.

Implemented behavior:

- `open openx gallery` opens a dedicated Gallery renderer window.
- Gallery uses the same OpenX glass theme language as the desktop assistant.
- The main photo timeline indexes the Windows Pictures folder and nested folders.
- Photos are grouped by date for browsing.
- Search filters indexed photo metadata locally.
- Image previews load lazily through `IntersectionObserver`.
- Gallery images are delivered as local `file:` URLs, reducing IPC memory pressure compared with base64 transport.
- The viewer has a floating favorite star.
- `Favorites` shows only starred images.
- `Recent` shows only images opened within the recent-window policy, currently three days.
- `People` shows named and unnamed Face Memory groups.
- The People view has a top-right `Scan People` button.
- People cards now use a close-up crop from the representative detected face instead of a generic `?` tile when face-box metadata is available.

People scan flow:

```text
Gallery People view
  -> Scan People button
  -> renderer invokes gallery:scanPeople
  -> Electron IPC validation bounds maxPhotos
  -> VisualMemoryAPI.scanGalleryPeople()
  -> VisionEngine default runtime
  -> WindowsFaceRuntimeAdapter on Windows
  -> Windows.Media.FaceAnalysis.FaceDetector
  -> face rectangle + local face-region vector
  -> Face Memory unknown grouping
  -> GalleryPeopleExperience exposes nameable people
  -> renderer displays cropped person cards
```

Accuracy and safety behavior:

- The scan does not create a person from weak evidence.
- A face must pass the face confidence threshold.
- A face-region vector must pass the embedding confidence threshold.
- A scan result with face detection but no embedding is skipped.
- Previous unnamed auto-scan clusters are cleared before rescanning, while named people are preserved.
- The grouping threshold was tightened to reduce merging unrelated faces into one large unnamed cluster.
- Windows FaceDetector is used only for local face detection. It does not identify a person by name; naming remains user-controlled.

Important files:

| File | Responsibility |
|---|---|
| `apps/desktop/renderer/gallery/index.html` | Gallery shell, navigation, People scan button, viewer favorite button. |
| `apps/desktop/renderer/gallery/index.js` | Timeline rendering, lazy image loading, views, People cards, face crop rendering, search, viewer. |
| `apps/desktop/renderer/gallery/index.css` | Gallery layout, glass styling, photo cards, People cards, cropped avatars. |
| `apps/desktop/electron/main.js` | Gallery window, IPC handlers, image data, favorite/recent/people APIs. |
| `apps/desktop/electron/security.js` | IPC validation for gallery views, photos, favorites, naming, and scan payloads. |
| `apps/desktop/preload.js` | Safe renderer API surface for gallery operations. |
| `core/assistant/capabilities/visual-memory/runtime/api/VisualMemoryAPI.js` | Public Visual Memory API, gallery scan orchestration, face verification, scan cleanup. |
| `core/vision/runtime/WindowsFaceRuntimeAdapter.js` | Node runtime adapter for Windows face analysis. |
| `core/vision/runtime/windows-face-analysis.ps1` | PowerShell/WinRT bridge for local face detection and region-vector extraction. |
| `core/assistant/capabilities/visual-memory/runtime/faces/*` | Consent, grouping, embeddings, identity/profile management, enrollment, validation, privacy. |
| `core/assistant/capabilities/visual-memory/runtime/gallery/people/GalleryPeopleExperience.js` | Converts Face Memory state into People view records. |

Current limitation:

- The Windows runtime provides local face detection and a lightweight face-region vector. It improves grouping and close-up display, but it is not a production-grade deep face recognition model. A future ONNX face embedding model can replace the region-vector logic behind the same adapter contract without changing the Gallery UI.

## Detailed OpenX System Information

### Product Purpose

OpenX is a local-first Windows desktop assistant built with Electron and Node.js. Its main responsibility is to understand user commands from chat, voice, phone, cloud relay, and plugin surfaces, convert those commands into validated assistant intents, execute desktop automation safely, and return a human-readable response.

The system is not a single parser or a single automation script. It is structured as a layered assistant runtime:

```text
Input source
  -> acquisition
  -> normalization
  -> linguistic analysis
  -> semantic understanding
  -> entity extraction
  -> memory/context resolution
  -> reasoning and decision
  -> planning
  -> validation
  -> automation execution
  -> verification
  -> response generation
  -> chat / voice / dynamic island / phone response
```

### Main Runtime Entrypoints

| Area | Main files | Responsibility |
|---|---|---|
| Desktop app boot | `apps/desktop/electron/main.js` | Creates Electron windows, registers IPC, starts assistant, cloud, voice, crash recovery, dynamic island, settings, and security flows. |
| Assistant API | `core/assistant/index.js` | Main assistant facade used by chat, phone, voice, and cloud command paths. Handles pending confirmation, clarification, contextual rewrites, learning, and final response shaping. |
| Assistant engine | `core/assistant/AssistantEngine.js` | Pipeline-oriented assistant runtime used for staged understanding and command processing. |
| Command router | `core/assistant/automation/ActionRouter.js` | Converts normalized human commands into concrete intent IDs and entity payloads, handles multi-command splitting, app/file/media/browser/schedule/utility routing, and response summaries. |
| Automation dispatcher | `core/automation/index.js` plus automation modules | Executes desktop actions such as app open/close, browser, files, folders, media, planner, scheduler, screenshot/recording, system, volume, brightness, and Windows actions. |
| Response generation | `core/assistant/response/ResponseGenerator.js` | Converts success/error/clarification/confirmation states into user-facing assistant text. |

### NLP And Language Understanding

OpenX uses a deterministic multi-layer NLP stack rather than relying on one large model call for every command.

Key NLP folders:

- `core/assistant/acquisition`
- `core/assistant/normalization`
- `core/assistant/linguistic`
- `core/assistant/semantic`
- `core/assistant/entities`
- `core/assistant/references`
- `core/assistant/memory`
- `core/assistant/reasoning`
- `core/assistant/planning`

Important flow:

1. Acquisition adapters normalize the input source. Chat, voice, phone, cloud, clipboard, plugins, and API inputs can be represented consistently.
2. Normalization cleans the text, expands contractions, repairs spelling, handles slang, normalizes punctuation, numbers, dates, times, units, unicode, and repeated words.
3. Linguistic analysis tokenizes the command, splits sentences, tags parts of speech, detects verbs, subjects, objects, modifiers, negation, questions, clauses, dependencies, and pronouns.
4. Semantic analysis resolves meaning, web targets, relationships, intent-like representations, confidence, and conversation classification.
5. Entity extraction identifies apps, browsers, files, folders, contacts, dates, times, durations, alarms, reminders, timers, volume, brightness, network, media, people, paths, windows, devices, and websites.
6. Memory and references resolve follow-ups such as `it`, `that`, `them`, `those`, `same`, `current app`, recent files, recent app groups, recent searches, and conversation topics.
7. Reasoning and decision stages decide whether the assistant can execute, needs clarification, requires confirmation, or should answer directly.
8. Planning converts single or multi-step instructions into an execution plan.

Recent confirmed NLP behavior:

- `open chrome and instagram and whatsapp` is preserved as a multi-app command.
- `close them` resolves from context to the previous app group.
- `set the vol and brighness to 40` creates both `volume.set` and `brightness.set` with the shared value.
- Media titles such as `Stars and Stripes Forever` are preserved as a full media query rather than split incorrectly.

### Command Routing And Multi-Command Handling

The routing core lives in `core/assistant/automation/ActionRouter.js`.

The router handles:

- single command routing;
- multi-command splitting with `and`, `then`, `also`, and related connectors;
- app-list preservation through noisy repair;
- shared-value utility splitting;
- contextual rewrite support from `Assistant`;
- command confidence and evidence;
- confirmation/clarification pause points;
- partial failure reporting;
- natural multi-command summaries.

Important examples:

```text
open chrome and instagram and whatsapp
  -> open chrome
  -> open instagram
  -> open whatsapp

close them
  -> close chrome
  -> close instagram
  -> close whatsapp

set the vol and brighness to 40
  -> set volume to 40
  -> set brightness to 40
```

Failure handling is designed to continue safe independent steps when possible. If one close action fails and another succeeds, the assistant reports both outcomes instead of collapsing everything into a generic failure.

### Automation Layer

Desktop automation lives under `core/automation`.

| Module | Responsibility |
|---|---|
| `apps.js` | Open, close, switch, focus, inspect, and verify applications/windows. |
| `browser.js` | Browser open/search/site workflows. |
| `files.js` | File search, open, move, copy, delete, archive, and transfer-related actions. |
| `folders.js` | Folder open/search/create/move/copy/delete/list workflows. |
| `media.js` | Media playback controls and YouTube/media search flows. |
| `planner.js` | Local planner/calendar integration. |
| `scheduler.js` | Timers, reminders, alarms, snooze/stop, and schedule alerts. |
| `screenshot-recording.js` | Screenshot and screen-recording commands. |
| `system.js` | System information, settings, power, task manager, and diagnostics. |
| `volume.js` | Volume set/up/down/mute/unmute. |
| `brightness.js` | Brightness set/up/down. |
| `windows.js` | Window management actions. |
| `communications.js` | Communication-related automation foundation. |

Common helpers under `core/automation/common` handle action confirmation, validation, verification, launch helpers, path utilities, and Windows session operations.

### Validation, Permission, And Verification

OpenX separates "understanding a command" from "being allowed to run it" and "verifying it worked".

Key folders:

- `core/assistant/validation`
- `core/assistant/decision`
- `core/assistant/verification`
- `apps/desktop/permissions.js`
- `apps/desktop/electron/security.js`
- `apps/desktop/security-lock.js`

Validation checks constraints, permissions, confirmation requirements, safety rules, context readiness, and entity completeness.

Verification checks whether expected outcomes appear true after execution. Examples include app/window verification, browser state verification, reminder verification, transfer verification, cloud verification, and execution verification.

Security-sensitive actions can require confirmation or a personal OpenX security lock instead of blindly executing.

### Context, Memory, And Follow-Up Understanding

Core context is managed by `core/assistant/context/ContextManager.js`.

The context layer stores compact bounded history with:

- input text;
- intent;
- success state;
- entities;
- response;
- target summary;
- domain;
- validation/verification status;
- recent app groups;
- recent files;
- recent searches;
- pending tasks;
- topic memory;
- user preferences and facts.

Important follow-up behavior:

- `close that` resolves to the last app target.
- `close them` resolves to the last successful app group.
- `where is it saved` resolves to the last file path.
- `how does it work` after a knowledge search resolves to the last topic.
- `try again` prefers the last failed actionable command.
- reminder/timer follow-ups can complete missing time or text.

### Learning System

Learning lives under `core/assistant/learning`.

The learning layer includes:

- active learning manager/store;
- alias learning;
- correction learning;
- feedback learning;
- habit learning;
- pattern learning;
- preference learning;
- usage learning;
- workflow learning;
- learning policy, guard, validation, diagnostics, analytics, and storage.

The assistant can record corrections, learn safe preferences, remember non-sensitive facts, and avoid storing unsafe secrets. Learning is designed to improve future routing without bypassing validation, confirmation, or security checks.

#### Fresh Learning Model

The learning layer now has a reference-informed local personalization model:

```text
assistant response + raw input metadata
  -> learning modules produce candidate events
  -> LearningValidator cleans and bounds each event
  -> LearningPolicy checks category, confidence, and constitution
  -> LearningStorage persists approved event records
  -> PersonalizationProfileStore updates the user-facing profile
  -> LearningAnalytics reports learned, rejected, prompt, and profile counts
```

New model files:

- `LearningConstitution.js`
  - Defines the durable learning principles.
  - Scores candidate learning events using confidence, source quality, category impact, and repeated evidence.
  - Rejects incomplete, sensitive, or weak events before storage.
  - Decides when the assistant should ask for feedback instead of silently strengthening a memory.
- `PersonalizationProfileStore.js`
  - Stores a compact local profile in `learning/v3/personalization_profile.json`.
  - Keeps per-category records for preferences, aliases, corrections, habits, patterns, workflows, feedback, and conversation style.
  - Tracks value, confidence, score, source, evidence count, first/last seen timestamps, principle, reason, and sanitized metadata.
  - Maintains bounded audit, rejected, and feedback-prompt lists.
  - Applies time decay so old weak signals naturally lose influence.

Learning principles implemented:

1. Local-first personalization.
2. User-visible and forgettable memories.
3. No secret or private identifier learning.
4. Evidence-weighted learning, where explicit corrections and repeated successful behavior beat one-off guesses.
5. Selective active-learning prompts only for useful uncertain behavior.
6. No learned preference or workflow can bypass confirmation, security, validation, or permissions.

Event sources are weighted differently:

- explicit user correction: strongest signal;
- explicit user preference: strongest signal;
- explicit feedback: strong signal;
- repeated successful use: medium-high signal;
- long-term usage pattern: medium signal;
- response metadata or conversation style: low signal.

The current implementation intentionally avoids opaque self-training. It stores auditable structured signals instead of retraining a model or saving full private chat text. This keeps learning useful for command routing and personalization while staying inspectable and reversible.

Reference basis:

- OpenAI learning from human preferences and memory control concepts.
- Anthropic Constitutional AI / Collective Constitutional AI style principle-first filtering.
- Google federated/on-device learning patterns for local-first personalization.
- Apple privacy and differential-privacy guidance for minimizing personal data retention.

### Response System

Response generation lives under `core/assistant/response`.

Important response responsibilities:

- success responses;
- error responses;
- clarification prompts;
- confirmation prompts;
- summary responses;
- notification formatting;
- chat formatting;
- voice formatting;
- personality application.

Recent response improvements:

- app close failures are humanized;
- multi-command responses explain the actual completed work;
- reminder/timer/alarm confirmations include meaningful task/time details;
- partial failures are reported with completed and failed actions in one sentence.

### Voice Subsystem

Voice code lives under `apps/desktop/voice`.

Major voice layers:

- `audio`: capture, buffer, device, permissions, frames;
- `preprocessing`: VAD, frame processing, RNNoise placeholder/processor layer, speech source classification;
- `stt`: model loading, Sherpa/Parakeet runtime, transcript assembly;
- `normalization`: transcript cleanup and command normalization;
- `integration`: bridge from voice transcript to assistant command execution;
- `ui`: dynamic island/overlay window, animations, theme, state renderer, IPC;
- `diagnostics`: metrics, latency, resource, health, privacy-aware logging.

Voice is integrated with assistant execution and can pause/resume listening depending on TTS and dynamic-island state.

### Desktop UI And Dynamic Island

Main UI surfaces:

- `apps/desktop/renderer/chat`
- `apps/desktop/renderer/planner`
- `apps/desktop/renderer/timer-widget`
- `apps/desktop/renderer/voice-capture`
- `apps/desktop/voice/ui`

The chat renderer provides chat, activity, notifications, calendar/planner, settings, profile, cloud pairing, device management, security lock, and theme surfaces.

The dynamic island is used for:

- voice states;
- TTS output;
- web/search results;
- phone notifications;
- timers;
- reminders;
- alarms;
- file transfer prompts;
- mobile/cloud events.

Phone notification grouping is handled in `apps/desktop/electron/main.js`, with normalized notification payloads and grouped result entries.

### Desktop OpenX Chat Integration

The desktop Chat app is a user-to-user chat surface inside the existing OpenX desktop renderer. It is separate from the assistant command conversation and uses the standalone `OpenX_Chat_Server` for account registration, device registration, contact discovery, contact requests, trusted relationships, and encrypted message routing.

Primary desktop chat files:

| File | Responsibility |
|---|---|
| `apps/desktop/renderer/chat/index.html` | Chat app shell, conversation list, thread pane, add-user form, edit/delete controls, settings popup, registration form, request lists. |
| `apps/desktop/renderer/chat/index.js` | Chat UI state, registration flow, add-user flow, request refresh/accept/delete/cancel, conversation rendering, send handling, toasts. |
| `apps/desktop/renderer/chat/index.css` | WhatsApp-style mobile chat layout, list/thread responsive states, request cards, setup popup, modern assistant-themed styling. |
| `apps/desktop/electron/main.js` | Main-process chat orchestration, local chat storage, Chat Server HTTP requests, OTP flow, device registration, contact requests, relationship sync, encrypted message send. |
| `apps/desktop/electron/security.js` | IPC validators for chat list/open/create/update/delete/send, contact request actions, and registration payloads. |
| `apps/desktop/preload.js` | Safe renderer API for chat registration, contacts, requests, local conversations, and send actions. |
| `core/chat/*` | Production chat client modules for crypto, discovery, requests, conversations, messages, mailbox, synchronization, multi-device, connection, security, transfer, infrastructure, and quality layers. |

Desktop Chat IPC surface:

| IPC channel | Purpose |
|---|---|
| `desktopChat:list` | List local conversations with optional query and limit. |
| `desktopChat:open` | Open one local conversation and recent history. |
| `desktopChat:create` | Discover a real user and create/send a contact request. |
| `desktopChat:update` | Edit local display metadata for a conversation. |
| `desktopChat:delete` | Delete local conversation history/metadata. |
| `desktopChat:send` | Send a local or trusted relationship message. |
| `desktopChat:contacts:list` | Load incoming requests, outgoing requests, and trusted relationships from Chat Server. |
| `desktopChat:contacts:accept` | Accept an incoming request and create/update a trusted local conversation. |
| `desktopChat:contacts:delete` | Delete an incoming request. |
| `desktopChat:contacts:cancel` | Cancel an outgoing request. |
| `desktopChat:registration:get` | Read local registration/setup state. |
| `desktopChat:registration:start` | Start new registration or existing-account OTP login. |
| `desktopChat:registration:verify` | Verify OTP, create optional PIN, and register/reuse desktop device. |

Desktop Chat data handling:

```text
OpenX data root
  -> chat setup state
  -> chat device state
  -> local conversation records
  -> local recent message previews/history
```

Important data rules:

- desktop chat account setup state is stored locally under the OpenX data root;
- desktop device state stores the server-issued `DeviceID` and local `clientDeviceKey` metadata;
- local conversations, messages, mailbox sequence state, synchronization cursors, multi-device state, file-transfer metadata, request nicknames, and chat crypto envelopes are stored under `OpenX_Data`;
- received files intentionally remain in `Documents\OpenX`;
- server requests use bounded JSON and timeout-controlled fetch calls;
- renderer access is through validated IPC only;
- registration and request payloads are normalized before leaving the renderer;
- server errors preserve machine-readable `code` and safe `details` for UI handling;
- message plaintext is not sent to the server in the trusted relationship path.

Current registration flow:

```text
Chat settings
  -> user enters server URL and email address
  -> desktop calls /account/check
  -> if email is new:
       /register/start
       Chat Server sends email OTP through Gmail SMTP
       user enters email OTP
       /register/verify
  -> if email already exists:
       /account/login/start
       Chat Server sends email OTP through Gmail SMTP
       user enters email OTP
       /account/login/verify
  -> desktop calls /device/register
  -> optional /security/pin/create
  -> desktop persists setup/device state locally
  -> renderer receives desktopChat:registrationChanged
```

Current add-user flow:

```text
Chat add user
  -> user enters display name and email address
  -> desktop requires a registered local chat account
  -> /discovery/lookup returns opaque contact token
  -> /contact/request creates a pending request
  -> local conversation is created with serverStatus=request-pending
  -> outgoing request appears in Chat settings
  -> composer is blocked until the request is accepted
```

Current contact acceptance flow:

```text
Chat settings
  -> /contact/request/pending
  -> user accepts request
  -> /contact/request/accept
  -> Chat Server creates TrustedRelationship
  -> desktop creates or updates local conversation
  -> serverStatus=trusted
  -> messages can be sent
```

Current relationship refresh flow:

```text
Chat settings refresh
  -> /contact/request/pending
  -> /contact/request/outgoing
  -> /contact/relationships
  -> trusted relationships are reconciled into local conversations
  -> pending requests remain visible with action controls
```

Current trusted message send flow:

```text
User sends message in trusted conversation
  -> renderer invokes desktopChat:send
  -> IPC validation bounds conversationId and text
  -> main process verifies local trusted relationship metadata
  -> main process builds opaque encrypted transport payload
  -> /messages/send routes the encrypted payload through Chat Server
  -> local desktop conversation history is updated for immediate UI feedback
```

Current limitation:

- the desktop UI now sends through the server-backed trusted relationship path, but full cross-device decrypt/sync display still depends on wiring the existing `core/chat/messages`, `core/chat/mailbox`, `core/chat/synchronization`, and Phase 4 session-key material into the renderer-facing Chat app. The current implementation does not weaken this by deriving shared keys from server-known relationship IDs.

### OpenX Gallery And Visual Memory

The OpenX Gallery is a local-first photo browsing and memory surface integrated into the assistant.

User-facing goals:

- browse the Windows Pictures library without copying images into OpenX;
- keep photos grouped by date for fast orientation;
- allow local search over indexed photo metadata;
- show Favorites, Recent, and People views;
- let assistant commands open the gallery or a photo result;
- support future semantic memory search without replacing the UI;
- avoid heavy startup cost by lazy-loading Visual Memory only when a gallery or visual-memory path is used.

Primary runtime components:

| Component | Path | Responsibility |
|---|---|---|
| Gallery renderer | `apps/desktop/renderer/gallery` | UI shell, timeline, search, viewer, People view, Favorites, Recent, lazy image loading. |
| Electron gallery bridge | `apps/desktop/electron/main.js` | Opens/closes Gallery window, serves gallery view data, returns safe image URLs, records recent/favorite state. |
| IPC validation | `apps/desktop/electron/security.js` | Validates all gallery IPC payloads before they reach main process handlers. |
| Visual Memory API | `core/assistant/capabilities/visual-memory/runtime/api/VisualMemoryAPI.js` | Public API for indexing, gallery, query, face, learning, and search operations. |
| Visual Memory engine | `core/assistant/capabilities/visual-memory/runtime/engine/VisualMemoryEngine.js` | Initializes database, folders, metadata, thumbnails, query, filtering, intelligence, learning, faces, gallery. |
| Database | `core/assistant/capabilities/visual-memory/runtime/database` | Local JSON-backed visual memory state under the OpenX data directory. |
| Folder indexing | `core/assistant/capabilities/visual-memory/runtime/folders` | Discovers and indexes images from Pictures and nested folders. |
| Metadata | `core/assistant/capabilities/visual-memory/runtime/metadata` | Stores image dates, dimensions, source type, folder info, and supporting metadata. |
| Gallery experience | `core/assistant/capabilities/visual-memory/runtime/gallery` | Presentation-only gallery state for timeline, collections, places, people, favorites, recent, viewer, quick actions. |
| Visual query | `core/assistant/capabilities/visual-memory/runtime/query` | Structured visual query parsing from existing assistant context; navigation commands bypass heavy search. |
| Candidate filtering | `core/assistant/capabilities/visual-memory/runtime/filtering` | Filters indexed memories by metadata, time, scene, objects, screenshots, documents, people, and constraints. |
| Memory intelligence | `core/assistant/capabilities/visual-memory/runtime/intelligence` | Ranks and reasons over memories, timelines, relationships, collections, confidence, and similarity using structured outputs. |
| Face Memory | `core/assistant/capabilities/visual-memory/runtime/faces` | Local face consent, grouping, unknown clusters, user naming, identities, profiles, privacy, diagnostics. |
| Vision runtime | `core/vision` | AI Vision engine contracts, runtime manager, model manager, postprocessor, and Windows face adapter. |

Gallery data model summary:

```text
photos table
  -> file path, file name, extension, indexed date, folder id

metadata table
  -> photo id, created date, dimensions, type, city/source hints

gallery state
  -> favorites, recent, selection, viewer state

faceMemory table
  -> consent, embeddings, unknown clusters, identities, profiles, relationships
```

Gallery view behavior:

| View | Behavior |
|---|---|
| `Photos` | Main timeline. Groups indexed photos by date. Supports lazy thumbnail/image loading and infinite loading. |
| `Favorites` | Shows only images marked by the viewer star. |
| `Recent` | Shows photos opened recently, currently bounded to the three-day recent policy. |
| `People` | Shows known and unnamed people from Face Memory. Unnamed people can be named by the user. |

Image delivery:

- Main process resolves image records by photo ID.
- The renderer receives a local file URL instead of base64 image bytes.
- The gallery CSP explicitly allows `file:` image sources for local image display.
- This reduces memory pressure for large libraries because Chromium streams the file from disk.

People scan behavior:

```text
scan request
  -> reset unnamed auto-scan clusters
  -> skip photos already represented by named embeddings
  -> run face detection
  -> require verified face rectangle
  -> require verified face-region vector
  -> ingest unknown face locally
  -> group by tightened similarity threshold
  -> persist Face Memory
  -> refresh People view
```

Face Memory rules:

- Face Memory requires explicit consent state before grouping.
- OpenX never auto-names a person.
- Unknown clusters are nameable by the user.
- Named people are preserved during rescans.
- Unnamed auto-scan clusters are rebuilt when Scan People is pressed.
- Representative face boxes are stored so the UI can show close-up person tiles.
- The local Windows runtime detects faces; it does not identify who the person is.

Performance choices:

- Visual Memory is lazy-loaded.
- Gallery indexing can run in the background.
- Repeated Visual Memory `start()` calls are idempotent.
- Gallery image loading is capped and intersection-based.
- Search is debounced.
- Renderer timers and observers are cleared on unload.
- People scan uses a bounded IPC payload and a bounded image analysis timeout.

### Cloud, Mobile, Pairing, And File Transfer

Cloud modules live under `core/cloud`.

| Module | Responsibility |
|---|---|
| `CloudConnectionManager.js` | Relay WebSocket lifecycle, reconnect, status, device list, notifications, relay packets. |
| `CloudPairingManager.js` | Pair token creation, QR payloads, approval/rejection, pairing status. |
| `CloudCommandManager.js` | Cloud assistant command requests, schedule sync, routing, execution timeout handling. |
| `CloudCommandRouter.js` | Cloud command integration and event routing. |
| `CloudFileTransferManager.js` | Cloud file transfer lifecycle, incoming/outgoing transfers, accept/reject, progress. |
| `CloudFileTransferProtocol.js` | Transfer packet/message protocol. |
| `CloudTransferIntegrity.js` | Transfer integrity and checksums. |
| `CloudE2EE.js` | JSON/packet encryption helpers and secure packet channel. |
| `CloudRequestQueue.js` | Request tracking and timeout management. |
| `CloudResponseSerializer.js` | Safe response serialization for relay/mobile. |
| `CloudLogger.js` | Cloud-specific logging. |

Desktop cloud features include:

- QR pairing creation;
- pair request approval/rejection;
- connected device list;
- pair box metadata display;
- cloud command execution;
- mobile schedule sync;
- phone notification display;
- encrypted relay packet support;
- incoming cloud file-transfer prompt;
- progress and presence updates.

### Crash Recovery And Stability

Crash and recovery behavior is implemented mainly in:

- `apps/desktop/electron/crash-recovery.js`
- `apps/desktop/electron/main.js`
- `core/assistant/utils/Cancellation.js`
- `core/communication/OperationScheduler.js`
- `core/cloud/CloudRequestQueue.js`

Important mechanisms:

- renderer load tracking;
- unresponsive window timeout tracking;
- crash recovery timers;
- operation deadlines;
- cancellation propagation;
- cloud request timeouts;
- voice/audio cleanup;
- shutdown cleanup for timers and windows.

### Data Security

Security-sensitive areas:

- Electron IPC validation in `apps/desktop/electron/security.js`;
- personal security lock in `apps/desktop/security-lock.js`;
- safe storage usage for cloud E2EE keys in Electron main;
- cloud packet encryption through `CloudE2EE.js`;
- renderer security tests;
- security critical tests;
- lock-protected pairing controls;
- secret redaction in context and learning stores.

Known security rule:

- Sensitive values such as passwords, tokens, API keys, private keys, OTPs, PINs, and credentials must not be stored in normal assistant history or learning memory.

### Test Coverage Map

Important test groups:

- `tests/core/command-corpus.test.js`: command corpus routing coverage.
- `tests/core/router.test.js`: routing behavior.
- `tests/core/assistant.test.js`: assistant conversation, confirmations, context, feedback, learning, and follow-ups.
- `tests/core/cloud-connection.test.js`: cloud connection behavior.
- `tests/core/cloud-file-transfer-manager.test.js`: cloud transfer manager.
- `tests/core/cloud-pairing-manager.test.js`: cloud pairing manager.
- `tests/core/electron-security.test.js`: Electron IPC security.
- `tests/core/renderer-security.test.js`: renderer safety.
- `tests/core/security-critical.test.js`: critical security behavior.
- `tests/core/security-lock.test.js`: OpenX lock behavior.
- `tests/core/performance-memory.test.js`: performance/memory guard coverage.
- `tests/core/openx-gallery-experience.test.js`: Gallery timeline, People view, face scan, favorites, recent, viewer, and persistence coverage.
- `tests/core/gallery-recent.test.js`: Recent gallery policy coverage.
- `tests/core/visual-memory*.test.js`: Visual Memory foundation, query, filtering, intelligence, learning, and capability coverage.
- `tests/core/vision-engine.test.js`: Vision Engine contract and runtime behavior coverage.
- `tests/ui/*`: renderer and dynamic island UI contract checks.
- `tests/automation/*`: automation module tests.

## Command Processing Deep Dive

### End-To-End Command Lifecycle

Every assistant command follows a staged lifecycle. Some direct context answers can return early, but normal automation commands pass through this shape:

```text
User input
  -> Assistant.processCommand()
  -> pending confirmation / clarification check
  -> schedule-completion check
  -> learning/correction check
  -> session/context direct answer check
  -> contextual rewrite
  -> ActionRouter.process()
  -> command preparation and noisy-repair decision
  -> capability classification
  -> multi-command splitting
  -> intent resolution
  -> entity extraction and repair
  -> action validation
  -> permission/external guard validation
  -> confirmation/clarification decision
  -> AutomationEngine.execute()
  -> controller execution
  -> action-level validation and verification
  -> response generation
  -> context/history/learning update
  -> UI/voice/phone/cloud response
```

### Assistant-Level Processing

Main file: `core/assistant/index.js`

Assistant responsibilities before routing:

1. Reject or finish pending confirmation flows.
2. Resolve pending clarification choices.
3. Complete partial schedule requests such as missing reminder text or missing time.
4. Apply learned corrections when safe.
5. Answer direct session questions such as last command, last search, or remembered facts.
6. Build the routed input from raw text.
7. Attach conversation digest, structured entities, resolved context, phone context, and cancellation signal.
8. Run the router under a command timeout.
9. Record the result into context history.
10. Capture incomplete schedules and duplicate reminders.
11. Generate context-aware error responses.
12. Append learning prompts only when appropriate.
13. Store pending confirmation or clarification state if needed.

Important assistant state:

| State | Purpose |
|---|---|
| `pendingConfirmation` | Stores command ID, intent, entities, source, permission guard, phone context, and optional multi-command continuation. |
| `pendingClarification` | Stores choices and entities when a command needs a specific user selection. |
| `pendingScheduleCompletion` | Stores incomplete reminder/timer/alarm details across turns. |
| `pendingLearningRepair` | Stores a correction flow after negative feedback or explicit repair. |
| `context` | Stores bounded conversation and command history. |
| `learning` | Stores safe corrections, aliases, patterns, feedback, preferences, habits, and workflows. |

### Routed Input And Contextual Rewrites

Main method: `_buildRoutedInput(input)`

The assistant does not always send raw user text directly to the router. It first normalizes compact command text and resolves contextual follow-ups.

Examples:

```text
can you please open instagram
  -> open instagram

can please close that
  -> close instagram

open chrome and instagram and whatsapp
  -> open chrome and instagram and whatsapp

close them
  -> close chrome and close instagram and close whatsapp

How does it work?
  -> search for how <last-topic> works
```

Contextual rewrite sources:

- last app action;
- last multi-app group;
- last file reference;
- last folder reference;
- last search topic;
- pending schedule task;
- recent failed command;
- voice transcript reference;
- phone transfer context.

### Router-Level Command Preparation

Main file: `core/assistant/automation/ActionRouter.js`

The router prepares the command through NLP and safety checks before choosing an intent.

Major router stages:

1. Normalize input and preserve raw text.
2. Run NLP preparation.
3. Decide whether noisy repair is safe.
4. Preserve structural commands such as:
   - file commands;
   - rename commands;
   - phone transfer commands;
   - schedule commands;
   - network commands;
   - app-list commands.
5. Classify capability domains.
6. Split multi-command requests when appropriate.
7. Resolve direct intent by priority.
8. Extract and normalize entities.
9. Validate required entities.
10. Check external permission guard.
11. Check permission policy.
12. Return confirmation/clarification or execute.

Noisy repair is guarded because a repaired transcript can accidentally delete important targets. For example:

```text
open chrome and whatsapp
```

must not become:

```text
open chrome
```

The structural app-list guard prevents that failure.

### Multi-Command Workflow

Main methods:

- `_buildMultiCommandPlan()`
- `_executeMultiCommand()`
- `_buildMultiCommandResponse()`
- `_summarizeMultiCommandSteps()`

Multi-command behavior:

1. Split the command into clauses.
2. Route each clause independently with `allowMulti: false`.
3. Preserve browser context between browser-related steps where needed.
4. Continue independent safe steps after ordinary failures.
5. Stop and store pending state if a step requires confirmation.
6. Stop and ask if a step needs clarification.
7. Return a combined response with successful and failed step summaries.

Example successful flow:

```text
Input:
open chrome and instagram and whatsapp

Plan:
1. open chrome
2. open instagram
3. open whatsapp

Execution:
app.open chrome
app.open instagram
app.open whatsapp

Response:
Done, sir. I opened Chrome, Instagram, and WhatsApp.
```

Example partial failure flow:

```text
Input:
close instagram and chrome

Execution:
app.close instagram -> failed verification
app.close chrome -> passed

Response:
Done, sir. I closed Chrome, but I could not close Instagram because Instagram still appears to be open.
```

Example confirmation pause:

```text
Input:
close chrome and set volume to 100

Step 1:
app.close chrome -> requires confirmation

State:
pendingConfirmation stores:
- confirmed input: close chrome
- completed previous steps: []
- remaining commands: [set volume to 100]

After user confirms:
app.close chrome executes
then volume.set 100 executes
```

### Shared-Value Multi-Command Workflow

Some commands contain one value shared by multiple targets:

```text
set the vol and brighness to 40
```

The router recognizes this as a coordinated utility set command:

```text
set volume to 40
set brightness to 40
```

This avoids an incorrect clarification such as:

```text
I need one more detail: value.
```

### Intent And Entity Contract

OpenX intents follow a domain/action format:

```text
domain.action
```

Examples:

| Intent | Required entity examples | Meaning |
|---|---|---|
| `app.open` | `appName` | Open or focus an app. |
| `app.close` | `appName` | Close an app/window/process. |
| `browser.search` | `query` | Search the web. |
| `browser.open` | `url` | Open a browser URL. |
| `media.play` | `mediaQuery`, optional `mediaPlatform` | Play/search media. |
| `volume.set` | `value` | Set system volume. |
| `brightness.set` | `value` | Set display brightness. |
| `file.open` | `filename` or `path` | Open a file. |
| `file.search` | `query` | Search files. |
| `folder.open` | `folderName` or `path` | Open a folder. |
| `phone.sendFile` | `path` or file context | Transfer a file to phone. |
| `timer.set` | `duration` | Start a timer. |
| `alarm.set` | `timeExpression` | Set an alarm. |
| `reminder.set` | `reminderText`, time/duration optional depending on context | Set a reminder. |
| `calendar.add` | planner/schedule entities | Add calendar entry. |
| `message.compose` | `contactName`, `messageText` | Compose message. |

Action validation checks required entities before automation executes.

### Clarification Workflow

Clarification is used when the assistant understands the action but does not have enough detail or has multiple safe candidates.

Clarification can happen for:

- missing required entity;
- ambiguous file/folder result;
- ambiguous app/window target;
- incomplete schedule request;
- phone file-transfer option selection;
- command needing a numeric choice.

Flow:

```text
User:
open resume

Assistant:
I found multiple matching files. Choose one.

State:
pendingClarification stores choices and original intent.

User:
2

Assistant:
resolves choice 2
calls confirmAndExecute()
executes file.open with selected path
```

Important clarification behavior:

- numeric replies map to choice indexes;
- natural replies like `this one`, `that one`, `first one`, `second one` are supported;
- unrelated new standalone requests can clear a pending schedule clarification;
- pending clarification does not blindly execute until the missing entity is resolved.

### Confirmation Workflow

Confirmation is used when the assistant knows the action but policy says the action should not execute immediately.

Common confirmation cases:

- closing apps from protected sources;
- destructive file/folder actions;
- system power actions;
- security-sensitive pairing/device removal;
- actions controlled by permission policy or OpenX lock.

Flow:

```text
User:
close chrome

Router:
intent = app.close
entities = { appName: "chrome" }
permission policy says confirmation required

Assistant:
stores pendingConfirmation
asks user to confirm

User:
yes

Assistant:
router.confirmAndExecute(commandId, intent, entities)
AutomationEngine.execute("app.close", entities)
verify result
respond
```

Confirmation phrases support natural variants:

- `yes`
- `yeah`
- `yep`
- `proceed`
- `confirm`
- `do it`
- `cancel`
- `no`
- `stop`
- `don't`

### Permission And External Guard Workflow

There are two major permission gates:

1. Router permission validator.
2. External permission guard passed through source-specific context.

The external guard is important for phone/cloud commands. A desktop user can allow or block remote command classes without changing local chat behavior.

Possible outcomes:

| Outcome | Meaning |
|---|---|
| allowed | Continue to execution. |
| denied | Return permission denied response. |
| requires confirmation | Store pending confirmation. |
| requires auth/security lock | Prompt through security lock flow. |

### Automation Engine Execution Workflow

Main file: `core/automation/index.js`

The automation engine owns controllers and the `actionId -> controller method` map.

Execution flow:

```text
AutomationEngine.execute(actionId, entities, context)
  -> find action handler in _actionMap
  -> throw if cancellation signal is aborted
  -> call controller method
  -> normalize result
  -> run ActionVerifier.verify(actionId, entities, result)
  -> return success/error/data/validation/verification
```

Controller instances:

| Controller | File | Example actions |
|---|---|---|
| Volume | `core/automation/volume.js` | `volume.set`, `volume.up`, `volume.down`, `volume.mute`, `volume.unmute` |
| Brightness | `core/automation/brightness.js` | `brightness.set`, `brightness.up`, `brightness.down` |
| Apps | `core/automation/apps.js` | `app.open`, `app.close`, `app.switch`, `app.newTab` |
| Browser | `core/automation/browser.js` | `browser.open`, `browser.search`, `browser.siteSearch`, tabs |
| Files | `core/automation/files.js` | `file.open`, `file.search`, `file.move`, `file.copy`, `file.delete` |
| Folders | `core/automation/folders.js` | `folder.open`, `folder.search`, `folder.create`, `folder.delete` |
| Media | `core/automation/media.js` | `media.play`, pause, resume, next, previous, fullscreen |
| Scheduler | `core/automation/scheduler.js` | timers, reminders, alarms, snooze, clear |
| Planner | `core/automation/planner.js` | calendar/timetable add/open |
| System | `core/automation/system.js` | system info, status, diagnostics |
| Windows | `core/automation/windows.js` | close/minimize/maximize/lock/sleep/shutdown/restart |
| Screenshot | `core/automation/screenshot-recording.js` | screenshot and recording commands |
| Communications | `core/automation/communications.js` | message/email/call composition |
| Forms | `plugins/forms` | form filling/validation support |

### Automation Dispatcher Workflow

Pipeline automation can also use `core/assistant/automation/AutomationDispatcher.js`.

Dispatcher workflow:

```text
ExecutionBlueprint + DecisionResult + ValidationResult
  -> if decision is not EXECUTE: skip tasks
  -> if validation failed: skip tasks
  -> if automation disabled: mark NOT_DISPATCHED
  -> for each ordered task:
       resolve automation route
       call automationEngine.execute(route, entities)
       record completed or failed action
       capture diagnostics timing
  -> return AutomationResult
```

This supports future graph-based execution, ordered workflows, and partial failure diagnostics.

### Validation Deep Dive

Validation managers:

- `core/assistant/validation/ValidationManager.js`
- `core/assistant/validation/ValidationPipeline.js`
- `core/automation/common/action-velidation.js`
- `core/automation/common/action-verification.js`

Default validation stages:

| Stage | Purpose |
|---|---|
| `validation.permission` | Checks permission policy and confirmation/auth requirements. |
| `validation.safety` | Blocks unsafe or disallowed operations. |
| `validation.entity` | Ensures required entities are available. |
| `validation.context` | Ensures required context exists. |
| `validation.confirmation` | Applies confirmation requirements. |
| `validation.automation` | Ensures automation tasks can dispatch. |
| `validation.constraint` | Checks configured operational constraints. |

Action-level validation checks required fields for concrete actions.

Examples:

| Action | Required fields |
|---|---|
| `app.open` | `appName` |
| `app.close` | `appName` |
| `file.rename` | `oldName`, `newName` |
| `file.move` | `source`, `destination` |
| `browser.search` | `query` |
| `media.play` | `mediaQuery` |
| `message.compose` | `contactName`, `messageText` |
| `timer.set` | `duration` |
| `alarm.set` | `timeExpression` |
| `reminder.set` | `reminderText` |

If a required field is missing, the router should ask for clarification instead of executing.

### Verification Deep Dive

Verification managers:

- `core/assistant/verification/VerificationManager.js`
- `core/assistant/verification/VerificationPipeline.js`
- `core/automation/common/action-verification.js`

Default verification stages:

| Stage | Purpose |
|---|---|
| `verification.execution` | Verifies execution result shape and success/failure state. |
| `verification.application` | Verifies app/window outcomes. |
| `verification.browser` | Verifies browser URL/search/tab outcomes. |
| `verification.window` | Verifies window-target outcomes. |
| `verification.reminder` | Verifies reminder/schedule outcomes. |
| `verification.transfer` | Verifies transfer outcomes. |
| `verification.cloud` | Verifies cloud operation outcomes. |
| `verification.graphBuilder` | Builds verification graph/diagnostics. |

Action-level verification examples:

| Action group | Verification |
|---|---|
| App open | Existing window focused, new window opened, visible process found, folder/web fallback target valid. |
| App close | Matching visible app/window/process no longer appears open. |
| File create/copy/rename | Expected target file exists. |
| File move | Destination exists and source is gone. |
| File delete | Source no longer exists. |
| Folder create/open/move/delete | Expected directory state. |
| Browser search/open | Valid URL or returned search result array. |
| Volume/brightness | Numeric value returned if readable. |
| Timer/alarm/reminder | Future `dueAt` exists. |
| Message/email/call | Draft/target/contact data exists. |

Verification can be blocking or non-blocking:

- Blocking failure changes `success` to false.
- Non-blocking unknown status keeps command result but records verification uncertainty.

### App Open Workflow

Typical `app.open` flow:

```text
User:
open chrome

Router:
intent app.open
entities.appName = chrome

Automation:
apps.open("chrome")

Controller strategy:
1. Resolve app alias/process/executable candidates.
2. If already running and no new window requested, focus existing window.
3. If not running, launch executable/start menu/protocol/app path.
4. If app is better as a web target, fallback to browser web app where configured.
5. If app name matches a folder, open folder fallback.

Verification:
- matched window found; or
- process/window appears; or
- fallback folder/url target is valid.

Response:
Opened Chrome.
```

### App Close Workflow

Typical `app.close` flow:

```text
User:
close instagram and chrome

Router:
multi-command with two app.close steps

Automation:
apps.close("instagram")
apps.close("chrome")

Controller strategy:
1. Resolve matching window/process candidates.
2. Try graceful close for visible windows.
3. Try process-level fallback when safe.
4. Wait for app/window disappearance.

Verification:
waitForAppClosed(appName)

Response:
Done, sir. I closed Chrome, but I could not close Instagram because Instagram still appears to be open.
```

Apps with tray/background processes may fail verification even if a visible window closes. The assistant reports that carefully instead of claiming success.

### File And Folder Workflow

Typical file command flow:

```text
User:
find my resume

Router:
intent file.search or file.smartFind
entities.query = resume

Automation:
files.search/smartFind

If multiple results:
needsClarification = true
choices returned to UI

User:
2

Assistant:
resolves selected file
executes open/send/move/copy depending on original command
```

File/folder safety:

- paths are normalized;
- dangerous path traversal is guarded by path utilities;
- delete/move operations can require confirmation;
- verification checks final filesystem state where possible;
- phone transfer uses recent file context for follow-ups like `send it to my phone`.

### Browser And Web Search Workflow

Browser command flow:

```text
User:
search for kotlin mobile

Router:
intent browser.search
entities.query = kotlin mobile

Automation:
browser.search(query)

Result:
search results and/or browser action response

Dynamic island:
can show result entries depending on source/state
```

Browser routing supports:

- direct URL open;
- search query;
- site search;
- open first result;
- open/list/close tab flows;
- trusted web targets for known services.

### Media Workflow

Media command flow:

```text
User:
play Stars and Stripes Forever song

Router:
intent media.play
entities.mediaQuery = stars and stripes forever
entities.mediaPlatform = youtube

Automation:
media.play(query, platform)

Response:
Started "stars and stripes forever" on YouTube.
```

Important media behavior:

- preserve full song/title phrase;
- avoid splitting title words as separate commands;
- infer YouTube as the default playback platform when the user asks to play a song without naming another supported service;
- respect explicit platform phrases such as `in youtube` or `on youtube`;
- preserve short title words and prepositions inside media names, including phrases such as `child in us`, instead of treating `us` as Apple Music;
- resolve YouTube playback to a watch target when a video result can be identified;
- avoid claiming verified playback when only a search-results fallback was opened;
- support pause/resume/stop/next/previous and media volume controls.

### Schedule Workflow

Schedule command flow:

```text
User:
remind me every saturday and monday to eat lunch at 8 pm

Router:
intent reminder.set
entities:
  reminderText = eat lunch
  timeExpression = 8 pm
  recurrence = weekly selected days

Automation:
scheduler.setReminder()

Verification:
future dueAt / schedule record exists

Response:
I added a reminder to eat lunch at 8 pm.
```

Schedule commands support:

- timers;
- reminders;
- alarms;
- natural event reminders such as `i have a meeting at 6pm tomorrow remind me`;
- recurrence;
- snooze;
- stop/cancel;
- list/clear;
- local planner/calendar integration;
- mobile sync through cloud command paths.

Recent reminder stabilization:

- trailing `remind me` requests now route to `reminder.set` when a time expression is present;
- event nouns such as `meeting`, `class`, `appointment`, and similar phrases become reminder text instead of personal facts;
- the learning layer does not store scheduled reminders as unsupported personal memories;
- calendar-reading fallback is limited to actual read/list/show calendar requests;
- reminder responses use natural wording such as `about your meeting` for event reminders.

Incomplete schedule handling:

```text
User:
remind me tomorrow

Assistant:
What should I remind you about?

User:
call mummy

Assistant:
remind me tomorrow to call mummy
```

### Phone And Cloud Command Workflow

Phone/cloud command flow:

```text
Mobile app
  -> relay/local command packet
  -> desktop cloud/phone command manager
  -> Assistant.processCommand(command, source='phone' or source='cloud')
  -> permission guard
  -> router
  -> automation
  -> serialized response
  -> mobile app / relay response
```

Phone/cloud specifics:

- phone commands carry device/session context;
- permission guard can block or require confirmation;
- file transfer can use cloud transfer manager;
- mobile schedule sync uses cloud command manager;
- phone notifications are not treated as user chat commands;
- encrypted relay packets can wrap sensitive payloads.

### Cancellation, Deadlines, And Timeouts

OpenX uses cancellation and timeouts to prevent hung operations.

Key parts:

- `core/assistant/utils/Cancellation.js`
- `Assistant._runWithCommandTimeout()`
- `core/communication/OperationScheduler.js`
- `core/cloud/CloudRequestQueue.js`
- route-specific timeouts in automation controllers

Flow:

```text
Assistant starts command
  -> creates AbortController
  -> attaches deadline metadata
  -> passes signal into router and automation
  -> timeout aborts command
  -> cancellation-aware controllers stop work
  -> assistant returns timeout-safe response
```

This protects the assistant from stuck browser/app/file/communication operations.

### Response And Result Contract

Most command results follow this shape:

```js
{
  commandId,
  success,
  intent,
  confidence,
  entities,
  data,
  response,
  validation,
  verification,
  requiresConfirmation,
  needsClarification,
  choices,
  error
}
```

The UI and mobile/cloud layers should rely on this contract rather than parsing arbitrary response text.

### Diagnostics And Observability

The system records diagnostics through:

- command IDs;
- structured logger entries;
- validation status;
- verification status;
- launch method;
- matched window;
- routing evidence;
- learning feedback prompts;
- voice diagnostics;
- cloud request IDs;
- transfer IDs;
- operation deadlines.

For production debugging, the most useful fields are:

- `commandId`
- `intent`
- `entities`
- `source`
- `validation.status`
- `verification.status`
- `data.launchMethod`
- `data.matchedWindow`
- `error`
- `executionContext.operationId`

## 2026-07-18 Scan Refresh, Face Search, And Chat Update

This refresh scanned the current OpenX workspace, reviewed the Visual Memory, AI Vision, and OpenX Chat desktop paths, and updated the report to reflect the latest face-search and Chat Server integration behavior.

### Current Scan Summary

Filtered scan exclusions:

- `node_modules/`
- `.git/`
- `dist/`
- `graphify-out/`
- `.codex/`
- `.code-review-graph/`
- `.agents/`
- `coverage/`
- `.next/`
- `.expo/`
- `.gradle/`
- generated mobile-native build folders when present

Current file distribution:

| Area | Files |
|---|---:|
| `core` | `797` |
| `apps` | `114` |
| `tests` | `101` |
| `docs` | `11` |
| `plugins` | `11` |
| top-level `models` | `4` |
| `build` | `5` |
| `scripts` | `1` |
| root config/docs/package files | `10` |
| total filtered scan | `1054` |

Current extension distribution:

| Extension | Files |
|---|---:|
| `.js` | `997` |
| `.md` | `17` |
| `.json` | `9` |
| `.onnx` | `8` |
| `.html` | `5` |
| `.css` | `4` |
| `.data` | `2` |
| `.ini` | `2` |
| `.yml` | `2` |
| `.ps1` | `1` |
| `.txt` | `1` |
| `.mjs` | `1` |
| `.gitignore` | `1` |
| `.ico` | `1` |
| `.exe` | `1` |
| `.nsh` | `1` |
| `.png` | `1` |

### Face Search Problem Addressed

The main issue was not that photo search failed to return results. The weaker behavior was that person-focused searches could still be ranked by generic metadata, folder text, or loose family terms after Visual Memory found a candidate pool.

Example weak behavior:

```text
find photos of mummy and daddy
  -> broad Visual Memory search
  -> generic Family / Photo Memory results
  -> partial or unrelated photo matches can appear
```

The updated behavior treats saved Face Memory evidence as the strongest source for person search:

```text
find photos of mummy and daddy
  -> visual query extracts relationships: mother + father
  -> VisualMemoryAPI resolves those relationships against saved Face Memory identities
  -> candidate photos receive faceMemorySearch coverage
  -> MemoryRankingEngine requires full saved-face coverage when the requested identities are known
  -> generic family-folder photos and one-parent-only photos are removed from strict results
```

### Updated Face Search Flow

Current person-search flow:

```text
User query
  -> ActionRouter routes local personal photo search to visualMemory.search
  -> VisualQueryEngine extracts people, relationships, owner, time, scene, and query text constraints
  -> CandidateFilterEngine builds deterministic local candidates from indexed Gallery photos
  -> VisualMemoryAPI attaches saved Face Memory evidence by photo id
  -> VisualMemoryAPI builds faceSearchContext from saved identities and relationships
  -> MemorySearchContext carries faceSearchContext into intelligence ranking
  -> MemoryRankingEngine computes faceSearchScore and faceSearchCoverage
  -> strict known-identity searches reject incomplete face evidence
  -> chat receives the best capped visual results
```

### Files Updated In This Pass

| File | Update |
|---|---|
| `core/assistant/capabilities/visual-memory/runtime/api/VisualMemoryAPI.js` | Builds `faceSearchContext`, resolves requested people/relationships against saved Face Memory identities, attaches `candidate.faceMemorySearch`, and passes face-search context into memory intelligence. |
| `core/assistant/capabilities/visual-memory/runtime/intelligence/context/MemorySearchContext.js` | Stores and exposes `faceSearchContext` to ranking and search components. |
| `core/assistant/capabilities/visual-memory/runtime/intelligence/ranking/MemoryRankingEngine.js` | Adds strict face-search scoring, coverage tracking, and rejection of incomplete known-person matches. |
| `core/assistant/capabilities/visual-memory/runtime/intelligence/utils/intelligence-utils.js` | Exposes `candidate.faceMemorySearch` through candidate evidence. |
| `core/assistant/entities/PersonLexicon.js` | Adds grouped relationship matching for `parents`, `family`, `friends`, `children`, and related aliases. |
| `tests/core/visual-memory-intelligence.test.js` | Adds regression coverage for full saved-face coverage in `me and dad` and `mummy and daddy` searches. |

### Face Search Accuracy Rules

The latest behavior separates three kinds of evidence:

| Evidence | Strength | Use |
|---|---|---|
| Saved Face Memory identity on the candidate photo | Strong | Used for strict person and relationship searches. |
| Saved relationship on a named identity, such as `father` or `mother` | Strong | Used to satisfy relationship aliases like `dad`, `daddy`, `mummy`, and `parents`. |
| Folder, filename, semantic tag, visual concept, or generic text | Weak | Still useful for scene/object/date searches, but not enough to satisfy known-person searches. |

Strict face search is enabled when the requested person or relationship can be resolved to saved Face Memory identities. In that case:

- `me and dad` must match both the saved user identity and a saved father/dad identity.
- `mummy and daddy` must match both saved mother and father evidence.
- `parents` can match father and mother relationship identities through grouped relationship matching.
- `family` can match saved family relationships, but generic `family` file/folder text does not outrank actual face evidence.
- partial matches, such as only `mummy` or only `daddy`, are rejected for strict multi-person requests.
- if no saved identity exists for the requested person or relationship, OpenX can still use weaker metadata and visual evidence instead of returning nothing immediately.

### Reference Basis

The design follows common production face-search practice:

- FaceNet-style embedding search maps faces into a vector space where identity similarity can be compared for recognition and clustering.
- ArcFace-style normalized discriminative embeddings motivate using identity separation and stricter thresholds instead of loose text matches.
- RetinaFace-style localization motivates separating face detection/localization from recognition and ranking.

The current OpenX implementation keeps those ideas inside the existing local-first architecture:

- face detection and embeddings stay local;
- user naming remains explicit;
- relationships are user-controlled metadata;
- search ranking uses saved face evidence without auto-naming unknown people;
- generic photo metadata remains useful for object, scene, date, folder, screenshot, and document searches.

### Expected Search Behavior After This Update

| Query | Expected behavior |
|---|---|
| `find photos of mummy and daddy` | Return photos with both saved mother and father face evidence when those identities exist. |
| `find latest photo of me and daddy` | Prefer recent photos containing both the saved user identity and saved father/dad identity. |
| `find photo of jithu` | Prefer photos where saved Face Memory has `jithu` evidence. |
| `find my parents photos` | Use grouped parent relationship matching. |
| `find family trip photos` | If it is not asking for a specific saved person, scene/folder/event evidence can still rank results. |
| `find hills or mountain photos` | Use visual concept and natural-location constraints, not face evidence. |

### Developer Notes

- The face-search ranking update does not replace the face detector or the embedding runtime.
- The strict search gate only applies when a requested person/relationship is resolvable through saved Face Memory.
- Existing `FaceMemoryEngine` auto-assignment safety remains unchanged: weak, low-quality, or ambiguous face matches are still deferred for review.
- Current model assets now include SCRFD, MobileFaceNet, MobileCLIP, and PaddleOCR paths under Visual Memory runtime models. These are documented in the refreshed directory tree below.
- A future production upgrade should continue toward a real local ONNX face embedding adapter while preserving the same `FaceMemory` and `faceSearchContext` contracts.

## 2026-07-18 OpenX Chat Integration Update

This update connected the desktop Chat app to the standalone OpenX Chat Server instead of leaving add-user and messaging behavior as local-only UI scaffolding.

### Problem Addressed

Before this pass, the desktop Chat app could show a WhatsApp-style chat layout and local conversation cards, but the real user flow was incomplete:

- adding a person could create a local record without discovering a real server account;
- the UI did not expose incoming/outgoing contact request controls in the setup popup;
- an already registered email address could be treated as a duplicate registration instead of an OTP login/device setup flow;
- sending a message from a server-backed contact did not route through `/messages/send`;
- trusted server relationships were not reconciled back into local desktop conversations;
- contact request IPC channels were not exposed through the preload bridge.

### Desktop Changes Implemented

| Area | Change |
|---|---|
| Registration | `startDesktopChatRegistration()` now checks `/account/check`; registered emails use `/account/login/start`; new emails use `/register/start`; both paths request server-side email OTP delivery only. |
| Verification | `verifyDesktopChatRegistration()` accepts the user-entered email OTP, uses `/account/login/verify` for existing accounts, and falls back to that path if registration verify reports `account.duplicate`. |
| Device setup | successful verification calls `/device/register` and stores the resulting desktop device state locally. |
| Add user | `createDesktopChatConversation()` now requires registration, calls `/discovery/lookup`, then calls `/contact/request`. |
| Duplicate requests | duplicate pending requests are converted into the existing local pending conversation instead of creating unrelated duplicates. |
| Already trusted users | `request.already_trusted` server responses create/update a trusted local conversation using the returned relationship metadata. |
| Request list | `listDesktopChatContacts()` loads pending incoming requests, outgoing requests, and trusted relationships. |
| Request actions | `acceptDesktopChatContactRequest()`, `deleteDesktopChatContactRequest()`, and `cancelDesktopChatContactRequest()` call the matching server endpoints and refresh local state. |
| Message send | trusted conversations send an opaque encrypted payload to `/messages/send`; pending requests are blocked from sending. |
| Renderer | Chat settings popup shows request lists and action buttons. |
| IPC security | new request channels are validated before reaching main-process handlers. |

Production OTP behavior:

- the desktop sends only server URL and email address when starting setup;
- the Chat Server generates, hashes, stores, expires, sends, and verifies the OTP;
- the Chat Server sends the OTP through the configured Gmail SMTP provider;
- the desktop never receives, parses, auto-fills, displays, logs, or stores the generated OTP;
- successful start responses are generic and contain no verification material:

```json
{
  "success": true,
  "message": "Verification email sent successfully."
}
```

### Server Flow Used By Desktop

```text
Registration/setup:
  /account/check
  /register/start or /account/login/start
  /register/verify or /account/login/verify
  /device/register
  /security/pin/create when optional PIN is provided

Adding a person:
  /discovery/lookup
  /contact/request

Refreshing contacts:
  /contact/request/pending
  /contact/request/outgoing
  /contact/relationships

Request actions:
  /contact/request/accept
  /contact/request/delete
  /contact/request/cancel

Trusted messaging:
  /messages/send
```

### Desktop Chat Runtime State Machine

The reconciliation pass replaced the important setup decision point with one authoritative state-machine contract:

```text
UNINITIALIZED
  -> SERVER_CONNECTED
  -> ACCOUNT_VERIFIED
  -> DEVICE_REGISTERED
  -> DEVICE_APPROVAL_REQUIRED
  -> DEVICE_APPROVED
  -> IDENTITY_READY
  -> SESSION_READY
  -> CHAT_READY
```

Operational rules:

- `DEVICE_APPROVAL_REQUIRED` is a blocking state, not a soft warning.
- `registered=true` only means the email/account flow completed; it does not imply chat is usable.
- `CHAT_READY` requires a verified account, registered device, server-approved device state, locally available private keys, registered public identity/device keys, and a local session-ready marker.
- Renderer request lists, add-user flow, contact actions, and trusted message send are gated by `chatReady`.
- Registration status refresh reconciles `/device/status/{DeviceID}` so a newly approved device can move to `CHAT_READY` without another OTP flow.
- Private keys stay in the desktop main process and are stored through Electron `safeStorage`; the server receives only public key material.

### Updated Files

| File | Update |
|---|---|
| `apps/desktop/electron/main.js` | Chat Server request helper, email OTP login support, registration/device state, exact-email discovery/contact request flow, relationship refresh, request actions, trusted message send, IPC handlers. |
| `apps/desktop/electron/security.js` | Validates email registration payloads, chat create/update/send payloads, and request action payloads. |
| `apps/desktop/preload.js` | Exposes contact list, accept, delete, cancel, registration, and conversation APIs to the renderer. |
| `apps/desktop/renderer/chat/index.html` | Uses email fields for chat setup and add-user, and keeps request list panels inside Chat settings. |
| `apps/desktop/renderer/chat/index.js` | Adds email setup normalization, request rendering, refresh/accept/delete/cancel handlers, server-backed add-user behavior, pending-send blocking, and setup refresh. |
| `apps/desktop/renderer/chat/index.css` | Adds request card styling, setup popup refinements, email input styling, and responsive containment for chat UI performance. |
| `core/chat/state/ChatRuntimeStateMachine.js` | Defines the authoritative Desktop Chat setup state machine from server connection through `CHAT_READY`. |
| `core/chat/ChatStatusManager.js` | Publishes runtime state-machine snapshots instead of unmanaged string status flags. |
| `core/chat/ChatLifecycleManager.js` | Uses runtime state names for lifecycle start and stop transitions. |
| `core/chat/crypto/SecureStorageManager.js` | Delegates stored-key listing to the active OS secure-storage backend. |
| `core/chat/index.js` | Exposes the Desktop Chat state module for shared use and tests. |
| `tests/core/chat-runtime-state.test.js` | Covers runtime-state derivation, device approval gating, and `ChatStatusManager` snapshots. |
| `tests/ui/chat-renderer.test.js` | Adds renderer contract coverage for the Chat app, email setup popup, request controls, and styling hooks. |
| `tests/core/electron-security.test.js` | Adds IPC validation coverage for email registration, contact request actions, and channel registration. |

### Current Behavior Confirmed

| User action | Current result |
|---|---|
| register a new email | desktop starts `/register/start`, server sends email OTP, user enters the email code, desktop verifies through `/register/verify`, then registers the desktop device. |
| use an already registered email | desktop starts `/account/login/start`, server sends email OTP, user enters the email code, desktop verifies through `/account/login/verify`, registers/reuses the desktop device, then waits for approval when the server marks it pending. |
| approved desktop device | desktop generates or reuses local identity/device keys, stores private keys with Electron `safeStorage`, and registers only public keys with Chat Server. |
| pending desktop device | Chat settings shows approval required and contact/message actions are blocked until another trusted device approves it. |
| add a real user by email | desktop performs exact discovery and sends a contact request only after the runtime state reaches `CHAT_READY`. |
| open Chat settings | shows setup state plus incoming/outgoing contact requests when `CHAT_READY`; pending devices show approval guidance instead. |
| accept request | server creates trusted relationship and desktop creates/updates a local conversation. |
| cancel outgoing request | server cancels the request and desktop refreshes request lists. |
| send before accepted | desktop blocks sending and tells the user the request is pending. |
| send after accepted | desktop posts opaque encrypted payload to Chat Server and updates local UI history. |

### Security And Privacy Notes

- Desktop discovery uses the Chat Server's exact-email lookup and opaque token model.
- The renderer never calls network APIs directly for registration, requests, or messaging; it goes through validated IPC.
- The renderer and desktop main process never receive the generated OTP. They only submit the user-entered email OTP for verification.
- The server-backed send path does not send plaintext message text to the Chat Server.
- Local UI history remains local desktop data so the current user sees immediate message previews.
- Full cross-device readable sync requires the existing Phase 4 session-key and Phase 8 message pipeline to be connected to the Chat UI receive path.

## 2026-07-19 Trusted-Device History Synchronization Update

This update adds the desktop-side foundation for moving local Chat history between trusted devices without letting OpenX Chat Server store readable history.

### Desktop Components Added

| File | Responsibility |
|---|---|
| `core/chat/history/HistorySynchronizationConfiguration.js` | Resolves API URL, request timeout, chunk size, and `OpenX_Data\chat-history-sync.json`. |
| `core/chat/history/HistorySynchronizationClient.js` | Calls `/history-sync/*` server coordination APIs. |
| `core/chat/history/HistorySynchronizationStorage.js` | Stores local sync request, transfer, availability, and audit metadata under `OpenX_Data`. |
| `core/chat/history/HistoryTransferEngine.js` | Tracks encrypted chunk progress and rejects plaintext message fields. |
| `core/chat/history/HistorySynchronizationManager.js` | Orchestrates availability, request, negotiation, completion, and cancellation from the desktop side. |
| `core/chat/history/index.js` | Exposes the history sync module from `core/chat`. |

### Local Data Rules

- Local readable chat data remains in desktop-local Chat stores.
- New sync coordination state is stored at `OpenX_Data\chat-history-sync.json`.
- Received files remain outside `OpenX_Data` in `Documents\OpenX`, preserving the existing exception.
- The transfer engine accepts encrypted chunk metadata only; it rejects `text`, `message`, and `plaintext` fields.
- `ChatManager.getHistorySynchronizationManager()` exposes the new manager for future UI and assistant integration.

### Server Offline Startup Behavior

Passive Chat setup refreshes now use a quiet offline mode:

```text
OpenX starts
  -> renderer asks for Chat registration status
  -> desktop tries /device/status/{DeviceID}
  -> if Chat Server is offline:
       log informational "server offline; refresh skipped"
       keep local setup state
       do not mark identity setup as failed
```

User-triggered actions still fail explicitly when the Chat Server is required. This avoids confusing startup warnings such as `Desktop chat identity setup is not ready` when the real issue is simply that `OpenX_Chat_Server` is not running.

## 2026-07-18 OpenX Chat Architecture Reconciliation Report

This reconciliation reviewed Desktop, IPC, local storage, Chat Server REST endpoints, device lifecycle, public-key registry, contact requests, relationships, messaging, synchronization boundaries, and recovery paths.

### Issues Discovered And Root Causes

| Issue | Root cause | Resolution |
|---|---|---|
| OTP verification could be treated as complete chat readiness. | Desktop used `registered` as the main UI/action gate even though Chat Server can return additional devices as `Pending`. | Added `ChatRuntimeStateMachine` and made server-backed actions require `chatReady`. |
| A fresh desktop for an existing account could proceed before device approval. | The desktop did not reconcile `deviceStatus` and `approvalStatus` after `/device/register`. | Device status is refreshed through `/device/status/{DeviceID}` and pending devices show approval guidance. |
| Public identity/device keys were implemented but not part of desktop setup readiness. | Server Phase 4 public-key registries existed, while desktop setup stopped at account/device registration. | Approved desktops now generate/reuse local identity and device keys, store private keys locally, and upload public keys only. |
| Secure local key storage could silently rely on non-durable fallback key material. | Generic crypto storage used an in-memory key when no durable backend or explicit secret was configured. | Electron main now injects a `safeStorage` backend for desktop chat keys. |
| Add-user could degrade into local-only chat behavior. | Renderer had local fallback behavior from the early UI scaffold. | Add-user submit now blocks until `chatReady` and directs the user to Chat settings. |
| Request lists could load against an incomplete setup. | Renderer checked `registered`, not the full lifecycle state. | Request lists and refresh handlers now require `chatReady`. |

### Unified Architecture

```text
Renderer Chat app
  -> validated preload IPC
  -> Electron main Chat orchestrator
  -> OpenX_Data local state
  -> Electron safeStorage private-key envelopes
  -> OpenX Chat Server REST APIs
  -> Chat Server JSON store / public registries / mailbox / sync metadata
```

Ownership after reconciliation:

- Desktop renderer owns UI state, focus, forms, and display.
- Desktop main owns orchestration, IPC validation boundary, local conversation storage, setup state, server calls, and client-side cryptographic key custody.
- Chat Server owns account verification, device trust, public-key registry, contact discovery, request validation, relationship creation, routing, mailbox, sync, and server-side audit metadata.
- The server still never owns private keys or plaintext chat content.

### Workflow Diagrams

New account:

```text
Email form
  -> /account/check registered=false
  -> /register/start
  -> Chat Server sends email OTP through Gmail SMTP
  -> user enters email OTP
  -> /register/verify
  -> /device/register
  -> if Approved: local keys + public-key registration
  -> CHAT_READY
```

Existing account on a new desktop:

```text
Email form
  -> /account/check registered=true
  -> /account/login/start
  -> Chat Server sends email OTP through Gmail SMTP
  -> user enters email OTP
  -> /account/login/verify
  -> /device/register
  -> DEVICE_APPROVAL_REQUIRED when server marks device Pending
  -> /device/status/{DeviceID} refresh after approval
  -> local keys + public-key registration
  -> CHAT_READY
```

Add user and request:

```text
CHAT_READY
  -> /discovery/lookup
  -> opaque contact token
  -> /contact/request
  -> pending local conversation
  -> recipient /contact/request/accept
  -> trusted relationship
  -> local conversation linked to relationship
```

Trusted send:

```text
CHAT_READY
  -> trusted local conversation
  -> opaque encrypted payload
  -> /messages/send
  -> server relationship/device validation
  -> live route or mailbox fallback
  -> local UI history updated
```

### Lifecycle Definitions

| Lifecycle | Start | Progress | Completion | Failure/recovery |
|---|---|---|---|---|
| Account | email submitted | email OTP pending | `ACCOUNT_VERIFIED` | restart OTP flow or login path when duplicate account exists |
| Device | `/device/register` | pending/approved | `DEVICE_APPROVED` | settings shows approval required; status refresh recovers after approval |
| Identity | approved device | local key generation/read | public keys registered | secure-storage or registry errors keep setup below `CHAT_READY` |
| Chat setup | server URL | account/device/identity/session gates | `CHAT_READY` | blocking reason is surfaced in setup popup |
| Relationship | contact token | request pending | trusted relationship | duplicate/already-trusted cases reconcile local conversation |
| Message | local send | server route/mailbox | local UI update | pending requests and incomplete metadata are blocked before send |

### API Changes Consumed By Desktop

- Existing account login uses `POST /account/login/start` and `POST /account/login/verify`.
- Device recovery/approval status uses `GET /device/status/{DeviceID}`.
- Client public keys use `POST /crypto/identity/public-key`, `GET /crypto/identity/{AccountID}/public-key`, `POST /crypto/device/public-key`, and `GET /crypto/device/{DeviceID}/public-key`.
- Trusted relationship refresh uses `GET /contact/relationships?accountId={AccountID}`.
- Contact requests use `/discovery/lookup`, `/contact/request`, `/contact/request/pending`, `/contact/request/outgoing`, `/contact/request/accept`, `/contact/request/delete`, and `/contact/request/cancel`.
- Trusted send uses `POST /messages/send`.

### Database And Local Storage Changes

- Desktop setup state in `OpenX_Data/chat-account.json` now includes derived runtime state inputs, last server contact, device approval status, and bounded crypto readiness metadata.
- Desktop device registration state remains in `OpenX_Data/chat-device.json`.
- Desktop private key envelopes are stored in `OpenX_Data/chat-crypto-secrets.json` using Electron `safeStorage`.
- Desktop local conversations remain in `OpenX_Data/chat-conversations.json`.
- Desktop chat messages are stored in `OpenX_Data/chat-messages.json`.
- Desktop mailbox sequence state is stored in `OpenX_Data/chat-mailbox-sequences.json`.
- Desktop synchronization cursors are stored in `OpenX_Data/chat-sync-cursors.json`.
- Desktop multi-device state is stored in `OpenX_Data/chat-multi-device.json`.
- Desktop file-transfer metadata is stored in `OpenX_Data/chat-file-transfers.json`.
- Desktop request nicknames are stored in `OpenX_Data/chat-request-nicknames.json`.
- Received cloud/mobile files intentionally remain outside `OpenX_Data` at `Documents\OpenX`.
- No server database shape change was required in this pass; the desktop now consumes existing public-key, device, relationship, and mailbox models more correctly.

### Security Improvements

- Pending or unapproved devices cannot add contacts, accept/delete/cancel contact requests, or send trusted messages from the desktop UI.
- Generated OTP values are never returned to desktop, renderer, preload, IPC, logs, or local setup state.
- Private identity and device keys never leave the desktop main process.
- Public-key registration happens only after the server-approved device gate.
- Renderer remains behind validated IPC and does not call REST endpoints directly.
- Secure-storage failures become explicit setup blockers instead of silent “ready” states.

### Performance Improvements

- Registration status reconciliation is lazy and only runs when Chat settings or server-backed actions need readiness.
- Public-key registration is idempotent: existing matching public keys are read before re-registering.
- Request lists are not polled or loaded while setup is blocked.
- The renderer does not create unnecessary local fallback conversations when real server chat cannot proceed.

### Remaining Risks

- True peer-to-peer/session-key decrypt-and-display for incoming mailbox envelopes is still not wired into the renderer-facing Chat app.
- The current trusted-send path sends an opaque encrypted payload and updates local UI history, but complete cross-device readable sync requires the existing `core/chat/messages`, `core/chat/mailbox`, and `core/chat/synchronization` managers to be used by the UI receive path.
- Production Chat setup requires configured Gmail SMTP credentials and HTTPS-only server URLs outside localhost development.
- The JSON store remains a development/runtime store and needs production persistence policy before public rollout.

### Production Readiness Checklist

| Gate | Status |
|---|---|
| Account registration and existing-account OTP login | Implemented and tested through focused desktop/server paths. |
| Device registration and approval blocking | Implemented on server; desktop now honors pending approval. |
| Client private-key custody | Implemented with Electron `safeStorage` backend for desktop chat setup. |
| Public identity/device key registration | Implemented for approved desktops. |
| Contact discovery and request flow | Implemented through opaque token and request APIs. |
| Relationship refresh | Implemented with `/contact/relationships`. |
| Server-side messaging validation | Implemented by Chat Server; desktop consumes `/messages/send`. |
| Incoming decrypt/sync display | Remaining integration risk. |
| Full end-to-end desktop + server fixture | Recommended before release. |

## Blockers And Risks

1. Full assistant suite drift

   Some assistant tests still expect old raw routed text while the current assistant normalizes route input. This is a test-contract cleanup issue unless a specific behavior regression is observed.

2. Desktop app close verification

   The assistant can now report partial close failures cleanly, but actual Windows app closure still depends on process/window matching in automation. Apps with multiple processes or background tray behavior may still appear open after a close request.

3. Cloud E2EE coverage

   E2EE primitives and packet wrapping exist, but every command, notification, schedule sync, and file-transfer path should continue to be audited for plaintext fallback.

4. Runtime performance validation

   Startup and gallery-specific resource blockers were reduced by lazy-loading Visual Memory, making voice runtime prewarm opt-in, moving gallery indexing to the background, and using `file:` image URLs instead of base64 image IPC. A full instrumented desktop profiling session is still recommended with voice, dynamic island, cloud connection, notifications, gallery scrolling, and file transfers active.

5. Face recognition depth

   OpenX now has a local Windows face-detection runtime and close-up People cards. The current face-region vector is a lightweight local grouping signal, not a deep face recognition model. For higher accuracy on large mixed photo libraries, integrate a real local ONNX face embedding model behind `WindowsFaceRuntimeAdapter` or a separate runtime adapter while keeping the same Face Memory contract.

6. Visual Memory data cleanup

   Rescans clear unnamed auto-scan clusters and preserve named people, but existing user data may still contain stale clusters from older builds until the user runs Scan People again.

7. Dirty working tree

   Many assistant files are modified. Before release, run a clean full validation pass and review all changed files as one integration set.

8. Desktop Chat receive/decrypt integration

   Desktop Chat now performs real registration, contact requests, trusted relationship refresh, and server-backed encrypted send. The remaining production gap is wiring the existing `core/chat/messages`, `core/chat/mailbox`, `core/chat/synchronization`, and Phase 4 session-key material into the renderer-facing Chat app so remote encrypted envelopes can be decrypted and displayed across devices without weakening the security model.

9. Chat Server production configuration

   Development OTP exposure has been removed. Local development can still use `http://localhost:8090`, but production deployments must use HTTPS, configured Gmail SMTP credentials, hardened secrets, persistent storage policy, and deployment-level rate limiting/observability.

## Recommended Next Actions

1. Normalize the full `tests/core/assistant.test.js` expectations where current behavior intentionally lowercases or normalizes routed input.
2. Add end-to-end tests for:
   - `open chrome and instagram and whatsapp`
   - `close them`
   - partial close failure for one app while others close
   - repeated `open them` or `switch to them` follow-ups
3. Add runtime profiling for:
   - idle assistant before first voice use
   - first voice activation after lazy startup
   - dynamic island notifications
   - gallery first open and large Pictures-library scrolling
   - People scan across large Pictures libraries
   - cloud reconnect
   - large file transfer
4. Add a production visual-memory checklist requiring:
   - Gallery timeline smoke test
   - Favorites star smoke test
   - Recent three-day policy check
   - People scan check on images with and without faces
   - Named people preservation after rescan
   - Memory usage check while scrolling a large gallery
5. Add a release checklist requiring:
   - `npm run lint`
   - assistant command corpus
   - gallery renderer tests
   - visual memory gallery tests
   - cloud pairing test
   - cloud file transfer test
   - notification grouping test
   - installer smoke test
6. Add end-to-end OpenX Chat desktop tests with a running Chat Server fixture for:
   - new email registration;
   - existing email OTP login;
   - desktop device registration;
   - exact email discovery;
   - outgoing request creation;
   - incoming request acceptance;
   - trusted relationship refresh;
   - pending-send blocking;
   - trusted encrypted `/messages/send`.
7. Connect the renderer-facing Chat app to the existing desktop chat encrypted receive/sync modules:
   - `core/chat/messages/MessageManager.js`;
   - `core/chat/mailbox/MailboxManager.js`;
   - `core/chat/synchronization/SynchronizationManager.js`;
   - Phase 4 identity/device/session key storage.
8. For production Chat deployment, configure Gmail SMTP credentials, keep OTP responses generic, and lock deployed desktop/mobile clients to HTTPS-only Chat Server URLs outside localhost development.

## Current Directory Tree

This is the only directory tree in this report. It was refreshed from the current OpenX workspace on 2026-07-19 and excludes dependency, build-output, cache, local graph, and other generated folders so the documentation stays focused on source, tests, configuration, docs, and checked-in assets.

Excluded generated/local-heavy paths:

- `node_modules/`
- `.git/`
- `dist/`
- `graphify-out/`
- `.codex/`
- `.code-review-graph/`
- `.agents/`
- `coverage/`
- `.next/`
- `.expo/`
- `.gradle/`
- `.cache/`
- `tmp/`
- `temp/`

Filtered tree scan: `1058` files.

```text
OpenX/
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
|   |   |   `-- VoiceAdapter.js
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
|   |   |   `-- VoiceFormatter.js
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
|   |   |-- windows.test.js
|   |   `-- windows-session.test.js
|   |-- context-awareness/
|   |   |-- context-awareness.test.js
|   |   `-- mode-engine.test.js
|   |-- core/
|   |   |-- acquisition-layer.test.js
|   |   |-- active-learning-v2.test.js
|   |   |-- app-language.test.js
|   |   |-- architecture-structure.test.js
|   |   |-- assistant.test.js
|   |   |-- assistant-intelligence-pipeline.test.js
|   |   |-- browser-language.test.js
|   |   |-- cloud-command-manager.test.js
|   |   |-- cloud-connection.test.js
|   |   |-- cloud-desktop-ui.test.js
|   |   |-- cloud-file-transfer-manager.test.js
|   |   |-- cloud-pairing-manager.test.js
|   |   |-- chat-history-sync.test.js
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
|   |   |-- learning.test.js
|   |   |-- learning-engine.test.js
|   |   |-- learning-repair.test.js
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
|   |   |-- tts.test.js
|   |   |-- utils.test.js
|   |   |-- validation.test.js
|   |   |-- verification-response.test.js
|   |   |-- vision-engine.test.js
|   |   |-- visual-filtering.test.js
|   |   |-- visual-memory.test.js
|   |   |-- visual-memory-capability.test.js
|   |   |-- visual-memory-intelligence.test.js
|   |   |-- visual-memory-learning.test.js
|   |   |-- visual-query.test.js
|   |   `-- voice-subsystem.test.js
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
|-- package.json
|-- package-lock.json
|-- README.md
|-- report.md
`-- RULES.md
```
