# OpenX Repository Report

Report date: 2026-10-01
Repository: OpenX_Desktop
Package name: openx
Branch: visiualremove
HEAD at report time: 4c100f6
Package version in package.json: 11.0.00

## Scope Scanned

This report describes the current checkout and working tree. It covers application source, desktop renderer assets, core modules, tests, documentation, plugins, build resources, configuration, and local model assets.

The filtered filesystem inventory contains 521 files and 93 directories. It excludes generated, dependency, and agent-workspace folders:

- .git/
- node_modules/
- dist/
- graphify-out/
- .agents/
- .codex/
- .claude/
- .opencode/
- .code-review-graph/

These excluded folders are not application source. The graphify summary is recorded below; generated graph files are not copied into the directory tree.

Tracked file count from git: 502. The filtered working-tree inventory also includes local or ignored files such as model assets and repository instruction files.

Tracked top-level distribution:

| Area | Files |
|---|---:|
| core/ | 340 |
| tests/ | 97 |
| apps/ | 28 |
| docs/ | 12 |
| plugins/ | 11 |
| build/ | 5 |
| scripts/ | 1 |
| Top-level files | 8 |
| Total tracked | 502 |

Tracked file extension distribution:

| Type | Files |
|---|---:|
| .js | 464 |
| .md | 15 |
| .json | 6 |
| .html | 5 |
| .css | 5 |
| .exe | 1 |
| .mjs | 1 |
| .nsh | 1 |
| .ico | 1 |
| .png | 1 |
| .cjs | 1 |
| .gitignore | 1 |

## Product Purpose

OpenX is a local-first Windows desktop assistant built with Electron and Node.js. Its central workflow is to understand a user command, validate it, execute it through a platform controller, verify the result, and return the result to the originating interface.

Implemented areas in this checkout include:

- Assistant chat and voice interaction.
- Windows app/window, browser, media, file, folder, volume, brightness, system, text, mouse, and screenshot automation.
- Planner entries, reminders, alarms, timers, stopwatch controls, and Dynamic Island schedule cards.
- Local OpenX Chat client modules for identity, contacts, conversations, messages, encryption, transfers, and synchronization.
- Cloud relay, device pairing, remote commands, and file transfer.
- Home-device discovery, onboarding, state, and command execution.
- Manifest-based Chrome, Discord, Forms, sample, and YouTube plugins.

The current source tree does not contain Gallery or Visual Memory modules described by older documentation. MobileCLIP, MobileFaceNet, SCRFD, and PaddleOCR assets are present under models/, but model assets alone do not establish an active application feature.

## Technology And Dependencies

| Area | Implementation |
|---|---|
| Desktop shell | Electron 28.3.3 |
| Runtime | Node.js >=18.18.0 <23 |
| Package manager | npm, declared as 10.9.2 |
| Application modules | JavaScript, CommonJS |
| Renderer | HTML, CSS, browser JavaScript |
| Windows integration | PowerShell, child processes, Windows APIs |
| Local text model | node-llama-cpp with the Llama 3.2 1B GGUF model |
| Voice input model | Parakeet ONNX assets |
| Voice output | Browser SpeechSynthesis in the voice renderer |
| Networking | ws |
| QR pairing | qrcode |
| Search | fuse.js |
| Packaging | electron-builder and NSIS |
| Tests | Mocha and Chai |
| Lint | ESLint |

## Version And Build State

package.json is the runtime version source through config.js. The current package.json version is 11.0.00. package-lock.json still identifies the package as 10.3.44. Resolve this mismatch before packaging or publishing. The 10.3.44 version in the supplied October startup logs reflects the package state when those logs were produced.

Package scripts:

| Command | Purpose |
|---|---|
| npm start | Start Electron through scripts/start-electron.js |
| npm run dev | Start the development runtime |
| npm run lint | ESLint over the repository |
| npm test | Run tests/**/*.test.js |
| npm run test:core | Run core tests |
| npm run test:automation | Run automation tests |
| npm run test:learning | Run focused learning tests |
| npm run test:ui | Run renderer/UI tests |
| npm run validate | Run lint and all tests |
| npm run build | Build an unpacked Windows x64 app |
| npm run package | Build the Windows NSIS installer |

Packaging uses electron-builder and NSIS. Build resources include OpenX icons and the Chrome native host executable. Configured extra resources include Parakeet and Llama model folders.

## Application Startup And Shutdown

Electron starts at apps/desktop/electron/main.js.

Startup path:

1. app.whenReady() installs session security and creates SettingsService.
2. Runtime settings are read and merged with config.js.
3. AssistantEventBus is created and schedule, command, and planner subscriptions are registered.
4. IPC handlers are registered through setupIPC().
5. Dynamic Island and tray are initialized.
6. initializeAssistant() constructs Assistant, initializes automation/scheduler, registers chat and voice shortcuts, and optionally warms the local LLM.
7. Cloud, pairing, mobile, home-device onboarding, and related runtimes are initialized.
8. The development chat window opens when the app is not packaged.

Exit path:

- app.on('before-quit') starts the application cleanup path.
- Tray behavior keeps the application running after all ordinary windows close.
- Crash recovery records fatal failures and unexpected renderer/child-process exits.

Main lifecycle functions:

| Function | Input/trigger | Main work | Output |
|---|---|---|---|
| app.whenReady() callback | Electron ready event | Security, services, event handlers, windows, assistant, cloud and home runtime initialization | Ready desktop runtime |
| initializeAssistant() | Startup or runtime reload | Build runtime config, create Assistant, initialize automation, install shortcuts, request LLM warmup | Initialized assistant reference |
| setupIPC() | Startup | Register validated IPC handlers for commands, settings, schedules, cloud, planner, chat, and windows | Renderer-facing command API |
| registerIpcHandler(channel, handler) | IPC registration | Apply channel and sender validation before dispatch | Trusted main-process handler |
| cleanup / before-quit handlers | Quit or fatal failure | Persist/stop runtime components and close resources | Clean shutdown or recovery exit |

