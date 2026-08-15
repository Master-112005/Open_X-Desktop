'use strict';

const ASSISTANT_TOKEN_CORRECTIONS = Object.freeze({
  acceurate: 'accurate',
  activte: 'activate',
  alaram: 'alarm',
  alram: 'alarm',
  andriod: 'android',
  anme: 'name',
  applcation: 'application',
  applciation: 'application',
  apllication: 'application',
  archve: 'archive',
  assisent: 'assistant',
  assistenat: 'assistant',
  assistent: 'assistant',
  assitrnt: 'assistant',
  attandance: 'attendance',
  attendence: 'attendance',
  backgroud: 'background',
  behaviroial: 'behavioral',
  behaviour: 'behavior',
  behaviours: 'behaviors',
  brighnes: 'brightness',
  brighness: 'brightness',
  calander: 'calendar',
  calandr: 'calendar',
  calender: 'calendar',
  cancl: 'cancel',
  cancle: 'cancel',
  canel: 'cancel',
  canle: 'cancel',
  cancell: 'cancel',
  caption: 'caption',
  chrmoe: 'chrome',
  clandar: 'calendar',
  clander: 'calendar',
  clane: 'cancel',
  clender: 'calendar',
  cloe: 'close',
  clos: 'close',
  clouse: 'close',
  clsoe: 'close',
  cloze: 'close',
  comands: 'commands',
  commads: 'commands',
  comperaction: 'comparison',
  comperasection: 'comparison',
  comperation: 'comparison',
  compleetely: 'completely',
  correctely: 'correctly',
  crome: 'chrome',
  crom: 'chrome',
  daliy: 'daily',
  deatils: 'details',
  decrese: 'decrease',
  detials: 'details',
  detaills: 'details',
  deveopemt: 'development',
  developement: 'development',
  develpment: 'development',
  devlopement: 'development',
  devlopemt: 'development',
  diconncted: 'disconnected',
  diconnected: 'disconnected',
  direcotry: 'directory',
  dirctory: 'directory',
  diretory: 'directory',
  dublicate: 'duplicate',
  dublicates: 'duplicates',
  evry: 'every',
  excapt: 'except',
  exteracetion: 'extraction',
  exteraction: 'extraction',
  facitial: 'facial',
  facitiall: 'facial',
  fealing: 'feeling',
  feelng: 'feeling',
  fatures: 'features',
  fcesial: 'facial',
  fild: 'file',
  fing: 'find',
  firefix: 'firefox',
  frustated: 'frustrated',
  floder: 'folder',
  foler: 'folder',
  follder: 'folder',
  foldr: 'folder',
  funcnality: 'functionality',
  galleary: 'gallery',
  galery: 'gallery',
  gallary: 'gallery',
  githubb: 'github',
  gotmy: 'got my',
  hummanise: 'humanize',
  humanise: 'humanize',
  hungery: 'hungry',
  ijust: 'just',
  imean: 'i mean',
  immedeate: 'immediate',
  imideated: 'immediately',
  imprve: 'improve',
  improvr: 'improve',
  increse: 'increase',
  incres: 'increase',
  indeciation: 'indication',
  indentification: 'identification',
  indentify: 'identify',
  identifiedd: 'identified',
  identifyed: 'identified',
  inderstrial: 'industrial',
  infromation: 'information',
  inteligance: 'intelligence',
  inteligence: 'intelligence',
  internt: 'internet',
  isseue: 'issue',
  isseues: 'issues',
  lanuage: 'language',
  lanuuage: 'language',
  lauch: 'launch',
  releation: 'relation',
  relaton: 'relation',
  remider: 'reminder',
  remideres: 'reminders',
  remindee: 'reminder',
  remeinder: 'reminder',
  remionder: 'reminder',
  remionders: 'reminders',
  reminderss: 'reminders',
  scann: 'scan',
  scaning: 'scanning',
  settngs: 'settings',
  setings: 'settings',
  shiuld: 'should',
  sink: 'sync',
  sinkble: 'syncable',
  sinking: 'syncing',
  synk: 'sync',
  synkrizations: 'synchronizations',
  tomo: 'tomorrow',
  tommorow: 'tomorrow',
  tommrow: 'tomorrow',
  transver: 'transfer',
  transvered: 'transferred',
  uiux: 'ui ux',
  volum: 'volume',
  whre: 'where',
  whare: 'where',
  yotub: 'youtube',
  yotube: 'youtube',
  youtub: 'youtube',
  conectivity: 'connectivity',
  recieve: 'receive',
  recive: 'receive',
  reciveing: 'receiving',
  receved: 'received',
  registeration: 'registration',
  regerstration: 'registration',
  regerstring: 'registering',
  stabilazation: 'stabilization',
  performace: 'performance',
  peroformance: 'performance',
  resoureces: 'resources',
  memeory: 'memory',
  fowr: 'four',
  selictor: 'selector',
  recieveing: 'receiving',
  verif: 'verify',
  verifyed: 'verified',
  normilization: 'normalization',
  normilize: 'normalize',
  normilized: 'normalized',
  parcsing: 'parsing',
  paresing: 'parsing',
  stressd: 'stressed',
  stresed: 'stressed',
  thursty: 'thirsty',
  tierd: 'tired',
  tird: 'tired',
  pptx: 'pptx',
  ppt: 'ppt',
  powerpoint: 'powerpoint',
  sliderbar: 'slider',
  slidebar: 'slider',
  whatsapp: 'whatsapp'
});

