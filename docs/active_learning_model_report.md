# OpenX Active Learning Model Report

Report date: 2026-07-29

Repository: `OpenX`

Package: `openx`

Version source: `package.json`

Current version: `10.2.12`

Primary scope:

- `core/assistant/learning`
- `core/assistant/index.js`
- `core/assistant/pipeline/PipelineManager.js`
- `core/assistant/automation/ActionRouter.js`
- `core/assistant/Data.js`
- `apps/desktop/settings.js`
- `core/assistant/capabilities/visual-memory/runtime/learning`
- Learning-related tests under `tests/core`

This document describes only the OpenX active-learning system: how it learns, where it stores data, how it uses learned data, what safety controls exist, and how the learning model connects to assistant routing, response generation, context, and visual memory.

## Executive Summary

OpenX active learning is a local-first deterministic personalization system. It is not a neural network training system, not an LLM fine-tuning system, and not a cloud learning pipeline. The learning layer records small, bounded, user-controlled facts, preferences, corrections, feedback, aliases, usage patterns, and workflow hints in local JSON stores under `OpenX_Data`.

The active-learning system currently has four cooperating layers:

| Layer | Main files | Purpose |
|---|---|---|
| Direct assistant learning store | `ActiveLearningStore.js` | Live assistant memory used by command routing, corrections, preferences, user facts, feedback prompts, and personal-memory answers. |
| Active Learning v2 manager | `ActiveLearningManager.js` plus split stores | Structured approval-based alias, correction, preference, workflow, and usage stores. |
| Learning engine v3 | `LearningManager.js`, `LearningPipeline.js`, `LearningStage.js`, `LearningStorage.js`, `PersonalizationProfileStore.js` | Post-response learning pipeline with modules, policy, constitution, diagnostics, and a local personalization profile. |
| Visual Memory learning | `core/assistant/capabilities/visual-memory/runtime/learning/*` | Local visual-search feedback, correction, preference, ranking, recommendation, undo, reset, and export layer. |
| Advanced user learning | `core/assistant/personal-memory`, `core/assistant/home-learning`, new v3 learning modules | Encrypted personal/contact memory, favorite preference scoring, routine-time learning, home-device event learning, appliance patterns, and action sequences. |

The most important production rule is that learning must improve future behavior without storing secrets, private communication content, temporary health/emotional states, or unsafe automation permissions.

## Advanced User Learning Update

The 2026-07-29 advanced learning pass extends the existing model without replacing it.

New capabilities:

- favorite contact, song, artist, playlist, food, restaurant, TV channel, streaming service, room, wake time, bedtime, and eating-time preference learning;
- external-event learning through `LearningManager.learnExternalEvent(event, metadata)`;
- encrypted personal-memory vault for people, contact methods, and relationships;
- routine-time observation learning with circular clock-time statistics;
- home-device event collection, validation, deduplication, device registry, context building, device preferences, appliance patterns, and short action sequences;
- compact profile events for learned summaries while raw sensitive contact values remain outside ordinary learning logs.

New folders:

```text
core/assistant/personal-memory/
core/assistant/home-learning/
core/assistant/learning/routines/
```

New pipeline modules:

| Module | Priority | Learns |
|---|---:|---|
| `PersonalPreferenceLearning` | `35` | Favorite contacts, songs, artists, playlists, foods, restaurants, TV channels, streaming services, rooms, and preferred routine times. |
| `RoutineTimeLearning` | `42` | Wake, bedtime, meal, media, and device routine observations from external events. |
| `HomeEventLearning` | `44` | Fan speed, light brightness, TV-channel preferences, room/time appliance patterns, home routines, event deduplication, and bounded N-gram action sequences from device events. |

New storage paths under `OpenX_Data`:

| Path | Purpose |
|---|---|
| `OpenX_Data/personal/personal-vault.db` | Encrypted personal vault records. |
| `OpenX_Data/personal/personal-vault.key` | Local vault encryption key. |
| `OpenX_Data/home-learning/home-learning.db` | Append-only home-event store with duplicate suppression. |
| `OpenX_Data/home-learning/devices.json` | Stable household device registry. |
| `OpenX_Data/home-learning/sequences.json` | Learned short home-action sequence summaries. |
| `OpenX_Data/learning/routines/observations.jsonl` | Append-only routine observations. |
| `OpenX_Data/learning/routines/summaries.json` | Compact learned routine summaries. |

The home-learning event store currently uses an append-only local database file and JSON summary stores so OpenX does not need a native SQLite dependency in the desktop package. The repository boundary is separated so the storage backend can be replaced later without changing the learning modules.

## What The Active Learning Model Is

The OpenX active-learning model is a rule-and-evidence model. It does not train weights like a neural network. Instead, it uses:

- explicit user statements;
- repeated evidence across commands;
- post-action validation and verification results;
- user feedback after uncertain or high-impact commands;
- correction and repair phrases;
- locally stored preference records;
- bounded usage and workflow counters;
- visual-memory result feedback and ranking adjustments.

The model output is a small set of behavioral adaptations:

- rewrite a future command that the user corrected;
- prefer a browser, search mode, media platform, photo library, or reminder category;
- answer safe personal-memory questions;
- decide whether to ask for feedback;
- rank visual-memory results differently after user feedback;
- suggest aliases, workflows, or corrections only after enough evidence;
- avoid persisting unsafe or private information.

## What The Active Learning Model Is Not

The learning layer deliberately does not:

- upload learned data to a server;
- store private keys, passwords, OTPs, access tokens, API keys, card details, or banking data;
- learn from private message bodies;
- auto-grant automation permissions;
- retrain text, vision, face-recognition, or language models;
- fine-tune an LLM;
- create cross-user shared behavior;
- auto-name people in the gallery;
- permanently remember temporary user states such as "I am cold" or "I am tired" as user facts.

## High-Level Workflow

```text
User input
  -> acquisition and normalization
  -> linguistic and semantic understanding
  -> context and memory resolution
  -> direct active-learning checks
       - apply learned correction
       - detect explicit learning
       - answer safe personal-memory question
  -> action routing and entity extraction
  -> learned entity adaptation
       - browser/search preference
       - media platform preference
       - reminder category preference
  -> automation execution
  -> validation and verification
  -> response generation
  -> feedback opportunity scoring
  -> post-response learning stage
       - correction learning
       - alias learning
       - preference learning
       - habit learning
       - workflow learning
       - conversation metadata learning
       - usage learning
       - pattern learning
       - feedback learning
  -> local storage under OpenX_Data
```

## Active Learning Data Root

OpenX resolves all assistant learning data through `core/assistant/Data.js`.

Default data root:

```text
%USERPROFILE%\OpenX_Data
```

Override options:

```text
config.app.dataDir
OPENX_DATA_DIR
```

The data root helper creates the main runtime folders and migrates legacy data from the older `.jarvis` location when possible. Learning files use atomic writes, backups, corrupt-file quarantine, and size limits.

## Learning Storage Map

| File or folder | Owner | Stored data |
|---|---|---|
| `OpenX_Data/learning.json` | `ActiveLearningStore` | Direct command rewrites, preferences, user facts, feedback, mistakes, prompts, routing evidence, command sequences. |
| `OpenX_Data/learning/aliases.json` | `AliasStore` | Approved aliases and observed alias suggestions. |
| `OpenX_Data/learning/preferences.json` | `PreferenceStore` | Approved preferences such as browser, editor, terminal, media player, theme, language, timezone. |
| `OpenX_Data/learning/corrections.json` | `CorrectionStore` | Approved command corrections and observed correction suggestions. |
| `OpenX_Data/learning/workflows.json` | `WorkflowStore` | Approved repeated command sequences. |
| `OpenX_Data/learning/usage_stats.json` | `UsageStatsStore` | Bounded local usage counters and ranked usage metadata. |
| `OpenX_Data/learning/v3/preferences.json` | `LearningStorage` | Event-based v3 preference learning records. |
| `OpenX_Data/learning/v3/aliases.json` | `LearningStorage` | Event-based v3 alias records. |
| `OpenX_Data/learning/v3/corrections.json` | `LearningStorage` | Event-based v3 correction records. |
| `OpenX_Data/learning/v3/habits.json` | `LearningStorage` | Event-based repeated habit records. |
| `OpenX_Data/learning/v3/patterns.json` | `LearningStorage` | Event-based repeated pattern records. |
| `OpenX_Data/learning/v3/statistics.json` | `LearningStorage` | Event-based usage/statistical learning records. |
| `OpenX_Data/learning/v3/workflows.json` | `LearningStorage` | Event-based workflow records. |
| `OpenX_Data/learning/v3/feedback.json` | `LearningStorage` | Event-based feedback records. |
| `OpenX_Data/learning/v3/conversation.json` | `LearningStorage` | Redacted conversation metadata, not private message content. |
| `OpenX_Data/learning/v3/personalization_profile.json` | `PersonalizationProfileStore` | Consolidated confidence-scored profile and audit state. |

## Core Runtime Integration

### Assistant Construction

File: `core/assistant/index.js`

The assistant creates or receives the learning dependency during construction:

```text
dependencies.learning
  or new ActiveLearningStore(config)
```

That same learning store is passed to `ActionRouter`, so routing can use learned corrections and preferences while staying inside the assistant process.

### Pipeline Integration

File: `core/assistant/pipeline/PipelineManager.js`

The default pipeline includes `LearningStage` after execution and response shaping:

```text
normalization
  -> linguistic
  -> semantic
  -> entities
  -> memory
  -> visual stages
  -> reasoning
  -> planning
  -> decision automation
  -> verification response
  -> execution
  -> learning
```

The learning stage order is `0.25`, which means learning runs after the assistant has a response and action result. This prevents learning from changing the current command while still letting it improve future commands.

### Router Integration

File: `core/assistant/automation/ActionRouter.js`

The router uses learning in two important places:

- `adaptEntities(intentId, entities)` adjusts resolved entities from learned preferences.
- routing evidence is recorded so future feedback prompts and learning diagnostics can understand what happened.

The router also avoids treating learning-repair phrases as normal automation commands.

## Direct Assistant Learning Store

File: `core/assistant/learning/ActiveLearningStore.js`

This is the live learning store used most directly by the assistant. It is responsible for immediate personalization behavior.

### Main Responsibilities

- Learn explicit corrections.
- Learn safe user preferences.
- Learn safe personal facts.
- Reject protected secrets.
- Reject private communication persistence.
- Avoid learning scheduled reminders as personal possessions.
- Avoid learning temporary wellbeing states as identity facts.
- Reuse learned command rewrites.
- Adapt command entities.
- Track feedback and mistakes.
- Decide when to ask "Did that work correctly?"
- Answer personal-memory questions.
- Store data in `OpenX_Data/learning.json`.

### Important Methods

| Method | Responsibility |
|---|---|
| `rememberCorrection(input, correction, metadata)` | Stores an explicit command rewrite with confidence, timestamps, source, and use count. |
| `findCorrection(input)` | Finds exact or fuzzy command corrections and increments use count. |
| `rememberPreference(kind, value, metadata)` | Stores a safe preference, then prunes to the preference cap. |
| `getPreference(kind)` | Reads a stored preference record. |
| `rememberUserFact(kind, value, metadata)` | Stores safe user facts such as name, school, workplace, favorites, location, or explicit profile facts. |
| `getUserFact(kind)` | Reads a safe user fact. |
| `getAllUserFacts()` | Returns all safe stored user facts. |
| `getUserIdentitySummary()` | Builds a compact identity summary from stored facts. |
| `answerPersonalQuestion(input)` | Answers questions such as "what is my name" or "who am I" from local memory. |
| `learnFromText(input)` | Parses explicit user learning statements. |
| `adaptEntities(intentId, entities)` | Applies preferences to routed command entities. |
| `recordFeedback(entry)` | Stores success, failure, or correction feedback after an action. |
| `recordRoutingEvidence(entry)` | Stores recent routing evidence for diagnostics and feedback scoring. |
| `shouldAskForFeedback(entry)` | Scores whether a feedback prompt is useful and not repetitive. |
| `recordFeedbackPrompt(entry)` | Records that the assistant already asked for feedback. |
| `getLearningInsights()` | Returns recent learning and prompt diagnostics. |
| `correctLearning(entry)` | Repairs an existing learned fact, correction, or preference. |
| `flush()` | Forces pending async writes to disk. |

### Direct Store Caps

| Data type | Cap |
|---|---:|
| Feedback events | `200` |
| Mistake events | `200` |
| Command rewrites | `100` |
| Feedback prompts | `100` |
| Routing evidence | `200` |
| Preferences | `100` |
| User facts | `150` |

### Explicit Learning Examples

The direct store can learn commands like:

```text
when I say open work, open VS Code
my name is Rakesh
call me Rakesh
use YouTube for music
open searches in browser
keep searches in background
use Photos as my photo library
```

It refuses protected cases like:

```text
remember my password is ...
my OTP is ...
my API key is ...
my private key is ...
```

### Personal Memory Behavior

The assistant can answer safe memory questions using local data:

```text
what is my name
where do I work
where do I study
what is my favorite food
who am I
```

The store also prevents password retrieval. If the user asks about a saved password or similar credential, the assistant must not return a secret.

### Transient Human State Handling

The direct store uses semantic human-state detection so statements such as these are not permanently saved as identity facts:

```text
I am cold
I am tired
I feel sick
I am anxious
```

Those inputs should be handled by response and wellbeing logic, not stored as stable personal facts.

## Active Learning v2 Manager

File: `core/assistant/learning/ActiveLearningManager.js`

The v2 manager separates active-learning data into focused JSON stores. Its design is more approval-based than the direct store.

### Managed Stores

| Store | File | Main purpose |
|---|---|---|
| `AliasStore` | `aliases.json` | Learns that a user phrase points to an app, website, folder, file, or command. |
| `PreferenceStore` | `preferences.json` | Stores approved user preferences. |
| `CorrectionStore` | `corrections.json` | Stores approved corrections after repeated evidence or user approval. |
| `WorkflowStore` | `workflows.json` | Stores repeated multi-command workflows. |
| `UsageStatsStore` | `usage_stats.json` | Stores bounded local usage counters. |

