# OpenX Repository Report

Report date: 2026-07-14

Repository: `OpenX`

Package: `openx`

Version source: `package.json`

Current version: `6.8.15`

Branch / commit: `main` / `a264616`

## Scope Scanned

- Desktop Electron app under `apps/desktop`.
- Assistant core under `core/assistant`.
- Cloud connection, E2EE, pairing, command, and file transfer modules under `core/cloud`.
- Automation, communication, context, response, learning, linguistic, semantic, validation, verification, memory, and pipeline layers under `core`.
- Desktop renderer UI, dynamic island, chat, planner, settings, security lock, and cloud pairing surfaces.
- Test suites under `tests`.
- Package/build configuration in `package.json`, `package-lock.json`, `config.js`, and Electron builder settings.

Approximate scan size:

- `621` files under `core`, `apps`, and `tests`.
- `58+` core test files under `tests/core`.

## Current Working Tree

The repository is actively modified. Current modified areas include:

- `core/assistant/automation/ActionRouter.js`
- `core/assistant/context/ContextManager.js`
- `core/assistant/index.js`
- `core/assistant/response/ResponseGenerator.js`
- assistant learning, language, entity, semantic, parser, NLU, and tests
- `package.json`

These modifications are not reverted or discarded. The report reflects the current workspace state.

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

Known caveat:

- Full `tests/core/assistant.test.js` still has unrelated expectation failures around normalized casing, time punctuation, and feedback prompt behavior. Those failures existed outside the latest plural-app follow-up change and should be handled in a dedicated cleanup pass.

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

### Cloud Pairing, Devices, And File Transfer

- Desktop cloud pairing QR, approval/rejection, status, and device list paths are present.
- Desktop cloud file transfer manager is wired for incoming transfer prompts, progress, accept/reject, and presence updates.
- Desktop cloud E2EE helpers are present under `core/cloud/CloudE2EE.js`.
- Pair box metadata is consumed when displaying connected devices.

### Crash Recovery And Resource Handling

- Electron main has unresponsive-window tracking and crash recovery timers.
- Cleanup clears recovery and unresponsive timers during shutdown.
- Voice/runtime prewarm and overlay state are present, but full runtime profiling should be done with the app running under real workload.

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
- infer platform when not explicit;
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
- recurrence;
- snooze;
- stop/cancel;
- list/clear;
- local planner/calendar integration;
- mobile sync through cloud command paths.

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

## Blockers And Risks

1. Full assistant suite drift

   Some assistant tests still expect old raw routed text while the current assistant normalizes route input. This is a test-contract cleanup issue unless a specific behavior regression is observed.

2. Desktop app close verification

   The assistant can now report partial close failures cleanly, but actual Windows app closure still depends on process/window matching in automation. Apps with multiple processes or background tray behavior may still appear open after a close request.

3. Cloud E2EE coverage

   E2EE primitives and packet wrapping exist, but every command, notification, schedule sync, and file-transfer path should continue to be audited for plaintext fallback.

4. Performance validation

   Lint and corpus routing pass. Runtime CPU/RAM validation still needs an instrumented desktop session with voice, dynamic island, cloud connection, notifications, and file transfers active.

5. Dirty working tree

   Many assistant files are modified. Before release, run a clean full validation pass and review all changed files as one integration set.

## Recommended Next Actions

1. Normalize the full `tests/core/assistant.test.js` expectations where current behavior intentionally lowercases or normalizes routed input.
2. Add end-to-end tests for:
   - `open chrome and instagram and whatsapp`
   - `close them`
   - partial close failure for one app while others close
   - repeated `open them` or `switch to them` follow-ups
3. Add runtime profiling for:
   - idle assistant
   - voice prewarm
   - dynamic island notifications
   - cloud reconnect
   - large file transfer
4. Add a release checklist requiring:
   - `npm run lint`
   - assistant command corpus
   - cloud pairing test
   - cloud file transfer test
   - notification grouping test
   - installer smoke test

## Full Filtered Directory Tree

Excluded generated/local-heavy paths:

- `node_modules/`
- `.git/`
- `dist/`
- `graphify-out/`
- `.codex/`
- `.code-review-graph/`
- `.agents/`

