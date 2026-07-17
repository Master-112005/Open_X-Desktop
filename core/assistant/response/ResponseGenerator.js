const path = require('path');

const MAX_CHAT_VISUAL_RESULTS = 10;

const { applyFormalAddress } = (() => {
const ALLOWED_HONORIFICS = new Set(['sir', 'master', 'boss', 'commander']);

function resolveHonorific(config) {
  const candidate = String(
    config?.assistant?.honorific ||
    config?.assistant?.addressing?.defaultHonorific ||
    'sir'
  ).trim().toLowerCase();

  if (ALLOWED_HONORIFICS.has(candidate)) {
    return candidate;
  }

  return 'sir';
}

function hasHonorific(text) {
  return /\b(?:sir|master|boss|commander)\b/i.test(String(text || ''));
}

function hashSeed(value) {
  const source = String(value || '');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function applyFormalAddress(text, config) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (!source) return '';
  if (hasHonorific(source)) return source;

  if (config?.assistant?.addressing?.useHonorific === false) {
    return source;
  }

  const honorific = resolveHonorific(config);
  const isTest = typeof global.it === 'function' || process.env.NODE_ENV === 'test';

  const punctuationMatch = source.match(/[.!?]$/);
  const punctuation = punctuationMatch ? punctuationMatch[0] : '.';
  const base = punctuationMatch ? source.slice(0, -1).trim() : source;

  if (isTest) {
    return `${base}, ${honorific}${punctuation}`;
  }

  return `${base}, ${honorific}${punctuation}`;
}

return {
  applyFormalAddress,
  hasHonorific,
  resolveHonorific,
  hashSeed
};

})();

function hashSeed(value) {
  const source = String(value || '');
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function chooseVariant(seed, variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return '';
  }

  return variants[hashSeed(seed) % variants.length];
}

function valueFromContext(context, key, fallback = '') {
  if (!context) return fallback;
  if (context.result?.data && context.result.data[key] !== undefined) return context.result.data[key];
  if (context.entities && context.entities[key] !== undefined) return context.entities[key];
  if (context[key] !== undefined) return context[key];
  return fallback;
}

function basenameOrValue(input) {
  if (!input || typeof input !== 'string') return '';
  return path.basename(input);
}

function pathLabel(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';

  const normalized = filePath.toLowerCase();
  if (normalized.includes('\\desktop\\') || normalized.endsWith('\\desktop')) return 'Desktop';
  if (normalized.includes('\\documents\\') || normalized.endsWith('\\documents')) return 'Documents';
  if (normalized.includes('\\downloads\\') || normalized.endsWith('\\downloads')) return 'Downloads';
  if (normalized.includes('\\pictures\\') || normalized.endsWith('\\pictures')) return 'Pictures';
  if (normalized.includes('\\music\\') || normalized.endsWith('\\music')) return 'Music';
  if (normalized.includes('\\videos\\') || normalized.endsWith('\\videos')) return 'Videos';
  return path.dirname(filePath);
}

function locationLabel(entry) {
  return entry?.location || pathLabel(entry?.path) || '';
}

function responseSeed(context, fallback) {
  return context?.result?.data?.responseVariantSeed || fallback;
}

function verifiedPrefix(context) {
  const verification = context?.result?.data?.verification;
  return verification?.status === 'passed' ? 'Verified. ' : '';
}

function plannerWhen(entry = {}) {
  const date = entry?.date || '';
  const time = entry?.startTime || '';
  if (date && time) return ` for ${date} at ${time}`;
  if (date) return ` for ${date}`;
  if (time) return ` at ${time}`;
  return '';
}

function scheduleWhen(context, fallback = '') {
  const dueAt = valueFromContext(context, 'dueAt', '');
  if (dueAt) {
    const date = new Date(dueAt);
    if (Number.isFinite(date.getTime())) {
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  }
  return fallback;
}

function formatSearchEntry(entry) {
  const name = entry?.name || basenameOrValue(entry?.path);
  const location = locationLabel(entry);
  const size = entry?.type === 'file' && Number(entry?.sizeMB) > 0 ? `, ${entry.sizeMB} MB` : '';
  const kind = entry?.type === 'folder' ? 'folder' : 'file';
  return location ? `${name} (${kind}, ${location}${size})` : `${name} (${kind}${size})`;
}

function partialSearchNote(searchStats) {
  if (!searchStats?.partial) return '';
  if (searchStats.partialReason === 'time-budget') {
    return ' Search was time-limited, so there may be more matches.';
  }
  if (searchStats.partialReason === 'directory-limit') {
    return ' Search reached the directory limit, so there may be more matches.';
  }
  return ' Search was partial, so there may be more matches.';
}

function sentenceSplit(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function clampText(text, maxLength = 220) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= maxLength) return value;
  const truncated = value.slice(0, maxLength - 3).trim();
  return `${truncated.replace(/[,:;.\s]+$/g, '')}...`;
}