const ASSISTANT_SEQUENCE_CORRECTIONS = Object.freeze([
  { from: ['open', 'x'], to: ['openx'] },
  { from: ['you', 'tube'], to: ['youtube'] },
  { from: ['power', 'point'], to: ['powerpoint'] },
  { from: ['wi', 'fi'], to: ['wifi'] },
  { from: ['blue', 'tooth'], to: ['bluetooth'] },
  { from: ['face', 'scaning'], to: ['face', 'scanning'] },
  { from: ['spelling', 'mistacks'], to: ['spelling', 'mistakes'] }
]);

const JOINED_TOKEN_SPLITS = Object.freeze({
  addreminder: ['add', 'reminder'],
  askopenx: ['ask', 'openx'],
  canyou: ['can', 'you'],
  canyouopen: ['can', 'you', 'open'],
  closeapp: ['close', 'app'],
  closechrome: ['close', 'chrome'],
  closeit: ['close', 'it'],
  closeppt: ['close', 'ppt'],
  closepowerpoint: ['close', 'powerpoint'],
  closeyoutube: ['close', 'youtube'],
  closeyotube: ['close', 'youtube'],
  closeyoutub: ['close', 'youtube'],
  couldyou: ['could', 'you'],
  findfile: ['find', 'file'],
  findfolder: ['find', 'folder'],
  findphotos: ['find', 'photos'],
  fullwindow: ['full', 'window'],
  goto: ['go', 'to'],
  howare: ['how', 'are'],
  howareyou: ['how', 'are', 'you'],
  howmany: ['how', 'many'],
  hows: ['how', 'is'],
  howsthe: ['how', 'is', 'the'],
  openapp: ['open', 'app'],
  openchrome: ['open', 'chrome'],
  opengallery: ['open', 'gallery'],
  openit: ['open', 'it'],
  openppt: ['open', 'ppt'],
  openpowerpoint: ['open', 'powerpoint'],
  opensettings: ['open', 'settings'],
  openyoutube: ['open', 'youtube'],
  openyotube: ['open', 'youtube'],
  openyoutub: ['open', 'youtube'],
  playmusic: ['play', 'music'],
  playsong: ['play', 'song'],
  playyoutube: ['play', 'youtube'],
  playyotube: ['play', 'youtube'],
  remindme: ['remind', 'me'],
  remindmeat: ['remind', 'me', 'at'],
  searchfile: ['search', 'file'],
  searchfolder: ['search', 'folder'],
  sendfile: ['send', 'file'],
  sendmessage: ['send', 'message'],
  setalarm: ['set', 'alarm'],
  setreminder: ['set', 'reminder'],
  setremider: ['set', 'reminder'],
  showphotos: ['show', 'photos'],
  starttimer: ['start', 'timer'],
  stopalarm: ['stop', 'alarm'],
  stopmusic: ['stop', 'music'],
  stoptimer: ['stop', 'timer'],
  turnoff: ['turn', 'off'],
  turnon: ['turn', 'on'],
  whatis: ['what', 'is'],
  whatisthe: ['what', 'is', 'the'],
  whats: ['what', 'is'],
  whatsthe: ['what', 'is', 'the'],
  whereare: ['where', 'are'],
  whereis: ['where', 'is'],
  whereisthe: ['where', 'is', 'the'],
  whois: ['who', 'is'],
  whoisthe: ['who', 'is', 'the'],
  whos: ['who', 'is'],
  willyou: ['will', 'you'],
  wouldyou: ['would', 'you']
});

