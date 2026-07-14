const DEV_APPS = Object.freeze([
  'Code.exe',
  'Code - Insiders.exe',
  'devenv.exe',
  'WebStorm64.exe',
  'WindowsTerminal.exe',
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
  'docker desktop.exe',
  'git-bash.exe'
]);

const STREAM_APPS = Object.freeze([
  'obs64.exe',
  'streamlabs.exe'
]);

const MEDIA_APPS = Object.freeze([
  'Spotify.exe',
  'chrome.exe',
  'msedge.exe',
  'vlc.exe',
  'Music.UI.exe',
  'YouTube Music.exe'
]);

const GAME_APPS = Object.freeze([
  'steam.exe',
  'steamwebhelper.exe',
  'EpicGamesLauncher.exe',
  'RiotClientServices.exe',
  'valorant.exe',
  'cs2.exe',
  'FortniteClient-Win64-Shipping.exe'
]);

const WORK_APPS = Object.freeze([
  'Teams.exe',
  'ms-teams.exe',
  'OUTLOOK.EXE',
  'Zoom.exe',
  'WINWORD.EXE',
  'EXCEL.EXE',
  'POWERPNT.EXE',
  'OneNote.exe',
  'Slack.exe'
]);

const BROWSER_APPS = Object.freeze([
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'brave.exe',
  'opera.exe'
]);

const COMMUNICATION_APPS = Object.freeze([
  'Teams.exe',
  'ms-teams.exe',
  'Zoom.exe',
  'Slack.exe',
  'Discord.exe',
  'Telegram.exe',
  'Signal.exe'
]);

const CATEGORY_METADATA = Object.freeze({
  DEV_APPS: Object.freeze({ mode: 'DEV_MODE', label: 'development', priority: 80 }),
  STREAM_APPS: Object.freeze({ mode: 'STREAM_MODE', label: 'streaming', priority: 75 }),
  MEDIA_APPS: Object.freeze({ mode: 'MEDIA_MODE', label: 'media', priority: 55 }),
  GAME_APPS: Object.freeze({ mode: 'GAME_MODE', label: 'gaming', priority: 85 }),
  WORK_APPS: Object.freeze({ mode: 'WORK_MODE', label: 'work', priority: 70 }),
  BROWSER_APPS: Object.freeze({ mode: null, label: 'browser', priority: 50 }),
  COMMUNICATION_APPS: Object.freeze({ mode: 'WORK_MODE', label: 'communication', priority: 65 })
});

const CATEGORIES = Object.freeze({
  DEV_APPS,
  STREAM_APPS,
  MEDIA_APPS,
  GAME_APPS,
  WORK_APPS,
  BROWSER_APPS,
  COMMUNICATION_APPS
});

const ALIASES = Object.freeze({
  code: 'code.exe',
  vscode: 'code.exe',
  'visual studio code': 'code.exe',
  terminal: 'windowsterminal.exe',
  wt: 'windowsterminal.exe',
  powershell: 'powershell.exe',
  pwsh: 'pwsh.exe',
  docker: 'docker desktop.exe',
  chrome: 'chrome.exe',
  edge: 'msedge.exe',
  firefox: 'firefox.exe',
  brave: 'brave.exe',
  spotify: 'spotify.exe',
  vlc: 'vlc.exe',
  obs: 'obs64.exe',
  streamlabs: 'streamlabs.exe',
  steam: 'steam.exe',
  teams: 'teams.exe',
  'microsoft teams': 'teams.exe',
  outlook: 'outlook.exe',
  word: 'winword.exe',
  excel: 'excel.exe',
  powerpoint: 'powerpnt.exe',
  zoom: 'zoom.exe',
  slack: 'slack.exe',
  discord: 'discord.exe'
});

function compactText(value, maxLength = 180) {
  const text = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function baseName(value) {
  return compactText(value)
    .replace(/^.*[\\/]/, '')
    .replace(/^["']|["']$/g, '');
}

function normalizeProcessName(processName) {
  const name = baseName(processName).toLowerCase();
  if (!name) return '';

  const withoutArgs = name.split(/\s+(?=--?|\/[a-z])/i)[0].trim();
  const canonical = ALIASES[withoutArgs] || ALIASES[withoutArgs.replace(/\.exe$/i, '')] || withoutArgs;
  if (!canonical) return '';
  return canonical.endsWith('.exe') || canonical.includes('!') ? canonical : `${canonical}.exe`;
}

function buildIndex(categories) {
  const index = new Map();

  Object.entries(categories).forEach(([category, apps]) => {
    apps.forEach(app => {
      const normalized = normalizeProcessName(app);
      if (!normalized) return;
      if (!index.has(normalized)) {
        index.set(normalized, {
          canonicalName: normalized,
          displayName: app,
          categories: []
        });
      }
      const entry = index.get(normalized);
      if (!entry.categories.includes(category)) {
        entry.categories.push(category);
      }
    });
  });

  Object.entries(ALIASES).forEach(([alias, target]) => {
    const normalizedTarget = normalizeProcessName(target);
    if (!normalizedTarget || !index.has(normalizedTarget)) return;
    index.set(normalizeProcessName(alias), index.get(normalizedTarget));
  });

  return index;
}

const APP_INDEX = buildIndex(CATEGORIES);

function getAppProfile(processName) {
  const normalized = normalizeProcessName(processName);
  const entry = normalized ? APP_INDEX.get(normalized) : null;
  if (!entry) {
    return {
      known: false,
      processName: normalized || compactText(processName).toLowerCase(),
      displayName: compactText(processName),
      categories: [],
      labels: [],
      modes: []
    };
  }

  const labels = entry.categories
    .map(category => CATEGORY_METADATA[category]?.label)
    .filter(Boolean);
  const modes = [...new Set(entry.categories
    .map(category => CATEGORY_METADATA[category]?.mode)
    .filter(Boolean))];

  return {
    known: true,
    processName: entry.canonicalName,
    displayName: entry.displayName,
    categories: [...entry.categories],
    labels,
    modes
  };
}

function getCategoriesForApp(processName) {
  return getAppProfile(processName).categories;
}

function getCategoryMetadata(category) {
  return CATEGORY_METADATA[category] ? { ...CATEGORY_METADATA[category] } : null;
}

function isKnownApp(processName) {
  return getAppProfile(processName).known;
}

function listKnownApps() {
  return Array.from(new Set(Array.from(APP_INDEX.values()).map(entry => entry.displayName))).sort((a, b) => (
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  ));
}

module.exports = {
  DEV_APPS,
  STREAM_APPS,
  MEDIA_APPS,
  GAME_APPS,
  WORK_APPS,
  BROWSER_APPS,
  COMMUNICATION_APPS,
  CATEGORIES,
  CATEGORY_METADATA,
  normalizeProcessName,
  getAppProfile,
  getCategoriesForApp,
  getCategoryMetadata,
  isKnownApp,
  listKnownApps
};