## Command Entry And Exit Flow

Main typed command route:

Desktop chat renderer
-> window.openx.processCommand(text, "chat")
-> preload IPC command:process
-> main handler in setupIPC()
-> Assistant.processCommand(input, source)
-> AssistantEngine.processCommand()
-> InputSourceManager.acquire()
-> PipelineManager.process()
-> Assistant._processCommandDirect()
-> ActionRouter.process()
-> AutomationEngine.execute(actionId, entities, context)
-> controller action
-> ActionVerifier.verify()
-> Assistant response finalization
-> IPC result returned to chat renderer

The assistant can take early exits for pending confirmation, clarification, schedule completion, identity/context questions, recall, or other handled conversational input. Those results are finalized without necessarily reaching desktop automation.

Voice route:

Alt+Space shortcut
-> main opens or activates voice renderer
-> renderer captures microphone input and runs voice transcription
-> processVoiceCommand / processCommand with source "voice"
-> shared Assistant.processCommand route above
-> voice renderer presents response and speaks it when voice replies are enabled
-> voice conversation can be relayed into assistant chat history

Cloud command route:

Cloud relay packet
-> CloudCommandManager / CloudCommandRouter
-> Assistant.processCommand(command, "phone", options)
-> shared command and verification route
-> cloud command response is serialized and sent through the relay

Plugin route:

PluginManager.loadAll()
-> manifest and trusted-plugin validation
-> plugin module initialization with restricted automation and intent facades
-> namespaced action/intent registration
-> registered action reaches AutomationEngine and its verifier

Command result exit surfaces:

- IPC result to the chat or voice request that initiated a command.
- AssistantEventBus lifecycle events for state, schedule, planner, and command updates.
- Cloud response for commands received from a paired device.
- Dynamic Island alert when a command result includes island presentation data.
- Persistent local data writes through Data.js and subsystem-specific stores.

## Important Entry Points, Methods, And Outputs

| Entry point | Important handoff methods | Exit point and result |
|---|---|---|
| Electron startup | app.whenReady() -> setupIPC() -> initializeAssistant() -> cloud/home initialization | Ready tray application, assistant, windows, and registered IPC/event handlers. |
| Typed desktop command | command:process IPC -> Assistant.processCommand() -> AssistantEngine.processCommand() -> _processCommandDirect() -> ActionRouter.process() -> AutomationEngine.execute() | Verified result returned to renderer; events, schedule updates, or island item may also be published. |
| Voice command | voice shortcut -> voice renderer capture/transcription -> processVoiceCommand() -> Assistant.processCommand() | Response rendered and optionally spoken; conversation can be appended to chat. |
| Cloud command | relay packet -> CloudCommandManager/CloudCommandRouter -> Assistant.processCommand() | Serialized command result returned to the paired-device relay. |
| Plugin registration | PluginManager.loadAll() -> _loadPlugin() -> _validateManifest() -> restricted facades | Namespaced intents/actions registered with the assistant and automation engine. |
| Application launch | ActionRouter app.open -> AutomationEngine.execute() -> AppController.open() -> waitForVisibleApp() | Success includes visible-window evidence; missing evidence becomes a failed result. |
| Scheduled reminder | SchedulerController._arm() -> _publishDue() -> SCHEDULE_DUE -> handleScheduleDue() | Sticky island item, chat event, and audio-only voice notification; item stays until action succeeds. |
| Settings edit | settings input/change -> scheduleSettingsSave() -> saveSettings() -> preload -> settings:save -> SettingsService.saveSettings() | Merged settings snapshot returned to renderer; pending save flushed on close/cleanup. |
| Renderer action | renderer -> explicit preload API -> validated main-process IPC -> core controller | Controller result returned through IPC; renderer does not invoke OS automation directly. |
| Local persistence | subsystem store -> Data.writeJsonAtomic() or secure JSON helper | File under OpenX_Data, with atomic replacement/backup or encrypted envelope where configured. |

Key method index:

| File/class | Important methods | Purpose |
|---|---|---|
| apps/desktop/electron/main.js | initializeAssistant(), setupIPC(), registerIpcHandler(), handleScheduleDue(), showIslandItem(), initializeCloudConnection(), initializeCloudPairing(), initializeCloudCommands(), initializeCloudFileTransfers(), registerPowerRecoveryHandlers() | Application composition root and adapter between Electron, renderers, core services, and platform events. |
| apps/desktop/electron/security.js | validateSettings(), validateScheduleAction(), validateIslandAction(), assertTrustedIpcSender(), createSecureWebPreferences() | Validate renderer messages and configure trusted, isolated renderer contexts. |
| apps/desktop/preload.js | command, settings, voice, island, planner, chat, cloud, transfer, and home-device bridge methods | Explicit renderer API; no general Node or filesystem bridge. |
| core/assistant/index.js | processCommand(), _processCommandDirect(), _finalizeAssistantResult(), generateScheduledNotification(), _applyLocalLlmTaskReply() | Assistant request lifecycle, result response, and guarded LLM wording. |
| core/assistant/AssistantEngine.js | processCommand(), getStatus(), destroy() | Acquire input, run pipeline, return output or normalized pipeline failure. |
| core/assistant/automation/ActionRouter.js | process() and intent/entity preparation methods | Parse, route, validate, and invoke the selected action. |
| core/automation/index.js | init(), execute(), _executeScheduledAction() | Initialize scheduler and dispatch/verify controller actions. |
| core/automation/apps.js | open(), close(), waitForVisibleApp(), switchTo() | Manage app/window lifecycle and opening evidence. |
| core/automation/scheduler.js | init(), checkDueSchedules(), setTimer(), setAlarm(), setReminder(), _scheduleNotification(), _arm(), _publishDue(), snooze(), complete(), listSchedules() | Schedule persistence, due-time delivery, recovery, and user actions. |
| apps/desktop/renderer/island/index.js | normalizeItem(), render(), runAction(), enqueue() | Keep/update alert card, route Stop/Snooze, and dismiss only after success. |
| apps/desktop/renderer/voice/index.js | beginListening(), sendVoiceCommand(), presentReply(), presentScheduledNotification(), speak() | Voice capture, command dispatch, response audio, and scheduled reminder audio. |
| apps/desktop/renderer/chat/index.js | process/send message handlers, scheduleSettingsSave(), saveSettings(), flushSettingsSave() | Typed commands, settings autosave, and schedule presentation. |
| core/chat/ChatManager.js | start(), stop(), service accessors, getHealth() | Start/stop local OpenX Chat services and expose subsystem state. |
| core/cloud/CloudConnectionManager.js | connect(), disconnect(), reconnect(), send(), handleMessage(), destroy() | Maintain relay session, send/receive packets, and clean up transport. |
| core/cloud/CloudPairingManager.js | generatePairingQR(), approvePairing(), rejectPairing(), handlePairingRequest() | Pair and authorize devices. |
| plugins/plugin-controller.js | loadAll(), _loadPlugin(), _validateManifest(), _createAutomationFacade(), _createIntentFacade() | Discover, authorize, and safely connect plugin modules. |
| core/assistant/Data.js | resolveDataRoot(), buildDataPaths(), writeJsonAtomic(), readJsonFile() | Resolve managed storage paths and read/write local state. |

## Assistant Processing Layers

The public facade is core/assistant/index.js. It owns runtime dependencies and routes requests through AssistantEngine and the intelligence pipeline. It also handles pending confirmations and clarifications, context, learning hooks, local LLM integration, and final response delivery.

| Layer | Path | Main responsibility |
|---|---|---|
| Acquisition and normalization | core/assistant/input/ | Normalize raw chat/voice/cloud inputs and expose parser and language helpers. |
| Linguistic and semantic understanding | core/assistant/understanding/ | Interpret language, entities, semantic frames, and browser/web targets. |
| Reasoning and planning | core/assistant/reasoning/ | Select intents, score patterns, plan tasks, and prepare decisions. |
| Pipeline contracts | core/assistant/pipeline/ | Stage results, stage interface, errors, and pipeline processing support. |
| Automation routing | core/assistant/automation/ | ActionRouter and decision-validation integration. |
| Response and verification | core/assistant/respond/ | Response generation, validation, personality, and action verification contracts. |
| Context and learning | core/assistant/knowledge/ | Profile, references, conversation context, memory providers, and learning store. |
| Local LLM | core/assistant/llm/ | Worker, manager, Llama runtime, prompt construction, and output leak guard. |
| Shared contracts/utilities | core/assistant/shared/ | Events, pipeline models, utilities, and event dispatch. |

Important assistant methods and handoffs:

| Entry method | Handoff | Exit |
|---|---|---|
| Assistant.processCommand(input, source, options) | Uses AssistantEngine unless confirmation/clarification state requires direct processing | Assistant result object |
| AssistantEngine.processCommand(input, source, options) | Acquires RawUserInput and calls PipelineManager.process | Pipeline output or normalized failure |
| Assistant._processCommandDirect(input, source, options) | Handles pending state and conversational paths, then ActionRouter.process | Routed and finalized result |
| ActionRouter.process(inputText, source, options) | Parses/repairs command text, identifies intent/entities, validates, and invokes automation | Action result with response metadata |
| AutomationEngine.execute(actionId, entities, context) | Finds action handler, executes controller, verifies result | Verified success/failure result |
| Assistant._finalizeAssistantResult(result, context) | Publishes events and formats response/state | User-facing result returned to caller |
| Assistant.generateScheduledNotification(schedule) | Requests LLM wording and checks it against saved reminder words | Grounded wording or saved reminder text |
| Assistant._applyLocalLlmTaskReply(...) | Guards LLM rewriting of automated action results | Controller-backed result is preserved for protected outcomes |

ActionRouter remains a central compatibility component with broad routing responsibility. The directory architecture separates input, understanding, reasoning, response, and knowledge concerns, but not every command path is a direct one-stage-per-folder route.

## Automation Controllers

core/automation/index.js constructs controllers and owns the action map and ActionVerifier.

| Controller/file | Main capability |
|---|---|
| apps.js | Resolve, launch, close, switch, and verify desktop applications. |
| windows.js | Inspect windows, focus/close windows, keys, and window state. |
| browser.js | Browser launch, tabs, navigation, search, and browser actions. |
| files.js | File search and file operations. |
| folders.js | Folder operations. |
| media.js | Media playback and device controls. |
| volume.js | System audio volume. |
| brightness.js | Display brightness. |
| system.js | System status and operating-system actions. |
| text.js | Text operations and application/browser text workflows. |
| communications.js | Communication-provider operations. |
| scheduler.js | Timers, reminders, alarms, due events, and scheduled actions. |
| planner.js | Planner entry storage and operations. |
| screenshot-recording.js | Screenshot and recording functions. |
| mouse.js | Pointer operations. |
| remote.js | Remote operation integration. |
| forms.js integration in index.js | Form automation using browser and windows controllers. |
| ActionVerifier constructed by index.js | Checks controller results and returns verification metadata. |

App-open verification path:

ActionRouter identifies app.open
-> AutomationEngine.execute()
-> AppController.open()
-> launch attempt
-> waitForVisibleApp() polls for a visible matching window
-> result carries matched window/process evidence or returns verification failure
-> ActionVerifier verifies and returns final result

