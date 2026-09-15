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
    'When a turn includes an executed-task report or a verified answer, base your reply on that report and never contradict it.',
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

function buildTaskOutcomeBlock(taskOutcome = {}) {
  const lines = ['[Executed-task report from the OpenX action router. Ground your reply strictly on this report.]'];
  const details = sanitizePromptValue(taskOutcome.details || '', 500);
  lines.push(
    `Intent: ${sanitizePromptValue(taskOutcome.intent || 'unknown', 80)} | ` +
    `Outcome: ${taskOutcome.success ? 'success' : 'failure'}` +
    (taskOutcome.error ? ` | Error: ${sanitizePromptValue(taskOutcome.error, 300)}` : '')
  );
  if (details) {
    lines.push(`Details: ${details}`);
  }
  if (taskOutcome.kind === 'answer') {
    lines.push(
      'This is a verified answer computed by OpenX, not an action.',
      `Verified answer to convey: "${sanitizePromptValue(taskOutcome.draftReply || '', 600)}"`,
      'Rephrase it naturally in your own words but keep every fact exactly as given. Do not add, drop, or alter facts.'
    );
    return lines;
  }
  if (taskOutcome.requiresConfirmation) {
    lines.push('The action is WAITING FOR USER CONFIRMATION and has NOT run yet. Confirm what will happen and ask the user to approve or cancel.');
  } else if (taskOutcome.needsClarification) {
    lines.push(`The action needs more information from the user. Ask for it naturally based on: "${sanitizePromptValue(taskOutcome.draftReply || '', 600)}"`);
  } else {
    lines.push(
      `Router draft reply: "${sanitizePromptValue(taskOutcome.draftReply || '', 400)}"`,
      taskOutcome.success
        ? 'Confirm this exact completed outcome naturally. Do not claim any additional actions beyond this report.'
        : 'Explain the failure naturally and suggest a practical next step. Do not claim anything succeeded.'
    );
  }
  return lines;
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
  if (context.taskOutcome && typeof context.taskOutcome === 'object') {
    lines.push(...buildTaskOutcomeBlock(context.taskOutcome));
  } else {
    lines.push(
      'This is not a computer command to execute. The user is asking a question or chatting; answer them directly and naturally from your own knowledge.'
    );
  }
  lines.push('If you genuinely do not know an answer, say you do not know it. Never invent times, dates, weather, prices, numbers, names, or events that were not provided to you.');
  lines.push(String(userText || '').trim());
  return lines.join('\n');
}

function buildCasualChatTurnPrompt(userText, context = {}) {
  const safeUser = String(userText || '').trim();
  const safeName = sanitizePromptValue(context.assistantName || 'OpenX', 80);
  const lines = [
    `[Casual chat mode. You are ${safeName}, a friendly local desktop assistant having a chat with the user.]`,
    'Rules:',
    '- Keep the reply to 1-2 short sentences.',
    '- Do not repeat, rephrase, or echo what the user said back to them.',
    '- Never acknowledge formally with "Noted, sir" or "I will remember that". Just chat naturally.',
    '- Answer the user directly. Ask a follow-up question only when it fits naturally.',
    '- Vary your wording. Do not repeat earlier replies.',
    `- If the user asks your name, say it is ${safeName}. If asked who you are, say you are ${safeName}, their local desktop assistant.`,
    '- If the user reports their day, mood, or life is fine or good, acknowledge it simply, for example: "That is good to hear." Only do this when they actually described how they are - a greeting alone like "hi" is not a report.',
    '- If asked for a joke, tell one short joke.',
    '- If you genuinely do not know something, say you do not know it instead of guessing.',
    'Now reply to the user:',
    safeUser
  ];
  return lines.join('\n');
}

module.exports = {
  buildSystemPrompt,
  buildTaskOutcomeBlock,
  buildTurnPrompt,
  buildCasualChatTurnPrompt,
  languageInstruction,
  responseStyleInstruction,
  sanitizePromptValue
};
