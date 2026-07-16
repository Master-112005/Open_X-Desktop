'use strict';

const path = require('path');
const { IMAGE_EXTENSIONS } = require('../utils/constants');
const { listFilesRecursive } = require('../utils/FileSystemUtils');
const { cosineSimilarity } = require('../faces/utils/face-utils');

const DEFAULT_FACE_SCAN_OPTIONS = Object.freeze({
  maxPhotos: 10000,
  faceConfidence: 0.86,
  embeddingConfidence: 0.82
});

class VisualMemoryAPI {
  constructor({ engine } = {}) {
    this.engine = engine;
    this.visionRuntimeLoadingLogged = false;
    this.visionRuntimeReadyLogged = false;
  }

  async initialize() {
    await this.engine.initialize();
    return this.getStatus();
  }

  async start() {
    await this.engine.start();
    return this.getStatus();
  }

  async pause() {
    return this.engine.pause();
  }

  async resume() {
    return this.engine.resume();
  }

  async stop() {
    return this.engine.stop();
  }

  async shutdown() {
    return this.engine.shutdown();
  }

  getStatus() {
    return this.engine.getStatus();
  }

  getHealth() {
    return this.engine.healthCheck();
  }

  getSettings() {
    return this.engine.settings.getSettings();
  }

  async updateSettings(patch) {
    return this.engine.settings.updateSettings(patch);
  }

  async resetSettings() {
    return this.engine.settings.resetSettings();
  }

  listFolders() {
    return this.engine.folders.listFolders();
  }

  getFolder(folderIdOrPath) {
    return this.engine.folders.getFolder(folderIdOrPath);
  }

  async addFolder(folderPath, options = {}) {
    return this.engine.folders.addFolder(folderPath, options);
  }

  async addDefaultFolders() {
    return this.engine.folders.addDefaultFolders();
  }

  async removeFolder(folderIdOrPath) {
    return this.engine.folders.removeFolder(folderIdOrPath);
  }

  async setFolderEnabled(folderIdOrPath, enabled) {
    return this.engine.folders.setFolderEnabled(folderIdOrPath, enabled);
  }

  async getFolderStats(folderIdOrPath) {
    return this.engine.folders.getFolderStats(folderIdOrPath);
  }

  async indexPhoto(filePath, options = {}) {
    this.engine.ensureReady();
    return this.engine.metadata.indexFile(filePath, options);
  }

  async refreshGallery(options = {}) {
    this.engine.ensureReady();
    const folders = options.folderId || options.folderPath
      ? [this.engine.folders.getFolder(options.folderId || options.folderPath)]
      : this.engine.folders.listFolders();
    const enabledFolders = folders.filter(folder => folder && folder.enabled !== false);
    this._logInfo('Gallery indexing started.', {
      folders: enabledFolders.length,
      maxFiles: options.maxFiles,
      maxDepth: options.maxDepth
    });
    const indexed = [];
    const failed = [];
    const settings = this.engine.settings.getSettings();
    const scanOptions = {
      extensions: IMAGE_EXTENSIONS,
      excludedFolders: settings.privacy?.excludedFolders || [],
      maxDepth: options.maxDepth ?? settings.performance?.maxIndexDepth ?? 8,
      maxFiles: options.maxFiles ?? settings.performance?.maxIndexFiles ?? 50000
    };

    for (const folder of enabledFolders) {
      try {
        this._logInfo(`Scanning photo folder: ${folder.path}`, { folderId: folder.id });
        const imageFiles = await listFilesRecursive(folder.path, scanOptions);
        this._logInfo(`Found ${imageFiles.length} image file${imageFiles.length === 1 ? '' : 's'} in ${folder.path}.`, {
          folderId: folder.id,
          files: imageFiles.length
        });
        for (const filePath of imageFiles) {
          try {
            indexed.push(await this.engine.metadata.indexFile(filePath, { folderId: folder.id }));
          } catch (error) {
            failed.push({ filePath, reason: error.message });
            await this.engine.diagnostics.recordError('index-photo-failed', error);
          }
        }
        await this.engine.database.upsert('folders', folder.id, { ...folder, lastIndexedAt: new Date().toISOString() });
      } catch (error) {
        failed.push({ folderId: folder.id, path: folder.path, reason: error.message });
        this._logWarn(`Could not scan photo folder: ${folder.path}`, {
          folderId: folder.id,
          error: error.message
        });
        await this.engine.diagnostics.recordError('index-folder-failed', error);
      }
    }

    const summary = {
      indexed: indexed.length,
      failed: failed.length,
      failures: failed,
      recursive: true,
      maxDepth: scanOptions.maxDepth,
      maxFiles: scanOptions.maxFiles
    };
    this._logInfo(`Gallery indexing completed: ${summary.indexed} photo${summary.indexed === 1 ? '' : 's'} indexed, ${summary.failed} failed.`, {
      indexed: summary.indexed,
      failed: summary.failed,
      recursive: true
    });
    await this.engine.diagnostics.record('gallery-refreshed', summary);
    return summary;
  }