App/window close, focus, brightness, volume, files, browser, and media commands also use controller handlers rather than direct renderer actions.

## Scheduling, Planner, Timer, And Dynamic Island Workflow

Scheduling entry:

Assistant command
-> ActionRouter identifies reminder.set / alarm.set / timer.set
-> AutomationEngine action map
-> SchedulerController.setReminder / setAlarm / setTimer
-> _scheduleNotification() validates and persists schedule
-> _arm() waits until dueAt
-> _publishDue() publishes SCHEDULE_DUE
-> Electron main handles due event
-> Dynamic Island, chat, and voice paths are notified

Scheduler persistence uses schedules.json under the OpenX data root. It also supports scheduled actions, completion, snooze, recurrence, and schedule snapshots.

Key methods:

| Method | Role |
|---|---|
| SchedulerController.init() | Load schedules and arm scheduled entries. |
| checkDueSchedules() | Recheck persisted due items after system resume. |
| setReminder(), setAlarm(), setTimer() | Validate request data and create schedule items. |
| _scheduleNotification() | Normalize item, deduplicate/update, persist, arm timer. |
| _arm() | Schedule a Node timeout for dueAt. |
| _publishDue() | Mark/persist due state or dispatch scheduled action and publish the event. |
| complete(id), snooze(id, minutes) | Complete/dismiss or move an item to a future due time. |
| listSchedules(kind, scope) | Return schedule state for UI/API consumers. |

Reminder presentation:

- handleScheduleDue(schedule) in Electron main logs lateByMs and sends schedule:due to chat.
- The Dynamic Island uses schedule ID to update the same card when generated text arrives.
- Reminder LLM output must contain the full saved reminder phrase in order and may use only a small allow-list of connective words. Invalid output falls back to the saved reminder.
- Main sends the resulting wording to the hidden voice renderer as an audio-only notification, preventing a second visible reminder window.
- Reminder cards are sticky and do not use the standard nine-second hide timer.
- Stop and Snooze call the scheduler through validated IPC. The renderer dismisses the card only after a successful action; a failed action leaves it visible.
- Electron powerMonitor resume triggers checkDueSchedules() to deliver schedules that elapsed during sleep.

Timer widget:

- renderer/timer-widget displays timer and stopwatch state.
- main observes COMMAND_EXECUTED and reacts to timer/stopwatch set, reset, and cancel intents.
- Widget controls route through preload/IPC into the scheduler.

## Desktop Renderer And IPC Surfaces

| Surface | Path | Purpose |
|---|---|---|
| Assistant chat/settings | apps/desktop/renderer/chat/ | Assistant conversation, settings, app activity, schedule and planner displays. |
| Voice | apps/desktop/renderer/voice/ | Microphone capture, transcription state, response display, and TTS. |
| Dynamic Island | apps/desktop/renderer/island/ | Top-level alert card with schedule actions. |
| Planner | apps/desktop/renderer/planner/ | Planner UI. |
| Timer widget | apps/desktop/renderer/timer-widget/ | Timer/stopwatch UI. |

IPC contract:

- apps/desktop/preload.js exposes explicit contextBridge functions.
- apps/desktop/electron/security.js validates payloads and trusted renderer senders.
- apps/desktop/electron/main.js performs privileged work and sends approved result/state events.
- Renderer windows do not import core controllers or access privileged Node APIs directly.

## Settings And Data Storage

Settings workflow:

Renderer input/change event
-> scheduleSettingsSave() debounces
-> saveSettings() captures a settings payload and appends it to settingsSaveQueue
-> preload saveSettings()
-> main settings:save handler and SettingsService.saveSettings()
-> merged settings snapshot returned
-> renderer updates live settings/status

Settings close flushes pending saves. Renderer cleanup also flushes the settings queue. The Settings Save and Reset buttons and settings reset IPC were removed from this working tree.

Data ownership:

- Default managed data root: %USERPROFILE%/OpenX_Data
- Legacy data root used by migration: %USERPROFILE%/.OpenX
- Received cloud files: Documents/OpenX unless configured otherwise
- Root resolution and path generation: core/assistant/Data.js
- JSON persistence: atomic replacement and backup helpers in Data.js
- Secure JSON format uses AES-256-GCM with a data key under the security directory
- SettingsService owns settings merge/save behavior in apps/desktop/settings.js

Important data files include settings.json, assistant-chat-history.json, schedules.json, planner.json, UI state, local chat account/device/conversation/message state, chat sync state, transfer state, learning state, logs, cloud runtime data, and the local encryption key.

## Local Models And Assets

| Path | Purpose/status |
|---|---|
| models/Llama-3.2-1B/Llama-3.2-1B-Instruct-Q4_K_M.gguf | Local assistant text generation model. |
| models/parakeet/ | ONNX encoder, decoder, joiner, and tokens for voice transcription. |
| models/mobileclip/ | MobileCLIP model assets. |
| models/mobilefacenet/ | MobileFaceNet model assets. |
| models/scrfd/ | Face detection model asset. |
| models/paddleocr/ | OCR detector/recognizer assets. |
| build/openx-chrome-host.exe | Chrome native messaging host executable. |
| build/icon.ico and build/icon.png | Application icons. |
| build/installer.nsh | NSIS installer customization. |

The model folders beyond Llama and Parakeet are assets in this checkout. The source tree scan did not find corresponding Gallery/Visual Memory or AI Vision runtime modules, so this report does not describe those assets as active features.

## OpenX Chat

The OpenX Chat client resides in core/chat. ChatManager.start() initializes its services and lifecycle. The source is organized into:

- Connection and service lifecycle.
- Accounts, devices, contact discovery and requests.
- Conversations and local message storage.
- Message validation, serialization, delivery, acknowledgement, retry, and mailbox sync.
- Crypto identity, key management, encryption, and secure storage.
- File transfer.
- Synchronization, history sync, and multi-device support.
- Health, quality, and infrastructure reporting.

The desktop UI and main-process handlers bridge these core services to renderer events and the configured chat server. This is separate from the assistant's local command conversation.

## Cloud And Home Automation

core/cloud provides:

- CloudConnectionManager.connect(), disconnect(), reconnect(), send(), and packet handling.
- CloudPairingManager QR generation, pairing approval/rejection, and device trust state.
- CloudCommandManager and CloudCommandRouter for remote command request/response.
- CloudFileTransferManager and protocol/integrity helpers for transfer lifecycle.
- CloudE2EE and secure packet handling.

core/home-automation groups discovery, onboarding, owner/device state, packet schemas, validators, command routing, execution, and UI integration. Electron main initializes cloud and home runtimes and binds trusted device commands to the automation boundary.

## Plugin System

plugins/plugin-controller.js exports PluginManager.

PluginManager.loadAll() scans configured plugin directories. A module is loaded only when it has plugin.json and index.js. The manager validates safe names, trust, permission levels, declared actions, and plugin-specific action/intent prefixes. Plugin code receives restricted facades rather than the full AutomationEngine.

Plugin directories present:

- chrome/
- discord/
- forms/
- sample_plugin/
- youtube/

## Security And Privacy Boundaries

- Renderer IPC calls are validated in the main process.
- Main process owns privileged OS, file, shell, cloud, and automation operations.
- Plugin manifests must pass trust and permission checks.
- Plugin action IDs and intent IDs are restricted to plugin-specific namespaces.
- Cloud relay data uses secure packet helpers and transfer integrity checks.
- Managed data is stored locally under OpenX_Data and includes secure storage helpers.
- LLM-generated text must not claim an action succeeded unless controller results support it; scheduled reminder text is checked against its saved source phrase.

## Current Working Tree Changes

This snapshot includes staged and unstaged edits from earlier work sessions. This report does not stage, discard, or rewrite those changes.

| File/group | Observed change |
|---|---|
| apps/desktop/renderer/chat/index.html and index.js | Removes manual settings Save/Reset controls, autosaves settings through a debounce and serialized save queue, flushes on close/cleanup, and displays schedule-due chat notifications. |
| apps/desktop/electron/main.js | Removes settings reset IPC, adds queued voice notification delivery, handles due reminders and late-by-ms logging, connects resume checks, and updates timer widget routing. |
| apps/desktop/electron/security.js and apps/desktop/preload.js | Removes reset channel validation/API and exposes voice notification subscription. |
| apps/desktop/renderer/island/index.js | Updates same-ID items in place, keeps sticky cards until successful Stop/Snooze, and does not dismiss on failed actions. |
| apps/desktop/renderer/voice/index.js | Queues voice notifications until renderer readiness and supports hidden audio-only reminder playback. |
| core/automation/scheduler.js | Adds persisted overdue-item scan for system resume. |
| core/automation/apps.js | Checks for visible matching windows after launch and returns failure if opening cannot be verified. |
| core/assistant/index.js | Protects automation replies from unsupported LLM rewrites, includes volume/brightness action intents, and validates LLM reminder text against saved reminder phrase. |
| package.json | Unstaged version change from 10.3.44 to 11.0.00. package-lock.json remains at 10.3.44. |

Modified source paths at report time: apps/desktop/electron/main.js, apps/desktop/electron/security.js, apps/desktop/preload.js, apps/desktop/renderer/chat/index.html, apps/desktop/renderer/chat/index.js, apps/desktop/renderer/island/index.js, apps/desktop/renderer/voice/index.js, core/assistant/index.js, core/automation/apps.js, core/automation/scheduler.js, package.json.

## Test And Validation Commands

- npm run test:core
- npm run test:automation
- npm run test:learning
- npm run test:ui
- npm test
- npm run lint
- npm run validate

The documentation refresh did not run tests or a package build. Review .mocharc.cjs and the individual suite files before choosing focused validation.

## Known Documentation And Workspace Risks

- package.json and package-lock.json disagree on version.
- package.json reports 11.0.00, while package-lock.json and earlier runtime logs report 10.3.44.
- README.md and older architecture/audit/setup documents describe Gallery, Visual Memory, or source folders absent from this branch. Confirm those claims against the source tree.
- Some architecture documents describe target or migration architecture. Treat them as design notes; this report distinguishes current runtime paths from target-state descriptions.
- Startup can deliver previously scheduled entries after application restart. An observed reminder was delivered at startup about 410 seconds after due time; a separate one-minute reminder in the same log was delivered about 25 ms late.
- graphify-out/GRAPH_REPORT.md is an orientation aid, not proof of direct runtime dependency. At report time it lists 5,700 nodes and 12,675 edges, including inferred edges.
- The current changes include staged and unstaged edits. Check git status before interpreting this table in a later session.

## Complete Filtered Directory Tree

