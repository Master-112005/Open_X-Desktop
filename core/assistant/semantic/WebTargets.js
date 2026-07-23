const Normalizer = require('../Data').Normalizer;

const TRUSTED_WEB_TARGETS = {
  google: { title: 'Google', url: 'https://www.google.com/' },
  chatgpt: { title: 'ChatGPT', url: 'https://chatgpt.com/' },
  'claude ai': { title: 'Claude', url: 'https://claude.ai/' },
  'google gemini': { title: 'Google Gemini', url: 'https://gemini.google.com/' },
  'perplexity ai': { title: 'Perplexity', url: 'https://www.perplexity.ai/' },
  github: { title: 'GitHub', url: 'https://github.com/' },
  linkedin: { title: 'LinkedIn', url: 'https://www.linkedin.com/' },
  gmail: { title: 'Gmail', url: 'https://mail.google.com/' },
  outlook: { title: 'Outlook', url: 'https://outlook.live.com/' },
  'google maps': { title: 'Google Maps', url: 'https://maps.google.com/' },
  'google photos': { title: 'Google Photos', url: 'https://photos.google.com/' },
  'google drive': { title: 'Google Drive', url: 'https://drive.google.com/' },
  'google docs': { title: 'Google Docs', url: 'https://docs.google.com/' },
  'google colab': { title: 'Google Colab', url: 'https://colab.research.google.com/' },
  'google chat': { title: 'Google Chat', url: 'https://chat.google.com/' },
  'microsoft 365': { title: 'Microsoft 365', url: 'https://www.office.com/' },
  onedrive: { title: 'OneDrive', url: 'https://onedrive.live.com/' },
  dropbox: { title: 'Dropbox', url: 'https://www.dropbox.com/' },
  notion: { title: 'Notion', url: 'https://www.notion.so/' },
  canva: { title: 'Canva', url: 'https://www.canva.com/' },
  figma: { title: 'Figma', url: 'https://www.figma.com/' },
  instagram: { title: 'Instagram', url: 'https://www.instagram.com/' },
  facebook: { title: 'Facebook', url: 'https://www.facebook.com/' },
  youtube: { title: 'YouTube', url: 'https://www.youtube.com/' },
  whatsapp: { title: 'WhatsApp Web', url: 'https://web.whatsapp.com/' },
  telegram: { title: 'Telegram Web', url: 'https://web.telegram.org/' },
  reddit: { title: 'Reddit', url: 'https://www.reddit.com/' },
  wikipedia: { title: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  amazon: { title: 'Amazon', url: 'https://www.amazon.com/' },
  netflix: { title: 'Netflix', url: 'https://www.netflix.com/' },
  x: { title: 'X', url: 'https://x.com/' },
  stackoverflow: { title: 'Stack Overflow', url: 'https://stackoverflow.com/' },
  hackerrank: { title: 'HackerRank', url: 'https://www.hackerrank.com/' },
  geeksforgeeks: { title: 'GeeksforGeeks', url: 'https://www.geeksforgeeks.org/' },
  leetcode: { title: 'LeetCode', url: 'https://leetcode.com/' },
  codeforces: { title: 'Codeforces', url: 'https://codeforces.com/' },
  codechef: { title: 'CodeChef', url: 'https://www.codechef.com/' },
  hackerearth: { title: 'HackerEarth', url: 'https://www.hackerearth.com/' },
  kaggle: { title: 'Kaggle', url: 'https://www.kaggle.com/' },
  coursera: { title: 'Coursera', url: 'https://www.coursera.org/' },
  udemy: { title: 'Udemy', url: 'https://www.udemy.com/' },
  w3schools: { title: 'W3Schools', url: 'https://www.w3schools.com/' },
  'mozilla firefox': { title: 'Mozilla Firefox', url: 'https://www.mozilla.org/firefox/' }
};

const WEB_TARGET_ALIASES = {
  google: 'google',
  'google search': 'google',
  chatgpt: 'chatgpt',
  'chat gpt': 'chatgpt',
  'openai chatgpt': 'chatgpt',
  'open ai chatgpt': 'chatgpt',
  claude: 'claude ai',
  gemini: 'google gemini',
  perplexity: 'perplexity ai',
  github: 'github',
  'git hub': 'github',
  linkedin: 'linkedin',
  'linked in': 'linkedin',
  gmail: 'gmail',
  mail: 'gmail',
  'google mail': 'gmail',
  outlook: 'outlook',
  'outlook mail': 'outlook',
  hotmail: 'outlook',
  maps: 'google maps',
  'google maps': 'google maps',
  photos: 'google photos',
  photes: 'google photos',
  photesw: 'google photos',
  phots: 'google photos',
  'google photos': 'google photos',
  'google photes': 'google photos',
  'google phots': 'google photos',
  drive: 'google drive',
  'google drive': 'google drive',
  docs: 'google docs',
  'google docs': 'google docs',
  colab: 'google colab',
  collab: 'google colab',
  'google colab': 'google colab',
  'google collab': 'google colab',
  'google colaboratory': 'google colab',
  'google chat': 'google chat',
  gchat: 'google chat',
  office: 'microsoft 365',
  'office 365': 'microsoft 365',
  'microsoft office': 'microsoft 365',
  'microsoft 365': 'microsoft 365',
  onedrive: 'onedrive',
  'one drive': 'onedrive',
  dropbox: 'dropbox',
  notion: 'notion',
  canva: 'canva',
  figma: 'figma',
  instagram: 'instagram',
  instgram: 'instagram',
  ig: 'instagram',
  facebook: 'facebook',
  fb: 'facebook',
  youtube: 'youtube',
  'you tube': 'youtube',
  yt: 'youtube',
  whatsapp: 'whatsapp',
  'whats app': 'whatsapp',
  'whatsapp web': 'whatsapp',
  telegram: 'telegram',
  'telegram web': 'telegram',
  reddit: 'reddit',
  wikipedia: 'wikipedia',
  wiki: 'wikipedia',
  amazon: 'amazon',
  netflix: 'netflix',
  twitter: 'x',
  'x.com': 'x',
  x: 'x',
  stackoverflow: 'stackoverflow',
  'stack overflow': 'stackoverflow',
  hackerrank: 'hackerrank',
  'hacker rank': 'hackerrank',
  geeksforgeeks: 'geeksforgeeks',
  'geeks for geeks': 'geeksforgeeks',
  gfg: 'geeksforgeeks',
  leetcode: 'leetcode',
  'leet code': 'leetcode',
  codeforces: 'codeforces',
  'code forces': 'codeforces',
  codechef: 'codechef',
  'code chef': 'codechef',
  hackerearth: 'hackerearth',
  'hacker earth': 'hackerearth',
  kaggle: 'kaggle',
  coursera: 'coursera',
  udemy: 'udemy',
  w3schools: 'w3schools',
  'w3 schools': 'w3schools',
  mozilla: 'mozilla firefox',
  firefox: 'mozilla firefox',
  'mozilla firefox': 'mozilla firefox'
};

function normalizeWebTarget(value, options = {}) {
  const target = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\b(?:website|web\s+app|site)\b/g, ' ')
    .replace(options.keepAppWord ? /\s+/g : /\bapp\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!target) {
    return null;
  }

  if (WEB_TARGET_ALIASES[target]) {
    return WEB_TARGET_ALIASES[target];
  }

  const fuzzy = Normalizer.findClosestOption(target, Object.keys(WEB_TARGET_ALIASES), {
    minSimilarity: 0.78,
    maxDistance: 2
  });
  return fuzzy ? WEB_TARGET_ALIASES[fuzzy.normalizedMatch] : null;
}

function resolveTrustedWebTarget(value) {
  const key = normalizeWebTarget(value);
  const target = key ? TRUSTED_WEB_TARGETS[key] : null;
  return target ? { key, ...target } : null;
}

module.exports = {
  TRUSTED_WEB_TARGETS,
  WEB_TARGET_ALIASES,
  normalizeWebTarget,
  resolveTrustedWebTarget
};
