# OpenX Production Finalization

Updated: 2026-07-09

## Current State

The assistant now routes through `AssistantEngine` and the staged pipeline. Legacy top-level assistant modules were removed from their old locations and surviving behavior was moved into phase-owned directories. `AssistantPassthroughStage` and `AssistantEngine.executeLegacy` were removed.

## Completed

- Moved parser, NLU, entity extraction, intent registry, response generation, personality, context, NLP preprocessing, web target resolution, natural language execution, and active learning stores into pipeline-owned directories.
- Added `AssistantExecutionStage` so pipeline output is the assistant result.
- Removed old legacy file locations and the old pass-through stage.
- Verified lint and focused assistant regression suites.

## Remaining Debt

`core/assistant/automation/ActionRouter.js` is still too broad. Continue extracting its language, reasoning, planning, decision, and automation responsibilities into their dedicated stages in small verified slices.
