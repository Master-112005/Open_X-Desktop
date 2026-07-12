# Architecture Overview

OpenX follows a deterministic, local-first desktop assistant architecture. The permanent target architecture is defined in [production-finalization.md](production-finalization.md).

## System Architecture

Current command flow:

```text
Chat / phone / voice / cloud / plugin input
  -> Assistant.processCommand()
  -> AssistantEngine
  -> InputSourceManager
  -> Assistant intelligence pipeline
  -> legacy-compatible router boundary
  -> automation or plugin action
  -> verification
  -> response
  -> context and learning
```

The public assistant API remains stable while the internal implementation migrates toward the production pipeline architecture.

## Assistant Runtime Ownership

`AssistantEngine` is the command-processing owner. It coordinates input acquisition, pipeline execution, diagnostics, and the compatibility bridge into the current execution path. It must not own stage-specific business logic.

`PipelineEngine` owns orchestration only: stage ordering, diagnostics, timing, cancellation, errors, and lifecycle.

## Target Pipeline Contract

The assistant pipeline communicates through immutable contracts:

```text
RawUserInput
  -> NormalizedInput
  -> LinguisticGraph
  -> SemanticRepresentation
  -> StructuredEntities
  -> ResolvedContext
  -> ReasoningResult
  -> ExecutionBlueprint
  -> AutomationResult
  -> VerificationResult
  -> AssistantResponse
  -> LearningResult
```

Each layer has one responsibility and must not mutate outputs from previous layers.

## Current Compatibility Boundary

The repository still retains legacy modules such as `router.js`, `parser.js`, `entities.js`, `responses.js`, `language.js`, `nlu.js`, and `nlp/` because production code and regression tests still depend on them. They are compatibility dependencies during migration, not the final architecture.

No legacy file should be deleted until all direct consumers are migrated and the full regression suite remains green.

## External plugins

Forms, YouTube, Chrome, Discord, and communication-specific adapters live under `plugins/`. Loadable plugins declare trust, permission levels, and every core automation action they are allowed to call. Plugin actions and intents must remain inside their own `plugin.<id>.*` namespace.

## Layer Definitions

### 1. Input and Acquisition
- Chat, phone, voice, cloud, plugin, API, OCR, and clipboard inputs
- Standard `RawUserInput` contract

### 2. Intelligence Pipeline
- Normalization
- Linguistic analysis
- Semantic analysis
- Entity understanding
- Memory/context
- Reasoning
- Planning
- Decision and validation

### 3. Automation Layer (`core/automation/`)
- File operations
- Application control
- System monitoring
- Windows OS commands

### 4. Verification, Response, and Learning
- Execution verification
- Deterministic response generation
- Responsible local learning

### 5. Data and Event Layer (`core/assistant/Data.js`)
- Shared event bus for voice, assistant, and UI modules
- Standard lifecycle events including:
  - `wakeword.detected`
  - `listener.started`
  - `speech.detected`
  - `utterance.finalized`
  - `stt.completed`
  - `intent.detected`
  - `command.executed`
  - `response.generated`
  - `ui.state.changed`

### 6. Desktop UI Layer (`apps/desktop/renderer/`)
- Electron renderer surfaces own chat, settings, notifications, and schedule alerts
- UI never executes automation directly
- Voice and chat stay as presentation surfaces over the same backend

## Key Design Rules

- **UI never executes automation directly**: all commands go through the router
- **Voice and chat share the same assistant boundary**: identical backend execution path
- **No LLM dependencies**: purely deterministic pattern matching and routing
- **Modular automation**: each capability is isolated in its own module
- **Event-driven coordination**: voice, assistant, and UI communicate through lifecycle events
- **Explicit speech states**: idle, wake detected, listening, hearing speech, processing, responding, error