const ASSISTANT_DOMAIN_WORDS = Object.freeze([
  'assistant',
  'acquisition',
  'action',
  'activity',
  'alarm',
  'alarms',
  'automation',
  'brightness',
  'browser',
  'calendar',
  'capability',
  'chat',
  'chatgpt',
  'chrome',
  'cloud',
  'command',
  'commands',
  'connect',
  'connected',
  'connection',
  'connectivity',
  'context',
  'correction',
  'data',
  'decision',
  'desktop',
  'device',
  'directory',
  'document',
  'download',
  'downloads',
  'dynamic',
  'entity',
  'entities',
  'face',
  'faces',
  'facial',
  'feature',
  'features',
  'file',
  'files',
  'folder',
  'folders',
  'gallery',
  'gmail',
  'google',
  'identity',
  'image',
  'images',
  'intent',
  'language',
  'learning',
  'linguistic',
  'matching',
  'media',
  'memory',
  'message',
  'messages',
  'mobile',
  'model',
  'models',
  'normalization',
  'openx',
  'pairing',
  'performance',
  'phone',
  'photo',
  'photos',
  'picture',
  'pictures',
  'planning',
  'powerpoint',
  'preprocessor',
  'profile',
  'query',
  'recognition',
  'relation',
  'remote',
  'reminder',
  'reminders',
  'renderer',
  'resource',
  'resources',
  'response',
  'router',
  'scan',
  'scanner',
  'scanning',
  'search',
  'security',
  'settings',
  'slide',
  'slider',
  'spell',
  'spelling',
  'sync',
  'synchronization',
  'timer',
  'timers',
  'transfer',
  'ui',
  'ux',
  'validation',
  'verification',
  'vision',
  'visual',

  'volume',
  'web',
  'website',
  'whatsapp',
  'instagram',
  'spotify',
  'telegram',
  'windows',
  'youtube'
]);

const COMMON_ENGLISH_WORDS = Object.freeze([
  'able',
  'about',
  'above',
  'accept',
  'account',
  'accurate',
  'after',
  'again',
  'against',
  'all',
  'allow',
  'also',
  'always',
  'and',
  'another',
  'any',
  'app',
  'are',
  'around',
  'ask',
  'at',
  'back',
  'be',
  'because',
  'before',
  'best',
  'better',
  'between',
  'bottom',
  'button',
  'by',
  'call',
  'can',
  'cancel',
  'change',
  'clear',
  'click',
  'close',
  'complete',
  'completely',
  'confirm',
  'copy',
  'create',
  'daily',
  'day',
  'delete',
  'detail',
  'details',
  'disable',
  'disconnected',
  'display',
  'do',
  'done',
  'down',
  'each',
  'easy',
  'edit',
  'every',
  'everything',
  'except',
  'fast',
  'faster',
  'find',
  'first',
  'fix',
  'for',
  'from',
  'full',
  'go',
  'get',
  'give',
  'good',
  'handle',
  'handling',
  'have',
  'cold',
  'chilly',
  'confused',
  'depressed',
  'dizzy',
  'emotional',
  'excited',
  'exhausted',
  'feeling',
  'feel',
  'freezing',
  'frustrated',
  'hot',
  'hungry',
  'lonely',
  'nervous',
  'overwhelmed',
  'panic',
  'panicking',
  'proud',
  'scared',
  'shivering',
  'sick',
  'sleepy',
  'stressed',
  'thirsty',
  'tired',
  'unwell',
  'here',
  'how',
  'many',
  'human',
  'if',
  'improve',
  'in',
  'include',
  'input',
  'into',
  'is',
  'it',
  'just',
  'keep',
  'latest',
  'left',
  'less',
  'like',
  'list',
  'load',
  'local',
  'make',
  'mark',
  'me',
  'minute',
  'minutes',
  'more',
  'move',
  'much',
  'name',
  'need',
  'new',
  'next',
  'no',
  'not',
  'now',
  'of',
  'off',
  'on',
  'one',
  'only',
  'open',
  'option',
  'other',
  'perfect',
  'place',
  'play',
  'please',
  'previous',
  'problem',
  'production',
  'ready',
  'receive',
  'received',
  'registered',
  'remove',
  'reset',
  'right',
  'save',
  'say',
  'send',
  'set',
  'should',
  'show',
  'small',
  'smooth',
  'solve',
  'start',
  'stop',
  'store',
  'stored',
  'system',
  'take',
  'tell',
  'text',
  'the',
  'then',
  'there',
  'this',
  'time',
  'to',
  'today',
  'tomorrow',
  'top',
  'try',
  'type',
  'understand',
  'update',
  'use',
  'used',
  'user',
  'verify',
  'view',
  'want',
  'when',
  'where',
  'while',
  'with',
  'without',
  'work',
  'working',
  'works',
  'yes',
  'you'
]);