### Important Methods

| Method | Responsibility |
|---|---|
| `learnAlias(aliasKey, target)` | Observes an alias use and suggests learning after enough evidence. |
| `approveAlias(aliasKey, target, category)` | Persists an alias after user approval. |
| `resolveAlias(aliasKey)` | Resolves a stored alias. |
| `setPreference(kind, value, source)` | Stores an approved preference. |
| `getPreferredValue(kind)` | Returns a stored preference value. |
| `recordCorrection(input, resolvedValue)` | Observes a correction and suggests learning after enough evidence. |
| `approveCorrection(input, resolvedValue)` | Persists a correction after approval. |
| `resolveCorrection(input)` | Resolves a stored correction. |
| `recordCommandSequence(commands, sourceInput)` | Observes repeated command sequences. |
| `approveWorkflow(name, commands, category)` | Stores a workflow after approval. |
| `executeWorkflow(name)` | Returns the stored commands for a workflow. |
| `recordUsage(itemKey, increment)` | Updates usage statistics. |
| `getPendingSuggestions()` | Lists pending alias, correction, and workflow suggestions. |
| `getLearningOverview()` | Returns a bounded status summary across all stores. |
| `handleUserCommand(command)` | Handles learning-management commands like showing or resetting learning data. |
| `resetActiveLearning()` | Clears all v2 active-learning stores. |

### Approval Thresholds

The v2 learning model is intentionally conservative:

- first occurrence: observe only;
- second occurrence: keep observing;
- third occurrence: ready to ask the user whether to remember it.

This pattern is used by aliases, corrections, and workflows so that OpenX does not immediately persist accidental wording.

### Store Limits

| Store | Limit |
|---|---:|
| Alias occurrence buffer | `200` |
| Corrections | `500` |
| Correction occurrence buffer | `200` |
| Workflows | `50` |
| Commands per workflow | `20` |
| Workflow sequence buffer | `100` |
| Preferences | `100` |
| Usage tracked items | `1000` |
| Base JSON file size default | `1 MB` |

## Base Store Safety

File: `core/assistant/learning/BaseStore.js`

The v2 stores inherit common JSON safety behavior:

- absolute path resolution;
- parent directory creation;
- schema validation;
- atomic write using a temporary file;
- backup of the last valid state;
- corrupt primary JSON quarantine;
- backup recovery;
- max file size protection;
- no leftover temporary files in normal operation;
- protection against unsafe store paths and symlink write targets.

This is important because active learning data is user-specific state and must survive app restarts without corrupting the assistant.

## Learning Engine v3

Files:

- `LearningManager.js`
- `LearningPipeline.js`
- `LearningStage.js`
- `LearningContext.js`
- `LearningRegistry.js`
- `LearningStorage.js`
- `LearningPolicy.js`
- `LearningConstitution.js`
- `LearningGuard.js`
- `LearningResult.js`
- `PersonalizationProfileStore.js`

The v3 engine is a staged event pipeline. It learns after an assistant response exists and stores only approved, policy-valid events.

### Default Configuration

File: `LearningConfiguration.js`

| Setting | Default |
|---|---:|
| Version | `12.0.0` |
| Minimum confidence | `0.7` |
| Habit threshold | `3` |
| Pattern threshold | `5` |
| Workflow threshold | `3` |
| Max records | `500` |
| Module timeout | `250 ms` |
| Max events per run | `100` |
| Max diagnostics | `100` |
| Max metadata entries | `40` |
| Learn conversation content | `false` |
| Local personalization profile | `true` |

### Default Modules

`LearningManager` registers these modules in priority order:

| Priority | Module | Purpose |
|---:|---|---|
| 10 | `CorrectionLearning` | Learns explicit and natural correction feedback. |
| 20 | `AliasLearning` | Learns phrase-to-target aliases. |
| 30 | `PreferenceLearning` | Learns user preferences. |
| 40 | `HabitLearning` | Learns repeated successful habits. |
| 50 | `WorkflowLearning` | Learns repeated command sequences. |
| 60 | `ConversationLearning` | Learns redacted response/source metadata, not private content. |
| 70 | `UsageLearning` | Learns usage statistics. |
| 80 | `PatternLearning` | Learns repeated command patterns. |
| 90 | `FeedbackLearning` | Learns explicit positive/negative feedback. |

### Learning Pipeline Workflow

```text
Assistant response and execution result
  -> LearningStage
  -> LearningManager.learn()
  -> LearningPipeline.create LearningContext
  -> for each registered module:
       - initialize module if needed
       - check supports(context)
       - run module.learn(context)
       - enforce module timeout
       - record diagnostics
  -> LearningPolicy validates accepted events
  -> LearningStorage commits category JSON files
  -> PersonalizationProfileStore applies accepted events
  -> LearningResult returned and attached to assistant response
```

