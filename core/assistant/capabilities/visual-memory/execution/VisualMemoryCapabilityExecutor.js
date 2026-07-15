'use strict';

const { topResult } = require('../utils/visual-memory-capability-utils');

class VisualMemoryCapabilityExecutor {
  constructor({ visualMemoryApi = null, verification, diagnostics } = {}) {
    this.visualMemoryApi = visualMemoryApi;
    this.verification = verification;
    this.diagnostics = diagnostics;
  }

  async execute(request, session, context) {
    const verify = this.verification.requiresVerification(request, session);
    if (verify.required) {
      return {
        type: 'verification',
        action: request.action,
        success: false,
        requiresVerification: true,
        verification: verify,
        data: { pendingAction: request, sessionId: session.id }
      };
    }

    if (request.action === 'search') return this._search(session, context);
    if (request.action === 'open') return this._open(request, session);
    if (request.action === 'next' || request.action === 'previous') return this._step(request.action, session);
    if (request.action === 'close') return this._close(session);
    if (request.action === 'favorite') return this._favorite(session);
    if (['share', 'send', 'move', 'copy', 'archive', 'restore', 'create-album', 'create-collection', 'merge', 'compare', 'duplicate-detection', 'album-management', 'collection-management'].includes(request.action)) {
      return this._orchestrated(request, session);
    }
    return { type: 'unsupported', action: request.action, success: false, data: { reason: 'Unsupported Visual Memory capability action.' } };
  }

  async _search(session, context) {
    const visualSearch = context?.visualMemorySearch || context?.get?.('assistant.visualMemorySearch') || null;
    const galleryView = this.visualMemoryApi?.openOpenXGallerySearchResults && visualSearch
      ? await this.visualMemoryApi.openOpenXGallerySearchResults(visualSearch)
      : null;
    const results = Array.isArray(visualSearch?.results) ? visualSearch.results : [];
    const currentMemory = results[0] || null;
    return {
      type: 'search',
      action: 'search',
      success: Boolean(visualSearch?.success),
      data: {
        total: visualSearch?.total || results.length,
        results,
        galleryView,
        strategies: visualSearch?.reasoning?.strategies || [],
        topConfidence: results[0]?.confidence || 0
      },
      sessionPatch: {
        currentSearch: visualSearch,
        currentMemory,
        currentImage: currentMemory?.photoId || null,
        currentSelection: results.slice(0, 1).map(result => result.photoId).filter(Boolean)
      }
    };
  }

  async _open(request, session) {
    const index = Number.isInteger(request.entities?.index) && request.entities.index >= 0 ? request.entities.index : 0;
    const memory = topResult(session.currentSearch, index) || session.currentMemory;
    const photoId = memory?.photoId || session.currentImage;
    if (!photoId) return { type: 'open', action: 'open', success: false, data: { reason: 'No current visual memory is available.' } };
    const viewer = this.visualMemoryApi?.openOpenXGalleryViewer
      ? await this.visualMemoryApi.openOpenXGalleryViewer(photoId)
      : { photo: { id: photoId } };
    return {
      type: 'viewer',
      action: 'open',
      success: true,
      data: { viewer, memory, photoId },
      sessionPatch: {
        currentMemory: memory,
        currentImage: photoId,
        currentViewer: viewer,
        currentSelection: [photoId]
      }
    };
  }

  async _step(action, session) {
    const viewer = session.currentViewer || {};
    const photoId = action === 'next' ? viewer.navigation?.nextPhotoId : viewer.navigation?.previousPhotoId;
    if (!photoId) return { type: 'viewer', action, success: false, data: { reason: `No ${action} visual memory is available.` } };
    const opened = this.visualMemoryApi?.openOpenXGalleryViewer
      ? await this.visualMemoryApi.openOpenXGalleryViewer(photoId)
      : { photo: { id: photoId } };
    return { type: 'viewer', action, success: true, data: { viewer: opened, photoId }, sessionPatch: { currentImage: photoId, currentViewer: opened, currentSelection: [photoId] } };
  }

  async _close(session) {
    await this.visualMemoryApi?.closeOpenXGallery?.('assistant-close');
    return { type: 'viewer', action: 'close', success: true, data: {}, sessionPatch: { currentViewer: null } };
  }

  async _favorite(session) {
    const photoId = session.currentImage || session.currentSelection?.[0];
    if (!photoId) return { type: 'favorite', action: 'favorite', success: false, data: { reason: 'No current image to favorite.' } };
    const favorite = await this.visualMemoryApi?.toggleOpenXGalleryFavorite?.('images', photoId, true);
    return { type: 'favorite', action: 'favorite', success: true, data: { favorite, photoId } };
  }

  _orchestrated(request, session) {
    this.diagnostics?.record?.('multi-capability-orchestration-required', { action: request.action, sessionId: session.id });
    return {
      type: 'orchestration',
      action: request.action,
      success: true,
      data: {
        orchestrationRequired: true,
        capability: 'visual-memory',
        nextCapabilities: this._nextCapabilities(request.action),
        currentImage: session.currentImage,
        currentSelection: session.currentSelection
      }
    };
  }

  _nextCapabilities(action) {
    if (action === 'send') return ['phone', 'communication'];
    if (action === 'share') return ['communication'];
    if (['move', 'copy', 'archive', 'restore'].includes(action)) return ['automation'];
    return ['assistant'];
  }
}

module.exports = VisualMemoryCapabilityExecutor;