const TARGET_ACTIONS = Object.freeze(new Set([
  'ask',
  'call',
  'close',
  'copy',
  'find',
  'google',
  'launch',
  'message',
  'move',
  'open',
  'play',
  'queue',
  'rename',
  'say',
  'search',
  'send',
  'show',
  'switch',
  'tell',
  'text'
]));

const TARGET_FUNCTION_WORDS = Object.freeze(new Set([
  'a',
  'about',
  'all',
  'and',
  'app',
  'application',
  'at',
  'browser',
  'by',
  'called',
  'current',
  'directory',
  'file',
  'folder',
  'for',
  'from',
  'in',
  'me',
  'my',
  'named',
  'new',
  'of',
  'on',
  'photo',
  'photos',
  'picture',
  'pictures',
  'please',
  'song',
  'songs',
  'tab',
  'tabs',
  'that',
  'the',
  'this',
  'to',
  'track',
  'video',
  'website',
  'with'
]));

const NON_TARGET_PREPOSITIONS = Object.freeze(new Set(['at', 'in', 'on', 'to', 'for', 'from', 'with']));

function normalizeToken(token) {
  return String(token || '').toLowerCase().trim();
}

const LEXICON_WORD_SET = new Set([
  ...ASSISTANT_DOMAIN_WORDS,
  ...COMMON_ENGLISH_WORDS,
  ...Object.keys(ASSISTANT_TOKEN_CORRECTIONS),
  ...Object.values(ASSISTANT_TOKEN_CORRECTIONS).flatMap(value => String(value).split(/\s+/))
].map(normalizeToken).filter(Boolean));

function repairRepeatedLetters(token) {
  const normalized = normalizeToken(token);
  if (normalized.length < 5) return normalized;
  return normalized.replace(/([a-z])\1{2,}/gi, '$1$1');
}

function _canUseSplitWord(word) {
  const normalized = normalizeToken(word);
  if (normalized.length < 2) return false;
  return LEXICON_WORD_SET.has(normalized);
}

function _scoreSplit(parts) {
  return parts.reduce((score, part) => score + Math.min(8, part.length), 0) - (parts.length * 0.7);
}

function _bestDynamicSplit(token, maxParts = 3) {
  const value = normalizeToken(token);
  if (value.length < 5 || value.length > 24) return null;
  if (LEXICON_WORD_SET.has(value) || ASSISTANT_TOKEN_CORRECTIONS[value]) return null;

  const memo = new Map();
  const visit = (offset, partsLeft) => {
    const key = `${offset}:${partsLeft}`;
    if (memo.has(key)) return memo.get(key);
    if (offset >= value.length) return [];
    if (partsLeft <= 0) return null;

    let best = null;
    for (let end = offset + 2; end <= value.length; end += 1) {
      const part = value.slice(offset, end);
      if (!_canUseSplitWord(part)) continue;
      if (value.length - end === 1) continue;
      const rest = visit(end, partsLeft - 1);
      if (rest === null) continue;
      const candidate = [part, ...rest];
      if (candidate.join('') !== value || candidate.length < 2) continue;
      if (!best || _scoreSplit(candidate) > _scoreSplit(best)) best = candidate;
    }
    memo.set(key, best);
    return best;
  };

  return visit(0, maxParts);
}

function splitJoinedToken(token, options = {}) {
  const normalized = normalizeToken(token);
  if (!normalized || normalized.length < 5 || /\d/.test(normalized)) return [token];
  if (JOINED_TOKEN_SPLITS[normalized]) return JOINED_TOKEN_SPLITS[normalized].slice();
  const dynamic = _bestDynamicSplit(normalized, options.maxParts || 3);
  return dynamic || [token];
}

function splitJoinedTokens(tokens, options = {}) {
  const safeTokens = Array.isArray(tokens) ? tokens : [];
  return safeTokens.flatMap(token => splitJoinedToken(token, options));
}

