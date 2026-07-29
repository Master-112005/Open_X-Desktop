'use strict';

const HUMAN_STATE_REPAIRS = Object.freeze({
  anxity: 'anxiety',
  anxous: 'anxious',
  anxios: 'anxious',
  bord: 'bored',
  coldd: 'cold',
  confuzed: 'confused',
  confuseed: 'confused',
  depresed: 'depressed',
  dizzyy: 'dizzy',
  exhasted: 'exhausted',
  fealing: 'feeling',
  feelng: 'feeling',
  frustated: 'frustrated',
  hungery: 'hungry',
  lonley: 'lonely',
  nervious: 'nervous',
  panicing: 'panicking',
  scarred: 'scared',
  shivring: 'shivering',
  sleppy: 'sleepy',
  stressd: 'stressed',
  stresed: 'stressed',
  thursty: 'thirsty',
  tierd: 'tired',
  tird: 'tired',
  tryed: 'tired',
  unwel: 'unwell',
  woried: 'worried'
});

const STATE_GROUPS = Object.freeze([
  {
    kind: 'cold',
    label: 'cold',
    terms: ['cold', 'chilly', 'freezing', 'shivering', 'frozen']
  },
  {
    kind: 'hot',
    label: 'hot',
    terms: ['hot', 'overheated', 'sweaty', 'burning up', 'too warm']
  },
  {
    kind: 'tired',
    label: 'tired',
    terms: ['tired', 'sleepy', 'exhausted', 'drained', 'fatigued', 'weak', 'low energy', 'worn out']
  },
  {
    kind: 'stressed',
    label: 'stressed',
    terms: ['stressed', 'stress', 'anxious', 'anxiety', 'worried', 'overwhelmed', 'nervous', 'tense', 'panic', 'panicking']
  },
  {
    kind: 'sick',
    label: 'unwell',
    terms: ['sick', 'ill', 'unwell', 'fever', 'feverish', 'dizzy', 'nauseous', 'headache', 'pain', 'hurt', 'hurting']
  },
  {
    kind: 'hungry',
    label: 'hungry',
    terms: ['hungry', 'starving', 'empty stomach']
  },
  {
    kind: 'thirsty',
    label: 'thirsty',
    terms: ['thirsty', 'dehydrated', 'dry mouth']
  },
  {
    kind: 'emotional',
    label: 'upset',
    terms: ['sad', 'upset', 'angry', 'lonely', 'alone', 'afraid', 'scared', 'depressed', 'crying', 'frustrated', 'disappointed', 'hurt emotionally', 'bored', 'ashamed', 'guilty', 'irritated']
  },
  {
    kind: 'confused',
    label: 'confused',
    terms: ['confused', 'lost', 'unclear', 'not understanding', 'do not understand', "don't understand"]
  },
  {
    kind: 'positive',
    label: 'good',
    terms: ['happy', 'excited', 'proud', 'good', 'better', 'fine', 'great', 'relieved', 'motivated']
  }
]);

const HUMAN_STATE_START_PATTERN = /^(?:i\s+am|i'm|im|i\s+feel|i\s+am\s+feeling|i\s+was|i\s+got|i\s+have|feeling|feel|my\s+body\s+feels|my\s+head\s+feels|my\s+stomach\s+feels|too)\b/i;
const ACTION_WORD_PATTERN = /\b(?:open|close|set|turn|play|pause|stop|send|message|call|remind|alarm|timer|search|find|delete|move|copy|scan|start|create|show)\b/i;
const PROFESSION_WORD_PATTERN = /\b(?:student|engineer|developer|teacher|doctor|designer|manager|assistant|from|at|working\s+at|studying\s+at|software|college|school|company)\b/i;

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHumanStateText(value) {
  let text = String(value || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\bi'?m\b/g, 'i am')
    .replace(/\bim\b/g, 'i am')
    .replace(/\bfealin\b/g, 'feeling')
    .replace(/\bfeeling\s+tried\b/g, 'feeling tired')
    .replace(/\bfeel\s+tried\b/g, 'feel tired')
    .replace(/\bi\s+am\s+tried\b/g, 'i am tired')
    .replace(/\bi\s+was\s+tried\b/g, 'i was tired')
    .replace(/\btoo\s+tried\b/g, 'too tired')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  Object.entries(HUMAN_STATE_REPAIRS).forEach(([from, to]) => {
    text = text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to);
  });

  return text.replace(/\s+/g, ' ').trim();
}

function hasStateTerm(text, terms) {
  return terms.some(term => new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text));
}

function classifyHumanState(input, options = {}) {
  const normalized = normalizeHumanStateText(input);
  if (!normalized) return null;

  const requireStarter = options.requireStarter !== false;
  const starter = HUMAN_STATE_START_PATTERN.test(normalized);
  if (requireStarter && !starter) return null;

  if (options.ignoreActionCommands !== false && ACTION_WORD_PATTERN.test(normalized)) {
    return null;
  }

  for (const group of STATE_GROUPS) {
    if (!hasStateTerm(normalized, group.terms)) continue;
    return {
      kind: group.kind,
      label: group.label,
      normalized,
      confidence: starter ? 0.94 : 0.72,
      healthAdjacent: ['cold', 'hot', 'tired', 'sick', 'hungry', 'thirsty'].includes(group.kind),
      emotional: ['stressed', 'emotional', 'confused', 'positive'].includes(group.kind)
    };
  }

  return null;
}

function isTransientHumanState(value) {
  const normalized = normalizeHumanStateText(value);
  if (!normalized || PROFESSION_WORD_PATTERN.test(normalized)) return false;
  return Boolean(classifyHumanState(`i am ${normalized}`, {
    requireStarter: true,
    ignoreActionCommands: false
  }));
}

module.exports = {
  HUMAN_STATE_REPAIRS,
  STATE_GROUPS,
  classifyHumanState,
  isTransientHumanState,
  normalizeHumanStateText
};
