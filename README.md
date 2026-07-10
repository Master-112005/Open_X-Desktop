# OpenX

OpenX is a deterministic, local-first Windows desktop assistant built with Electron 28, Node.js, and CommonJS. It understands chat, voice, phone, and cloud-delivered text commands, then routes them through the same assistant pipeline for validation, automation, verification, response generation, context, and learning.

Current package version: `5.5.1`

## What OpenX Does

- Opens and controls local apps, browser tabs, folders, files, media, windows, volume, brightness, and system utilities.
- Handles reminders, alarms, timers, stopwatch, calendar entries, and timetable entries.
- Understands flexible reminder language, including scheduled `remember`, `note`, and `save` phrases when a date, time, or duration is present.
- Searches local files and folders with typo tolerance and clarification prompts for ambiguous matches.
- Supports OpenX Mobile pairing, trusted-device permissions, phone command routing, and local/cloud file transfer.
- Supports optional desktop cloud relay mode for command packets, pairing requests, presence, notifications, and file-transfer packets.
- Runs local voice sessions with audio preprocessing, STT, transcript normalization, Dynamic Island voice UI, and TTS.
- Stores runtime data locally under `%USERPROFILE%\OpenX_Data`.
- Keeps plugins isolated behind the assistant command and automation boundaries.

## Command Flow

```text
chat / voice / phone / cloud text
  -> input acquisition
  -> language normalization
  -> linguistic understanding
  -> semantic understanding
  -> entity understanding
  -> memory and context
  -> intent and goal reasoning
  -> task planning
  -> decision, validation, and automation dispatch
  -> verification and response generation
  -> learning update
```

All command sources enter through the same public assistant contract:

```js
Assistant.processCommand(text, source, options)
```

## Main Areas

| Area | Path | Responsibility |
|---|---|---|
| Desktop app | `apps/desktop/` | Electron lifecycle, IPC, renderer UI, settings, crash recovery, identity verification |
| Assistant core | `core/assistant/` | Input, normalization, language understanding, entities, memory, reasoning, planning, decisions, validation, automation bridge, verification, response, learning |
| Automation | `core/automation/` | Apps, browser, files, folders, media, planner, scheduler, system, volume, brightness, windows |
| Phone | `core/phone/` | Pairing, sessions, permissions, command routing, WebSocket server, file transfer |
| Cloud | `core/cloud/` | Relay connection, pairing, command packets, file transfer, presence, notifications |
| Voice | `apps/desktop/voice/` | Capture, preprocessing, STT, normalization, voice sessions, diagnostics, voice UI, TTS |
| Plugins | `plugins/` | Chrome, YouTube, Discord, forms, communications, sample plugin |
| Tests | `tests/` | Core, automation, context, phone, cloud, voice, renderer, planner, widgets |

## Runtime Data

OpenX stores managed local data under:

```text
%USERPROFILE%\OpenX_Data\
```

Important files and folders include:

- `settings.json`
- `schedules.json`
- `planner.json`
- `learning/`
- `logs/`
- `voice/diagnostics/`
- `phone/`
- `cloud/connection.log`
- `screenshots/`
- `runtime/phone-transfer/`
- `received/`

## Optional Cloud Relay

OpenX works offline for local automation, local voice, local schedules, and local phone pairing. Cloud relay mode is optional and is controlled from `Settings -> Phone -> Cloud`.

Cloud mode supports:

- Desktop relay connect/disconnect.
- Relay QR pairing.
- Desktop approval or rejection of incoming pair requests.
- Cloud command packets routed into the same assistant command path.
- Metadata-first cloud file transfer with chunk acknowledgements and SHA-256 verification.
- Presence and notification packets for paired devices.

Default relay URL:

```text
wss://openx-server.onrender.com/ws
```

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

## Test

```powershell
npm test
npm run test:core
npm run test:automation
npm run test:context
npm run test:learning
npm run test:ui
npm run lint
```

Full validation:

```powershell
npm run validate
```

## Package

Directory build:

```powershell
npm run build
```

NSIS installer:

```powershell
npm run package
```

## Documentation

- `report.md`: detailed repository report with critical methods, runtime surfaces, validation notes, and directory tree.
- `commands.md`: command-language regression corpus.
- `docs/architecture/overview.md`: architecture overview.
- `docs/architecture/production-finalization.md`: target assistant architecture.
- `docs/architecture/repository-audit.md`: repository ownership and dependency audit.
- `docs/workflows/command-execution.md`: command execution workflow.
- `docs/plugins/development.md`: plugin development rules.