  getPhotos(query = {}) {
    return this.engine.gallery.getPhotos(query);
  }

  getPhoto(photoId) {
    return this.engine.gallery.getPhoto(photoId);
  }

  getMetadata(photoId) {
    return this.engine.metadata.getMetadata(photoId);
  }

  async generateThumbnail(photoId, size) {
    return this.engine.thumbnails.generateThumbnail(photoId, size);
  }

  getThumbnail(photoId, size) {
    return this.engine.thumbnails.getThumbnail(photoId, size);
  }

  async updateGalleryState(patch) {
    return this.engine.gallery.updateGalleryState(patch);
  }

  getGalleryState() {
    return this.engine.gallery.getGalleryState();
  }

  async enable() {
    return this.engine.privacy.enable();
  }

  async disable() {
    return this.engine.privacy.disable();
  }

  async excludeFolder(folderPath) {
    return this.engine.privacy.excludeFolder(folderPath);
  }

  async clearThumbnails() {
    return this.engine.privacy.clearThumbnails();
  }

  async deleteMetadata() {
    return this.engine.privacy.deleteMetadata();
  }

  async resetGallery() {
    return this.engine.privacy.resetGallery();
  }

  async resetDatabase() {
    return this.engine.privacy.resetDatabase();
  }

  getPrivacyState() {
    return this.engine.privacy.getPrivacyState();
  }

  async buildCandidatePool(visualQuery, options = {}) {
    this.engine.ensureReady();
    const pool = this.engine.candidateFiltering.buildCandidatePool({
      visualQuery,
      databaseSnapshot: this.engine.database.snapshot(),
      options
    });
    await this.engine.diagnostics.record('candidate-pool-built', {
      total: pool.candidates.length,
      rejected: pool.rejected.length,
      filters: pool.diagnostics.length
    });
    return options.json === true ? pool.toJSON() : pool;
  }

  async filterByDate(visualQuery, options = {}) {
    return this.buildCandidatePool(visualQuery, { ...options, only: 'date' });
  }

  async filterByFolder(visualQuery, options = {}) {
    return this.buildCandidatePool(visualQuery, { ...options, only: 'folder' });
  }

  async filterByGPS(visualQuery, options = {}) {
    return this.buildCandidatePool(visualQuery, { ...options, only: 'gps' });
  }

  async filterByCamera(visualQuery, options = {}) {
    return this.buildCandidatePool(visualQuery, { ...options, only: 'camera' });
  }

  async filterByAlbum(visualQuery, options = {}) {
    return this.buildCandidatePool(visualQuery, { ...options, only: 'album' });
  }

  async filterScreenshots(visualQuery, options = {}) {
    return this.buildCandidatePool(visualQuery, { ...options, only: 'screenshot' });
  }

  async removeDuplicateCandidates(visualQuery, options = {}) {
    return this.buildCandidatePool(visualQuery, { ...options, only: 'duplicate' });
  }

  async rankCandidates(visualQuery, options = {}) {
    return this.buildCandidatePool(visualQuery, { ...options, rankOnly: true });
  }

  getCandidateStatistics(pool) {
    return this.engine.candidateFiltering.getCandidateStatistics(pool);
  }

  async searchMemories(input = {}) {
    this.engine.ensureReady();
    const candidatePool = input.candidatePool || await this.buildCandidatePool(input.visualQuery, input.filtering || {});
    this._attachFaceMemoryEvidence(candidatePool);
    const result = await this.engine.intelligence.search({
      visualQuery: input.visualQuery,
      candidatePool,
      visionResults: input.visionResults || {},
      assistantContext: input.assistantContext || input.pipelineContext || null,
      previousSearch: input.previousSearch || null,
      options: input.options || {}
    });
    await this.engine.diagnostics.record('memory-intelligence-search', {
      success: result.success,
      total: result.total,
      strategies: result.reasoning?.strategies || []
    });
    return result;
  }

  getMemoryIntelligenceHealth() {
    return this.engine.intelligence.healthCheck();
  }

