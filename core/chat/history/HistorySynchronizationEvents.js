/**
 * Desktop Chat local-history synchronization events.
 */
module.exports = Object.freeze({
  REQUESTED: 'chat.historySync.requested',
  SOURCE_AVAILABLE: 'chat.historySync.sourceAvailable',
  WAITING_FOR_SOURCE: 'chat.historySync.waitingForSource',
  NEGOTIATED: 'chat.historySync.negotiated',
  TRANSFER_PROGRESS: 'chat.historySync.transferProgress',
  COMPLETED: 'chat.historySync.completed',
  FAILED: 'chat.historySync.failed',
  CANCELLED: 'chat.historySync.cancelled'
});