function isKnownWord(token) {
  const normalized = normalizeToken(token);
  return COMMON_ENGLISH_WORDS.includes(normalized) || ASSISTANT_DOMAIN_WORDS.includes(normalized);
}

function _lastTargetActionIndex(tokens, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const token = normalizeToken(tokens[cursor]);
    if (TARGET_ACTIONS.has(token)) return cursor;
  }
  return -1;
}

function _looksLikeStructuredTarget(token) {
  const value = String(token || '');
  return (
    /^[a-z]:\\/i.test(value) ||
    /[./\\_-]/.test(value) ||
    /\d/.test(value) ||
    /^[a-z]{1,3}\d{1,5}$/i.test(value) ||
    /\.(?:app|exe|pdf|docx?|pptx?|xlsx?|txt|png|jpe?g|webp|mp3|mp4|zip)$/i.test(value)
  );
}

function shouldProtectToken(token, options = {}) {
  const normalized = normalizeToken(token);
  if (!normalized || normalized.length <= 2) return true;
  if (ASSISTANT_TOKEN_CORRECTIONS[normalized]) return false;
  if (isKnownWord(normalized)) return false;
  if (_looksLikeStructuredTarget(token)) return true;

  const tokens = Array.isArray(options.tokens) ? options.tokens.map(normalizeToken) : [];
  const index = Number.isInteger(options.index) ? options.index : -1;
  if (index < 0 || tokens.length === 0) return false;

  const actionIndex = _lastTargetActionIndex(tokens, index);
  if (actionIndex < 0) return false;

  const action = tokens[actionIndex];
  const previous = tokens[index - 1] || '';
  if (TARGET_FUNCTION_WORDS.has(normalized)) return false;
  if (NON_TARGET_PREPOSITIONS.has(previous) && ['open', 'close', 'switch', 'show'].includes(action)) return false;

  if (['play', 'queue'].includes(action)) return true;
  if (['search', 'find', 'google'].includes(action)) return true;
  if (['ask', 'tell', 'message', 'text', 'send', 'call', 'say'].includes(action)) return true;
  if (['open', 'close', 'switch', 'show', 'launch'].includes(action)) return true;

  return false;
}

function correctTokenWithLexicon(token, options = {}) {
  const normalized = normalizeToken(token);
  if (!normalized) return normalized;

  const explicit = ASSISTANT_TOKEN_CORRECTIONS[normalized];
  if (explicit) return explicit;

  const compact = repairRepeatedLetters(normalized);
  if (compact && compact !== normalized) {
    if (ASSISTANT_TOKEN_CORRECTIONS[compact]) {
      return ASSISTANT_TOKEN_CORRECTIONS[compact];
    }
    if (isKnownWord(compact)) {
      return compact;
    }
  }

  if (options.explicitOnly === true) return null;
  if (shouldProtectToken(normalized, options)) return normalized;

  return null;
}

function repairKnownTokenText(text, options = {}) {
  return String(text || '').replace(/\b[a-zA-Z][a-zA-Z0-9_-]*\b/g, token => (
    correctTokenWithLexicon(token, { ...options, explicitOnly: true }) || token
  ));
}

function buildAssistantVocabulary(...sources) {
  const tokens = new Set([
    ...ASSISTANT_DOMAIN_WORDS,
    ...COMMON_ENGLISH_WORDS,
    ...Object.keys(ASSISTANT_TOKEN_CORRECTIONS),
    ...Object.values(ASSISTANT_TOKEN_CORRECTIONS).flatMap(value => String(value).split(/\s+/))
  ]);

  sources.flat().filter(Boolean).forEach(value => {
    if (Array.isArray(value)) {
      value.forEach(item => tokens.add(normalizeToken(item)));
    } else if (value instanceof Set) {
      value.forEach(item => tokens.add(normalizeToken(item)));
    } else {
      tokens.add(normalizeToken(value));
    }
  });

  return Array.from(tokens).filter(Boolean);
}

module.exports = {
  ASSISTANT_DOMAIN_WORDS,
  ASSISTANT_SEQUENCE_CORRECTIONS,
  ASSISTANT_TOKEN_CORRECTIONS,
  COMMON_ENGLISH_WORDS,
  JOINED_TOKEN_SPLITS,
  buildAssistantVocabulary,
  correctTokenWithLexicon,
  isKnownWord,
  repairKnownTokenText,
  repairRepeatedLetters,
  splitJoinedToken,
  splitJoinedTokens,
  shouldProtectToken
};
