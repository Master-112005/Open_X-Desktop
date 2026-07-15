'use strict';

const { normalize, ordinalIndex } = require('../utils/visual-memory-capability-utils');

class VisualMemoryCapabilityRouter {
  route(context, session = {}) {
    const text = normalize(context?.getCommandInput?.() || context?.normalizedInput || context?.rawInput || '');
    const hasVisualSearch = Boolean(context?.visualQuery?.active || context?.get?.('assistant.visualQuery.active'));
    const searchResult = context?.visualMemorySearch || context?.get?.('assistant.visualMemorySearch') || null;
    if (hasVisualSearch || searchResult) return this._request('search', { text, reason: 'visual-query' });

    if (!text) return null;
    if (/^(?:open|show|view)\s+(?:the\s+)?(?:first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?|this|that|it|one)/.test(text)) {
      return this._request('open', { index: ordinalIndex(text), text, reason: 'conversation-continuation' });
    }
    if (/^(?:open|show|view)\s+(?:it|this|that|current(?:\s+(?:photo|image|memory))?)$/.test(text)) {
      return this._request('open', { index: -1, text, reason: 'current-reference' });
    }
    if (/^(?:next|show\s+next|open\s+next)(?:\s+(?:photo|image|memory|one))?$/.test(text)) return this._request('next', { text });
    if (/^(?:previous|prev|back|show\s+previous|open\s+previous)(?:\s+(?:photo|image|memory|one))?$/.test(text)) return this._request('previous', { text });
    if (/^(?:close|exit)\s+(?:gallery|viewer|photo|image|memory)$/.test(text)) return this._request('close', { text });
    if (/\b(?:favorite|favourite|star|pin)\s+(?:it|this|that|photo|image|memory)\b/.test(text)) return this._request('favorite', { text });
    if (/\b(?:share|send)\s+(?:it|this|that|photo|image|memory)\b/.test(text)) return this._request(/phone|mobile/.test(text) ? 'send' : 'share', { text });
    if (/\b(?:delete|remove)\b.*\b(?:photo|photos|image|images|memory|memories|album|collection|duplicates?)\b/.test(text)) return this._request('delete', { text });
    if (/\b(?:move|copy|archive|restore)\b.*\b(?:photo|photos|image|images|memory|memories|screenshots?|receipts?|invoices?)\b/.test(text)) {
      const action = text.match(/\b(move|copy|archive|restore)\b/)?.[1] || 'move';
      return this._request(action, { text });
    }
    if (/\b(?:create|make)\b.*\b(?:album|collection)\b/.test(text)) {
      return this._request(text.includes('collection') ? 'create-collection' : 'create-album', { text });
    }
    if (session.currentSearch && /^(?:open|show|view|share|send|favorite|delete|move|copy|archive)\b/.test(text)) {
      const action = text.match(/^(open|show|view|share|send|favorite|delete|move|copy|archive)\b/)?.[1] || 'open';
      return this._request(action === 'show' || action === 'view' ? 'open' : action, { index: ordinalIndex(text), text, reason: 'session-continuation' });
    }
    return null;
  }

  _request(action, data = {}) {
    return {
      capability: 'visual-memory',
      action,
      target: data.target || null,
      entities: { ...data },
      confidence: data.reason ? 0.9 : 0.7
    };
  }
}

module.exports = VisualMemoryCapabilityRouter;
