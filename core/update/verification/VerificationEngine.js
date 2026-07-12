const VerificationContext = require('./VerificationContext');
const VerificationPipeline = require('./VerificationPipeline');
const VerificationSession = require('./VerificationSession');
const EVENTS = require('./VerificationEvents');
const FileVerifier = require('./FileVerifier');
const ReadableVerifier = require('./ReadableVerifier');
const SizeVerifier = require('./SizeVerifier');
const HashVerifier = require('./HashVerifier');
const SignatureVerifier = require('./SignatureVerifier');
const MetadataVerifier = require('./MetadataVerifier');
const VersionVerifier = require('./VersionVerifier');
const ManifestVerifier = require('./ManifestVerifier');
const SecurityVerifier = require('./SecurityVerifier');

class VerificationEngine {
  constructor(options = {}) {
    this.configuration = options.configuration;
    this.versionManager = options.versionManager;
    this.diagnostics = options.diagnostics;
    this.emitEvent = options.emitEvent || (() => {});
  }

  createPipeline() {
    const common = { configuration: this.configuration, versionManager: this.versionManager };
    return new VerificationPipeline({
      diagnostics: this.diagnostics,
      emitEvent: this.emitEvent,
      steps: [
        { event: EVENTS.FILE_VERIFIED, verifier: new FileVerifier(common) },
        { event: EVENTS.FILE_VERIFIED, verifier: new ReadableVerifier(common) },
        { event: EVENTS.SIZE_VERIFIED, verifier: new SizeVerifier(common) },
        { event: EVENTS.HASH_VERIFIED, verifier: new HashVerifier(common) },
        { event: EVENTS.SIGNATURE_VERIFIED, verifier: new SignatureVerifier(common) },
        { event: EVENTS.METADATA_VERIFIED, verifier: new MetadataVerifier(common) },
        { event: EVENTS.VERSION_VERIFIED, verifier: new VersionVerifier(common) },
        { event: EVENTS.MANIFEST_VERIFIED, verifier: new ManifestVerifier(common) },
        { event: EVENTS.POLICY_VERIFIED, verifier: new SecurityVerifier(common) }
      ]
    });
  }

  async verify(input = {}) {
    const session = new VerificationSession(input.filePath);
    const currentVersionResult = this.versionManager?.getCurrentVersion?.() || {};
    const context = new VerificationContext({
      filePath: input.filePath,
      manifest: input.manifest || {},
      policy: input.policy || {},
      currentVersion: input.currentVersion || currentVersionResult.data?.version || currentVersionResult.version || '',
      configuration: this.configuration
    });
    this.emitEvent(EVENTS.VERIFICATION_STARTED, { verificationId: session.verificationId, filePath: input.filePath });
    return this.createPipeline().run(context, session);
  }
}

module.exports = VerificationEngine;