  continueMemorySearch(continuationToken) {
    return this.engine.intelligence.continueSearch(continuationToken);
  }

  cancelMemorySearch(sessionId, reason = 'cancelled') {
    return this.engine.intelligence.cancelSearch(sessionId, reason);
  }

  async getFaceMemoryStatus() {
    await this.engine.initialize();
    return this.engine.faces.getStatus();
  }

  async getFaceMemoryHealth() {
    await this.engine.initialize();
    return this.engine.faces.healthCheck();
  }

  async reviewFaceMemoryPermissions() {
    await this.engine.initialize();
    return this.engine.faces.reviewPermissions();
  }

  async enableFaceMemory(options = {}) {
    await this.engine.initialize();
    const result = this.engine.faces.enableFaceMemory(options);
    await this.engine.persistFaceMemory();
    return result;
  }

  async disableFaceMemory(reason = 'user-disabled') {
    await this.engine.initialize();
    const result = this.engine.faces.disableFaceMemory(reason);
    await this.engine.persistFaceMemory();
    return result;
  }

  async ingestUnknownFace(face) {
    await this.engine.initialize();
    const result = this.engine.faces.ingestUnknownFace(face);
    await this.engine.persistFaceMemory();
    return result;
  }

  async getFaceEnrollmentSuggestions() {
    await this.engine.initialize();
    return this.engine.faces.getEnrollmentSuggestions();
  }

  async scanGalleryPeople(options = {}) {
    await this.engine.initialize();
    const scanOptions = {
      ...DEFAULT_FACE_SCAN_OPTIONS,
      ...(options || {})
    };
    scanOptions.maxPhotos = Math.max(1, Math.min(100000, Number(scanOptions.maxPhotos) || DEFAULT_FACE_SCAN_OPTIONS.maxPhotos));
    scanOptions.faceConfidence = Math.max(0.5, Math.min(0.99, Number(scanOptions.faceConfidence) || DEFAULT_FACE_SCAN_OPTIONS.faceConfidence));
    scanOptions.embeddingConfidence = Math.max(0.5, Math.min(0.99, Number(scanOptions.embeddingConfidence) || DEFAULT_FACE_SCAN_OPTIONS.embeddingConfidence));
    const startedAt = Date.now();

    this._logInfo('People scan started. OpenX will check indexed photos for clear, verified faces.', {
      maxPhotos: scanOptions.maxPhotos,
      faceConfidence: scanOptions.faceConfidence,
      embeddingConfidence: scanOptions.embeddingConfidence
    });

    const vision = await this._resolveVisionEngine();
    if (!vision.available) {
      this._logWarn('People scan stopped because the AI Vision face runtime is not available.', {
        reason: vision.reason,
        warnings: vision.warnings?.length || 0
      });
      return {
        success: false,
        reason: vision.reason,
        scanned: 0,
        grouped: 0,
        detectedFaces: 0,
        skipped: 0,
        warnings: vision.warnings,
        verification: this._faceScanVerification(scanOptions)
      };
    }

    const status = this.engine.faces.getStatus();
    if (status?.enabled !== true) {
      this.engine.faces.enableFaceMemory({ acceptedBy: options.acceptedBy || 'gallery-people-scan' });
      await this.engine.persistFaceMemory();
    }
    const resetSummary = scanOptions.rescan === false
      ? { removedEmbeddings: 0, removedClusters: 0 }
      : this._resetGalleryScanUnknownFaces();
    if (resetSummary.removedClusters > 0 || resetSummary.removedEmbeddings > 0) {
      this._logInfo('Cleared old unnamed people before rescanning so the People view stays accurate.', resetSummary);
    }

    const existingPhotoIds = new Set(Object.values(this.engine.faces.state.embeddings || {})
      .map(embedding => embedding.photoId)
      .filter(Boolean));
    const skipAlreadyKnownPhotos = scanOptions.rescan === false;
    const photos = Object.values(this.engine.database.getTable('photos') || {})
      .filter(photo => photo?.id && photo.filePath && (!skipAlreadyKnownPhotos || !existingPhotoIds.has(photo.id)))
      .slice(0, scanOptions.maxPhotos);
    this._logInfo(`People scan will analyze ${photos.length} photo${photos.length === 1 ? '' : 's'}.`, {
      indexedPhotos: Object.keys(this.engine.database.getTable('photos') || {}).length,
      alreadyKnownPhotos: existingPhotoIds.size,
      queuedPhotos: photos.length
    });

    const summary = {
      success: true,
      reason: 'completed',
      scanned: 0,
      grouped: 0,
      detectedFaces: 0,
      verifiedFaces: 0,
      autoAssigned: 0,
      duplicateSuppressed: 0,
      skipped: 0,
      reset: resetSummary,
      warnings: [],
      verification: this._faceScanVerification(scanOptions)
    };

    for (const photo of photos) {
      summary.scanned += 1;
      this._logPeopleScanProgress(summary.scanned, photos.length);
      try {
        const result = await vision.engine.infer({
          imagePath: photo.filePath,
          tasks: ['faces', 'faceEmbedding'],
          options: { source: 'gallery-people-scan', photoId: photo.id }
        });
        const verified = this._verifiedFaceEmbeddings(result, photo.id, scanOptions);
        summary.detectedFaces += verified.detectedFaces;
        summary.verifiedFaces += verified.items.length;
        summary.warnings.push(...verified.warnings);
        if (verified.items.length === 0) {
          summary.skipped += 1;
          continue;
        }
        this._logDebug(`Verified ${verified.items.length} face${verified.items.length === 1 ? '' : 's'} in ${this._photoLabel(photo)}.`, {
          photoId: photo.id,
          detectedFaces: verified.detectedFaces,
          verifiedFaces: verified.items.length
        });
        for (const item of verified.items) {
          const grouped = this.engine.faces.ingestUnknownFace(item);
          if (grouped?.autoAssigned) {
            summary.autoAssigned += 1;
            if (grouped.duplicate) summary.duplicateSuppressed += 1;
          } else if (grouped?.duplicate) {
            summary.duplicateSuppressed += 1;
          } else if (!grouped?.skipped) {
            summary.grouped += 1;
          }
          else summary.warnings.push({ photoId: photo.id, code: grouped.reason || 'face-memory-skipped' });
        }
      } catch (error) {
        summary.skipped += 1;
        summary.warnings.push({ photoId: photo.id, code: error.code || 'vision-inference-failed', message: error.message });
        this._logWarn(`Could not check ${this._photoLabel(photo)} for faces.`, {
          photoId: photo.id,
          code: error.code || 'vision-inference-failed',
          error: error.message
        });
      }
    }

    await this.engine.persistFaceMemory();
    summary.people = this.engine.galleryExperience.getPeople();
    summary.durationMs = Date.now() - startedAt;
    this._logInfo('People scan finished. Face detection, recognition, and duplicate cleanup are complete.', {
      scanned: summary.scanned,
      facesDetected: summary.detectedFaces,
      facesVerified: summary.verifiedFaces,
      newUnnamedPeople: summary.grouped,
      knownPeopleMatched: summary.autoAssigned,
      duplicateFacesSkipped: summary.duplicateSuppressed,
      skipped: summary.skipped,
      warnings: summary.warnings.length,
      durationMs: summary.durationMs,
      people: summary.people?.summary?.totalPeople || summary.people?.items?.length || undefined
    });
    return summary;
  }

