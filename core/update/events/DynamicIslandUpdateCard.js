function cleanText(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

class DynamicIslandUpdateCard {
  static build(event = {}) {
    const version = cleanText(event.latestVersion, 80);
    const notes = cleanText(event.releaseNotes, 500);
    const priority = event.mandatory ? 'Mandatory update' : 'Update available';
    return Object.freeze({
      success: true,
      actionId: 'update.available',
      intent: 'update.available',
      displayMode: 'medium',
      heading: 'OpenX Update Available',
      response: `Version ${version} Available`,
      data: {
        actions: [],
        buttons: [],
        resultEntries: [
          {
            index: 1,
            name: `Version ${version}`,
            type: 'OpenX update',
            location: cleanText(event.channel || 'stable', 80),
            snippet: notes || priority,
            description: notes || priority,
            metadata: {
              channel: cleanText(event.channel, 80),
              priority: cleanText(event.priority || priority, 80),
              mandatory: event.mandatory === true,
              publishedAt: event.publishedAt || ''
            }
          }
        ]
      },
      ui: {
        icon: 'UP',
        previewStatus: 'OpenX update available',
        preExpandDelayMs: 450,
        autoHideMs: event.mandatory ? 30000 : 18000,
        persistUntilAction: false
      },
      notification: {
        informationalOnly: true,
        updateEventId: event.eventId,
        noInstallAction: true
      }
    });
  }
}

module.exports = DynamicIslandUpdateCard;