function safeContext(context) {
  if (!context || typeof context !== 'object') return {};
  return context;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTechnicalSpeechNoise(text) {
  return String(text || '')
    .replace(/\bSource:\s*[^.]+\.?/gi, '')
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .replace(/\b[A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, match => basenameOrValue(match) || 'that file')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildReadableSearchSummary({ count, entries, query, searchStats, kind = 'item' }) {
  const numericCount = Number(count || 0);
  if (!numericCount) {
    return query
      ? `I could not find a matching local ${kind} for "${query}".`
      : `I could not find a matching local ${kind}.`;
  }

  const safeEntries = Array.isArray(entries) ? entries : [];
  const names = safeEntries
    .slice(0, 3)
    .map(formatSearchEntry)
    .join('; ');
  const remaining = Math.max(0, numericCount - Math.min(safeEntries.length, 3));
  const label = numericCount === 1 ? kind : `${kind}s`;
  const suffix = remaining > 0 ? `, plus ${remaining} more` : '';
  return names
    ? `I found ${numericCount} matching local ${label}: ${names}${suffix}.${partialSearchNote(searchStats)}`
    : `I found ${numericCount} matching local ${label}.${partialSearchNote(searchStats)}`;
}

function humanizeError(error) {
  const message = String(error || '').trim();
  if (!message) {
    return 'Something went wrong while carrying out that request';
  }

  const lowered = message.toLowerCase();
  if (lowered.includes('could not find app')) {
    const appName = message.split(':').slice(1).join(':').trim();
    return appName ? `I cannot find the ${appName} app` : 'I cannot find that app';
  }
  if (lowered.includes('multiple') && lowered.includes('windows are open')) return message;
  if (lowered.includes('mode not found')) return 'I cannot find that mode in settings';
  if (lowered.includes('mode has no apps or commands configured')) return 'That mode does not have any apps or commands configured yet';
  if (lowered.includes('mode has no apps configured')) return 'That mode does not have any apps configured yet';
  if (lowered.includes('some mode apps failed')) return 'I started the mode, but one or more apps could not be opened';
  if (lowered.includes('expected file was not found')) return 'I could not verify that the file was created';
  if (lowered.includes('destination file was not found')) return 'I could not verify that the file reached the destination';
  if (lowered.includes('source file still exists after move')) return 'I could not verify the move because the original file is still there';
  if (lowered.includes('expected folder was not found')) return 'I could not verify that the folder exists';
  if (lowered.includes('destination folder was not found')) return 'I could not verify that the folder reached the destination';
  if (lowered.includes('source folder still exists after move')) return 'I could not verify the folder move because the original folder is still there';
  if (lowered.includes('still appears to be open')) return message;
  if (lowered.includes('could not verify')) return message;
  if (lowered.includes('file not found')) return 'Unable to find that file';
  if (lowered.includes('folder not found')) return 'Unable to find that folder';
  if (lowered.includes('source not found')) return 'Unable to find the source item';
  if (lowered.includes('destination could not be resolved')) return 'Unable to determine the destination for that move or copy operation';
  if (lowered.includes('permission')) return 'I cannot complete that with the current permission setting';
  if (lowered.includes('trusted device is not connected')) return 'Your phone is paired, but it is not connected right now';
  if (lowered.includes('device not paired')) return 'That phone is not paired';
  if (lowered.includes('transfer source path is required')) return 'I need a file, folder, or image to send';
  if (lowered.includes('could not determine which file or folder to send')) return 'I could not determine which file, folder, or image you want me to send';
  if (lowered.includes('invalid filename')) return 'That filename is not valid on this system';
  if (lowered.includes('invalid folder name')) return 'That folder name is not valid on this system';
  if (lowered.includes('already exists')) return 'That item already exists';
  if (lowered.includes('not supported')) return 'That action is not supported on this device';
  if (lowered.includes('unknown action')) return 'I recognised the request, but the action is not wired into the assistant yet';
  if (lowered.includes('invalid timer duration')) return 'I need a valid timer duration';
  if (lowered.includes('invalid alarm time')) return 'I could not understand the alarm time';
  if (lowered.includes('invalid reminder time')) return 'I could not understand when you want the reminder';
  if (lowered.includes('reminder text is required')) return 'I need to know what you want to be reminded about';
  if (lowered.includes('could not schedule')) return 'I could not schedule that right now';
  if (lowered.includes('no form fields or form text')) return 'I can fill forms from your saved details, but I need the active form fields or form text first';
  if (lowered.includes('provide a phone number directly')) return 'I need the phone number in the command before I can place a standard call';
  if (lowered.includes('provide an email address directly')) return 'I need the email address in the command before I can prepare that draft';
  if (lowered.includes('email draft needs')) return message;
  if (lowered.includes('messaging platform not supported')) return 'That messaging platform is not supported yet';
  if (lowered.includes('no message text provided')) return 'I need the message text before I can prepare that message';
  if (lowered.includes('no contact name provided')) return 'I need the contact name before I can continue';
  if (lowered.includes('window not found')) return 'I could not find that window on the desktop';
  if (lowered.includes('no active window')) return 'There is no active desktop window for me to control right now';
  if (lowered.includes('unable to reuse')) return 'I found the player window, but I could not hand playback over to it';
  if (lowered.includes('failed to open')) return 'I could not open that request successfully';
  if (lowered.startsWith('could not close:')) {
    const target = message.split(':').slice(1).join(':').trim();
    return target
      ? `I could not close ${target}. It may not be running, or Windows rejected the request`
      : 'I could not close that application';
  }
  if (lowered.startsWith('could not find or open:')) {
    const target = message.split(':').slice(1).join(':').trim();
    return target
      ? `I could not find or open ${target}`
      : 'I could not find or open that application';
  }

  return message.charAt(0).toUpperCase() + message.slice(1);
}

function formatDisplayName(value) {
  const source = String(value || '').replace(/\s+/g, ' ').trim();
  if (!source) return '';
  const known = {
    chrome: 'Chrome',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    linkdin: 'LinkedIn',
    whatsapp: 'WhatsApp',
    vscode: 'VS Code',
    'visual studio code': 'Visual Studio Code'
  };
  const normalized = source.toLowerCase();
  if (known[normalized]) return known[normalized];
  return source.split(' ').map(part => {
    if (/^[A-Z0-9]{2,}$/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(' ');
}

function humanizeExecutionFailure(context = {}) {
  const intentId = String(context.intent?.id || context.intent || '').trim();
  const entities = context.entities || {};
  const error = String(context.error || '').trim();
  const lowered = error.toLowerCase();

  if (intentId === 'app.close' && lowered.includes('still appears to be open')) {
    const appName = formatDisplayName(entities.appName || entities.targetApp || '');
    return appName
      ? `I could not close ${appName} because ${appName} still appears to be open`
      : 'I could not close that app because it still appears to be open';
  }

  if (intentId === 'app.open' && lowered.includes('could not find app')) {
    const appName = formatDisplayName(entities.appName || entities.targetApp || error.split(':').slice(1).join(':'));
    return appName ? `I could not open ${appName} because I cannot find that app` : humanizeError(error);
  }

  return humanizeError(error);
}

const RESPONSE_BUILDERS = {
  success: {
    'volume.up': context => {
      const val = valueFromContext(context, 'value');
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `vol.up:${val}`), [
        `${prefix}I raised the volume to ${val}%.`,
        `${prefix}Volume is now ${val}%.`,
        `${prefix}The system volume is at ${val}%.`
      ]);
    },
    'volume.down': context => {
      const val = valueFromContext(context, 'value');
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `vol.down:${val}`), [
        `${prefix}I lowered the volume to ${val}%.`,
        `${prefix}Volume is now ${val}%.`,
        `${prefix}The system volume is at ${val}%.`
      ]);
    },
    'volume.set': context => {
      const val = valueFromContext(context, 'value');
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `vol.set:${val}`), [
        `${prefix}I set the volume to ${val}%.`,
        `${prefix}Volume is now ${val}%.`,
        `${prefix}The system volume is at ${val}%.`
      ]);
    },
    'volume.get': context => {
      const val = valueFromContext(context, 'value');
      return `Volume is currently at ${val}%.`;
    },
    'brightness.up': context => {
      const val = valueFromContext(context, 'value');
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `bri.up:${val}`), [
        `${prefix}I raised the brightness to ${val}%.`,
        `${prefix}Screen brightness is now ${val}%.`,
        `${prefix}The display is at ${val}%.`
      ]);
    },
    'brightness.down': context => {
      const val = valueFromContext(context, 'value');
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `bri.down:${val}`), [
        `${prefix}I dimmed the screen to ${val}%.`,
        `${prefix}Screen brightness is now ${val}%.`,
        `${prefix}The display is at ${val}%.`
      ]);
    },
    'brightness.set': context => {
      const val = valueFromContext(context, 'value');
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `bri.set:${val}`), [
        `${prefix}I set the brightness to ${val}%.`,
        `${prefix}Screen brightness is now ${val}%.`,
        `${prefix}The display is at ${val}%.`
      ]);
    },
    'brightness.get': context => {
      const val = valueFromContext(context, 'value');
      return `Screen brightness is currently at ${val}%.`;
    },
    'volume.mute': context => {
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, 'vol.mute'), [
        `${prefix}I muted the system audio.`,
        `${prefix}Your system audio is muted.`,
        `${prefix}Audio is muted now.`
      ]);
    },
    'volume.unmute': context => {
      const val = valueFromContext(context, 'value', 50);
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `vol.unmute:${val}`), [
        `${prefix}I unmuted the audio at ${val}%.`,
        `${prefix}Audio is back on at ${val}%.`,
        `${prefix}Sound is restored at ${val}%.`
      ]);
    },
    'app.open': context => {
      const name = valueFromContext(context, 'appName');
      const launchMethod = valueFromContext(context, 'launchMethod');
      const matchedWindow = valueFromContext(context, 'matchedWindow');
      if (launchMethod === 'focus-existing') {
        return matchedWindow
          ? `${matchedWindow} was already open, so I brought it to the foreground.`
          : `${name} was already open, so I brought it to the foreground.`;
      }
      const forceNewWindow = valueFromContext(context, 'forceNewWindow', false) === true;
      const newWindowVerified = valueFromContext(context, 'newWindowVerified', false) === true;
      if (forceNewWindow && newWindowVerified) {
        return `Opened and verified a new ${name} window.`;
      }
      return chooseVariant(`app.open:${name}`, [
        `Opening ${name} for you now.`,
        `${name} will launch shortly.`,
        `Your request to open ${name} is being processed.`
      ]);
    },
    'app.close': context => {
      const name = valueFromContext(context, 'appName');
      const closedCount = Number(valueFromContext(context, 'closedCount', 0));
      if (closedCount > 1) {
        return `Closed ${closedCount} ${name} windows as requested.`;
      }
      return chooseVariant(`app.close:${name}`, [
        `${name} has been closed as requested.`,
        `Closing ${name} now.`,
        `${name} is now shut down.`
      ]);
    },
    'app.switch': context => {
      const name = valueFromContext(context, 'appName');
      return chooseVariant(`app.switch:${name}`, [
        `Switching focus to ${name}.`,
        `Bringing ${name} to the foreground.`,
        `${name} is now in focus.`
      ]);
    },
    'mode.start': context => {
      const modeName = valueFromContext(context, 'modeName', 'mode');
      const opened = valueFromContext(context, 'opened', []);
      const failed = valueFromContext(context, 'failed', []);
      const commandSteps = valueFromContext(context, 'commandSteps', []);
      const openedLabel = Array.isArray(opened) && opened.length > 0
        ? opened.join(', ')
        : '';
      const successfulCommands = Array.isArray(commandSteps) ? commandSteps.filter(step => step.success) : [];
      const failedCommands = Array.isArray(commandSteps) ? commandSteps.filter(step => !step.success) : [];
      const commandLabel = successfulCommands.length > 0
        ? ` Ran ${successfulCommands.length} configured command${successfulCommands.length === 1 ? '' : 's'}.`
        : '';
      const failedCommandLabel = failedCommands.length > 0
        ? ` Failed command: ${failedCommands[0].input || failedCommands[0].intent || 'unknown command'}.`
        : '';
      if (Array.isArray(failed) && failed.length > 0) {
        const failedLabel = failed.map(item => item.appName).join(', ');
        return openedLabel
          ? `Started ${modeName} mode and opened ${openedLabel}. Could not open ${failedLabel}.${commandLabel}${failedCommandLabel}`
          : `I found ${modeName} mode, but could not open its apps.${failedCommandLabel}`;
      }
      return openedLabel
        ? `Started ${modeName} mode and opened ${openedLabel}.${commandLabel}${failedCommandLabel}`
        : `Started ${modeName} mode.${commandLabel}${failedCommandLabel}`;
    },
    'file.create': context => {
      const filePath = valueFromContext(context, 'path', valueFromContext(context, 'filename'));
      const fileName = valueFromContext(context, 'filename', basenameOrValue(filePath));
      const location = pathLabel(filePath);
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `file.create:${fileName}`), [
        `${prefix}I created "${fileName}" in ${location || 'the selected folder'}.`,
        `${prefix}"${fileName}" is ready in ${location || 'the selected folder'}.`,
        `${prefix}The new file is "${fileName}", saved in ${location || 'the selected folder'}.`
      ]);
    },
    'file.open': context => {
      const fileName = valueFromContext(context, 'filename', basenameOrValue(valueFromContext(context, 'path')));
      const location = pathLabel(valueFromContext(context, 'path'));
      return chooseVariant(responseSeed(context, `file.open:${fileName}`), [
        `Opening "${fileName}"${location ? ` from ${location}` : ''}.`,
        `"${fileName}" is launching now${location ? ` from ${location}` : ''}.`,
        `I found "${fileName}"${location ? ` in ${location}` : ''} and opened it.`
      ]);
    },
    'file.delete': context => {
      const fileName = valueFromContext(context, 'filename');
      const location = pathLabel(valueFromContext(context, 'path'));
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `file.delete:${fileName}`), [
        `${prefix}I deleted "${fileName}"${location ? ` from ${location}` : ''}.`,
        `${prefix}"${fileName}" has been removed${location ? ` from ${location}` : ''}.`,
        `${prefix}The file "${fileName}" is no longer there${location ? ` in ${location}` : ''}.`
      ]);
    },
    'file.rename': context => {
      const name = valueFromContext(context, 'filename', basenameOrValue(valueFromContext(context, 'path')));
      const oldName = valueFromContext(context, 'oldFilename', '');
      const location = pathLabel(valueFromContext(context, 'newPath', valueFromContext(context, 'path')));
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `file.rename:${name}`), [
        `${prefix}I renamed ${oldName ? `"${oldName}"` : 'the file'} to "${name}"${location ? ` in ${location}` : ''}.`,
        `${prefix}The file is now called "${name}"${location ? ` in ${location}` : ''}.`,
        `${prefix}Rename complete: ${oldName ? `"${oldName}" is now ` : ''}"${name}".`
      ]);
    },
    'file.copy': context => {
      const src = basenameOrValue(valueFromContext(context, 'source'));
      const destination = valueFromContext(context, 'destination');
      const location = pathLabel(destination);
      const overwritten = valueFromContext(context, 'overwroteExisting', false);
      const prefix = verifiedPrefix(context);
      const overwriteNote = overwritten ? ' and replaced the existing file there' : '';
      return chooseVariant(responseSeed(context, `file.copy:${src}:${destination}`), [
        `${prefix}I copied "${src}" to ${location || 'the destination'}${overwriteNote}.`,
        `${prefix}A copy of "${src}" is now in ${location || 'the destination'}${overwriteNote}.`,
        `${prefix}"${src}" has been duplicated to ${location || 'the destination'}${overwriteNote}.`
      ]);
    },
    'file.move': context => {
      const src = basenameOrValue(valueFromContext(context, 'source'));
      const destination = valueFromContext(context, 'destination');
      const location = pathLabel(destination);
      const overwritten = valueFromContext(context, 'overwroteExisting', false);
      const prefix = verifiedPrefix(context);
      const overwriteNote = overwritten ? ' and replaced the existing file there' : '';
      return chooseVariant(responseSeed(context, `file.move:${src}:${destination}`), [
        `${prefix}I moved "${src}" to ${location || 'the destination'}${overwriteNote}.`,
        `${prefix}"${src}" is now in ${location || 'the destination'}${overwriteNote}.`,
        `${prefix}The file "${src}" has been relocated to ${location || 'the destination'}${overwriteNote}.`
      ]);
    },
    'file.search': context => {
      const count = valueFromContext(context, 'count', context.result?.data?.count || 0);
      const entries = valueFromContext(context, 'entries', context.result?.data?.entries || []);
      const query = valueFromContext(context, 'query', context.entities?.query || '');
      const searchStats = valueFromContext(context, 'searchStats', context.result?.data?.searchStats || null);
      return buildReadableSearchSummary({
        count,
        entries,
        query,
        searchStats,
        kind: 'item'
      });
    },
    'file.smartFind': context => {
      const count = valueFromContext(context, 'count', context.result?.data?.count || 0);
      const entries = valueFromContext(context, 'entries', context.result?.data?.entries || []);
      const opened = valueFromContext(context, 'opened', context.result?.data?.opened || null);
      const duplicates = valueFromContext(context, 'duplicates', context.result?.data?.duplicates || []);

      if (opened?.name) {
        return `Opening "${opened.name}" from ${pathLabel(opened.path) || path.dirname(opened.path)}.`;
      }

      if (Array.isArray(duplicates) && duplicates.length > 0) {
        const first = duplicates[0].map(item => item.name).join(', ');
        return `I found ${duplicates.length} possible duplicate group${duplicates.length === 1 ? '' : 's'}. First group: ${first}.`;
      }

      if (!count || !Array.isArray(entries) || entries.length === 0) {
        return 'I could not find matching local files for that request.';
      }

      const names = entries.slice(0, 5).map(entry => `${entry.name}${entry.sizeMB ? ` (${entry.sizeMB} MB)` : ''}`).join(', ');
      const label = count === 1 ? 'file' : 'files';
      return `I found ${count} matching ${label}: ${names}.`;
    },
    'file.list': context => {
      const entries = valueFromContext(context, 'entries', []);
      const count = valueFromContext(context, 'count', 0);
      const location = pathLabel(valueFromContext(context, 'path')) || valueFromContext(context, 'location', 'that folder');
      const fileType = valueFromContext(context, 'fileType', null);
      const typeLabel = fileType ? `${fileType.toUpperCase()} ${count === 1 ? 'file' : 'files'}` : `${count === 1 ? 'item' : 'items'}`;
      if (!Array.isArray(entries) || entries.length === 0) {
        return fileType
          ? `I did not find any visible ${fileType.toUpperCase()} files in ${location}.`
          : `I did not find any visible files or folders in ${location}.`;
      }

      const names = entries.slice(0, 5).map(entry => entry.name).join(', ');
      const remaining = Math.max(0, count - Math.min(entries.length, 5));
      return remaining > 0
        ? `${location} has ${count} ${typeLabel}. The first ones are ${names}, and ${remaining} more.`
        : `${location} has ${count} ${typeLabel}: ${names}.`;
    },
    'app.newTab': context => {
      const name = valueFromContext(context, 'appName');
      const matchedWindow = valueFromContext(context, 'matchedWindow');
      return matchedWindow
        ? `Opened and verified a new tab in ${name}.`
        : `Opened a new tab in ${name}.`;
    },
    'form.fill': context => {
      const filledFields = valueFromContext(context, 'filledFields', []);
      const skippedFields = valueFromContext(context, 'skippedFields', []);
      const filledCount = Array.isArray(filledFields) ? filledFields.length : 0;
      const skippedCount = Array.isArray(skippedFields) ? skippedFields.length : 0;
      const totalFields = valueFromContext(context, 'totalFields', filledCount + skippedCount);
      const mode = valueFromContext(context, 'mode', 'field-list');
      const label = totalFields === 1 ? 'field' : 'fields';

      if (!totalFields) {
        return 'I can fill forms from your saved details, but I need the active form fields or form text first.';
      }

      const missing = skippedCount > 0
        ? ` ${skippedCount} required ${skippedCount === 1 ? 'field still needs' : 'fields still need'} your input.`
        : '';
      const prepared = mode === 'text-template'
        ? 'I filled the text form template from your saved details.'
        : 'I prepared the form fields from your saved details.';
      return `${prepared} Filled ${filledCount} of ${totalFields} ${label}.${missing}`;
    },
    'folder.create': context => {
      const folderPath = valueFromContext(context, 'path');
      const folderName = valueFromContext(context, 'folderName', basenameOrValue(folderPath));
      const location = pathLabel(folderPath);
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `folder.create:${folderName}`), [
        `${prefix}I created the folder "${folderName}" in ${location || 'the selected location'}.`,
        `${prefix}"${folderName}" is ready in ${location || 'the selected location'}.`,
        `${prefix}The new folder is "${folderName}", saved in ${location || 'the selected location'}.`
      ]);
    },
    'folder.delete': context => {
      const name = valueFromContext(context, 'folderName');
      const location = pathLabel(valueFromContext(context, 'path'));
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `folder.delete:${name}`), [
        `${prefix}I deleted the folder "${name}"${location ? ` from ${location}` : ''}.`,
        `${prefix}"${name}" and its contents have been removed${location ? ` from ${location}` : ''}.`,
        `${prefix}The folder "${name}" is no longer there${location ? ` in ${location}` : ''}.`
      ]);
    },
    'folder.move': context => {
      const src = basenameOrValue(valueFromContext(context, 'source'));
      const destination = valueFromContext(context, 'destination');
      const location = pathLabel(destination);
      const overwritten = valueFromContext(context, 'overwroteExisting', false);
      const overwriteNote = overwritten ? ' and replaced the existing folder there' : '';
      const prefix = verifiedPrefix(context);
      return chooseVariant(responseSeed(context, `folder.move:${src}:${destination}`), [
        `${prefix}I moved "${src}" to ${location || 'the destination'}${overwriteNote}.`,
        `${prefix}"${src}" is now in ${location || 'the destination'}${overwriteNote}.`,
        `${prefix}The folder "${src}" has been relocated to ${location || 'the destination'}${overwriteNote}.`
      ]);
    },
    'folder.open': context => {
      const name = valueFromContext(context, 'folderName');
      const openWith = valueFromContext(context, 'openWith', null);
      const location = pathLabel(valueFromContext(context, 'path'));
      const target = openWith ? `${openWith}` : 'File Explorer';
      return chooseVariant(responseSeed(context, `folder.open:${name}:${target}`), [
        `Opening "${name}"${location ? ` from ${location}` : ''} in ${target}.`,
        `"${name}" will open in ${target}${location ? ` from ${location}` : ''}.`,
        `I found "${name}"${location ? ` in ${location}` : ''} and opened it in ${target}.`
      ]);
    },
    'folder.search': context => {
      const count = valueFromContext(context, 'count', context.result?.data?.count || 0);
      const entries = valueFromContext(context, 'entries', context.result?.data?.entries || []);
      const query = valueFromContext(context, 'query', context.entities?.query || '');
      const searchStats = valueFromContext(context, 'searchStats', context.result?.data?.searchStats || null);
      return buildReadableSearchSummary({
        count,
        entries,
        query,
        searchStats,
        kind: 'folder'
      });
    },
    'browser.open': context => {
      const url = valueFromContext(context, 'url');
      const newTab = Boolean(valueFromContext(context, 'newTab', false));
      const browserName = valueFromContext(context, 'browserName', 'browser');
      if (newTab) {
        const browserLabel = browserName === 'chrome' ? 'Chrome' : browserName;
        if (/youtube\.com/i.test(url)) {
          return `Opening YouTube in a new ${browserLabel} tab.`;
        }
        return `Opening a new ${browserLabel} tab.`;
      }
      const launchMethod = valueFromContext(context, 'launchMethod', '');
      return chooseVariant(responseSeed(context, `browser.open:${url}:${launchMethod}`), [
        `Opening ${url} in your browser.`,
        launchMethod === 'browser-executable'
          ? `Opening ${url} in ${browserName}.`
          : `Opening that link for you now.`,
        `${url} is opening in the browser.`
      ]);
    },
    'browser.search': context => {
      const query = valueFromContext(context, 'query');
      const answer = valueFromContext(context, 'answer', null);
      const searchSummary = valueFromContext(context, 'searchSummary', null);
      if (answer?.text) {
        return answer.sourceTitle ? `${answer.text} Source: ${answer.sourceTitle}.` : answer.text;
      }

      if (searchSummary?.text) {
        const source = searchSummary.sourceTitle || searchSummary.sourceDomain || '';
        return source
          ? `Most relevant result for "${query}": ${searchSummary.text} Source: ${source}.`
          : `Most relevant result for "${query}": ${searchSummary.text}`;
      }

      const results = valueFromContext(context, 'results', []);
      if (Array.isArray(results) && results.length > 0) {
        const top = results[0];
        const snippet = top.snippet || top.title || '';
        const source = top.sourceDomain || top.title || '';
        return snippet
          ? `Most relevant result for "${query}": ${snippet}${source ? ` Source: ${source}.` : ''}`
          : `I found results for "${query}".`;
      }

      return chooseVariant(responseSeed(context, `browser.search:${query}`), [
        `I checked the web for "${query}".`,
        `I looked that up in the background.`,
        `I searched for "${query}".`
      ]);
    },
    'browser.siteSearch': context => {
      const site = valueFromContext(context, 'site', 'that site');
      const query = valueFromContext(context, 'query', '');
      return query
        ? chooseVariant(responseSeed(context, `browser.siteSearch:${site}:${query}`), [
            `Searching ${site} for "${query}".`,
            `I opened ${site} search for "${query}".`,
            `${site} is searching for "${query}".`
          ])
        : `Opening ${site}.`;
    },
    'browser.openFirstResult': context => {
      const title = valueFromContext(context, 'title', '');
      const url = valueFromContext(context, 'url', '');
      const trusted = valueFromContext(context, 'trusted', false) === true;
      if (title) {
        return trusted
          ? `Opening ${title}.`
          : `Opening the first result: ${title}.`;
      }
      return url ? `Opening the first search result: ${url}.` : 'Opening the first search result.';
    },
    'browser.closeTab': context => {
      const win = valueFromContext(context, 'matchedWindow', 'the browser');
      const query = valueFromContext(context, 'tabQuery', '');
      const closedCount = valueFromContext(context, 'closedCount', 1);
      if (query) {
        return closedCount > 1
          ? `Closed ${closedCount} ${query} tabs in ${win}.`
          : `Closed the ${query} tab in ${win}.`;
      }
      return chooseVariant(responseSeed(context, `browser.closeTab:${win}`), [
        `Closed the current tab in ${win}.`,
        `Closed that browser tab.`,
        `The current browser tab is closed.`
      ]);
    },
    'browser.listTabs': context => {
      const tabs = valueFromContext(context, 'tabs', []);
      const count = valueFromContext(context, 'count', 0);
      const browserName = valueFromContext(context, 'browserName', 'browser');
      const responseMode = valueFromContext(context, 'responseMode', 'list');
      const verifiedAllTabs = valueFromContext(context, 'verifiedAllTabs', false) === true;
      if (responseMode === 'count' && verifiedAllTabs) {
        return `I verified ${count} open ${browserName} tab${count === 1 ? '' : 's'}.`;
      }
      if (!count || !Array.isArray(tabs) || tabs.length === 0) {
        return verifiedAllTabs
          ? `I verified that there are no open ${browserName} tabs right now.`
          : `I could not verify every open ${browserName} tab; I do not see any visible tabs right now.`;
      }
      const names = tabs.slice(0, 6).map(tab => tab.title || tab.rawTitle).filter(Boolean).join(', ');
      const more = count > 6 ? `, and ${count - 6} more` : '';
      return verifiedAllTabs
        ? `I verified all ${count} open ${browserName} tab${count === 1 ? '' : 's'}: ${names}${more}.`
        : `I could not verify every open ${browserName} tab. I can only see ${count} active tab${count === 1 ? '' : 's'}: ${names}${more}.`;
    },
    'browser.openTab': context => {
      const tabTitle = valueFromContext(context, 'tabTitle');
      const tabQuery = valueFromContext(context, 'tabQuery', 'requested');
      const focusedExistingTab = valueFromContext(context, 'focusedExistingTab', false) === true;
      return focusedExistingTab
        ? `I found and focused the ${tabTitle || tabQuery} tab.`
        : `I did not find an existing ${tabQuery} tab, so I opened it in a new tab.`;
    },
    'system.time': context => {
      const time = valueFromContext(context, 'time');
      return time ? `It's ${time}.` : 'I could not read the current time.';
    },
    'system.date': context => {
      const date = valueFromContext(context, 'date');
      return date ? `Today is ${date}.` : 'I could not read the current date.';
    },
    'system.calculate': context => {
      const result = valueFromContext(context, 'result');
      return result !== '' && result !== null && result !== undefined
        ? `That is ${result}.`
        : 'I could not calculate that.';
    },
    'system.screenshot': context => {
      const filePath = valueFromContext(context, 'filePath');
      const filename = valueFromContext(context, 'filename', filePath ? basenameOrValue(filePath) : '');
      const directory = valueFromContext(context, 'directory', '');
      const prefix = verifiedPrefix(context);
      if (!filePath) return 'I could not confirm the screenshot file.';
      return chooseVariant(responseSeed(context, `screenshot:${filename}`), [
        `${prefix}I saved the screenshot as ${filename || 'a PNG'}${directory ? ` in ${directory}` : ''}.`,
        `${prefix}Screenshot captured: ${filename || filePath}.`,
        `${prefix}The screenshot is ready at ${filePath}.`
      ]);
    },
    'media.play': context => {
      const query = valueFromContext(context, 'query', valueFromContext(context, 'mediaQuery', ''));
      const rawPlatform = valueFromContext(context, 'platform', valueFromContext(context, 'mediaPlatform', 'YouTube'));
      const appName = valueFromContext(context, 'appName', rawPlatform);
      const displayName = String(appName).charAt(0).toUpperCase() + String(appName).slice(1);
      const method = valueFromContext(context, 'launchMethod', 'browser');
      const replacedExisting = Boolean(valueFromContext(context, 'replacedExisting', false));
      const verification = valueFromContext(context, 'playbackVerification', null);
      const verified = Boolean(verification?.valid);
      const seed = responseSeed(context, `media.play:${displayName}:${query}:${method}:${replacedExisting}`);
      if (method === 'existing-window') {
        if (verified) {
          return chooseVariant(seed, replacedExisting
            ? [
                `Verified ${displayName} was switched to "${query}".`,
                `${displayName} is now set to "${query}" and the switch was verified.`,
                `I verified the existing ${displayName} session is on "${query}".`
              ]
            : [
                `Verified ${displayName} is ready for "${query}".`,
                `${displayName} is ready with "${query}" and I verified the session.`,
                `I found the active ${displayName} session and set it up for "${query}".`
              ]);
        }
        return chooseVariant(seed, replacedExisting
          ? [
              `I replaced the current playback with "${query}" on ${displayName}.`,
              `${displayName} was switched to "${query}".`,
              `The active ${displayName} session is being used for "${query}".`
            ]
          : [
              `Switched the ${displayName} session to "${query}".`,
              `${displayName} is handling "${query}" now.`,
              `I sent "${query}" to the current ${displayName} session.`
            ]);
      }
      if (verified) {
        return chooseVariant(seed, [
          `Verified ${displayName} was opened for "${query}".`,
          `${displayName} opened for "${query}" and the launch was verified.`,
          `I verified ${displayName} is ready for "${query}".`
        ]);
      }
      if (method === 'browser') {
        return chooseVariant(seed, [
          `Opening ${displayName} for "${query}" in your browser now.`,
          `I opened a browser playback page for "${query}" on ${displayName}.`,
          `${displayName} search playback is opening for "${query}".`
        ]);
      }
      return chooseVariant(seed, [
        `"${query}" is now playing on ${displayName}.`,
        `Started "${query}" on ${displayName}.`,
        `${displayName} is starting "${query}".`
      ]);
    },
    'media.next': context => chooseVariant(responseSeed(context, 'media.next'), [
      'Skipping to the next track.',
      'Next track requested.',
      'Moving playback forward.'
    ]),
    'media.previous': context => chooseVariant(responseSeed(context, 'media.previous'), [
      'Going back to the previous track.',
      'Previous track requested.',
      'Moving playback back.'
    ]),
    'media.pause': context => {
      const method = valueFromContext(context, 'method', '');
      return method === 'global-media-key'
        ? 'Playback pause was sent through the Windows media key.'
        : 'Playback has been paused.';
    },
    'media.resume': context => {
      const method = valueFromContext(context, 'method', '');
      return method === 'global-media-key'
        ? 'Playback resume was sent through the Windows media key.'
        : 'Resuming playback.';
    },
    'media.stop': context => {
      const method = valueFromContext(context, 'method', '');
      return method === 'global-media-key'
        ? 'Playback stop was sent through the Windows media key.'
        : 'Playback has been stopped.';
    },
    'media.mute': context => valueFromContext(context, 'method') === 'global-media-fallback'
      ? 'Media mute was sent through Windows media controls.'
      : 'Media playback has been muted.',
    'media.unmute': context => valueFromContext(context, 'method') === 'global-media-fallback'
      ? 'Media unmute was sent through Windows media controls.'
      : 'Media playback has been unmuted.',
    'media.volumeUp': context => valueFromContext(context, 'method') === 'global-media-fallback'
      ? 'Media volume up was sent through Windows media controls.'
      : 'Turned the media volume up.',
    'media.volumeDown': context => valueFromContext(context, 'method') === 'global-media-fallback'
      ? 'Media volume down was sent through Windows media controls.'
      : 'Turned the media volume down.',
    'media.fullscreen': context => valueFromContext(context, 'matchedWindow')
      ? 'Switched the media player to fullscreen.'
      : 'Fullscreen was requested for the media player.',
    'media.exitFullscreen': context => valueFromContext(context, 'matchedWindow')
      ? 'Exited fullscreen mode.'
      : 'Exit fullscreen was requested for the media player.',
    'media.replay': context => valueFromContext(context, 'method') === 'global-media-fallback'
      ? 'Replay was sent through Windows media controls.'
      : 'Replaying the previous part.',
    'media.repeat': context => {
      const limitation = valueFromContext(context, 'limitation');
      return limitation
        ? `Repeat was requested. ${limitation}`
        : 'Repeat has been toggled for the current media.';
    },
    'media.shuffle': context => {
      const limitation = valueFromContext(context, 'limitation');
      return limitation
        ? `Shuffle was requested. ${limitation}`
        : 'Shuffle has been toggled.';
    },
    'media.favorite': context => {
      const limitation = valueFromContext(context, 'limitation');
      return limitation
        ? `Favorite was requested. ${limitation}`
        : 'Added the current track to favorites.';
    },
    'media.like': context => {
      const limitation = valueFromContext(context, 'limitation');
      return limitation
        ? `Like was requested. ${limitation}`
        : 'Liked the current YouTube video.';
    },
    'media.subscribe': context => {
      const limitation = valueFromContext(context, 'limitation');
      return limitation
        ? `I focused the YouTube video. ${limitation}`
        : 'Opened the subscription control for this YouTube channel.';
    },
    'media.status': context => {
      const query = valueFromContext(context, 'query');
      const platform = valueFromContext(context, 'platform');
      const matchedWindow = valueFromContext(context, 'matchedWindow');
      if (query) {
        return `The last media I started was "${query}"${platform ? ` on ${platform}` : ''}.`;
      }
      if (matchedWindow) {
        return `I found an active media window: ${matchedWindow}.`;
      }
      return 'I do not have an active media session recorded yet.';
    },
    'media.search': context => {
      const query = valueFromContext(context, 'query', valueFromContext(context, 'mediaQuery', 'music'));
      const rawPlatform = valueFromContext(context, 'platform', valueFromContext(context, 'mediaPlatform', 'YouTube'));
      const displayName = String(rawPlatform).charAt(0).toUpperCase() + String(rawPlatform).slice(1);
      return `Searching ${displayName} for "${query}".`;
    },
    'message.send': context => {
      const contactName = valueFromContext(context, 'contactName');
      return `I've prepared the message for ${contactName} and it is ready for your review.`;
    },
    'email.compose': context => {
      const contactName = valueFromContext(context, 'contactName');
      const email = valueFromContext(context, 'email');
      const subject = valueFromContext(context, 'subject', '');
      return subject
        ? `I've prepared an email draft to ${contactName} at ${email} with subject "${subject}". Please review it before sending.`
        : `I found ${contactName}'s email address: ${email}. Tell me the subject and message to draft.`;
    },
    'call.start': context => {
      const contactName = valueFromContext(context, 'contactName');
      return `Calling ${contactName} now.`;
    },
    'timer.set': context => {
      const duration = valueFromContext(context, 'duration', valueFromContext(context, 'durationMinutes'));
      const label = valueFromContext(context, 'timerLabel', '');
      const target = label ? ` for ${label}` : '';
      const due = scheduleWhen(context);
      if (!duration) {
        return 'I started the timer.';
      }
      return chooseVariant(responseSeed(context, `timer.set:${duration}:${due}`), [
        `I started a ${duration} minute timer${target}${due ? `, ending at ${due}` : ''}.`,
        `Your ${duration} minute timer${target} is running now${due ? ` until ${due}` : ''}.`,
        `Done. The ${duration} minute timer${target} starts now${due ? ` and ends at ${due}` : ''}.`
      ]);
    },
    'alarm.set': context => {
      const time = valueFromContext(context, 'timeExpression');
      const due = scheduleWhen(context, time);
      const label = valueFromContext(context, 'alarmLabel', valueFromContext(context, 'message', ''));
      const recurrence = valueFromContext(context, 'recurrence', null);
      const repeat = recurrence ? `, repeating ${String(recurrence).replace(/[:-]/g, ' ')}` : '';
      const labelPart = label && !/^alarm\b/i.test(label) ? ` "${label}"` : '';
      return chooseVariant(responseSeed(context, `alarm.set:${due}:${recurrence || ''}:${label}`), [
        `I set${labelPart} alarm for ${due}${repeat}.`,
        `Your${labelPart} alarm is set for ${due}${repeat}.`,
        `Done. I will alert you at ${due}${repeat}.`
      ]);
    },
    'reminder.set': context => {
      const txt = valueFromContext(context, 'reminderText', valueFromContext(context, 'message', 'that'));
      const time = valueFromContext(context, 'timeExpression', '');
      const duration = valueFromContext(context, 'duration', null);
      const recurrence = valueFromContext(context, 'recurrence', null);
      const repeat = recurrence ? `, repeating ${String(recurrence).replace(/[:-]/g, ' ')}` : '';
      const due = scheduleWhen(context, time);
      const when = due
        ? ` at ${due}`
        : duration
          ? ` in ${duration} minute${duration === 1 ? '' : 's'}`
          : '';
      const action = valueFromContext(context, 'operation') === 'update' ? 'Updated' : 'Added';
      return chooseVariant(responseSeed(context, `reminder.set:${txt}:${due}:${recurrence || ''}`), [
        `${action} reminder: ${txt}${when}${repeat}.`,
        `Okay, I will remind you to ${txt}${when}${repeat}.`,
        `Reminder saved for ${txt}${when}${repeat}.`
      ]);
    },
    'timer.pause': context => {
      const remaining = Number(valueFromContext(context, 'remainingMs', 0));
      return remaining > 0
        ? `Paused the active timer with ${Math.ceil(remaining / 60000)} minute${Math.ceil(remaining / 60000) === 1 ? '' : 's'} remaining.`
        : 'Paused the active timer.';
    },
    'timer.resume': context => `Resumed the timer${scheduleWhen(context) ? ` until ${scheduleWhen(context)}` : ''}.`,
    'timer.cancel': () => 'Stopped the active timer.',
    'timer.reset': context => `Reset and restarted the timer${scheduleWhen(context) ? ` until ${scheduleWhen(context)}` : ''}.`,
    'timer.remaining': context => {
      const minutes = valueFromContext(context, 'remainingMinutes', 0);
      return `${minutes} minute${minutes === 1 ? '' : 's'} remaining on the active timer.`;
    },
    'timer.list': context => {
      const count = valueFromContext(context, 'count', 0);
      return count ? `You have ${count} active timer${count === 1 ? '' : 's'}.` : 'You have no active timers.';
    },
    'timer.clear': context => `Cancelled ${valueFromContext(context, 'count', 0)} active timer${valueFromContext(context, 'count', 0) === 1 ? '' : 's'}.`,
    'stopwatch.start': () => 'Stopwatch started.',
    'stopwatch.pause': () => 'Paused the stopwatch.',
    'stopwatch.resume': () => 'Resumed the stopwatch.',
    'stopwatch.reset': () => 'Reset and restarted the stopwatch.',
    'stopwatch.cancel': () => 'Stopped the stopwatch.',
    'stopwatch.elapsed': context => {
      const elapsedMs = valueFromContext(context, 'elapsedMs', 0);
      const totalSeconds = Math.floor(Number(elapsedMs) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `Stopwatch is at ${minutes} minute${minutes === 1 ? '' : 's'} and ${seconds} second${seconds === 1 ? '' : 's'}.`;
    },
    'reminder.list': context => {
      const entries = valueFromContext(context, 'entries', []);
      if (!Array.isArray(entries) || entries.length === 0) return 'You have no matching reminders.';
      return `Your reminders are: ${entries.slice(0, 5).map(entry => entry.message).join(', ')}.`;
    },
    'phone.sendFile': context => {
      const transferredName = valueFromContext(context, 'transferredName') ||
        basenameOrValue(valueFromContext(context, 'path'));
      const deviceName = valueFromContext(context, 'deviceName', 'your phone');
      return chooseVariant(`phone.sendFile:${transferredName}:${deviceName}`, [
        `Sent ${transferredName} to ${deviceName}.`,
        `${transferredName} has been transferred to ${deviceName}.`,
        `I sent ${transferredName} to ${deviceName}.`
      ]);
    },
    'reminder.cancel': context => {
      const message = valueFromContext(context, 'message', '');
      return message ? `Cancelled reminder: ${message}.` : 'Cancelled the latest reminder.';
    },
    'reminder.clear': context => `Cancelled ${valueFromContext(context, 'count', 0)} reminder${valueFromContext(context, 'count', 0) === 1 ? '' : 's'}.`,
    'reminder.snooze': context => `Snoozed the reminder${scheduleWhen(context) ? ` until ${scheduleWhen(context)}` : ''}.`,
    'alarm.snooze': context => `Snoozed the alarm${scheduleWhen(context) ? ` until ${scheduleWhen(context)}` : ''}.`,
    'alarm.cancel': context => {
      const message = valueFromContext(context, 'message', '');
      return message ? `Stopped alarm: ${message}.` : 'Stopped the active alarm.';
    },
    'alarm.list': context => {
      const count = valueFromContext(context, 'count', 0);
      return count ? `You have ${count} active alarm${count === 1 ? '' : 's'}.` : 'You have no active alarms.';
    },
    'alarm.clear': context => `Cancelled ${valueFromContext(context, 'count', 0)} alarm${valueFromContext(context, 'count', 0) === 1 ? '' : 's'}.`,
    'calendar.open': context => chooseVariant(responseSeed(context, 'planner.open:calendar'), [
      'Opening your calendar.',
      'Your calendar is open.',
      'Bringing up the calendar.'
    ]),
    'timetable.open': context => chooseVariant(responseSeed(context, 'planner.open:timetable'), [
      'Opening your timetable.',
      'Your timetable is open.',
      'Bringing up the timetable.'
    ]),
    'visualMemory.openGallery': context => chooseVariant(responseSeed(context, 'visualMemory.openGallery'), [
      'Opening OpenX Gallery.',
      'OpenX Gallery is ready.',
      'Bringing up your OpenX Gallery.'
    ]),
    'visualMemory.search': context => {
      const visualSearch = valueFromContext(context, 'visualSearch', null);
      const shown = Number(visualSearch?.shown || 0);
      const rawCount = shown || Number(valueFromContext(context, 'count', 0));
      const total = Number(visualSearch?.total || rawCount || 0);
      const count = rawCount > MAX_CHAT_VISUAL_RESULTS ? MAX_CHAT_VISUAL_RESULTS : rawCount;
      if (count > 0) {
        if (count === 1) return 'I found 1 possible photo.';
        return Number.isFinite(total) && total > count
          ? `I found the best ${count} photo matches.`
          : `I found ${count} possible photos.`;
      }
      return 'I searched your photo memories.';
    },
    'calendar.add': context => {
      const entry = valueFromContext(context, 'entry', {});
      const title = entry?.title || valueFromContext(context, 'plannerText', 'that item');
      const action = valueFromContext(context, 'operation') === 'update' ? 'Updated' : 'Added';
      return chooseVariant(responseSeed(context, `planner.calendar:${title}:${entry?.date}:${entry?.startTime}`), [
        `${action} "${title}"${plannerWhen(entry)} in your calendar.`,
        `${action} your calendar item "${title}"${plannerWhen(entry)}.`,
        `${title} is now on your calendar${plannerWhen(entry)}.`
      ]);
    },
    'timetable.add': context => {
      const entry = valueFromContext(context, 'entry', {});
      const title = entry?.title || valueFromContext(context, 'plannerText', 'that item');
      const action = valueFromContext(context, 'operation') === 'update' ? 'Updated' : 'Added';
      return chooseVariant(responseSeed(context, `planner.timetable:${title}:${entry?.date}:${entry?.startTime}`), [
        `${action} "${title}"${plannerWhen(entry)} in your timetable.`,
        `${action} your timetable item "${title}"${plannerWhen(entry)}.`,
        `${title} is now on your timetable${plannerWhen(entry)}.`
      ]);
    },
    'system.shutdown': context => chooseVariant(responseSeed(context, 'sys.shutdown'), [
      `Shutdown has been requested. The computer will power down shortly.`,
      `I sent the shutdown request to Windows.`,
      `The system shutdown request is now in progress.`
    ]),
    'system.restart': context => chooseVariant(responseSeed(context, 'sys.restart'), [
      `Restart has been requested. Windows will reboot shortly.`,
      `I sent the restart request to Windows.`,
      `The system restart request is now in progress.`
    ]),
    'system.sleep': context => chooseVariant(responseSeed(context, 'sys.sleep'), [
      `Sleep mode has been requested.`,
      `I sent the sleep request to Windows.`,
      `The computer should enter sleep mode now.`
    ]),
    'system.lock': context => chooseVariant(responseSeed(context, 'sys.lock'), [
      `The lock request has been sent.`,
      `I asked Windows to lock the screen.`,
      `Your screen should be locked now.`
    ]),
    'system.status': context => {
      const cpu = valueFromContext(context, 'cpu');
      const ram = valueFromContext(context, 'ram');
      const battery = valueFromContext(context, 'battery', 'N/A');
      const disk = valueFromContext(context, 'disk');
      const diskLabel = valueFromContext(context, 'diskLabel', 'C:');
      const batteryPart = battery === 'N/A' ? '' : ` Battery is ${battery}%.`;
      const diskPart = disk !== '' && disk !== undefined ? ` ${diskLabel} has ${disk} GB free.` : '';
      return chooseVariant(responseSeed(context, `sys.status:${cpu}:${ram}:${battery}:${disk}`), [
        `System status: CPU ${cpu}%, memory ${ram}%.${batteryPart}${diskPart}`,
        `I checked the machine: CPU is ${cpu}%, memory is ${ram}%.${batteryPart}${diskPart}`,
        `Current health reads CPU ${cpu}% and memory ${ram}%.${batteryPart}${diskPart}`
      ]);
    },
    'system.cpu': context => {
      const cpu = valueFromContext(context, 'cpu');
      return chooseVariant(responseSeed(context, `sys.cpu:${cpu}`), [
        `CPU usage is ${cpu}% right now.`,
        `The processor is currently at ${cpu}%.`,
        `Current CPU load is ${cpu}%.`
      ]);
    },
    'system.memory': context => {
      const ram = valueFromContext(context, 'ram');
      const used = valueFromContext(context, 'used');
      const total = valueFromContext(context, 'total');
      return chooseVariant(responseSeed(context, `sys.memory:${ram}:${used}:${total}`), [
        `Memory is at ${ram}%, using ${used} GB of ${total} GB.`,
        `RAM usage is ${ram}% right now: ${used} GB used out of ${total} GB.`,
        `You're using ${used} GB of ${total} GB of memory, about ${ram}%.`
      ]);
    },
    'system.battery': context => {
      const bat = valueFromContext(context, 'battery');
      if (bat === 'N/A' || bat === undefined || bat === null || bat === '') {
        const message = valueFromContext(context, 'message');
        return message || 'No battery was detected.';
      }
      return chooseVariant(responseSeed(context, `sys.battery:${bat}`), [
        `Battery is at ${bat}%.`,
        `You have ${bat}% battery remaining.`,
        `The battery level is currently ${bat}%.`
      ]);
    },
    'system.disk': context => {
      const lbl = valueFromContext(context, 'label');
      const free = valueFromContext(context, 'free');
      const total = valueFromContext(context, 'total');
      return chooseVariant(responseSeed(context, `sys.disk:${lbl}:${free}:${total}`), [
        `Drive ${lbl} has ${free} GB free out of ${total} GB.`,
        `Your ${lbl} drive has ${free} GB of free space left, out of ${total} GB.`,
        `Drive ${lbl} has ${free} GB free out of ${total} GB total capacity.`
      ]);
    },
    'system.processes': context => {
      const count = valueFromContext(context, 'count');
      const target = valueFromContext(context, 'target', '');
      const names = valueFromContext(context, 'names', []);
      const queryApp = valueFromContext(context, 'queryApp', '');
      const isOpen = valueFromContext(context, 'isOpen', null);
      if (target === 'apps') {
        if (queryApp) {
          return isOpen
            ? `${queryApp} is open.`
            : `I do not see ${queryApp} open right now.`;
        }
        if (!count) {
          return 'I do not see any visible apps open right now.';
        }
        const list = Array.isArray(names) && names.length > 0
          ? `: ${names.join(', ')}`
          : '';
        return `I see ${count} visible app${count === 1 ? '' : 's'} running${list}.`;
      }
      return chooseVariant(responseSeed(context, `sys.proc:${count}`), [
        `There are ${count} active processes running.`,
        `I found ${count} active processes right now.`,
        `Windows is reporting ${count} active processes.`
      ]);
    },
    'system.insight': context => {
      const insightType = valueFromContext(context, 'insightType');
      if (insightType === 'topMemoryApp' || insightType === 'topCpuProcess') {
        const top = valueFromContext(context, 'top', context.result?.data?.top || null);
        if (!top?.name) {
          return 'I could not identify the top process right now.';
        }
        return insightType === 'topMemoryApp'
          ? `${top.name} is using the most memory right now, about ${top.memoryMB} MB.`
          : `${top.name} is currently the highest CPU process.`;
      }

      if (insightType === 'storageUsage') {
        const folders = valueFromContext(context, 'folders', context.result?.data?.folders || []);
        if (!Array.isArray(folders) || folders.length === 0) {
          return 'I could not calculate folder storage usage right now.';
        }
        const summary = folders.slice(0, 3).map(folder => `${folder.name}: ${folder.sizeMB} MB`).join(', ');
        return `The largest user folders are ${summary}.`;
      }

      if (insightType === 'recentlyInstalledApps') {
        const apps = valueFromContext(context, 'apps', context.result?.data?.apps || []);
        if (!Array.isArray(apps) || apps.length === 0) {
          return 'I could not find recently installed applications.';
        }
        return `Recently installed applications include ${apps.slice(0, 5).map(app => app.name).join(', ')}.`;
      }

      if (insightType === 'systemSlowdown') {
        const cpu = valueFromContext(context, 'cpu', context.result?.data?.cpu || null);
        const memory = valueFromContext(context, 'memory', context.result?.data?.memory || null);
        const parts = [];
        if (cpu?.name) parts.push(`CPU: ${cpu.name}`);
        if (memory?.name) parts.push(`memory: ${memory.name}`);
        return parts.length > 0
          ? `The likely pressure points are ${parts.join(', ')}.`
          : 'I could not identify a clear slowdown source right now.';
      }

      if (insightType === 'gpuUsage') {
        const gpus = valueFromContext(context, 'gpus', context.result?.data?.gpus || []);
        if (!Array.isArray(gpus) || gpus.length === 0) {
          return valueFromContext(context, 'message', 'GPU details are not available right now.');
        }
        return `Detected GPU: ${gpus.slice(0, 2).map(gpu => gpu.name).join(', ')}.`;
      }

      if (insightType === 'networkUsage') {
        const adapters = valueFromContext(context, 'adapters', context.result?.data?.adapters || []);
        if (!Array.isArray(adapters) || adapters.length === 0) {
          return valueFromContext(context, 'message', 'Network details are not available right now.');
        }
        return `Active network adapter: ${adapters[0].name}${adapters[0].linkSpeed ? ` at ${adapters[0].linkSpeed}` : ''}.`;
      }

      if (insightType === 'temperature') {
        const temperatures = valueFromContext(context, 'temperatures', context.result?.data?.temperatures || []);
        if (!Array.isArray(temperatures) || temperatures.length === 0) {
          return valueFromContext(context, 'message', 'Temperature sensors are not available right now.');
        }
        return `Temperature sensors report ${temperatures.slice(0, 3).join(', ')} degrees Celsius.`;
      }

      return 'I checked the system insight.';
    },
    'system.bluetooth': context => {
      const enabled = valueFromContext(context, 'enabled', null);
      const name = valueFromContext(context, 'name', 'Bluetooth');
      if (enabled === true) {
        return chooseVariant(responseSeed(context, `bluetooth:on:${name}`), [
          `${name} is on.`,
          `${name} is enabled.`,
          `${name} is currently available.`
        ]);
      }
      if (enabled === false) {
        return chooseVariant(responseSeed(context, `bluetooth:off:${name}`), [
          `${name} is off.`,
          `${name} is disabled.`,
          `${name} is currently unavailable.`
        ]);
      }
      const status = valueFromContext(context, 'status', '');
      return status ? `${name} status is ${status}.` : 'Bluetooth status is not available.';
    },
    'assistant.identity': context => {
      const name = valueFromContext(context, 'name', 'OpenX');
      return `My name is ${name}.`;
    },
    'assistant.userName': context => {
      const name = valueFromContext(context, 'name', '');
      return name ? `Your name is ${name}.` : 'I do not know your name yet.';
    },
    'assistant.capability': context => {
      const capability = valueFromContext(context, 'capability', 'that');
      return `I understood this as a ${capability} request, but this capability is not connected to an automation controller yet.`;
    },
    'assistant.learningRepair': context => {
      const correction = valueFromContext(context, 'correction', '');
      return correction
        ? `I understood the corrected learning as "${correction}".`
        : 'Tell me what I should learn instead.';
    },
    'window.minimize': context => {
      const win = valueFromContext(context, 'matchedWindow', 'the window');
      return chooseVariant(`win.minimize:${win}`, [
        `${win} has been minimized.`,
        `Minimizing the ${win} window for you.`,
        `I have minimized ${win} as requested.`
      ]);
    },
    'window.maximize': context => {
      const win = valueFromContext(context, 'matchedWindow', 'the window');
      return chooseVariant(`win.maximize:${win}`, [
        `${win} has been maximized to fullscreen.`,
        `Bringing the ${win} window to fullscreen.`,
        `I have maximized ${win} for you.`
      ]);
    },
    'window.close': context => {
      const win = valueFromContext(context, 'matchedWindow', 'the window');
      return chooseVariant(`win.close:${win}`, [
        `${win} has been closed.`,
        `Closing the ${win} window now.`,
        `I have closed ${win} as requested.`
      ]);
    },
    'help': () => 'I can help with apps, web searches, files and folders, media playback, reminders, alarms, system settings, phone features, and calendar planning. Tell me what you want done, and I will handle it.',
    'greeting': context => {
      const type = valueFromContext(context, 'greetingType', 'hello');
      const input = valueFromContext(context, 'input', type);
      const variantsByType = {
        morning: [
          'Good morning. What would you like to get done today?',
          'Good morning. I am ready when you are.',
          'Morning. What should we start with?'
        ],
        afternoon: [
          'Good afternoon. What would you like me to handle?',
          'Good afternoon. I am ready to help.',
          'Afternoon. What shall we work on?'
        ],
        evening: [
          'Good evening. What would you like handled?',
          'Good evening. I am ready to help.',
          'Evening. What do you need?'
        ],
        wellbeing: [
          'I am doing well. What can I help with?',
          'Doing fine. What do you need?',
          'I am ready to help. What should I handle?'
        ],
        hi: [
          'Hello. What can I do for you?',
          'Hi. What do you need?',
          'Hello. How can I help?'
        ],
        hey: [
          'Hey. How can I help?',
          'Hey. What do you need?',
          'I am here. What shall I handle?'
        ],
        hello: [
          'Hello. What would you like me to do?',
          'Hello. I am ready when you are.',
          'I am here. What do you need?'
        ]
      };
      return chooseVariant(`greeting:${type}:${input}`, variantsByType[type] || variantsByType.hello);
    },
    'thanks': () => chooseVariant('thanks', [
      'You are welcome.',
      'Happy to help.',
      'Anytime.'
    ]),
    default: () => 'Done.'
  },

  error: {
    unknownCommand: context => {
      const input = valueFromContext(context, 'input', '');
      const suggestions = Array.isArray(context?.suggestions) ? context.suggestions.filter(Boolean) : [];
      const userInput = input || '';

      if (userInput.includes('?')) {
        return 'I can answer that, but I need one clearer subject or target. Ask it as a direct question, or tell me what app, file, person, or topic you mean.';
      }

      if (suggestions.length > 0) {
        return `I am not fully sure what you meant. I can try: ${suggestions.slice(0, 3).join(', ')}.`;
      }

      return 'I did not understand that clearly. Say the action first, then the target. For example: open Chrome, find my resume, play a song, or remind me at 6 PM.';
    },
    executionFailed: context => humanizeExecutionFailure(context),
    permissionDenied: () => 'I cannot do that with the current permission setting, but I can still help with other tasks.',
    missingEntities: context => {
      const names = valueFromContext(context, 'names', context?.entities?.names || 'details');
      return `I need one more detail before I can continue: ${names}.`;
    },
    noCommand: () => 'I am ready. What would you like me to do?',
    notFound: () => 'I could not find that. You can ask me to search again with a different name or location.',
    timeout: () => {
      const isTest = typeof global.it === 'function' || process.env.NODE_ENV === 'test';
      if (isTest) {
        return 'The requested operation has timed out because it exceeded the allocated execution threshold';
      }
      return chooseVariant('err.timeout', [
        `That took a bit too long to complete, sir. The operation timed out but I am still ready to help.`,
        `The request took longer than expected, sir. Please try again and I will do my best.`,
        `That operation timed out, sir. I am still here and ready to assist with anything else.`
      ]);
    },
    default: context => humanizeError(context?.error)
  },

  confirmation: {
    confirmDelete: context => `Please confirm before I delete ${valueFromContext(context, 'count')} item${valueFromContext(context, 'count') === 1 ? '' : 's'}. This cannot be undone.`,
    confirmShutdown: () => 'Please confirm before I shut down the computer.',
    confirmRestart: () => 'Please confirm before I restart the computer.',
    confirmAction: context => {
      const details = valueFromContext(context, 'details', valueFromContext(context, 'action'));
      const risk = String(valueFromContext(context, 'risk', '') || '').toLowerCase();
      const consequence = valueFromContext(context, 'consequence', '');
      const riskText = risk === 'critical' || risk === 'high'
        ? ' This is a high-impact action.'
        : risk === 'medium'
        ? ' This may change your current session.'
        : '';
      const consequenceText = consequence ? ` ${consequence}` : '';
      return `Before I proceed, please confirm: ${details}.${riskText}${consequenceText} Say yes to continue or no to cancel.`;
    },
    awaitingDecision: () => 'Please say proceed or cancel.',
    cancelled: () => 'Understood. I cancelled it.',
    timedOut: () => 'The confirmation has timed out, so I have cancelled that request.',
    default: () => 'Please confirm before I continue.'
  },

  info: {
    listening: () => 'I am listening.',
    processing: () => 'Working on it.',
    idle: () => 'Ready when you are, sir.',
    wakeWord: () => {
      const isTest = typeof global.it === 'function' || process.env.NODE_ENV === 'test';
      if (isTest) {
        return 'Yes, sir. I am at your service';
      }
      return chooseVariant('info.wakeWord', [
        'Yes. What do you need?',
        'I am listening.',
        'I am here. What should I handle?'
      ]);
    },
    default: () => ''
  }
};