  async enrollFaceCluster(input) {
    await this.engine.initialize();
    const result = this.engine.faces.enrollCluster(input);
    await this.engine.persistFaceMemory();
    return result;
  }

  async addFaceClusterToIdentity(input = {}) {
    await this.engine.initialize();
    const result = this.engine.faces.addClusterToIdentity(input);
    await this.engine.persistFaceMemory();
    return result;
  }

  async deleteFaceCluster(clusterId) {
    await this.engine.initialize();
    const result = this.engine.faces.deleteCluster(clusterId);
    await this.engine.persistFaceMemory();
    return result;
  }

  async matchFace(vector) {
    await this.engine.initialize();
    return this.engine.faces.matchFace(vector);
  }

  async searchFaces(query = {}) {
    await this.engine.initialize();
    return this.engine.faces.searchFaces(query);
  }

  async mergeFaceIdentities(sourceId, targetId) {
    await this.engine.initialize();
    const result = this.engine.faces.mergeIdentities(sourceId, targetId);
    await this.engine.persistFaceMemory();
    return result;
  }

  async splitFaceIdentity(identityId, embeddingIds, newName) {
    await this.engine.initialize();
    const result = this.engine.faces.splitIdentity(identityId, embeddingIds, newName);
    await this.engine.persistFaceMemory();
    return result;
  }

  async deleteFaceIdentity(identityId) {
    await this.engine.initialize();
    const result = this.engine.faces.deleteIdentity(identityId);
    await this.engine.persistFaceMemory();
    return result;
  }