### Learning Context

`LearningContext` keeps learning runs bounded and auditable. It tracks:

- input command;
- source;
- assistant response;
- action result;
- accepted events;
- rejected events;
- module diagnostics;
- metadata;
- predicted counts that include existing storage, pending events, and current action count.

### Learning Result

`LearningResult` is immutable. It contains:

- success state;
- accepted events;
- rejected events;
- diagnostics;
- insights;
- errors;
- timing;
- metadata.

The immutability prevents later code from accidentally modifying learning results after they are attached to the assistant response.

## Learning Constitution

File: `LearningConstitution.js`

The learning constitution is the policy layer that decides whether a learning event is allowed. The default principles are:

| Principle | Meaning |
|---|---|
| `local-first` | Learning is local to the device by default. |
| `user-control` | High-impact learning should be explicit or ask for confirmation. |
| `no-secrets` | Secrets and private identifiers are rejected. |
| `evidence-weighted` | Repeated evidence increases confidence. |
| `ask-selectively` | The assistant asks only when feedback is useful. |
| `no-permission-bypass` | Learning cannot bypass validation, permissions, or safety controls. |

The constitution applies category and source weights. Explicit user statements receive stronger confidence than weak inferred usage patterns, but secrets are still rejected even when explicit.

## Learning Guard

File: `LearningGuard.js`

The learning guard blocks or redacts unsafe learning data before it reaches storage.

### Rejected Data Classes

- passwords;
- passcodes;
- OTPs;
- API keys;
- access tokens;
- refresh tokens;
- private keys;
- session secrets;
- credit card data;
- CVV data;
- bank-account details;
- cookies and authorization headers;
- private messages;
- high-entropy token-like values;
- unsafe object keys.

### Redaction

The guard redacts sensitive metadata before storage. Examples:

```text
email address -> [redacted-email]
secret assignment -> [redacted-secret]
long number -> [redacted-number]
password/token fields -> [redacted]
```

## Learning Policy And Storage

File: `LearningPolicy.js`

`LearningPolicy` maps event categories to storage categories, asks the constitution whether an event is allowed, and returns only accepted events for persistence.

File: `LearningStorage.js`

`LearningStorage` stores v3 events under `OpenX_Data/learning/v3`. It:

- commits records by category;
- bounds records with `maxRecords`;
- prunes old records by update time;
- hashes overly long keys;
- writes with the shared atomic JSON writer;
- creates the storage folder through `ensureDataRoot`.

## Personalization Profile

File: `PersonalizationProfileStore.js`

The personalization profile consolidates learning events into a local confidence-scored profile. It exists to give future assistant layers one compact source of personalization state.

### Profile Features

- category-based profile records;
- confidence tracking;
- decay by half-life days;
- audit history;
- prompt history;
- rejected-event history;
- forget support;
- clear/reset support;
- exportable snapshot;
- bounded records;
- local-only storage.

Default max profile records:

```text
800
```

The profile can keep up to `5000` records when configured, but clamps low values to at least `25`.

## How Learned Data Changes Assistant Behavior

### 1. Command Correction

```text
User says: when I say open work, open VS Code
  -> ActiveLearningStore.learnFromText()
  -> rememberCorrection("open work", "open VS Code")
  -> OpenX_Data/learning.json

Later:
User says: open work
  -> Assistant builds routed input
  -> findCorrection("open work")
  -> command becomes "open VS Code"
  -> router opens VS Code
```

### 2. Preference Adaptation

```text
User says: use YouTube for music
  -> rememberPreference("mediaPlatform", "youtube")

Later:
User says: play lo-fi music
  -> router resolves media.play
  -> adaptEntities("media.play", entities)
  -> media platform becomes YouTube
```

Other direct adaptations include:

- `browser.search` can prefer browser opening or background search.
- `reminder.set` can prefer a default reminder category.
- `media.play` can prefer a media platform.

### 3. Feedback Prompting

```text
Command finishes
  -> record validation and verification result
  -> score learning opportunity
  -> check cooldown and novelty
  -> ask "Did that work correctly?" only when useful
```

The feedback logic avoids repeatedly asking about the same command. It also avoids prompting for private communication intents.

### 4. Mistake Repair

```text
Assistant does the wrong thing
User says: no, when I say X I mean Y
  -> repair phrase is detected before automation
  -> existing learned rule or preference is corrected
  -> sensitive replacements are rejected
```

Repair language is recognized across parser, NLP, frames, NLU, and direct assistant handling.

### 5. Personal Memory Question