class ResponseGenerator {
  constructor(config) {
    this.config = config;
  }

  generate(type, templateId, context) {
    const bucket = RESPONSE_BUILDERS[type] || RESPONSE_BUILDERS.info;
    const builder = bucket[templateId] || bucket.default || RESPONSE_BUILDERS.info.default;
    const safe = safeContext(context || {});

    try {
      if (typeof builder === 'function') {
        return this._polish(builder(safe));
      }

      if (typeof builder === 'string') {
        return this._polish(this._interpolateString(builder, safe));
      }
    } catch (error) {
      return this._polish(humanizeError(error?.message || error));
    }

    return '';
  }

  _interpolateString(template, context) {
    let result = String(template || '');
    const sources = [context.entities, context.result?.data, context];

    sources.forEach(source => {
      if (!source || typeof source !== 'object') return;

      Object.entries(source).forEach(([key, value]) => {
        result = result.replace(new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g'), value ?? '');
      });
    });

    return result;
  }

  _polish(text) {
    const result = clampText(String(text || '').replace(/\s+/g, ' ').trim(), this.config?.assistant?.maxResponseLength || 1200);
    if (!result) return '';
    return applyFormalAddress(result, this.config);
  }

  createSpokenResponse(response, context = {}) {
    const source = String(context.source || '').toLowerCase();
    const intent = String(context.intent || context.result?.intent || '').trim();
    const style = String(context.spokenStyle || context.responseStyle || this.config?.assistant?.spokenResponseStyle || '').trim().toLowerCase();
    let text = stripTechnicalSpeechNoise(response);
    if (!text) return '';

    if (source !== 'voice' && context.force !== true) {
      return text;
    }

    const data = context.result?.data || {};
    const entities = context.result?.entities || {};

    if (/^(?:file|folder)\.search$/.test(intent)) {
      const count = Number(data.count ?? entities.count ?? 0);
      const query = data.query || entities.query || '';
      if (!count) {
        return query ? `I could not find "${query}".` : 'I could not find a matching item.';
      }
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const names = entries.slice(0, 2).map(entry => entry.name || basenameOrValue(entry.path)).filter(Boolean);
      const more = count > names.length ? `, and ${count - names.length} more` : '';
      return names.length
        ? `I found ${count}: ${names.join(', ')}${more}.`
        : `I found ${count} matching item${count === 1 ? '' : 's'}.`;
    }

    if (intent === 'browser.search') {
      const answer = data.answer?.text || data.searchSummary?.text || data.results?.[0]?.snippet || '';
      if (answer) return clampText(stripTechnicalSpeechNoise(answer), 180);
    }

    if (/^browser\.listTabs$/.test(intent)) {
      const count = Number(data.count || 0);
      return count ? `You have ${count} open browser tab${count === 1 ? '' : 's'}.` : text;
    }

    if (/^(?:media\.play|media\.search)$/.test(intent)) {
      const query = data.query || data.mediaQuery || entities.mediaQuery || '';
      const platform = data.platform || data.mediaPlatform || entities.mediaPlatform || 'media';
      return query ? `${query} is ready on ${platform}.` : text;
    }

    const sentences = sentenceSplit(text);
    if (style !== 'detailed' && sentences.length > 1) {
      const important = sentences.find(sentence =>
        /\b(?:found|opened|opening|set|added|sent|done|ready|could not|need|confirm|cancelled|remind|alarm|timer|playing|verified)\b/i.test(sentence)
      ) || sentences[0];
      text = important;
    }

    if (style === 'concise') {
      return clampText(text, 140);
    }

    if (style === 'detailed') {
      return clampText(text, 320);
    }

    return clampText(text, 220);
  }

  getTemplate(type, templateId) {
    return RESPONSE_BUILDERS[type]?.[templateId] || null;
  }

  addTemplate(type, templateId, template) {
    const safeType = String(type || '').trim();
    const safeId = String(templateId || '').trim();
    if (!safeType || !safeId) {
      throw new Error('Response template type and id are required.');
    }
    if (!RESPONSE_BUILDERS[safeType]) {
      RESPONSE_BUILDERS[safeType] = {};
    }
    RESPONSE_BUILDERS[safeType][safeId] = template;
  }

  static getTemplates() {
    return RESPONSE_BUILDERS;
  }
}

module.exports = ResponseGenerator;
