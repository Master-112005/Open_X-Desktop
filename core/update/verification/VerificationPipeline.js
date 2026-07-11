const EVENTS = require('./VerificationEvents');
const VerificationResult = require('./VerificationResult');

class VerificationPipeline {
  constructor(options = {}) {
    this.steps = options.steps || [];
    this.emitEvent = options.emitEvent || (() => {});
    this.diagnostics = options.diagnostics;
  }

  async run(context, session) {
    for (const step of this.steps) {
      const check = await step.verifier.verify(context);
      if (check.name === 'sha256') this.diagnostics?.addTiming?.('sha256', check.durationMs);
      if (check.name === 'signature') this.diagnostics?.addTiming?.('signature', check.durationMs);
      this.emitEvent(step.event, check);
      if (!check.success) {
        const result = VerificationResult.failed(check.error, {
          verificationId: session.verificationId,
          checks: context.checks,
          warnings: context.warnings,
          securityLevel: 'rejected',
          data: this.resultData(context),
          durationMs: Date.now() - context.startedAt
        });
        session.complete(result);
        return result;
      }
    }
    const hasRelaxedSignatureWarning = context.warnings.some(warning => warning.code === 'SIGNATURE_RELAXED');
    const result = VerificationResult.passed({
      verificationId: session.verificationId,
      checks: context.checks,
      warnings: context.warnings,
      securityLevel: hasRelaxedSignatureWarning ? 'relaxed' : 'strict',
      data: this.resultData(context),
      durationMs: Date.now() - context.startedAt
    });
    session.complete(result);
    this.emitEvent(EVENTS.VERIFICATION_COMPLETED, result);
    return result;
  }

  resultData(context) {
    return {
      filePath: context.filePath,
      file: context.file,
      hash: context.hash,
      signature: context.signature,
      metadata: context.metadata,
      manifest: context.manifest
    };
  }
}

module.exports = VerificationPipeline;
