const CANDIDATE_TIMEOUT_MS = 2000;

const LAYOUTS = Object.freeze({
  LOADING: 'Loading',
  QR_LOGIN: 'QR Login',
  LOGGED_IN: 'Logged In',
  CHAT_OPEN: 'Chat Open',
  EMPTY_CHAT: 'Empty Chat',
  UNSUPPORTED: 'Unsupported Layout'
});

function candidate(strategy, value, options = {}) {
  return { strategy, value, ...options };
}

function candidateKey(item) {
  if (item.strategy === 'role') return `${item.strategy}:${item.value}:${item.name || ''}`;
  return `${item.strategy}:${item.value}`;
}

function buildLocator(page, item) {
  switch (item.strategy) {
    case 'role':
      return page.getByRole?.(item.value, { name: item.name, exact: item.exact });
    case 'placeholder':
      return page.getByPlaceholder?.(item.value, { exact: item.exact });
    case 'label':
      return page.getByLabel?.(item.value, { exact: item.exact });
    case 'text':
      return page.getByText?.(item.value, { exact: item.exact });
    case 'testid':
      return page.getByTestId?.(item.value);
    case 'aria':
    case 'contenteditable':
    case 'css':
      return page.locator?.(item.value);
    default:
      return null;
  }
}

function locatorFor(page, item) {
  return buildLocator(page, item);
}

async function withTimeout(work, timeoutMs) {
  let timer = null;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('candidate timed out')), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function visible(locator, timeoutMs) {
  const target = locator?.first ? locator.first() : locator;
  if (!target) return false;
  if (target.waitFor) {
    await target.waitFor({ state: 'visible', timeout: timeoutMs });
    return true;
  }
  return withTimeout(async () => {
    const count = target.count ? await target.count() : 1;
    return count > 0 && (!target.isVisible || await target.isVisible());
  }, timeoutMs);
}

async function resolveElement(page, name, options = {}) {
  const timeoutMs = Math.max(1, Number(options.timeoutMs) || CANDIDATE_TIMEOUT_MS);
  const attempts = [];
  const candidates = WhatsAppSelectors.elements[name] || [];

  for (const item of candidates) {
    const attempt = {
      name,
      strategy: item.strategy,
      value: String(item.value),
      found: false
    };
    try {
      const locator = buildLocator(page, item);
      if (locator && await visible(locator, timeoutMs)) {
        attempt.found = true;
        attempts.push(attempt);
        return {
          name,
          found: true,
          strategy: item.strategy,
          selector: item.strategy === 'css' || item.strategy === 'aria' || item.strategy === 'contenteditable'
            ? item.value
            : candidateKey(item),
          locator: locator.first ? locator.first() : locator,
          attempts
        };
      }
    } catch (error) {
      attempt.error = error.message;
    }
    attempts.push(attempt);
  }

  return { name, found: false, selector: null, locator: null, attempts };
}

function locatorsFor(page, name) {
  return (WhatsAppSelectors.elements[name] || [])
    .map(item => ({ item, locator: buildLocator(page, item) }))
    .filter(entry => entry.locator);
}

const common = Object.freeze([
  candidate('role', 'textbox', { name: /search|message|chat/i }),
  candidate('placeholder', /search|message|chat/i),
  candidate('label', /search|message|chat/i),
  candidate('text', /search|type a message|chat/i),
  candidate('testid', 'chat-list-search'),
  candidate('aria', '[aria-label*="Search" i], [aria-label*="message" i], [aria-label*="Chat" i]'),
  candidate('contenteditable', '[contenteditable="true"]'),
  candidate('css', 'div')
]);