```text
OpenX/
|-- .github
|   `-- workflows
|-- apps
|   `-- desktop
|       |-- electron
|       |   |-- crash-recovery.js
|       |   |-- main.js
|       |   `-- security.js
|       |-- renderer
|       |   |-- chat
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   |-- planner
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   |-- timer-widget
|       |   |   |-- index.css
|       |   |   |-- index.html
|       |   |   `-- index.js
|       |   `-- voice-capture
|       |       |-- index.html
|       |       `-- index.js
|       |-- voice
|       |   |-- audio
|       |   |   |-- AudioBuffer.js
|       |   |   |-- AudioCapture.js
|       |   |   |-- AudioConfiguration.js
|       |   |   |-- AudioDeviceManager.js
|       |   |   |-- AudioErrors.js
|       |   |   |-- AudioEvents.js
|       |   |   |-- AudioFrame.js
|       |   |   |-- AudioPermissions.js
|       |   |   `-- index.js
|       |   |-- config
|       |   |   `-- VoiceSettings.js
|       |   |-- diagnostics
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
|       |   |-- integration
|       |   |   |-- AssistantDispatcher.js
|       |   |   |-- AssistantInputAdapter.js
|       |   |   |-- index.js
|       |   |   |-- VoiceAssistantBridge.js
|       |   |   |-- VoiceExecutionCoordinator.js
|       |   |   |-- VoiceIntegrationConfiguration.js
|       |   |   |-- VoiceIntegrationErrors.js
|       |   |   |-- VoiceIntegrationEvents.js
|       |   |   `-- VoiceResponseHandler.js
|       |   |-- normalization
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
|       |   |-- preprocessing
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
|       |   |-- session
|       |   |   |-- SessionEvents.js
|       |   |   |-- VoiceSession.js
|       |   |   |-- VoiceSessionManager.js
|       |   |   `-- VoiceStateMachine.js
|       |   |-- stt
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
|       |   |-- ui
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
|-- build
|   |-- icon.ico
|   |-- icon.png
|   |-- ICON_README.md
|   |-- installer.nsh
|   `-- openx-chrome-host.exe
|-- core
|   |-- assistant
|   |   |-- acquisition
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
|   |   |-- automation
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
|   |   |-- context
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
|   |   |-- contracts
|   |   |   |-- ErrorContract.js
|   |   |   |-- index.js
|   |   |   |-- LoggerContract.js
|   |   |   |-- PipelineConfigurationContract.js
|   |   |   |-- PipelineContextContract.js
|   |   |   |-- PipelineEventsContract.js
|   |   |   |-- PipelineResultContract.js
|   |   |   |-- PipelineStageContract.js
|   |   |   `-- StageResultContract.js
|   |   |-- decision
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
|   |   |-- entities
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
|   |   |   `-- WindowExtractor.js
|   |   |-- events
|   |   |   |-- index.js
|   |   |   |-- PipelineEventDispatcher.js
|   |   |   `-- PipelineEvents.js
|   |   |-- learning
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
|   |   |   `-- WorkflowStore.js
|   |   |-- linguistic
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
|   |   |-- memory
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
|   |   |-- models
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
|   |   |-- normalization
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
|   |   |-- pipeline
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
|   |   |-- planning
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
|   |   |-- reasoning
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
|   |   |-- references
|   |   |   |-- AliasResolver.js
|   |   |   |-- ContextResolver.js
|   |   |   |-- ConversationResolver.js
|   |   |   |-- index.js
|   |   |   |-- PronounResolver.js
|   |   |   |-- ReferenceGraphBuilder.js
|   |   |   `-- ReferenceResolver.js
|   |   |-- response
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
|   |   |-- semantic
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
|   |   |-- utils
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
|   |   |-- validation
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
|   |   |-- verification
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
|   |-- automation
|   |   |-- common
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
|   |-- cloud
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
|   |-- communication
|   |   |-- CommunicationEngine.js
|   |   |-- CommunicationErrors.js
|   |   |-- CommunicationEvents.js
|   |   |-- CommunicationProvider.js
|   |   |-- CommunicationProviderManager.js
|   |   |-- CommunicationResult.js
|   |   |-- index.js
|   |   `-- OperationScheduler.js
|   `-- context-awareness
|       |-- active-window.js
|       |-- app-registry.js
|       |-- context-engine.js
|       |-- mode-engine.js
|       |-- process-monitor.js
|       `-- signals.js
|-- docs
|   |-- architecture
|   |   |-- overview.md
|   |   |-- production-finalization.md
|   |   `-- repository-audit.md
|   |-- modules
|   |   |-- assistant-communication.md
|   |   |-- communications.md
|   |   |-- core-engine.md
|   |   |-- nlp-pipeline.md
|   |   `-- settings.md
|   |-- plugins
|   |   `-- development.md
|   |-- setup
|   |   `-- installation.md
|   `-- workflows
|       `-- command-execution.md
|-- models
|   `-- parakeet
|       |-- decoder.int8.onnx
|       |-- encoder.int8.onnx
|       |-- joiner.int8.onnx
|       `-- tokens.txt
|-- plugins
|   |-- chrome
|   |   |-- index.js
|   |   `-- plugin.json
|   |-- discord
|   |   |-- index.js
|   |   `-- plugin.json
|   |-- forms
|   |   |-- index.js
|   |   `-- understanding.js
|   |-- sample_plugin
|   |   |-- index.js
|   |   `-- plugin.json
|   |-- youtube
|   |   |-- index.js
|   |   `-- plugin.json
|   `-- plugin-controller.js
|-- scripts
|   `-- start-electron.js
|-- tests
|   |-- automation
|   |   |-- apps.test.js
|   |   |-- automation.test.js
|   |   |-- browser.test.js
|   |   |-- communications.test.js
|   |   |-- file-management.test.js
|   |   |-- media.test.js
|   |   |-- volume-brightness.test.js
|   |   `-- windows-session.test.js
|   |-- context-awareness
|   |   |-- context-awareness.test.js
|   |   `-- mode-engine.test.js
|   |-- core
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
|   |   |-- command-corpus.test.js
|   |   |-- communication-engine.test.js
|   |   |-- context-providers.test.js
|   |   |-- contracts.test.js
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
|   |   |-- models.test.js
|   |   |-- nlp.test.js
|   |   |-- nlu.test.js
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
|   |   `-- voice-subsystem.test.js
|   |-- media-handling
|   |   `-- media-handling.test.js
|   `-- ui
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
