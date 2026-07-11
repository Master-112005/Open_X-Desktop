class UpdateCardBuilder {
  static build(model = {}) {
    const actions = (model.actions || [])
      .filter(action => action && action.enabled !== false && action.future !== true)
      .slice(0, 3)
      .map(action => Object.freeze({
        id: `update-${action.id}`,
        label: action.label,
        kind: 'update',
        updateActionId: action.id,
        updatePayload: {},
        primary: action.primary === true
      }));
    const progress = model.progress || {};
    const progressText = progress.percent > 0
      ? `${progress.percent}%${progress.speedLabel ? ` at ${progress.speedLabel}` : ''}${progress.etaLabel ? `, ${progress.etaLabel}` : ''}`
      : '';
    return Object.freeze({
      success: true,
      intent: 'update.presentation',
      response: [model.status?.message || model.status?.label || 'Update status', progressText].filter(Boolean).join(' '),
      data: {
        update: model,
        actions,
        resultEntries: [{
          index: 1,
          name: model.version?.latestVersionLabel || model.version?.currentVersionLabel || 'OpenX Update',
          type: model.status?.label || 'Update',
          location: model.version?.channel || 'stable',
          snippet: progressText || model.releaseNotes?.summary || model.status?.message || ''
        }]
      },
      ui: {
        icon: 'UP',
        previewStatus: model.status?.label || 'Update',
        preExpandDelayMs: 300,
        autoHideMs: model.status?.state === 'FAILED' ? 22000 : 12000
      }
    });
  }
}

module.exports = UpdateCardBuilder;
