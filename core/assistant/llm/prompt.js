'use strict';

function sanitizePromptValue(value, maxLength = 1200) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function languageInstruction(language) {
  const normalized = String(language || '').toLowerCase().trim();
  if (!normalized || normalized === 'system' || normalized === 'auto') {
    return 'Reply in the same language the user used when it is clear. Otherwise use natural English.';
  }
  return `Reply in ${sanitizePromptValue(normalized, 80)} unless the user explicitly asks for another language.`;
}

function responseStyleInstruction(responseStyle) {
  const normalized = String(responseStyle || '').toLowerCase().trim();
  if (normalized === 'detailed') {
    return 'Use a complete answer with practical details, but do not pad the response.';
  }
  if (normalized === 'natural') {
    return 'Use a natural conversational answer with enough detail to be useful.';
  }
  return 'Be concise. Prefer one or two short paragraphs unless the user asks for detail.';
}

function buildSystemPrompt(memorySummary, assistantName = 'OpenX', responseStyle = 'concise', language = 'system') {
  const safeName = sanitizePromptValue(assistantName, 80) || 'OpenX';
  const safeMemory = sanitizePromptValue(memorySummary, 1800);

  return [
    `You are ${safeName}, a local Windows desktop assistant running inside OpenX.`,
    responseStyleInstruction(responseStyle),
    languageInstruction(language),
    '',
    'OpenX has already tried its deterministic command router before this model was called.',
    'Do not claim you opened, closed, deleted, sent, scheduled, clicked, changed, or verified anything unless the user only asked for an explanation and no action is required.',
    'If the user asks for a real desktop action, say that the action router did not find a safe command match and ask for a clearer command.',
    'For general questions, explanations, writing, reasoning, and casual conversation, answer directly.',
    'For greetings and questions like "how are you" or "how is your day going", answer naturally and vary the wording. Do not repeat the same greeting template every turn.',
    '',
    'Do not invent reminders, files, messages, contacts, device state, browser state, alarms, calendar events, or private data.',
    'Use only the memories provided below when they are relevant. If the answer depends on current external information and no tool result is provided, say that you do not have live data.',
    'Voice transcripts may contain mistakes. If the text is too garbled to understand, ask the user to repeat it instead of guessing.',
    'Avoid raw file paths, URLs, JSON, stack traces, or implementation details unless the user specifically asks for them.',
    'Avoid robotic filler. Lead with the answer.',
    safeMemory ? `Relevant local memory: ${safeMemory}` : 'Relevant local memory: none provided.'
  ].join('\n');
}

function buildTurnPrompt(userText, context = {}) {
  const lines = [];
  const now = context.now ? sanitizePromptValue(context.now, 80) : new Date().toISOString();
  lines.push(`[Private background context. Do not repeat this block. Current time: ${now}.]`);
  if (context.memorySummary) {
    lines.push(`[Relevant memory: ${sanitizePromptValue(context.memorySummary, 1800)}]`);
  }
  if (context.conversationSummary) {
    lines.push(`[Recent conversation: ${sanitizePromptValue(context.conversationSummary, 1200)}]`);
  }
  lines.push(String(userText || '').trim());
  return lines.join('\n');
}

module.exports = {
  buildSystemPrompt,
  buildTurnPrompt,
  languageInstruction,
  responseStyleInstruction,
  sanitizePromptValue
};