  async resetFaceMemory() {
    await this.engine.initialize();
    const result = this.engine.faces.reset();
    await this.engine.persistFaceMemory();
    return result;
  }

  async exportFaceMemoryData() {
    await this.engine.initialize();
    return this.engine.faces.exportFaceData();
  }

  async getFaceCollections() {
    await this.engine.initialize();
    return this.engine.faces.getCollections();
  }

  async getFaceTimeline(identityId) {
    await this.engine.initialize();
    return this.engine.faces.getTimeline(identityId);
  }

  _attachFaceMemoryEvidence(candidatePool) {
    const candidates = Array.isArray(candidatePool?.candidates) ? candidatePool.candidates : [];
    if (candidates.length === 0) return candidatePool;
    const state = this.engine.faces?.state || {};
    const profiles = state.profiles || {};
    const identities = state.identities || {};
    const byPhoto = new Map();
    for (const embedding of Object.values(state.embeddings || {})) {
      if (!embedding?.photoId || !embedding.identityId) continue;
      const identity = identities[embedding.identityId];
      const profile = profiles[identity?.profileId];
      if (!profile) continue;
      const item = byPhoto.get(embedding.photoId) || {
        names: new Set(),
        relationships: new Set(),
        identityIds: new Set(),
        profileIds: new Set(),
        faceCount: 0
      };
      item.faceCount += 1;
      if (profile.name) item.names.add(profile.name);
      if (identity?.name) item.names.add(identity.name);
      for (const relationship of this._relationshipSearchTerms(profile.relationship || identity?.relationship || '')) {
        item.relationships.add(relationship);
      }
      item.identityIds.add(identity.id);
      item.profileIds.add(profile.id);
      byPhoto.set(embedding.photoId, item);
    }
    for (const candidate of candidates) {
      const evidence = byPhoto.get(candidate.photoId);
      if (!evidence) continue;
      const peopleNames = Array.from(evidence.names);
      const relationships = Array.from(evidence.relationships);
      candidate.faceMemory = {
        peopleNames,
        relationships,
        identityIds: Array.from(evidence.identityIds),
        profileIds: Array.from(evidence.profileIds),
        faceCount: evidence.faceCount
      };
      candidate.metadata = {
        ...(candidate.metadata || {}),
        peopleNames,
        faceRelationships: relationships,
        personCount: Math.max(Number(candidate.metadata?.personCount) || 0, evidence.faceCount)
      };
    }
    return candidatePool;
  }

  _relationshipSearchTerms(value = '') {
    const normalized = String(value || '').toLowerCase().trim();
    const aliases = {
      father: ['father', 'dad', 'papa'],
      mother: ['mother', 'mom', 'mummy', 'amma'],
      parents: ['parents', 'family'],
      brother: ['brother'],
      sister: ['sister'],
      friend: ['friend', 'friends'],
      friends: ['friend', 'friends'],
      family: ['family'],
      wife: ['wife', 'spouse'],
      husband: ['husband', 'spouse'],
      colleague: ['colleague', 'coworker']
    };
    return aliases[normalized] || (normalized ? [normalized] : []);
  }

  async setFaceRelationship(identityId, relationship, source = 'user') {
    await this.engine.initialize();
    const result = this.engine.faces.setRelationship(identityId, relationship, source);
    await this.engine.persistFaceMemory();
    return result;
  }

