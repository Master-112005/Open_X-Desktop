# OpenX

OpenX is a deterministic, local-first Windows desktop assistant built with Electron and Node.js. It routes natural-language commands for desktop automation, browser control, files and folders, media, scheduling, planner entries, phone integration, and local voice interaction.

Current package version: `3.9.0`

## Current Status

- Production assistant pipeline for chat, phone, and voice-derived text.
- Local command processing through NLP, NLU, parser, router, NLE, automation, verification, response generation, context, and active learning.
- Local voice subsystem with Sherpa-ONNX/Parakeet STT, RNNoise/VAD preprocessing, transcript normalization, continuous voice sessions, Dynamic Island voice UI, and TTS turn-taking.
- Phone pairing, permission checks, session validation, command routing, and file transfer support for OpenX Mobile.
- Calendar, timetable, reminders, timers, alarms, snooze, stopwatch, and Dynamic Island alert display.
- Managed runtime storage under `%USERPROFILE%\OpenX_Data`.
- Plugin support for isolated Chrome, YouTube, Discord, forms, and communications integrations.
- Test coverage for core assistant behavior, automation, context awareness, phone security/file transfer, voice subsystem, and renderer UI.

## Command Pipeline

```text
Chat / phone / voice text
  -> NLP normalization and repair
  -> NLU and context interpretation
  -> parser and entity extraction
  -> intent resolution
  -> validation and permission checks
  -> NLE execution boundary
  -> automation or plugin action
  -> postcondition verification
  -> response generation
  -> context and active-learning updates
  -> OpenX_Data persistence
```

The assistant remains input-source agnostic. Chat, voice, and phone commands all enter the same `Assistant.processCommand(text, source)` contract.

## Main Modules

| Area | Path | Responsibility |
|---|---|---|
| Assistant core | `core/assistant/` | NLP, NLU, parser, router, NLE, responses, context, learning, data handling |
| Automation | `core/automation/` | Apps, browser, files, folders, media, planner, scheduler, system, volume, brightness, windows |
| Phone integration | `core/phone/` | Pairing, sessions, permissions, WebSocket server, command routing, file transfer |
| Desktop app | `apps/desktop/` | Electron lifecycle, IPC, renderer UI, settings, security, crash recovery |
| Voice | `apps/desktop/voice/` | Audio capture, preprocessing, STT, normalization, session lifecycle, voice UI, diagnostics, TTS |
| Plugins | `plugins/` | Restricted external integration packages |
| Tests | `tests/` | Core, automation, context, phone, voice, and UI regression coverage |

## Data Storage

OpenX stores runtime data under:

```text
%USERPROFILE%\OpenX_Data\
```

This managed root includes settings, schedules, planner data, learning state, logs, voice diagnostics, phone pairing/device state, file transfer history, received phone files, media runtime data, screenshots, and temporary transfer files. Legacy `.jarvis` data is migrated where supported.

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

NSIS installer package:

```powershell
npm run package
```

The packaged app includes `apps/`, `core/`, `plugins/`, `config.js`, `package.json`, the Parakeet model files, and the Chrome native host binary.

## Documentation

- `report.md`: detailed implementation report, critical method reference, and full filtered project tree.
- `commands.md`: command-language regression corpus.
- `docs/architecture/overview.md`: architecture overview.
- `docs/workflows/command-execution.md`: command execution workflow.
- `docs/plugins/development.md`: plugin development rules.