```text
User says: my name is Rakesh
  -> safe fact stored locally

Later:
User says: what is my name?
  -> answerPersonalQuestion()
  -> OpenX answers from local memory
```

### 6. Workflow Learning

```text
User repeats a sequence of commands
  -> WorkflowStore observes sequence
  -> after repeated evidence, it becomes a pending suggestion
  -> user approves
  -> workflow is stored
  -> future command can execute the stored sequence
```

Workflow learning is capped to avoid runaway storage and accidental large automations.

### 7. V3 Post-Response Learning

```text
Action result exists
  -> LearningStage runs
  -> modules inspect response and result
  -> LearningPolicy filters unsafe events
  -> LearningStorage commits accepted events
  -> PersonalizationProfileStore updates local profile
```

This model prevents learning from interfering with the command currently being executed.

## Visual Memory Learning

Folder: `core/assistant/capabilities/visual-memory/runtime/learning`

Visual Memory learning extends the same local-first principle to photo search and gallery behavior.

### Contract

The visual-memory learning contract says:

- local only;
- user controlled;
- reversible;
- exportable;
- resettable;
- no model retraining;
- no cloud/shared learning;
- no automatic relationship creation;
- no automatic face naming;
- no emotion or behavior prediction;
- no autonomous decisions.

### Main Components

| Component | Responsibility |
|---|---|
| `VisualMemoryLearningEngine` | Orchestrates visual feedback, corrections, preferences, ranking, recommendations, audit, undo, reset, export, health. |
| `VisualMemoryFeedbackEngine` | Records result feedback such as selected, ignored, favorite, opened, or confirmed. |
| `VisualMemoryCorrectionEngine` | Records corrections for face, location, event, document, collection, or timeline metadata. |
| `VisualMemoryPreferenceEngine` | Stores visual-memory preferences. |
| `VisualMemoryRankingLearning` | Adjusts local result ranking based on feedback. |
| `VisualMemoryRecommendationEngine` | Creates explainable local recommendations. |
| `VisualMemoryLearningDashboard` | Produces a dashboard snapshot for diagnostics and UI. |
| `VisualMemoryLearningValidator` | Validates visual learning inputs. |
| `VisualMemoryLearningDiagnostics` | Tracks bounded visual learning diagnostics. |

### Visual Memory Defaults

| Setting | Default |
|---|---:|
| Positive ranking weight | `0.08` |
| Negative ranking weight | `-0.12` |
| Max ranking adjustment | `0.35` |
| Max recommendations | `5` |
| Minimum recommendation confidence | `0.55` |
| Feedback confidence | `0.8` |
| Correction confidence | `0.95` |
| Preference confidence | `0.9` |
| Max visual learning events | `1000` |
| Max visual corrections | `500` |
| Max visual recommendations | `200` |
| Max events per learn run | `25` |
| Background only | `true` |

### Visual Memory Ranking Workflow

```text
User searches or opens photos
  -> result interaction is recorded as feedback
  -> VisualMemoryRankingLearning applies a bounded score delta
  -> later search results receive ranking adjustment
  -> raw vision or face model output is not retrained
```

### Visual Memory Correction Workflow

```text
User corrects visual memory metadata
  -> correction is stored locally
  -> ranking confidence is adjusted
  -> event can be forwarded to the assistant learning engine
  -> correction can be undone or reset
```

## Privacy And Security Review

### Strengths

- Learning data is local-first and stored under `OpenX_Data`.
- Direct learning has strict credential rejection.
- v3 learning has `LearningGuard` and `LearningConstitution`.
- Private communication intents are excluded from persistence.
- Schedule commands are not stored as personal possessions.
- Temporary human wellbeing states are not stored as long-term facts.
- JSON writes are atomic and backed up.
- Corrupt JSON files are quarantined and recovered.
- v2 stores use schema validation.
- Store sizes and record counts are bounded.
- Visual Memory learning forbids model retraining and cloud learning by contract.
- Visual Memory learning supports undo, reset, export, and diagnostics.

### Important Compatibility Details

- The direct store and v3 learning engine coexist. The direct store currently affects live routing most immediately.
- The v2 `PreferenceStore` uses a stricter list of preference kinds than the direct store. The direct store includes assistant-specific kinds such as `mediaPlatform`, `photoLibrary`, `responseStyle`, and `wordedResponseStyle`.
- Direct assistant memory can store explicit safe phone/email facts. The v3 guard redacts or rejects broader private identifiers in event metadata.
- Visual Memory ranking changes local ranking adjustments only. It does not change the underlying detector, face runtime, embedding model, or image parser.

## Performance Behavior

Active learning is designed to be lightweight:

- direct store writes are scheduled and can be flushed;
- v2 stores are small bounded JSON files;
- v3 modules have a default timeout of `250 ms`;
- v3 storage is category-based instead of one giant append-only log;
- prompt and event histories are capped;
- visual-memory learning uses bounded arrays and background-only configuration;
- no remote model call is required for active learning;
- no GPU or model training is required.

The main performance cost is JSON read/write overhead and module execution after each completed command. Record caps and atomic writes keep this cost bounded for normal assistant use.

## Reliability Behavior

The learning layer protects itself from common local-data failures:

- missing files are created with defaults;
- invalid schemas are replaced with safe defaults;
- corrupt files can recover from backups;
- corrupt files are quarantined instead of repeatedly crashing startup;
- writes are atomic so a crash during write is less likely to lose the previous valid state;
- old legacy data can be migrated into `OpenX_Data`;
- learning can be disabled in configuration.

## Important Files

| File | Role |
|---|---|
| `core/assistant/Data.js` | Defines `OpenX_Data`, learning paths, atomic JSON IO, backup recovery, corruption quarantine, legacy migration. |
| `apps/desktop/settings.js` | Wires app data root and active-learning store path into runtime settings. |
| `core/assistant/index.js` | Main assistant integration for direct learning, correction, feedback, personal memory, and response preference adaptation. |
| `core/assistant/automation/ActionRouter.js` | Applies learned entity preferences and records routing evidence. |
| `core/assistant/pipeline/PipelineManager.js` | Registers `LearningStage` in the assistant pipeline. |
| `core/assistant/learning/index.js` | Exports the learning layer public API and layer version. |
| `core/assistant/learning/ActiveLearningStore.js` | Direct active-learning store used by live assistant behavior. |
| `core/assistant/learning/ActiveLearningManager.js` | v2 split-store active-learning manager. |
| `core/assistant/learning/BaseStore.js` | Shared safe JSON store implementation. |
| `core/assistant/learning/AliasStore.js` | Alias suggestion and approval store. |
| `core/assistant/learning/CorrectionStore.js` | Correction suggestion and approval store. |
| `core/assistant/learning/PreferenceStore.js` | Approved preference store. |
| `core/assistant/learning/WorkflowStore.js` | Repeated workflow store. |
| `core/assistant/learning/UsageStatsStore.js` | Local usage statistics store. |
| `core/assistant/learning/LearningManager.js` | v3 learning engine facade. |
| `core/assistant/learning/LearningPipeline.js` | v3 module runner and event commit pipeline. |
| `core/assistant/learning/LearningStage.js` | Assistant pipeline stage for post-response learning. |
| `core/assistant/learning/LearningConfiguration.js` | Learning defaults and clamps. |
| `core/assistant/learning/LearningContext.js` | Per-run learning context and event accumulator. |
| `core/assistant/learning/LearningPolicy.js` | Applies constitution and category mapping. |
| `core/assistant/learning/LearningConstitution.js` | Local-first, user-control, no-secrets, and no-bypass policy. |
| `core/assistant/learning/LearningGuard.js` | Secret detection, sensitive-data rejection, redaction, and sanitization. |
| `core/assistant/learning/LearningStorage.js` | v3 category JSON persistence. |
| `core/assistant/learning/PersonalizationProfileStore.js` | Consolidated confidence-scored local profile. |
| `core/assistant/learning/*Learning.js` | Individual v3 learning modules. |
| `core/assistant/capabilities/visual-memory/runtime/learning/*` | Visual Memory learning, ranking, feedback, correction, preference, recommendation, diagnostics. |

## Learning Folder Tree

```text
core/assistant/learning/
|-- ActiveLearningManager.js
|-- ActiveLearningStore.js
|-- AliasLearning.js
|-- AliasStore.js
|-- BaseLearningModule.js
|-- BaseStore.js
|-- ConversationLearning.js
|-- CorrectionLearning.js
|-- CorrectionStore.js
|-- FeedbackLearning.js
|-- HabitLearning.js
|-- HomeEventLearning.js
|-- index.js
|-- LearningConfiguration.js
|-- LearningConstitution.js
|-- LearningContext.js
|-- LearningDiagnostics.js
|-- LearningErrors.js
|-- LearningGuard.js
|-- LearningLanguage.js
|-- LearningManager.js
|-- LearningPipeline.js
|-- LearningPolicy.js
|-- LearningRegistry.js
|-- LearningResult.js
|-- LearningStage.js
|-- LearningStorage.js
|-- LearningValidator.js
|-- PatternLearning.js
|-- PersonalizationProfileStore.js
|-- PreferenceLearning.js
|-- PreferenceStore.js
|-- UsageLearning.js
|-- UsageStatsStore.js
|-- WorkflowLearning.js
`-- WorkflowStore.js
```

## Visual Memory Learning Tree

```text
core/assistant/capabilities/visual-memory/runtime/learning/
|-- contracts/
|   `-- VisualMemoryLearningContracts.js
|-- corrections/
|   `-- VisualMemoryCorrectionEngine.js
|-- dashboard/
|   `-- VisualMemoryLearningDashboard.js
|-- diagnostics/
|   `-- VisualMemoryLearningDiagnostics.js
|-- engine/
|   `-- VisualMemoryLearningEngine.js
|-- events/
|   `-- VisualMemoryLearningEvents.js
|-- feedback/
|   `-- VisualMemoryFeedbackEngine.js
|-- lifecycle/
|   `-- VisualMemoryLearningLifecycle.js
|-- preferences/
|   `-- VisualMemoryPreferenceEngine.js
|-- ranking/
|   `-- VisualMemoryRankingLearning.js
|-- recommendations/
|   `-- VisualMemoryRecommendationEngine.js
|-- validation/
|   `-- VisualMemoryLearningValidator.js
`-- index.js
```