  async getOpenXGalleryStatus() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getStatus();
  }

  async getOpenXGalleryHealth() {
    await this.engine.initialize();
    return this.engine.galleryExperience.healthCheck();
  }

  async openOpenXGallery(view = 'timeline', options = {}) {
    await this.engine.initialize();
    return this.engine.galleryExperience.open(view, options);
  }

  async closeOpenXGallery(reason = 'manual') {
    await this.engine.initialize();
    return this.engine.galleryExperience.close(reason);
  }

  async getOpenXGalleryNavigation() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getNavigation();
  }

  async openOpenXGalleryView(view, options = {}) {
    await this.engine.initialize();
    return this.engine.galleryExperience.openView(view, options);
  }

  async getOpenXGalleryTimeline(options = {}) {
    await this.engine.initialize();
    return this.engine.galleryExperience.getTimeline(options);
  }

  async getOpenXGalleryPeople() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getPeople();
  }

  async getOpenXGalleryPlaces() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getPlaces();
  }

  async getOpenXGalleryEvents(memorySearchResult = {}) {
    await this.engine.initialize();
    return this.engine.galleryExperience.getEvents(memorySearchResult);
  }

  async getOpenXGalleryObjects(visionResults = {}) {
    await this.engine.initialize();
    return this.engine.galleryExperience.getObjects(visionResults);
  }

  async getOpenXGalleryCollections() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getCollections();
  }

  async getOpenXGalleryAlbums() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getAlbums();
  }

  async openOpenXGallerySearchResults(memorySearchResult = {}, options = {}) {
    await this.engine.initialize();
    return this.engine.galleryExperience.openSearchResults(memorySearchResult, options);
  }

  async openOpenXGalleryViewer(photoId, options = {}) {
    await this.engine.initialize();
    return this.engine.galleryExperience.openViewer(photoId, options);
  }

  async setOpenXGallerySelection(ids, mode = 'multiple') {
    await this.engine.initialize();
    return this.engine.galleryExperience.setSelection(ids, mode);
  }

  async getOpenXGallerySelection() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getSelection();
  }

  async toggleOpenXGalleryFavorite(type, id, value = null) {
    await this.engine.initialize();
    return this.engine.galleryExperience.toggleFavorite(type, id, value);
  }

  async getOpenXGalleryFavorites(type = 'images') {
    await this.engine.initialize();
    return this.engine.galleryExperience.getFavorites(type);
  }

  async addOpenXGalleryRecent(type, item) {
    await this.engine.initialize();
    return this.engine.galleryExperience.addRecent(type, item);
  }

  async getOpenXGalleryRecent(type = 'images') {
    await this.engine.initialize();
    return this.engine.galleryExperience.getRecent(type);
  }

  async presentOpenXGallerySimilar(memorySearchResult = {}) {
    await this.engine.initialize();
    return this.engine.galleryExperience.presentSimilar(memorySearchResult);
  }

  async getOpenXGalleryQuickActions() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getQuickActions();
  }

  async getOpenXGalleryAccessibility() {
    await this.engine.initialize();
    return this.engine.galleryExperience.getAccessibility();
  }

  async getVisualMemoryLearningStatus() {
    await this.engine.initialize();
    return this.engine.learning.getStatus();
  }

  async getVisualMemoryLearningHealth() {
    await this.engine.initialize();
    return this.engine.learning.healthCheck();
  }

  async learnFromVisualMemoryInteraction(input = {}) {
    await this.engine.initialize();
    const result = await this.engine.learning.learn(input);
    await this.engine.persistVisualMemoryLearning();
    return result;
  }

  async recordVisualMemoryFeedback(feedback = {}) {
    return this.learnFromVisualMemoryInteraction({ feedback, type: 'feedback' });
  }

  async recordVisualMemoryCorrection(correction = {}) {
    return this.learnFromVisualMemoryInteraction({ correction, type: 'correction' });
  }

  async setVisualMemoryPreference(preference = {}) {
    return this.learnFromVisualMemoryInteraction({ preference, type: 'preference' });
  }

  async adaptVisualMemoryRanking(results = []) {
    await this.engine.initialize();
    return this.engine.learning.adaptRanking(results);
  }

  async getVisualMemoryRecommendations(context = {}) {
    await this.engine.initialize();
    return this.engine.learning.getRecommendations(context);
  }

  async getVisualMemoryLearningDashboard() {
    await this.engine.initialize();
    return this.engine.learning.getDashboard();
  }

  async undoVisualMemoryLearning(recordId) {
    await this.engine.initialize();
    const result = this.engine.learning.undo(recordId);
    await this.engine.persistVisualMemoryLearning();
    return result;
  }

  async resetVisualMemoryLearning() {
    await this.engine.initialize();
    const result = this.engine.learning.reset();
    await this.engine.persistVisualMemoryLearning();
    return result;
  }

  async exportVisualMemoryLearningData() {
    await this.engine.initialize();
    return this.engine.learning.exportData();
  }

  async _resolveVisionEngine() {
    if (!this.visionRuntimeLoadingLogged) {
      this.visionRuntimeLoadingLogged = true;
      this._logInfo('Loading AI Vision face runtime for People scan.', {
        detector: 'SCRFD face detector',
        embedding: 'MobileFaceNet face recognition embeddings',
        runtime: 'windows-face-analysis'
      });
    }
    const injected = this.engine.options?.visionEngine || this.engine.visionEngine || null;
    const engine = injected || await this._createDefaultVisionEngine();
    if (!engine || typeof engine.infer !== 'function') {
      this._logWarn('AI Vision runtime is not connected to Visual Memory.');
      return { available: false, reason: 'vision-engine-unavailable', warnings: [{ code: 'vision-engine-unavailable' }] };
    }
    await engine.initialize?.();
    const adapters = engine.runtime?.getStatus?.().adapters || [];
    if (!Array.isArray(adapters) || adapters.length === 0) {
      this._logWarn('AI Vision started, but no face detection adapter is available.');
      return {
        available: false,
        reason: 'vision-runtime-unavailable',
        warnings: [{ code: 'vision-runtime-unavailable', message: 'No AI Vision runtime adapter is available for face detection.' }]
      };
    }
    if (!this.visionRuntimeReadyLogged) {
      this.visionRuntimeReadyLogged = true;
      this._logInfo('AI Vision face runtime ready.', {
        detector: 'SCRFD face detector',
        embedding: 'MobileFaceNet face recognition embeddings',
        runtime: 'windows-face-analysis',
        adapterCount: adapters.length
      });
    }
    return { available: true, engine, warnings: [] };
  }

  async _createDefaultVisionEngine() {
    if (this.engine.visionEngine) return this.engine.visionEngine;
    try {
      const { VisionEngine, WindowsFaceRuntimeAdapter } = require('../../../../../vision');
      this.engine.visionEngine = new VisionEngine({
        logger: this.engine.logger,
        configuration: this.engine.options?.vision || {}
      });
      if (process.platform === 'win32' && WindowsFaceRuntimeAdapter) {
        this.engine.visionEngine.registerRuntimeAdapter('onnx', new WindowsFaceRuntimeAdapter({
          logger: this.engine.logger,
          timeoutMs: this.engine.options?.vision?.resources?.timeoutMs || 20000
        }));
        this._logInfo('Windows face detection adapter registered for OpenX Gallery People scan.');
      }
      return this.engine.visionEngine;
    } catch (error) {
      this._logWarn('Could not create the default AI Vision engine for People scan.', { error: error.message });
      return null;
    }
  }

  _faceScanVerification(options = {}) {
    return {
      requireFaceDetection: true,
      requireFaceEmbedding: true,
      faceConfidenceThreshold: options.faceConfidence,
      embeddingConfidenceThreshold: options.embeddingConfidence,
      source: 'ai-vision'
    };
  }

  _verifiedFaceEmbeddings(result = {}, photoId = '', options = {}) {
    const faces = (Array.isArray(result.faces) ? result.faces : [])
      .filter(face => Number(face.confidence || 0) >= options.faceConfidence);
    const embeddings = (Array.isArray(result.embeddings) ? result.embeddings : [])
      .filter(embedding => Array.isArray(embedding.vector)
        && embedding.vector.length > 0
        && embedding.vector.every(Number.isFinite)
        && Number(embedding.confidence || 0) >= options.embeddingConfidence);
    const warnings = Array.isArray(result.warnings) ? result.warnings.slice(0, 5) : [];
    const count = Math.min(faces.length, embeddings.length);
    if (faces.length > 0 && embeddings.length === 0) warnings.push({ photoId, code: 'face-embedding-missing' });
    if (faces.length === 0 && embeddings.length > 0) warnings.push({ photoId, code: 'face-detection-missing' });
    const paired = [];
    for (let index = 0; index < count; index += 1) {
      const face = faces[index];
      const embedding = embeddings[index];
      paired.push({
        face,
        embedding,
        index,
        confidence: Math.min(Number(face.confidence || 0), Number(embedding.confidence || 0))
      });
    }
    const uniquePairs = this._dedupeFacePairs(paired);
    const suppressed = paired.length - uniquePairs.length;
    if (suppressed > 0) warnings.push({ photoId, code: 'duplicate-face-detection-suppressed', count: suppressed });
    const items = [];
    for (const pair of uniquePairs) {
      const { face, embedding, index, confidence } = pair;
      items.push({
        vector: embedding.vector,
        photoId,
        faceId: face.id || `${photoId}:face:${index + 1}`,
        confidence,
        source: 'gallery-people-scan',
        faceBox: face.box || null,
        imageWidth: Number(face.imageWidth || face.box?.imageWidth || 0) || null,
        imageHeight: Number(face.imageHeight || face.box?.imageHeight || 0) || null
      });
    }
    return { items, detectedFaces: faces.length, warnings };
  }

  _dedupeFacePairs(pairs = []) {
    const selected = [];
    const sorted = pairs
      .slice()
      .sort((left, right) => (right.confidence || 0) - (left.confidence || 0));
    for (const pair of sorted) {
      const box = pair.face?.box || null;
      const duplicate = selected.some(existing => {
        const existingBox = existing.face?.box || null;
        return (box && existingBox && this._isDuplicateFaceBox(box, existingBox))
          || this._isDuplicateFaceEmbedding(pair.embedding, existing.embedding);
      });
      if (!duplicate) selected.push(pair);
    }
    return selected.sort((left, right) => left.index - right.index);
  }

  _isDuplicateFaceEmbedding(left = {}, right = {}) {
    const threshold = Number(this.engine.faces?.configuration?.thresholds?.duplicate ?? 0.998);
    const leftVector = Array.isArray(left?.vector) ? left.vector : [];
    const rightVector = Array.isArray(right?.vector) ? right.vector : [];
    if (!leftVector.length || !rightVector.length) return false;
    return cosineSimilarity(leftVector, rightVector) >= threshold;
  }

  _isDuplicateFaceBox(left = {}, right = {}) {
    if (!left || !right) return false;
    const overlap = this._faceBoxIoU(left, right);
    if (overlap >= 0.42) return true;
    const leftWidth = Math.max(1, Number(left.width) || 0);
    const leftHeight = Math.max(1, Number(left.height) || 0);
    const rightWidth = Math.max(1, Number(right.width) || 0);
    const rightHeight = Math.max(1, Number(right.height) || 0);
    const leftCenterX = (Number(left.x) || 0) + (leftWidth / 2);
    const leftCenterY = (Number(left.y) || 0) + (leftHeight / 2);
    const rightCenterX = (Number(right.x) || 0) + (rightWidth / 2);
    const rightCenterY = (Number(right.y) || 0) + (rightHeight / 2);
    const centerDistance = Math.hypot(leftCenterX - rightCenterX, leftCenterY - rightCenterY);
    const averageSize = (leftWidth + leftHeight + rightWidth + rightHeight) / 4;
    return centerDistance <= averageSize * 0.28 && overlap >= 0.18;
  }

  _faceBoxIoU(left = {}, right = {}) {
    const leftX = Number(left.x) || 0;
    const leftY = Number(left.y) || 0;
    const leftWidth = Math.max(0, Number(left.width) || 0);
    const leftHeight = Math.max(0, Number(left.height) || 0);
    const rightX = Number(right.x) || 0;
    const rightY = Number(right.y) || 0;
    const rightWidth = Math.max(0, Number(right.width) || 0);
    const rightHeight = Math.max(0, Number(right.height) || 0);
    const x1 = Math.max(leftX, rightX);
    const y1 = Math.max(leftY, rightY);
    const x2 = Math.min(leftX + leftWidth, rightX + rightWidth);
    const y2 = Math.min(leftY + leftHeight, rightY + rightHeight);
    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const union = (leftWidth * leftHeight) + (rightWidth * rightHeight) - intersection;
    return union > 0 ? intersection / union : 0;
  }

  _resetGalleryScanUnknownFaces() {
    const state = this.engine.faces.state;
    const removableEmbeddingIds = new Set();
    const removableClusterIds = [];
    for (const [clusterId, cluster] of Object.entries(state.unknownClusters || {})) {
      if (cluster.status !== 'unknown') continue;
      removableClusterIds.push(clusterId);
      for (const embeddingId of cluster.embeddingIds || []) {
        removableEmbeddingIds.add(embeddingId);
      }
    }

    for (const clusterId of removableClusterIds) delete state.unknownClusters[clusterId];
    for (const embeddingId of removableEmbeddingIds) delete state.embeddings[embeddingId];
    return { removedEmbeddings: removableEmbeddingIds.size, removedClusters: removableClusterIds.length };
  }

  _logPeopleScanProgress(scanned, total) {
    if (total <= 0) return;
    if (scanned !== 1 && scanned !== total && scanned % 25 !== 0) return;
    this._logInfo(`People scan progress: checked ${scanned} of ${total} photo${total === 1 ? '' : 's'}.`, {
      scanned,
      total,
      remaining: Math.max(0, total - scanned)
    });
  }

  _photoLabel(photo = {}) {
    return String(photo.fileName || path.basename(String(photo.filePath || '')) || photo.id || 'photo');
  }

  _logInfo(message, data = {}) {
    this.engine?.logger?.info?.(`[Visual Memory] ${message}`, data);
  }

  _logWarn(message, data = {}) {
    this.engine?.logger?.warn?.(`[Visual Memory] ${message}`, data);
  }

  _logDebug(message, data = {}) {
    this.engine?.logger?.debug?.(`[Visual Memory] ${message}`, data);
  }
}

module.exports = VisualMemoryAPI;