The tree below lists all files and directories found in the working tree after excluding the generated/dependency/agent-workspace directories listed above. Model and build-resource filenames are included; binary contents are not embedded in this report.
```
OpenX_Desktop/
|-- apps/
|   \-- desktop/
|       |-- electron/
|       |   |-- crash-recovery.js
|       |   |-- home-bluetooth-selection.js
|       |   |-- main.js
|       |   \-- security.js
|       |-- renderer/
|       |   |-- chat/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   \-- index.js
|       |   |-- island/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   \-- index.js
|       |   |-- planner/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   \-- index.js
|       |   |-- timer-widget/
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   \-- index.js
|       |   \-- voice/
|       |       |-- index.css
|       |       |-- index.html
|       |       \-- index.js
|       |-- voice/
|       |   \-- stt/
|       |       |-- fbank.js
|       |       |-- ModelLoader.js
|       |       |-- onnx-metadata.js
|       |       |-- ParakeetEngine.js
|       |       \-- tokenizer.js
|       |-- permissions.js
|       |-- preload.js
|       |-- security-lock.js
|       \-- settings.js
|-- build/
|   |-- icon.ico
|   |-- icon.png
|   |-- ICON_README.md
|   |-- installer.nsh
|   \-- openx-chrome-host.exe
|-- core/
|   |-- assistant/
|   |   |-- automation/
|   |   |   |-- ActionRouter.js
|   |   |   |-- AutomationRuntime.js
|   |   |   |-- DecisionValidation.js
|   |   |   \-- index.js
|   |   |-- input/
|   |   |   |-- _acquisition.js
|   |   |   |-- _linguistic.js
|   |   |   |-- _normalization.js
|   |   |   |-- AcquisitionErrors.js
|   |   |   |-- AssistantLexicon.js
|   |   |   |-- BaseNormalizer.js
|   |   |   |-- CommandPreprocessor.js
|   |   |   |-- index.js
|   |   |   |-- InputAdapters.js
|   |   |   |-- InputBuilders.js
|   |   |   |-- InputParser.js
|   |   |   |-- InputSourceManager.js
|   |   |   |-- InputSourceUtilities.js
|   |   |   |-- LanguageAnalysis.js
|   |   |   |-- LinguisticAnalyzers.js
|   |   |   |-- LinguisticCore.js
|   |   |   |-- NlpProcessor.js
|   |   |   |-- NormalizationCore.js
|   |   |   |-- NormalizedInput.js
|   |   |   \-- Normalizers.js
|   |   |-- knowledge/
|   |   |   |-- _context.js
|   |   |   |-- _learning.js
|   |   |   |-- _memory.js
|   |   |   |-- _profile.js
|   |   |   |-- _references.js
|   |   |   |-- audit-log.js
|   |   |   |-- ContextManager.js
|   |   |   |-- ContextProviders.js
|   |   |   |-- fact-model.js
|   |   |   |-- FactRecall.js
|   |   |   |-- index.js
|   |   |   |-- LearningStore.js
|   |   |   |-- MemoryCore.js
|   |   |   |-- MemoryProviders.js
|   |   |   |-- ProfileFacts.js
|   |   |   |-- ReferencesCore.js
|   |   |   \-- StatementCapture.js
|   |   |-- llm/
|   |   |   |-- ExternalLlmEngine.js
|   |   |   |-- index.js
|   |   |   |-- LeakGuard.js
|   |   |   |-- LlamaEngine.js
|   |   |   |-- llm-worker.js
|   |   |   |-- LocalLlmManager.js
|   |   |   \-- prompt.js
|   |   |-- pipeline/
|   |   |   |-- index.js
|   |   |   |-- PipelineCore.js
|   |   |   |-- PipelineError.js
|   |   |   |-- PipelineStage.js
|   |   |   \-- StageResult.js
|   |   |-- reasoning/
|   |   |   |-- _decision.js
|   |   |   |-- _planning.js
|   |   |   |-- _reasoning.js
|   |   |   |-- DecisionCore.js
|   |   |   |-- index.js
|   |   |   |-- IntentPatternScorer.js
|   |   |   |-- IntentRegistry.js
|   |   |   |-- Planners.js
|   |   |   |-- PlanningCore.js
|   |   |   |-- ReasoningCore.js
|   |   |   \-- ReasoningDiagnostics.js
|   |   |-- respond/
|   |   |   |-- _response.js
|   |   |   |-- _validation.js
|   |   |   |-- _verification.js
|   |   |   |-- index.js
|   |   |   |-- Personality.js
|   |   |   |-- ResponseCore.js
|   |   |   |-- ResponseGenerator.js
|   |   |   |-- ValidationCore.js
|   |   |   \-- VerificationCore.js
|   |   |-- shared/
|   |   |   |-- _events.js
|   |   |   |-- _models.js
|   |   |   |-- _utils.js
|   |   |   |-- index.js
|   |   |   |-- ModelsCore.js
|   |   |   |-- PipelineEventDispatcher.js
|   |   |   |-- PipelineEvents.js
|   |   |   \-- UtilsCore.js
|   |   |-- understanding/
|   |   |   |-- _entities.js
|   |   |   |-- _semantic.js
|   |   |   |-- EntityCore.js
|   |   |   |-- EntityExtractor.js
|   |   |   |-- EntityExtractors.js
|   |   |   |-- EntityManager.js
|   |   |   |-- index.js
|   |   |   |-- NaturalLanguageRouter.js
|   |   |   |-- SemanticCore.js
|   |   |   \-- WebTargets.js
|   |   |-- AssistantEngine.js
|   |   |-- Data.js
|   |   \-- index.js
|   |-- automation/
|   |   |-- action-plan/
|   |   |   |-- ActionStepRegistry.js
|   |   |   |-- ComputerActionEngine.js
|   |   |   |-- ComputerActionPlanner.js
|   |   |   \-- index.js
|   |   |-- common/
|   |   |   |-- action-confirm.js
|   |   |   |-- action-velidation.js
|   |   |   |-- action-verification.js
|   |   |   |-- launcher.js
|   |   |   |-- path-utils.js
|   |   |   |-- search-scoring.js
|   |   |   |-- text-repair.js
|   |   |   \-- windows-session.js
|   |   |-- apps.js
|   |   |-- brightness.js
|   |   |-- browser.js
|   |   |-- communications.js
|   |   |-- files.js
|   |   |-- folders.js
|   |   |-- index.js
|   |   |-- media.js
|   |   |-- mouse.js
|   |   |-- planner.js
|   |   |-- remote.js
|   |   |-- scheduler.js
|   |   |-- screenshot-recording.js
|   |   |-- system.js
|   |   |-- text.js
|   |   |-- volume.js
|   |   \-- windows.js
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
|   |   |   \-- SessionManager.js
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
|   |   |   \-- SortingManager.js
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
|   |   |   \-- SessionManager.js
|   |   |-- devices/
|   |   |   |-- DeviceConfiguration.js
|   |   |   |-- DeviceEvents.js
|   |   |   |-- DeviceLifecycle.js
|   |   |   |-- DeviceLogger.js
|   |   |   |-- DeviceManager.js
|   |   |   |-- DeviceRegistry.js
|   |   |   |-- DeviceService.js
|   |   |   |-- DeviceStatus.js
|   |   |   \-- index.js
|   |   |-- discovery/
|   |   |   |-- ContactDiscoveryManager.js
|   |   |   |-- DiscoveryConfiguration.js
|   |   |   |-- DiscoveryEvents.js
|   |   |   |-- DiscoveryLogger.js
|   |   |   |-- DiscoveryService.js
|   |   |   |-- DiscoveryValidation.js
|   |   |   \-- index.js
|   |   |-- history/
|   |   |   |-- HistorySynchronizationClient.js
|   |   |   |-- HistorySynchronizationConfiguration.js
|   |   |   |-- HistorySynchronizationEvents.js
|   |   |   |-- HistorySynchronizationManager.js
|   |   |   |-- HistorySynchronizationStorage.js
|   |   |   |-- HistoryTransferEngine.js
|   |   |   \-- index.js
|   |   |-- infrastructure/
|   |   |   |-- ConnectionOptimizer.js
|   |   |   |-- index.js
|   |   |   |-- InfrastructureEvents.js
|   |   |   |-- MemoryOptimizer.js
|   |   |   |-- MetricsManager.js
|   |   |   |-- MonitoringManager.js
|   |   |   |-- PerformanceManager.js
|   |   |   |-- StorageOptimizer.js
|   |   |   \-- SynchronizationOptimizer.js
|   |   |-- mailbox/
|   |   |   |-- AcknowledgementManager.js
|   |   |   |-- index.js
|   |   |   |-- MailboxClient.js
|   |   |   |-- MailboxConfiguration.js
|   |   |   |-- MailboxEvents.js
|   |   |   |-- MailboxLogger.js
|   |   |   |-- MailboxManager.js
|   |   |   |-- MailboxSyncManager.js
|   |   |   \-- SequenceManager.js
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
|   |   |   \-- TypingManager.js
|   |   |-- multidevice/
|   |   |   |-- DeviceConsistencyManager.js
|   |   |   |-- DeviceEvents.js
|   |   |   |-- DeviceLogger.js
|   |   |   |-- DeviceSynchronizationManager.js
|   |   |   |-- index.js
|   |   |   |-- MultiDeviceClient.js
|   |   |   |-- MultiDeviceConfiguration.js
|   |   |   |-- MultiDeviceManager.js
|   |   |   \-- SynchronizationCopyManager.js
|   |   |-- quality/
|   |   |   |-- CrashRecoveryManager.js
|   |   |   |-- index.js
|   |   |   |-- PerformanceReporter.js
|   |   |   |-- ProductionValidator.js
|   |   |   |-- QualityManager.js
|   |   |   \-- ReleaseLogger.js
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
|   |   |   \-- TrustManager.js
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
|   |   |   \-- TrustManager.js
|   |   |-- state/
|   |   |   |-- ChatRuntimeStateMachine.js
|   |   |   \-- index.js
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
|   |   |   \-- SynchronizationManager.js
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
|   |   |   \-- UploadManager.js
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
|   |   \-- LogFormatter.js
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
|   |   \-- index.js
|   \-- home-automation/
|       |-- constants/
|       |   |-- HomeActions.js
|       |   \-- PacketTypes.js
|       |-- execution/
|       |   \-- HomeCommandClient.js
|       |-- managers/
|       |   \-- HomeAutomationManager.js
|       |-- models/
|       |   |-- DeviceState.js
|       |   |-- ExecutionResult.js
|       |   |-- HomeCommand.js
|       |   |-- HomeDevice.js
|       |   |-- HomePacket.js
|       |   |-- HomeResponse.js
|       |   \-- PendingRequest.js
|       |-- onboarding/
|       |   |-- constants/
|       |   |   \-- OnboardingStates.js
|       |   |-- discovery/
|       |   |   |-- HomeDeviceDiscoveryManager.js
|       |   |   \-- HomeLanDiscoveryTransport.js
|       |   |-- identity/
|       |   |   \-- HomeOwnerIdentity.js
|       |   |-- managers/
|       |   |   \-- HomeOnboardingManager.js
|       |   |-- services/
|       |   |   |-- HomeConfigurationService.js
|       |   |   \-- HomePairingService.js
|       |   |-- state/
|       |   |   \-- HomeOnboardingStateManager.js
|       |   |-- storage/
|       |   |   \-- HomeDeviceStore.js
|       |   |-- utilities/
|       |   |   \-- OnboardingSanitizer.js
|       |   \-- index.js
|       |-- packets/
|       |   \-- HomePacketBuilder.js
|       |-- parser/
|       |   \-- HomeCommandParser.js
|       |-- responses/
|       |   \-- HomeResponseHandler.js
|       |-- routing/
|       |   \-- HomeAutomationRouter.js
|       |-- state/
|       |   \-- HomeAutomationState.js
|       |-- ui/
|       |   \-- HomeAutomationUiPlaceholders.js
|       |-- utilities/
|       |   \-- HomeText.js
|       |-- validators/
|       |   \-- HomePacketValidator.js
|       \-- index.js
|-- docs/
|   |-- architecture/
|   |   |-- overview.md
|   |   |-- production-finalization.md
|   |   \-- repository-audit.md
|   |-- modules/
|   |   |-- assistant-communication.md
|   |   |-- communications.md
|   |   |-- core-engine.md
|   |   |-- nlp-pipeline.md
|   |   \-- settings.md
|   |-- plugins/
|   |   \-- development.md
|   |-- setup/
|   |   \-- installation.md
|   |-- workflows/
|   |   \-- command-execution.md
|   \-- active_learning_model_report.md
|-- models/
|   |-- Llama-3.2-1B/
|   |   \-- Llama-3.2-1B-Instruct-Q4_K_M.gguf
|   |-- mobileclip/
|   |   |-- config.json
|   |   |-- mobileclip_s2.onnx
|   |   \-- mobileclip_s2.onnx.data
|   |-- mobilefacenet/
|   |   |-- MobileFaceNet.onnx
|   |   \-- MobileFaceNet.onnx.data
|   |-- paddleocr/
|   |   |-- detection/
|   |   |   |-- inference.json
|   |   |   |-- inference.onnx
|   |   |   \-- inference.yml
|   |   \-- Recognition/
|   |       |-- inference (1).json
|   |       |-- inference.onnx
|   |       \-- inference.yml
|   |-- parakeet/
|   |   |-- decoder.int8.onnx
|   |   |-- encoder.int8.onnx
|   |   |-- joiner.int8.onnx
|   |   \-- tokens.txt
|   \-- scrfd/
|       \-- 2.5g_bnkps.onnx
|-- plugins/
|   |-- chrome/
|   |   |-- index.js
|   |   \-- plugin.json
|   |-- discord/
|   |   |-- index.js
|   |   \-- plugin.json
|   |-- forms/
|   |   |-- index.js
|   |   \-- understanding.js
|   |-- sample_plugin/
|   |   |-- index.js
|   |   \-- plugin.json
|   |-- youtube/
|   |   |-- index.js
|   |   \-- plugin.json
|   \-- plugin-controller.js
|-- scripts/
|   \-- start-electron.js
|-- tests/
|   |-- automation/
|   |   |-- action-confirm.test.js
|   |   |-- action-plan.test.js
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
|   |   |-- remote.test.js
|   |   |-- screenshot-recording.test.js
|   |   |-- system.test.js
|   |   |-- text-repair.test.js
|   |   |-- volume-brightness.test.js
|   |   |-- windows.test.js
|   |   \-- windows-session.test.js
|   |-- core/
|   |   |-- acquisition-layer.test.js
|   |   |-- app-language.test.js
|   |   |-- architecture-structure.test.js
|   |   |-- assistant.test.js
|   |   |-- assistant-intelligence-pipeline.test.js
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
|   |   |-- cloud-file-transfer-manager.test.js
|   |   |-- cloud-pairing-manager.test.js
|   |   |-- command-corpus.test.js
|   |   |-- context-providers.test.js
|   |   |-- crash-recovery.test.js
|   |   |-- data-root.test.js
|   |   |-- decision-automation.test.js
|   |   |-- desktop-action-routing.test.js
|   |   |-- electron-config-ipc.test.js
|   |   |-- electron-security.test.js
|   |   |-- entities.test.js
|   |   |-- entity-understanding.test.js
|   |   |-- fact-recall.test.js
|   |   |-- home-automation.test.js
|   |   |-- home-automation-router.test.js
|   |   |-- home-bluetooth-selection.test.js
|   |   |-- home-command-client.test.js
|   |   |-- home-onboarding.test.js
|   |   |-- input-acquisition.test.js
|   |   |-- intents.test.js
|   |   |-- language-normalization.test.js
|   |   |-- learning-store.test.js
|   |   |-- linguistic-understanding.test.js
|   |   |-- local-llm-fallback.test.js
|   |   |-- logger.test.js
|   |   |-- media-youtube-corpus.test.js
|   |   |-- memory-context.test.js
|   |   |-- models.test.js
|   |   |-- nlp.test.js
|   |   |-- parser.test.js
|   |   |-- performance-memory.test.js
|   |   |-- permissions.test.js
|   |   |-- pipeline-events.test.js
|   |   |-- planner.test.js
|   |   |-- planning.test.js
|   |   |-- profile-sync.test.js
|   |   |-- profile-write.test.js
|   |   |-- reasoning.test.js
|   |   |-- reminder-extraction.test.js
|   |   |-- reminder-removal-routing.test.js
|   |   |-- remote-command-routing.test.js
|   |   |-- renderer-security.test.js
|   |   |-- response-layer.test.js
|   |   |-- responses.test.js
|   |   |-- router.test.js
|   |   |-- scheduler-alert.test.js
|   |   |-- scheduler-targeted-removal.test.js
|   |   |-- security-critical.test.js
|   |   |-- security-lock.test.js
|   |   |-- semantic-understanding.test.js
|   |   |-- settings.test.js
|   |   |-- statement-capture.test.js
|   |   |-- utils.test.js
|   |   |-- validation.test.js
|   |   |-- verification-response.test.js
|   |   \-- voice-production-packaging.test.js
|   |-- media-handling/
|   |   \-- media-handling.test.js
|   \-- ui/
|       |-- chat-renderer.test.js
|       |-- planner-renderer.test.js
|       |-- timer-widget-renderer.test.js
|       \-- voice-renderer.test.js
|-- .gitignore
|-- .mocharc.cjs
|-- AGENTS.md
|-- commands.md
|-- config.js
|-- eslint.config.mjs
|-- package.json
|-- package-lock.json
|-- README.md
\-- report.md
```
