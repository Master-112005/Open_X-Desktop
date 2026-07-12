const STATES = require('./UpdatePresentationState');
const UpdateActionModel = require('./UpdateActionModel');
const UpdateProgressModel = require('./UpdateProgressModel');
const UpdateStatusModel = require('./UpdateStatusModel');
const UpdatePresentationModel = require('./UpdatePresentationModel');
const ReleaseNotesFormatter = require('./ReleaseNotesFormatter');
const VersionFormatter = require('./VersionFormatter');
const UpdateCardBuilder = require('./UpdateCardBuilder');
const NotificationFormatter = require('./NotificationFormatter');

function latestDownload(downloads = {}) {
  return downloads.active?.[0] || downloads.queued?.[0] || downloads.tasks?.[0] || downloads.history?.[0] || {};
}

class UpdatePresentationService {
  build(snapshot = {}) {
    const versionCheck = snapshot.versionCheck || {};
    const notifications = snapshot.updateNotifications || {};
    const downloads = snapshot.downloads || {};
    const verification = snapshot.verification || {};
    const download = latestDownload(downloads);
    const latestNotification = notifications.latestNotification || {};
    const latestVersion = versionCheck.latestVersion || latestNotification.latestVersion || '';
    const currentVersion = snapshot.version || versionCheck.currentVersion || '';
    const releaseNotes = ReleaseNotesFormatter.format(
      latestNotification.releaseNotes || versionCheck.releaseNotes || ''
    );
    const progress = new UpdateProgressModel(download);
    const installation = snapshot.installation || {};
    const selfUpdate = snapshot.selfUpdate || {};
    const state = this.resolveState({ versionCheck, notifications, download, verification, installation, selfUpdate });
    const status = this.statusForState(state, { latestVersion, currentVersion, progress, verification, selfUpdate });
    const actions = this.actionsForState(state, { download, latestNotification, verification, installation, selfUpdate });
    const model = new UpdatePresentationModel({
      generatedAt: new Date().toISOString(),
      state,
      status,
      version: Object.freeze({
        currentVersion,
        latestVersion,
        currentVersionLabel: VersionFormatter.versionLabel(currentVersion),
        latestVersionLabel: latestVersion ? VersionFormatter.versionLabel(latestVersion) : 'Latest version unknown',
        channel: versionCheck.channel || latestNotification.channel || snapshot.configuration?.channel || 'stable',
        buildNumber: latestVersion || currentVersion || 'unknown',
        releaseDate: latestNotification.publishedAt || versionCheck.releaseDate || null,
        publisher: 'OpenX',
        verificationStatus: verification.latestResult?.status || verification.state || 'READY',
        packageStatus: download.state || 'IDLE'
      }),
      progress,
      releaseNotes,
      actions,
      health: Object.freeze({
        updateEngine: snapshot.state || 'UNKNOWN',
        download: download.state || 'IDLE',
        verification: verification.state || 'READY',
        installation: installation.state || 'IDLE',
        selfUpdate: selfUpdate.state || 'IDLE',
        offline: state === STATES.OFFLINE
      })
    });
    return Object.freeze({
      model,
      card: UpdateCardBuilder.build(model),
      notification: NotificationFormatter.build(state === STATES.FAILED ? 'failed' : state === STATES.READY ? 'ready' : 'information', model)
    });
  }

  resolveState({ versionCheck, notifications, download, verification, installation, selfUpdate }) {
    const downloadState = String(download?.state || '').toUpperCase();
    const installationState = String(installation?.state || '').toUpperCase();
    const selfUpdateState = String(selfUpdate?.state || '').toUpperCase();
    const verificationState = String(verification?.state || '').toUpperCase();
    const versionState = String(versionCheck?.state || '').toUpperCase();
    if (['PREPARING', 'PRESERVING_STATE', 'SHUTTING_DOWN', 'INSTALLER_STARTING', 'INSTALLER_RUNNING', 'RESTARTING', 'RESTORING'].includes(selfUpdateState)) return STATES.INSTALLING;
    if (selfUpdateState === 'COMPLETED') return STATES.COMPLETED;
    if (selfUpdateState === 'FAILED' || selfUpdateState === 'ERROR') return STATES.FAILED;
    if (['PREPARING', 'SHUTTING_DOWN', 'LAUNCHING_INSTALLER', 'INSTALLER_RUNNING'].includes(installationState)) return STATES.INSTALLING;
    if (installationState === 'COMPLETED') return STATES.COMPLETED;
    if (installationState === 'FAILED' || installationState === 'ERROR') return STATES.FAILED;
    if (downloadState === 'DOWNLOADING' || downloadState === 'CONNECTING' || downloadState === 'RETRYING') return STATES.DOWNLOADING;
    if (downloadState === 'PAUSED') return STATES.PAUSED;
    if (verificationState === 'VERIFYING') return STATES.VERIFYING;
    if (verificationState === 'PASSED') return STATES.READY;
    if (downloadState === 'FAILED' || verificationState === 'FAILED' || versionState === 'ERROR') return STATES.FAILED;
    if (versionState.includes('CHECKING')) return STATES.CHECKING;
    if (versionCheck?.updateAvailable || notifications?.latestNotification) return STATES.UPDATE_AVAILABLE;
    if (versionState === 'SERVER_UNAVAILABLE' || versionState === 'OFFLINE') return STATES.OFFLINE;
    return STATES.IDLE;
  }

