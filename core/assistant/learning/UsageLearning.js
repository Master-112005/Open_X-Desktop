'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { normalizeLearningKey } = require('./LearningLanguage');

function compactActionMetadata(action = {}) {
  const data = action.data || action.result?.data || {};
  const confirmation = action.confirmation || action.result?.confirmation || {};
  const verification = action.verification || data.verification || {};
  const verificationSummary = action.verificationSummary || data.verificationSummary || {};
  const location = data.location || data.destinationLocation || null;
  const operation = data.operation || action.route || action.action || action.taskId || null;
  const plannerEntry = data.entry || null;
  const dueAt = Number.isFinite(Date.parse(data.dueAt || '')) ? new Date(data.dueAt) : null;
  const deviceValue = Number.isFinite(Number(data.value)) ? Number(data.value) : null;
  const captureSize = Number.isFinite(Number(data.size)) ? Number(data.size) : null;
  const browserHost = (() => {
    try {
      return data.url ? new URL(String(data.url)).hostname.replace(/^www\./i, '') : null;
    } catch (err) {
      return null;
    }
  })();

  return {
    successful: true,
    operation,
    location,
    platform: data.platform || null,
    launchMethod: data.launchMethod || null,
    controlMethod: data.controlMethod || data.method || null,
    metricSource: data.metricSource || null,
    target: data.target || null,
    systemCommand: data.command || null,
    dryRun: data.dryRun === true || null,
    browserName: data.browserName || null,
    browserHost,
    plannerView: data.view || plannerEntry?.type || null,
    plannerDate: plannerEntry?.date || null,
    plannerTime: plannerEntry?.startTime || null,
    plannerOperation: data.operation || null,
    scheduleKind: data.kind || null,
    scheduleStatus: data.status || null,
    scheduleRecurrence: data.recurrence || null,
    scheduleDueHour: dueAt ? dueAt.getHours() : null,
    deviceValueBucket: deviceValue === null ? null : Math.round(deviceValue / 10) * 10,
    deviceMuted: typeof data.muted === 'boolean' ? data.muted : null,
    deviceSupported: typeof data.supported === 'boolean' ? data.supported : null,
    captureExtension: data.extension || null,
    captureSizeBucketKb: captureSize === null ? null : Math.round(captureSize / 1024 / 100) * 100,
    confirmationRisk: confirmation.risk || null,
    confirmationReversible: typeof confirmation.reversible === 'boolean' ? confirmation.reversible : null,
    confirmationRequiresReview: confirmation.requiresReview === true || null,
    resultCount: Number.isFinite(Number(data.resultCount)) ? Number(data.resultCount) : null,
    verificationStatus: verification.status || null,
    verificationCheck: verification.check || null,
    verificationConfidence: Number.isFinite(Number(verificationSummary.confidence || verification.confidence))
      ? Number(verificationSummary.confidence || verification.confidence)
      : null,
    verificationEvidenceCount: Number.isFinite(Number(verificationSummary.evidenceCount))
      ? Number(verificationSummary.evidenceCount)
      : Array.isArray(verification.evidence) ? verification.evidence.length : null,
    controllerVerified: data.controllerVerified === true || null
  };
}

class UsageLearning extends BaseLearningModule {
  learn(context) {
    const actions = context.assistantResponse?.verificationResult?.successfulActions || [];
    for (const action of actions) {
      const route = normalizeLearningKey(action.route || action.action || action.taskId);
      if (!route) continue;
      context.addEvent({
        category: 'statistic',
        key: `command.${route}`,
        value: route,
        confidence: 1,
        source: 'successful-action',
        module: this.id,
        metadata: compactActionMetadata(action)
      });
    }
    return context;
  }
}

module.exports = UsageLearning;
