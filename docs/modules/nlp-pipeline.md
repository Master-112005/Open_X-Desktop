# NLP Pipeline

## Purpose

The NLP pipeline turns inconsistent natural language input into normalized, linguistic, and semantic structures for the assistant pipeline.

## Modules

- `core/assistant/linguistic/InputParser.js`
  Preserves raw command text and builds command clauses and word relations.
- `core/assistant/normalization/CommandPreprocessor.js`
  Normalizes commands, strips polite prefixes, applies phrase rewrites, and collapses repeated tokens.
- `core/assistant/reasoning/IntentPatternScorer.js`
  Scores command patterns using overlap, order, bigrams, and string similarity.
- `core/assistant/linguistic/NlpProcessor.js`
  Coordinates vocabulary building, spelling correction, and scoring.
- `core/assistant/semantic/NaturalLanguageRouter.js`
  Converts natural language evidence into semantic route candidates.

## Design Notes

- Raw command text is preserved for entity extraction.
- Corrected command text is used for intent scoring.
- Word order mistakes are tolerated through overlap and bigram scoring.
- Phrase normalization covers common text variants such as `put on`, `start playing`, `full screen`, and British spellings like `minimise`.
- Search, open, media, and window commands also use explicit router guards where ambiguity is high.
- Media entity extraction strips filler nouns such as `song`, `track`, and `video` so playback requests stay query-focused.