## Test Coverage

| Test file | Coverage |
|---|---|
| `tests/core/learning.test.js` | Direct `ActiveLearningStore`: corrections, preferences, personal facts, entity adaptation, feedback utility, password rejection, schedule exclusion, temporary wellbeing exclusion, communication privacy. |
| `tests/core/active-learning-v2.test.js` | v2 split stores: five managed JSON files, approval thresholds, sensitive-value blocking, corruption quarantine, backup recovery, no temporary write leftovers, bounded overview, bounded buffers. |
| `tests/core/learning-engine.test.js` | v3 learning engine: immutable results, post-response storage, secret rejection, natural correction feedback, usage/habit/pattern/workflow events, pipeline isolation, timeout health, redaction, personalization profile, constitution, selective prompts. |
| `tests/core/learning-repair.test.js` | Incorrect-learning repair: language recognition, no automation invocation, correction replacement, preference repair, sensitive repair rejection. |
| `tests/core/visual-memory-learning.test.js` | Visual Memory learning: local-first contract, no retraining, feedback/correction/preference state, ranking adaptation, recommendations, undo, reset, export, persistence, forwarding standard events to assistant learning. |

## Recommended Validation Commands

Focused learning validation:

```powershell
npm run test:learning
```

Extended learning validation:

```powershell
npx mocha tests/core/learning-engine.test.js tests/core/learning-repair.test.js tests/core/visual-memory-learning.test.js --timeout 120000
```

Full repository validation before release:

```powershell
npm run validate
```

## Current Production Readiness Assessment

The active-learning layer is suitable for local-first assistant personalization because:

- it is deterministic and inspectable;
- it stores data locally under `OpenX_Data`;
- it has bounded storage;
- it has explicit secret and private-data guards;
- it has repair/reset surfaces;
- it does not retrain models or upload personal learning data;
- it has focused tests for the main failure modes.

It should be treated as a personalization and memory layer, not as a general intelligence model.

## Known Limitations And Follow-Up Work

1. Direct store and v3 store consolidation

   The direct `ActiveLearningStore` is still the most immediately behavior-changing layer. The v3 pipeline is cleaner and more modular. A future cleanup could gradually move direct behavior onto v3 records while preserving compatibility with `learning.json`.

2. Preference taxonomy alignment

   The direct store supports assistant-specific preference keys such as `mediaPlatform`, `photoLibrary`, `responseStyle`, and `wordedResponseStyle`. The v2 `PreferenceStore` uses a narrower fixed list. A future compatibility pass should align preference names or add an adapter.

3. User-facing learning dashboard

   The manager can show aliases, preferences, workflows, and usage stats, but the UI can be improved so users can inspect, approve, edit, and delete learned behavior more easily.

4. More explicit retention controls

   Record caps exist, but a user-facing retention policy would make it easier to expire old habits, patterns, and feedback after a chosen period.

5. More cross-layer diagnostics

   Routing evidence, v3 diagnostics, and personalization profile audit data exist separately. A single local diagnostics view would make it easier to explain why OpenX learned or changed a behavior.

6. No cloud sync by default

   This is intentional for privacy. If cross-device learning sync is added later, it should be encrypted, opt-in, exportable, resettable, and separable from chat or cloud relay data.

## Final Summary

OpenX active learning is a local, bounded, policy-guarded personalization system. It improves the assistant by learning safe corrections, aliases, preferences, user facts, workflows, feedback, usage patterns, and visual-memory ranking signals. It stores data under `OpenX_Data`, uses atomic JSON persistence, blocks sensitive information, avoids private communication content, and provides tests for direct learning, v2 active learning, v3 learning pipeline behavior, learning repair, and Visual Memory learning.

The system is strongest when learning explicit user preferences and corrections. Its next major improvement should be unifying direct learning and v3 learning into one visible, user-editable learning dashboard while preserving the current safety guarantees.