  statusForState(state, context = {}) {
    const labels = {
      [STATES.IDLE]: ['Waiting', 'OpenX is waiting for update information.'],
      [STATES.CHECKING]: ['Checking', 'Checking for updates.'],
      [STATES.UPDATE_AVAILABLE]: ['Update Available', `${VersionFormatter.versionLabel(context.latestVersion)} is available.`],
      [STATES.DOWNLOADING]: ['Downloading', `Downloading update package (${context.progress.percent || 0}%).`],
      [STATES.PAUSED]: ['Paused', 'Update download is paused.'],
      [STATES.VERIFYING]: ['Verifying', 'Verifying downloaded package integrity.'],
      [STATES.READY]: ['Ready To Restart', 'The package is verified. Restart OpenX to install silently.'],
      [STATES.INSTALLING]: ['Installing', 'OpenX is preserving state, installing silently, and restarting.'],
      [STATES.COMPLETED]: ['Completed', 'Update task completed.'],
      [STATES.FAILED]: ['Failed', 'The update task failed.'],
      [STATES.OFFLINE]: ['Offline', 'Update services are currently unavailable.']
    };
    const [label, message] = labels[state] || labels[STATES.IDLE];
    return new UpdateStatusModel({ state, label, message, health: state === STATES.FAILED ? 'error' : 'ok' });
  }

  actionsForState(state, context = {}) {
    const downloadId = context.download?.id || '';
    const hasDownloadAsset = Boolean(context.latestNotification?.assetUrl || context.latestNotification?.asset?.url || context.download?.url);
    const canDownload = state === STATES.UPDATE_AVAILABLE && hasDownloadAsset;
    const canInstall = state === STATES.READY &&
      String(context.verification?.state || '').toUpperCase() === 'PASSED' &&
      context.installation?.running !== true &&
      context.selfUpdate?.running !== true;
    return Object.freeze([
      new UpdateActionModel({ id: 'check', label: 'Check Now', enabled: true, primary: state === STATES.IDLE }),
      new UpdateActionModel({ id: 'download', label: 'Download', enabled: canDownload, primary: canDownload, reason: canDownload ? '' : 'No downloadable relay asset is selected.' }),
      new UpdateActionModel({ id: 'pause', label: 'Pause', enabled: state === STATES.DOWNLOADING && Boolean(downloadId) }),
      new UpdateActionModel({ id: 'resume', label: 'Resume', enabled: state === STATES.PAUSED && Boolean(downloadId) }),
      new UpdateActionModel({ id: 'cancel', label: 'Cancel', enabled: [STATES.DOWNLOADING, STATES.PAUSED].includes(state) && Boolean(downloadId) }),
      new UpdateActionModel({ id: 'selfUpdate', label: 'Restart & Update', enabled: canInstall, primary: canInstall, reason: canInstall ? 'Installs the verified update silently and restarts OpenX.' : 'A verified installer is required before restart.' }),
      new UpdateActionModel({ id: 'install', label: 'Install', enabled: canInstall, primary: false, reason: canInstall ? 'Launches the verified installer through the legacy installer path.' : 'A verified installer is required before installation.' }),
      new UpdateActionModel({ id: 'refresh', label: 'Refresh', enabled: true }),
      new UpdateActionModel({ id: 'copyVersion', label: 'Copy Version', enabled: true }),
      new UpdateActionModel({ id: 'viewReleaseNotes', label: 'View Release Notes', enabled: true }),
      new UpdateActionModel({ id: 'openDownloadsFolder', label: 'Open Downloads Folder', enabled: true }),
      new UpdateActionModel({ id: 'openLogsFolder', label: 'Open Logs Folder', enabled: true })
    ]);
  }
}

module.exports = UpdatePresentationService;
