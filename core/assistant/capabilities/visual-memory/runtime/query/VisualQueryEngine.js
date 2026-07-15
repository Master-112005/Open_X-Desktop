'use strict';

const VisualQueryContext = require('./VisualQueryContext');
const VisualQueryNormalizer = require('./VisualQueryNormalizer');
const VisualQueryParser = require('./VisualQueryParser');
const VisualConstraintExtractor = require('./VisualConstraintExtractor');
const VisualQueryValidator = require('./VisualQueryValidator');
const VisualQueryResult = require('./VisualQueryResult');

class VisualQueryEngine {
  constructor(options = {}) {
    this.logger = options.logger || null;
    this.normalizer = options.normalizer || new VisualQueryNormalizer();
    this.parser = options.parser || new VisualQueryParser({ normalizer: this.normalizer });
    this.extractor = options.extractor || new VisualConstraintExtractor({ normalizer: this.normalizer });
    this.validator = options.validator || new VisualQueryValidator(options.validation || {});
  }

  understand(input = {}) {
    const startedAt = Date.now();
    const context = input instanceof VisualQueryContext ? input : new VisualQueryContext(input);
    const parsed = this.parser.parse(context);
    if (!parsed.active) {
      return new VisualQueryResult({
        active: false,
        rawInput: context.rawInput,
        normalizedInput: context.normalizedInput,
        timing: { durationMs: Date.now() - startedAt }
      });
    }

    const extracted = this.extractor.extract(context, parsed);
    const validation = this.validator.validate({
      parsed,
      constraints: extracted.constraints,
      confidence: extracted.confidence
    });
    const result = new VisualQueryResult({
      active: true,
      intent: parsed.intent,
      media: extracted.constraints.media[0]?.value || parsed.mediaHint || 'photo',
      owner: extracted.constraints.owner[0]?.value || 'user',
      constraints: extracted.constraints,
      confidence: extracted.confidence,
      validation,
      needsClarification: validation.needsClarification,
      diagnostics: extracted.diagnostics.concat([{
        level: validation.valid ? 'info' : 'warn',
        message: validation.valid ? 'Visual query validated.' : 'Visual query validation found issues.',
        data: { errors: validation.errors.length, warnings: validation.warnings.length }
      }]),
      rawInput: context.rawInput,
      normalizedInput: context.normalizedInput,
      timing: { durationMs: Date.now() - startedAt }
    });

    this.logger?.debug?.('Visual query understood', {
      intent: result.intent,
      media: result.media,
      confidence: result.confidence,
      constraints: Object.fromEntries(Object.entries(result.constraints).map(([key, value]) => [key, value.length]))
    });

    return result;
  }
}

module.exports = VisualQueryEngine;