const WhatsAppSelectors = Object.freeze({
  version: 'whatsapp-web-resolver-2026-07',
  url: 'https://web.whatsapp.com/',
  layouts: LAYOUTS,
  candidateTimeoutMs: CANDIDATE_TIMEOUT_MS,
  elements: Object.freeze({
    searchBox: [
      candidate('role', 'textbox', { name: /search/i }),
      candidate('placeholder', /search/i),
      candidate('label', /search/i),
      candidate('text', /search or start new chat|search/i),
      candidate('testid', 'chat-list-search'),
      candidate('aria', 'div[role="textbox"][aria-label*="Search" i], div[contenteditable="true"][aria-label*="Search" i]'),
      candidate('contenteditable', '#side div[contenteditable="true"], [data-testid="chat-list-search"] [contenteditable="true"]'),
      candidate('css', '#side [role="textbox"], #pane-side [role="textbox"]')
    ],
    conversationList: [
      candidate('role', 'list', { name: /search results|contacts|chats/i }),
      candidate('placeholder', /search/i),
      candidate('label', /search results|contacts|chats/i),
      candidate('text', /search results|contacts|chats/i),
      candidate('testid', 'cell-frame-container'),
      candidate('aria', '[aria-label*="Search results" i], [aria-label*="Contacts" i], [aria-label*="Chats" i]'),
      candidate('contenteditable', '#pane-side [contenteditable="true"]'),
      candidate('css', '[data-testid="cell-frame-container"], #pane-side [role="listitem"], #pane-side [role="row"]')
    ],
    messageInput: [
      candidate('role', 'textbox', { name: /type a message|message/i }),
      candidate('placeholder', /type a message|message/i),
      candidate('label', /type a message|message/i),
      candidate('text', /type a message/i),
      candidate('testid', 'conversation-compose-box-input'),
      candidate('aria', 'footer div[role="textbox"][aria-label*="message" i], div[aria-label*="Type a message" i]'),
      candidate('contenteditable', 'footer div[contenteditable="true"][role="textbox"], footer div[contenteditable="true"]'),
      candidate('css', '[data-testid="conversation-compose-box-input"], #main footer [role="textbox"]')
    ],
    sendButton: [
      candidate('role', 'button', { name: /send/i }),
      candidate('placeholder', /send/i),
      candidate('label', /send/i),
      candidate('text', /^send$/i),
      candidate('testid', 'send'),
      candidate('aria', 'button[aria-label*="Send" i], [aria-label*="Send" i][role="button"]'),
      candidate('contenteditable', 'footer div[contenteditable="true"]'),
      candidate('css', 'span[data-icon="send"], button:has(span[data-icon="send"])')
    ],
    chatList: [
      candidate('role', 'list', { name: /chat/i }),
      candidate('placeholder', /search/i),
      candidate('label', /chat list|chats/i),
      candidate('text', /chats|archived/i),
      candidate('testid', 'chat-list'),
      candidate('aria', '[aria-label*="Chat list" i], [aria-label*="Chats" i]'),
      candidate('contenteditable', '#side div[contenteditable="true"]'),
      candidate('css', '#pane-side, [data-testid="chat-list"]')
    ],
    qrCode: [
      candidate('role', 'img', { name: /qr|scan/i }),
      candidate('placeholder', /qr|scan/i),
      candidate('label', /qr|scan/i),
      candidate('text', /scan this qr code|use whatsapp on your computer/i),
      candidate('testid', 'qrcode'),
      candidate('aria', 'canvas[aria-label*="Scan" i], [aria-label*="QR" i]'),
      candidate('contenteditable', 'div[data-ref]'),
      candidate('css', 'div[data-ref] canvas, canvas')
    ],
    sidebar: [
      candidate('role', 'navigation', { name: /sidebar|chats|whatsapp/i }),
      candidate('placeholder', /search/i),
      candidate('label', /sidebar|chats/i),
      candidate('text', /chats|status|channels/i),
      candidate('testid', 'chat-list'),
      candidate('aria', '[aria-label*="Sidebar" i], [aria-label*="Chat list" i]'),
      candidate('contenteditable', '#side [contenteditable="true"]'),
      candidate('css', '#side, #pane-side')
    ],
    mainPane: [
      candidate('role', 'application', { name: /whatsapp|chat/i }),
      candidate('placeholder', /message/i),
      candidate('label', /conversation|chat/i),
      candidate('text', /select a chat|type a message/i),
      candidate('testid', 'conversation-panel-wrapper'),
      candidate('aria', '[aria-label*="Conversation" i], [role="application"]'),
      candidate('contenteditable', '#main [contenteditable="true"]'),
      candidate('css', '#main, [data-testid="conversation-panel-wrapper"]')
    ],
    loading: [
      candidate('role', 'progressbar', { name: /loading/i }),
      candidate('placeholder', /loading/i),
      candidate('label', /loading/i),
      candidate('text', /loading|connecting/i),
      candidate('testid', 'startup'),
      candidate('aria', '[aria-busy="true"], [aria-label*="Loading" i]'),
      candidate('contenteditable', '[contenteditable="true"][aria-busy="true"]'),
      candidate('css', 'progress, [data-testid="startup"]')
    ],
    offline: [
      candidate('role', 'alert', { name: /offline|not connected/i }),
      candidate('placeholder', /offline/i),
      candidate('label', /offline|not connected/i),
      candidate('text', /computer not connected|trying to reach phone|offline/i),
      candidate('testid', 'alert-phone'),
      candidate('aria', '[aria-label*="offline" i], [aria-label*="not connected" i]'),
      candidate('contenteditable', '[contenteditable="true"][aria-label*="offline" i]'),
      candidate('css', '[data-testid="alert-phone"]')
    ]
  }),
  common,
  locatorFor,
  resolveElement,
  locatorsFor
});

module.exports = WhatsAppSelectors;
