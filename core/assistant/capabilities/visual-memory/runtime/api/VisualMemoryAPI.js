'use strict';

const { IMAGE_EXTENSIONS } = require('../utils/constants');
const { listFilesRecursive } = require('../utils/FileSystemUtils');

class VisualMemoryAPI {
  constructor({ engine } = {}) {
    this.engine = engine;
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
        const imageFiles = await listFilesRecursive(folder.path, scanOptions);
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

  async enrollFaceCluster(input) {
    await this.engine.initialize();
    const result = this.engine.faces.enrollCluster(input);
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
}

module.exports = VisualMemoryAPI;
