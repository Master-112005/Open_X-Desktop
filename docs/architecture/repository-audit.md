# Repository Audit

Updated: 2026-07-09

## Result

The previous top-level assistant legacy files are no longer present. Current source references point at phase-owned modules under `core/assistant/{normalization,linguistic,semantic,entities,memory,context,reasoning,planning,decision,validation,automation,verification,response,learning}`.

## Verification

- `npm run lint`: clean
- Focused parser/intents/NLU/NLP/router/assistant pipeline suites: passing

## Remaining Risk

The main remaining consolidation target is `core/assistant/automation/ActionRouter.js`, which still owns too much command-resolution behavior even though it is no longer exposed as `core/assistant/router.js`.
