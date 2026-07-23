'use strict';

const path = require('path');
const { IMAGE_EXTENSIONS } = require('../utils/constants');
const { listFilesRecursive } = require('../utils/FileSystemUtils');
const {
  cosineSimilarity,
  faceQualityScore,
  normalizeFaceBox,
  normalizedFaceBoxDistance,
  weightedMeanVector
} = require('../faces/utils/face-utils');
const {
  personValuesMatch,
  relationshipAliasesFor,
  relationshipValuesMatch
} = require('../../../../entities/PersonLexicon');

const DEFAULT_FACE_SCAN_OPTIONS = Object.freeze({
  maxPhotos: null,
  faceConfidence: 0.86,
  embeddingConfidence: 0.82,
  faceQuality: 0.56,
  minFacePixels: 32,
  minFaceAreaRatio: 0.0006,
  maxFaceAreaRatio: 0.68,
  minFaceAspect: 0.45,
  maxFaceAspect: 1.75,
  minFaceSharpness: 0.012,
  minFaceContrast: 0.018,
  minFaceTextureEnergy: 0.012,
  minFaceVectorDimensions: 64,
  duplicateClusterSimilarity: 0.985,
  duplicateClusterMargin: 0.012
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
    this._attachFaceMemoryEvidence(candidatePool, input.visualQuery);
    const result = await this.engine.intelligence.search({
      visualQuery: input.visualQuery,
      candidatePool,
      visionResults: input.visionResults || {},
      assistantContext: input.assistantContext || input.pipelineContext || null,
      previousSearch: input.previousSearch || null,
      faceSearchContext: candidatePool.faceSearchContext || null,
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
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const scanOptions = {
      ...DEFAULT_FACE_SCAN_OPTIONS,
      ...(options || {})
    };
    delete scanOptions.onProgress;
    const requestedMaxPhotos = Number(scanOptions.maxPhotos);
    scanOptions.maxPhotos = Number.isFinite(requestedMaxPhotos) && requestedMaxPhotos > 0
      ? Math.max(1, Math.min(500000, Math.floor(requestedMaxPhotos)))
      : null;
    scanOptions.faceConfidence = Math.max(0.5, Math.min(0.99, Number(scanOptions.faceConfidence) || DEFAULT_FACE_SCAN_OPTIONS.faceConfidence));
    scanOptions.embeddingConfidence = Math.max(0.5, Math.min(0.99, Number(scanOptions.embeddingConfidence) || DEFAULT_FACE_SCAN_OPTIONS.embeddingConfidence));
    scanOptions.faceQuality = Math.max(0.35, Math.min(0.95, Number(scanOptions.faceQuality) || this.engine.faces?.configuration?.quality?.minScanQuality || DEFAULT_FACE_SCAN_OPTIONS.faceQuality));
    scanOptions.minFacePixels = Math.max(16, Math.min(160, Number(scanOptions.minFacePixels) || DEFAULT_FACE_SCAN_OPTIONS.minFacePixels));
    scanOptions.minFaceAreaRatio = Math.max(0.0001, Math.min(0.04, Number(scanOptions.minFaceAreaRatio) || DEFAULT_FACE_SCAN_OPTIONS.minFaceAreaRatio));
    scanOptions.maxFaceAreaRatio = Math.max(0.12, Math.min(0.9, Number(scanOptions.maxFaceAreaRatio) || DEFAULT_FACE_SCAN_OPTIONS.maxFaceAreaRatio));
    scanOptions.minFaceAspect = Math.max(0.25, Math.min(0.9, Number(scanOptions.minFaceAspect) || DEFAULT_FACE_SCAN_OPTIONS.minFaceAspect));
    scanOptions.maxFaceAspect = Math.max(1.1, Math.min(3, Number(scanOptions.maxFaceAspect) || DEFAULT_FACE_SCAN_OPTIONS.maxFaceAspect));
    scanOptions.minFaceSharpness = Math.max(0, Math.min(0.2, Number(scanOptions.minFaceSharpness) || DEFAULT_FACE_SCAN_OPTIONS.minFaceSharpness));
    scanOptions.minFaceContrast = Math.max(0, Math.min(0.2, Number(scanOptions.minFaceContrast) || DEFAULT_FACE_SCAN_OPTIONS.minFaceContrast));
    scanOptions.minFaceTextureEnergy = Math.max(0, Math.min(0.2, Number(scanOptions.minFaceTextureEnergy) || DEFAULT_FACE_SCAN_OPTIONS.minFaceTextureEnergy));
    scanOptions.minFaceVectorDimensions = Math.max(0, Math.min(512, Number(scanOptions.minFaceVectorDimensions) || DEFAULT_FACE_SCAN_OPTIONS.minFaceVectorDimensions));
    scanOptions.duplicateClusterSimilarity = Math.max(0.95, Math.min(0.9999, Number(scanOptions.duplicateClusterSimilarity) || DEFAULT_FACE_SCAN_OPTIONS.duplicateClusterSimilarity));
    scanOptions.duplicateClusterMargin = Math.max(0, Math.min(0.08, Number(scanOptions.duplicateClusterMargin) || DEFAULT_FACE_SCAN_OPTIONS.duplicateClusterMargin));
    const startedAt = Date.now();

    this._emitPeopleScanProgress(onProgress, {
      stage: 'preparing',
      message: 'Preparing People scan.',
      detail: 'OpenX is checking scan settings and Face Memory permissions.'
    });
    this._logInfo('People scan started. OpenX will check indexed photos for clear, verified faces.', {
      maxPhotos: scanOptions.maxPhotos || 'all-indexed-photos',
      faceConfidence: scanOptions.faceConfidence,
      embeddingConfidence: scanOptions.embeddingConfidence,
      faceQuality: scanOptions.faceQuality,
      minFacePixels: scanOptions.minFacePixels,
      minFaceSharpness: scanOptions.minFaceSharpness,
      duplicateClusterSimilarity: scanOptions.duplicateClusterSimilarity,
      duplicateClusterMargin: scanOptions.duplicateClusterMargin
    });

    this._emitPeopleScanProgress(onProgress, {
      stage: 'loading-runtime',
      message: 'Loading local face scanner.',
      detail: 'OpenX is starting local face detection and face-matching support.'
    });
    const vision = await this._resolveVisionEngine();
    if (!vision.available) {
      this._logWarn('People scan stopped because the AI Vision face runtime is not available.', {
        reason: vision.reason,
        warnings: vision.warnings?.length || 0
      });
      this._emitPeopleScanProgress(onProgress, {
        stage: 'failed',
        message: 'People scan could not start.',
        detail: 'The local AI Vision face runtime is not available.',
        success: false,
        reason: vision.reason
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
    this._emitPeopleScanProgress(onProgress, {
      stage: 'runtime-ready',
      message: 'Face scanner is ready.',
      detail: 'OpenX will now scan indexed Gallery photos locally.'
    });

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
      this._emitPeopleScanProgress(onProgress, {
        stage: 'cleaning-old-results',
        message: 'Refreshing old unnamed people.',
        detail: `Removed ${resetSummary.removedClusters} old unnamed group${resetSummary.removedClusters === 1 ? '' : 's'} before rescanning.`,
        removedClusters: resetSummary.removedClusters,
        removedEmbeddings: resetSummary.removedEmbeddings
      });
    }

    const existingPhotoIds = new Set(Object.values(this.engine.faces.state.embeddings || {})
      .map(embedding => embedding.photoId)
      .filter(Boolean));
    const skipAlreadyKnownPhotos = scanOptions.rescan === false;
    const allPhotos = Object.values(this.engine.database.getTable('photos') || {})
      .filter(photo => photo?.id && photo.filePath && (!skipAlreadyKnownPhotos || !existingPhotoIds.has(photo.id)));
    const photos = scanOptions.maxPhotos ? allPhotos.slice(0, scanOptions.maxPhotos) : allPhotos;
    this._logInfo(`People scan will analyze ${photos.length} photo${photos.length === 1 ? '' : 's'}.`, {
      indexedPhotos: Object.keys(this.engine.database.getTable('photos') || {}).length,
      alreadyKnownPhotos: existingPhotoIds.size,
      queuedPhotos: photos.length,
      scanLimit: scanOptions.maxPhotos || 'all'
    });
    this._emitPeopleScanProgress(onProgress, {
      stage: 'photo-queue',
      message: photos.length > 0
        ? `Ready to scan ${photos.length} photo${photos.length === 1 ? '' : 's'}.`
        : 'No indexed photos are available to scan.',
      total: photos.length,
      indexedPhotos: Object.keys(this.engine.database.getTable('photos') || {}).length,
      alreadyKnownPhotos: existingPhotoIds.size
    });

    const summary = {
      success: true,
      reason: 'completed',
      scanned: 0,
      grouped: 0,
      detectedFaces: 0,
      verifiedFaces: 0,
      lowQualityFaces: 0,
      falsePositiveFaces: 0,
      autoAssigned: 0,
      duplicateSuppressed: 0,
      duplicateClustersMerged: 0,
      knownClustersReconciled: 0,
      invalidClustersRemoved: 0,
      skipped: 0,
      reset: resetSummary,
      warnings: [],
      verification: this._faceScanVerification(scanOptions)
    };
    const acceptedFaceIndex = [];

    for (const photo of photos) {
      summary.scanned += 1;
      this._logPeopleScanProgress(summary.scanned, photos.length, onProgress, summary);
      try {
        const result = await vision.engine.infer({
          imagePath: photo.filePath,
          tasks: ['faces', 'faceEmbedding'],
          options: {
            source: 'gallery-people-scan',
            photoId: photo.id,
            faceDetection: {
              minFacePixels: scanOptions.minFacePixels
            }
          }
        });
        const verified = this._verifiedFaceEmbeddings(result, photo.id, scanOptions);
        summary.detectedFaces += verified.detectedFaces;
        summary.lowQualityFaces += verified.lowQualityFaces || 0;
        summary.falsePositiveFaces += verified.falsePositiveFaces || 0;
        summary.warnings.push(...verified.warnings);
        const uniqueItems = this._dedupeScanFaceItems(verified.items, acceptedFaceIndex, scanOptions);
        const scanDuplicates = verified.items.length - uniqueItems.length;
        if (scanDuplicates > 0) {
          summary.duplicateSuppressed += scanDuplicates;
          summary.warnings.push({ photoId: photo.id, code: 'scan-duplicate-face-suppressed', count: scanDuplicates });
        }
        summary.verifiedFaces += uniqueItems.length;
        if (uniqueItems.length === 0) {
          summary.skipped += 1;
          continue;
        }
        this._logDebug(`Verified ${uniqueItems.length} face${uniqueItems.length === 1 ? '' : 's'} in ${this._photoLabel(photo)}.`, {
          photoId: photo.id,
          detectedFaces: verified.detectedFaces,
          verifiedFaces: uniqueItems.length
        });
        for (const item of uniqueItems) {
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

    this._emitPeopleScanProgress(onProgress, {
      stage: 'cleaning-faces',
      message: 'Cleaning face results.',
      detail: 'OpenX is removing unclear faces and duplicate face suggestions.',
      scanned: summary.scanned,
      total: photos.length,
      detectedFaces: summary.detectedFaces,
      verifiedFaces: summary.verifiedFaces
    });
    const cleanup = this._cleanupUnknownFaceClusters(scanOptions);
    summary.cleanup = cleanup;
    summary.duplicateClustersMerged = cleanup.mergedClusters;
    summary.invalidClustersRemoved = cleanup.removedClusters;
    if (cleanup.mergedClusters > 0 || cleanup.removedClusters > 0) {
      this._logInfo('People scan cleanup removed unclear faces and merged duplicate unnamed people.', cleanup);
    }
    this._emitPeopleScanProgress(onProgress, {
      stage: 'matching-known-people',
      message: 'Matching faces with saved people.',
      detail: 'OpenX is checking whether unnamed groups already belong to named people.',
      scanned: summary.scanned,
      total: photos.length,
      duplicatePeopleMerged: summary.duplicateClustersMerged,
      unclearFacesRemoved: summary.lowQualityFaces + summary.falsePositiveFaces + summary.invalidClustersRemoved
    });
    const knownClusterReconciliation = this.engine.faces.reconcileUnknownClustersWithIdentities?.(scanOptions) || { assignedClusters: 0 };
    summary.knownClusterReconciliation = knownClusterReconciliation;
    summary.knownClustersReconciled = knownClusterReconciliation.assignedClusters || 0;
    if (summary.knownClustersReconciled > 0) {
      this._logInfo('People scan matched duplicate unnamed people to already named people.', {
        assignedClusters: knownClusterReconciliation.assignedClusters,
        assignedEmbeddings: knownClusterReconciliation.assignedEmbeddingCount,
        deferredClusters: knownClusterReconciliation.deferredClusters
      });
    }
    this._emitPeopleScanProgress(onProgress, {
      stage: 'saving-results',
      message: 'Saving People results.',
      detail: 'OpenX is updating the local Gallery People view.',
      scanned: summary.scanned,
      total: photos.length,
      matchedKnownPeople: summary.autoAssigned + summary.knownClustersReconciled,
      duplicateFacesSkipped: summary.duplicateSuppressed
    });
    await this.engine.persistFaceMemory();
    summary.people = this.engine.galleryExperience.getPeople();
    summary.durationMs = Date.now() - startedAt;
    const peopleSummary = summary.people?.summary || {};
    this._logInfo('People scan finished. Face detection, recognition, and duplicate cleanup are complete.', {
      scanned: summary.scanned,
      facesDetected: summary.detectedFaces,
      facesVerified: summary.verifiedFaces,
      newUnnamedPeople: summary.grouped,
      namedPeople: peopleSummary.namedPeople || 0,
      readyToName: peopleSummary.readyToName || 0,
      knownPeopleMatched: summary.autoAssigned,
      duplicatePeopleMatchedToKnown: summary.knownClustersReconciled,
      duplicateFacesSkipped: summary.duplicateSuppressed,
      duplicatePeopleMerged: summary.duplicateClustersMerged,
      unclearFacesRemoved: summary.lowQualityFaces + summary.falsePositiveFaces + summary.invalidClustersRemoved,
      skipped: summary.skipped,
      warnings: summary.warnings.length,
      durationMs: summary.durationMs,
      people: peopleSummary.totalPeople || summary.people?.items?.length || undefined
    });
    this._emitPeopleScanProgress(onProgress, {
      stage: 'complete',
      message: 'People scan complete.',
      detail: this._peopleScanSummaryText(summary, peopleSummary),
      success: true,
      scanned: summary.scanned,
      total: photos.length,
      detectedFaces: summary.detectedFaces,
      verifiedFaces: summary.verifiedFaces,
      newUnnamedPeople: summary.grouped,
      namedPeople: peopleSummary.namedPeople || 0,
      readyToName: peopleSummary.readyToName || 0,
      matchedKnownPeople: summary.autoAssigned + summary.knownClustersReconciled,
      duplicateFacesSkipped: summary.duplicateSuppressed,
      duplicatePeopleMerged: summary.duplicateClustersMerged,
      unclearFacesRemoved: summary.lowQualityFaces + summary.falsePositiveFaces + summary.invalidClustersRemoved,
      skipped: summary.skipped,
      warnings: summary.warnings.length,
      durationMs: summary.durationMs
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

  async identifyFace(input = {}, options = {}) {
    await this.engine.initialize();
    return this.engine.faces.identifyFace(input, options);
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

  async updateFaceIdentity(identityId, updates = {}, source = 'user-edit') {
    await this.engine.initialize();
    const result = this.engine.faces.updateIdentity(identityId, updates, source);
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

  _attachFaceMemoryEvidence(candidatePool, visualQuery = null) {
    const candidates = Array.isArray(candidatePool?.candidates) ? candidatePool.candidates : [];
    if (candidates.length === 0) return candidatePool;
    const state = this.engine.faces?.state || {};
    const profiles = state.profiles || {};
    const identities = state.identities || {};
    const faceSearchContext = this._buildFaceSearchContext(visualQuery || candidatePool.visualQuery, profiles, identities);
    candidatePool.faceSearchContext = faceSearchContext;
    const byPhoto = new Map();
    for (const embedding of Object.values(state.embeddings || {})) {
      if (!embedding?.photoId) continue;
      const identity = identities[embedding.identityId];
      const profile = profiles[identity?.profileId];
      const item = byPhoto.get(embedding.photoId) || {
        names: new Set(),
        relationships: new Set(),
        identityIds: new Set(),
        profileIds: new Set(),
        unknownClusterIds: new Set(),
        faceCount: 0,
        namedFaceCount: 0,
        unknownFaceCount: 0,
        bestQuality: 0,
        bestConfidence: 0
      };
      item.faceCount += 1;
      item.bestQuality = Math.max(item.bestQuality, Number(embedding.quality || 0));
      item.bestConfidence = Math.max(item.bestConfidence, Number(embedding.confidence || 0));
      if (identity && profile) {
        item.namedFaceCount += 1;
        if (profile.name) item.names.add(profile.name);
        if (identity?.name) item.names.add(identity.name);
        for (const relationship of this._relationshipSearchTerms(profile.relationship || identity?.relationship || '')) {
          item.relationships.add(relationship);
        }
        item.identityIds.add(identity.id);
        item.profileIds.add(profile.id);
      } else if (embedding.clusterId && state.unknownClusters?.[embedding.clusterId]?.status === 'unknown') {
        item.unknownFaceCount += 1;
        item.unknownClusterIds.add(embedding.clusterId);
      }
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
        unknownClusterIds: Array.from(evidence.unknownClusterIds),
        faceCount: evidence.faceCount,
        namedFaceCount: evidence.namedFaceCount,
        unknownFaceCount: evidence.unknownFaceCount,
        bestQuality: Number(evidence.bestQuality.toFixed(4)),
        bestConfidence: Number(evidence.bestConfidence.toFixed(4)),
        hasFaceEvidence: evidence.faceCount > 0
      };
      candidate.faceMemorySearch = this._scoreCandidateFaceEvidence(candidate.faceMemory, faceSearchContext);
      candidate.metadata = {
        ...(candidate.metadata || {}),
        peopleNames,
        faceRelationships: relationships,
        personCount: Math.max(Number(candidate.metadata?.personCount) || 0, evidence.faceCount),
        faceEvidence: evidence.faceCount > 0 ? 'verified-local-face-memory' : candidate.metadata?.faceEvidence
      };
    }
    return candidatePool;
  }

  _buildFaceSearchContext(visualQuery = null, profiles = {}, identities = {}) {
    const constraints = visualQuery?.constraints || {};
    const values = key => (Array.isArray(constraints[key]) ? constraints[key] : [])
      .filter(item => key !== 'owner' || item.metadata?.explicit !== false)
      .map(item => String(item.value || '').trim())
      .filter(Boolean);
    const rawPeople = values('people');
    const unknownPersonTerms = new Set(['unknown', 'unnamed', 'unidentified']);
    const people = rawPeople.filter(person => !unknownPersonTerms.has(person.toLowerCase()));
    const relationships = values('relationships');
    const owners = values('owner');
    const photoTypes = values('photoTypes');
    const media = values('media');
    const queryText = values('queryText').join(' ');
    const faceIntentText = [queryText, ...photoTypes, ...media].join(' ').toLowerCase();
    const wantsAnyFace = /\b(?:face|faces|person|people|portrait|selfie|group photo)\b/.test(faceIntentText);
    const wantsUnknownFace = rawPeople.some(person => unknownPersonTerms.has(person.toLowerCase())) ||
      /\b(?:unknown|unnamed|unidentified|new face|new person|not named|without name)\b/.test(faceIntentText);
    const identityEvidence = Object.values(identities || {}).map(identity => {
      const profile = profiles?.[identity.profileId] || {};
      const names = [identity.name, profile.name].filter(Boolean);
      const relationshipTerms = [
        ...this._relationshipSearchTerms(identity.relationship || ''),
        ...this._relationshipSearchTerms(profile.relationship || '')
      ];
      return {
        identityId: identity.id,
        profileId: profile.id || identity.profileId || null,
        names,
        relationships: Array.from(new Set(relationshipTerms))
      };
    });
    const resolvablePeople = people.filter(request => identityEvidence.some(identity => (
      identity.names.some(name => personValuesMatch(name, request))
    )));
    const resolvableOwners = owners.filter(request => identityEvidence.some(identity => (
      identity.names.some(name => personValuesMatch(name, request))
    )));
    const resolvableRelationships = relationships.filter(request => identityEvidence.some(identity => (
      identity.relationships.some(relationship => relationshipValuesMatch(relationship, request)) ||
      identity.names.some(name => relationshipValuesMatch(name, request))
    )));
    const resolvable = resolvablePeople.length + resolvableRelationships.length + resolvableOwners.length;
    return {
      active: people.length > 0 || relationships.length > 0 || resolvableOwners.length > 0 || wantsAnyFace || wantsUnknownFace,
      strict: resolvable > 0,
      people,
      relationships,
      owners,
      wantsAnyFace,
      wantsUnknownFace,
      resolvablePeople,
      resolvableRelationships,
      resolvableOwners,
      identityCount: identityEvidence.length,
      resolvable
    };
  }

  _scoreCandidateFaceEvidence(faceMemory = {}, faceSearchContext = {}) {
    if (!faceSearchContext?.active) {
      return { active: false, strict: false, coverage: 0, matched: 0, required: 0 };
    }
    const peopleNames = Array.isArray(faceMemory.peopleNames) ? faceMemory.peopleNames : [];
    const relationships = Array.isArray(faceMemory.relationships) ? faceMemory.relationships : [];
    const faceCount = Number(faceMemory.faceCount || 0);
    const namedFaceCount = Number(faceMemory.namedFaceCount || 0);
    const unknownFaceCount = Number(faceMemory.unknownFaceCount || 0);
    const requiredPeople = faceSearchContext.strict ? faceSearchContext.resolvablePeople : faceSearchContext.people;
    const requiredRelationships = faceSearchContext.strict ? faceSearchContext.resolvableRelationships : faceSearchContext.relationships;
    const requiredOwners = faceSearchContext.strict ? faceSearchContext.resolvableOwners : [];
    const matchedPeople = requiredPeople.filter(request => peopleNames.some(name => personValuesMatch(name, request)));
    const matchedRelationships = requiredRelationships.filter(request => relationships.some(relationship => relationshipValuesMatch(relationship, request)));
    const matchedOwners = requiredOwners.filter(request => peopleNames.some(name => personValuesMatch(name, request)));
    const required = requiredPeople.length + requiredRelationships.length + requiredOwners.length;
    const matched = matchedPeople.length + matchedRelationships.length + matchedOwners.length;
    const generalFaceMatched = faceSearchContext.wantsAnyFace === true && faceCount > 0;
    const unknownFaceMatched = faceSearchContext.wantsUnknownFace === true && unknownFaceCount > 0;
    const generalRequired = required === 0 && (faceSearchContext.wantsAnyFace || faceSearchContext.wantsUnknownFace) ? 1 : 0;
    const generalMatched = generalRequired > 0 && (generalFaceMatched || unknownFaceMatched) ? 1 : 0;
    return {
      active: true,
      strict: faceSearchContext.strict === true,
      required: required + generalRequired,
      matched: matched + generalMatched,
      coverage: (required + generalRequired) > 0 ? (matched + generalMatched) / (required + generalRequired) : 0,
      matchedPeople,
      matchedRelationships,
      matchedOwners,
      hasNamedFaceEvidence: peopleNames.length > 0 || relationships.length > 0 || namedFaceCount > 0,
      hasFaceEvidence: faceCount > 0,
      faceCount,
      namedFaceCount,
      unknownFaceCount,
      generalFaceMatched,
      unknownFaceMatched
    };
  }

  _relationshipSearchTerms(value = '') {
    const normalized = String(value || '').toLowerCase().trim();
    return normalized ? relationshipAliasesFor(normalized) : [];
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
      requireClearFaceCrop: true,
      suppressObjectLikeDetections: true,
      removeDuplicateFaces: true,
      requireFeatureVectorComparison: true,
      scanAllIndexedPhotos: !options.maxPhotos,
      faceConfidenceThreshold: options.faceConfidence,
      embeddingConfidenceThreshold: options.embeddingConfidence,
      faceQualityThreshold: options.faceQuality,
      minFacePixels: options.minFacePixels,
      minFaceSharpness: options.minFaceSharpness,
      duplicateClusterSimilarity: options.duplicateClusterSimilarity,
      duplicateClusterMargin: options.duplicateClusterMargin,
      source: 'ai-vision'
    };
  }

  _verifiedFaceEmbeddings(result = {}, photoId = '', options = {}) {
    const rawFaces = Array.isArray(result.faces) ? result.faces : [];
    const rawEmbeddings = Array.isArray(result.embeddings) ? result.embeddings : [];
    const warnings = Array.isArray(result.warnings) ? result.warnings.slice(0, 5) : [];
    const count = Math.min(rawFaces.length, rawEmbeddings.length);
    if (rawFaces.length > 0 && rawEmbeddings.length === 0) warnings.push({ photoId, code: 'face-embedding-missing' });
    if (rawFaces.length === 0 && rawEmbeddings.length > 0) warnings.push({ photoId, code: 'face-detection-missing' });
    if (rawFaces.length > rawEmbeddings.length) {
      warnings.push({ photoId, code: 'face-embedding-count-mismatch', count: rawFaces.length - rawEmbeddings.length });
    }
    if (rawEmbeddings.length > rawFaces.length) {
      warnings.push({ photoId, code: 'face-detection-count-mismatch', count: rawEmbeddings.length - rawFaces.length });
    }
    const paired = [];
    let lowConfidenceFaces = 0;
    let invalidEmbeddings = 0;
    let lowQualityFaces = 0;
    let falsePositiveFaces = 0;
    for (let index = 0; index < count; index += 1) {
      const face = rawFaces[index];
      const embedding = rawEmbeddings[index];
      const faceConfidence = Number(face?.confidence || 0);
      const embeddingConfidence = Number(embedding?.confidence || 0);
      if (faceConfidence < options.faceConfidence) {
        lowConfidenceFaces += 1;
        continue;
      }
      if (!Array.isArray(embedding?.vector) ||
        embedding.vector.length === 0 ||
        !embedding.vector.every(Number.isFinite) ||
        embeddingConfidence < options.embeddingConfidence) {
        invalidEmbeddings += 1;
        continue;
      }
      if (this._hasRuntimeQualitySignals(embedding) &&
        embedding.vector.length < (Number(options.minFaceVectorDimensions) || DEFAULT_FACE_SCAN_OPTIONS.minFaceVectorDimensions)) {
        invalidEmbeddings += 1;
        continue;
      }
      const imageWidth = Number(face.imageWidth || face.box?.imageWidth || 0) || null;
      const imageHeight = Number(face.imageHeight || face.box?.imageHeight || 0) || null;
      const confidence = Math.min(faceConfidence, embeddingConfidence);
      const quality = faceQualityScore({
        confidence,
        faceBox: face.box || null,
        imageWidth,
        imageHeight,
        vector: embedding.vector
      });
      const validation = this._validateClearFaceCandidate({
        face,
        embedding,
        faceBox: face.box || null,
        imageWidth,
        imageHeight,
        confidence,
        quality
      }, options);
      if (!validation.valid) {
        if (validation.reason === 'low-quality-face') lowQualityFaces += 1;
        else falsePositiveFaces += 1;
        continue;
      }
      paired.push({
        face,
        embedding,
        index,
        confidence,
        quality
      });
    }
    if (lowConfidenceFaces > 0) warnings.push({ photoId, code: 'low-confidence-face-suppressed', count: lowConfidenceFaces });
    if (invalidEmbeddings > 0) warnings.push({ photoId, code: 'invalid-face-embedding-suppressed', count: invalidEmbeddings });
    if (lowQualityFaces > 0) warnings.push({ photoId, code: 'low-quality-face-suppressed', count: lowQualityFaces });
    if (falsePositiveFaces > 0) warnings.push({ photoId, code: 'object-like-face-suppressed', count: falsePositiveFaces });
    const uniquePairs = this._dedupeFacePairs(paired);
    const suppressed = paired.length - uniquePairs.length;
    if (suppressed > 0) warnings.push({ photoId, code: 'duplicate-face-detection-suppressed', count: suppressed });
    const items = [];
    for (const pair of uniquePairs) {
      const { face, embedding, index, confidence, quality } = pair;
      items.push({
        vector: embedding.vector,
        photoId,
        faceId: face.id || `${photoId}:face:${index + 1}`,
        confidence,
        source: 'gallery-people-scan',
        faceBox: face.box || null,
        imageWidth: Number(face.imageWidth || face.box?.imageWidth || 0) || null,
        imageHeight: Number(face.imageHeight || face.box?.imageHeight || 0) || null,
        quality
      });
    }
    return { items, detectedFaces: rawFaces.length, warnings, lowQualityFaces, falsePositiveFaces };
  }

  _validateClearFaceCandidate(input = {}, options = {}) {
    const qualitySignals = this._faceQualitySignals(input.embedding);
    const box = normalizeFaceBox(input.faceBox, input.imageWidth, input.imageHeight);
    if (!box || box.width <= 0 || box.height <= 0) return { valid: false, reason: 'invalid-face-box' };
    const minPixels = Number(options.minFacePixels) || DEFAULT_FACE_SCAN_OPTIONS.minFacePixels;
    if (Math.min(box.width, box.height) < minPixels) return { valid: false, reason: 'unclear-face-too-small' };
    const aspect = box.width / Math.max(1, box.height);
    if (aspect < options.minFaceAspect || aspect > options.maxFaceAspect) {
      return { valid: false, reason: 'object-like-face-aspect' };
    }
    if (box.imageWidth > 0 && box.imageHeight > 0) {
      const imageArea = box.imageWidth * box.imageHeight;
      const faceAreaRatio = (box.width * box.height) / Math.max(1, imageArea);
      if (faceAreaRatio < options.minFaceAreaRatio) return { valid: false, reason: 'unclear-face-area' };
      if (faceAreaRatio > options.maxFaceAreaRatio) return { valid: false, reason: 'object-like-face-too-large' };
      if ((box.width / box.imageWidth) > 0.92 || (box.height / box.imageHeight) > 0.92) {
        return { valid: false, reason: 'object-like-face-frame' };
      }
    }
    if (qualitySignals) {
      const sharpness = Number(qualitySignals.sharpness ?? qualitySignals.meanGradient ?? 0);
      const contrast = Number(qualitySignals.contrast ?? 0);
      const textureEnergy = Number(qualitySignals.textureEnergy ?? 0);
      if (Number.isFinite(textureEnergy) && textureEnergy < options.minFaceTextureEnergy) {
        return { valid: false, reason: 'object-like-face-texture' };
      }
      if (Number.isFinite(sharpness) && sharpness < options.minFaceSharpness) {
        return { valid: false, reason: 'low-quality-face' };
      }
      if (Number.isFinite(contrast) && contrast < options.minFaceContrast) {
        return { valid: false, reason: 'low-quality-face' };
      }
    }
    if ((Number(input.quality) || 0) < (Number(options.faceQuality) || DEFAULT_FACE_SCAN_OPTIONS.faceQuality)) {
      return { valid: false, reason: 'low-quality-face' };
    }
    return { valid: true, reason: 'clear-face' };
  }

  _hasRuntimeQualitySignals(embedding = {}) {
    return Boolean(embedding?.metadata?.vectorType || embedding?.metadata?.qualitySignals || embedding?.qualitySignals);
  }

  _faceQualitySignals(embedding = {}) {
    const signals = embedding?.metadata?.qualitySignals || embedding?.qualitySignals || null;
    return signals && typeof signals === 'object' ? signals : null;
  }

  _dedupeFacePairs(pairs = []) {
    const selected = [];
    const sorted = pairs
      .slice()
      .sort((left, right) => (right.quality || 0) - (left.quality || 0) || (right.confidence || 0) - (left.confidence || 0));
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

  _dedupeScanFaceItems(items = [], acceptedFaceIndex = [], options = {}) {
    const selected = [];
    for (const item of items) {
      const duplicate = selected.some(existing => this._isDuplicateFaceItem(item, existing, options)) ||
        acceptedFaceIndex.some(existing => this._isDuplicateFaceItem(item, existing, options));
      if (duplicate) continue;
      selected.push(item);
      acceptedFaceIndex.push(item);
    }
    return selected;
  }

  _isDuplicateFaceItem(left = {}, right = {}, options = {}) {
    if (!left || !right) return false;
    const leftVector = Array.isArray(left.vector) ? left.vector : [];
    const rightVector = Array.isArray(right.vector) ? right.vector : [];
    const similarity = leftVector.length && rightVector.length ? cosineSimilarity(leftVector, rightVector) : 0;
    const leftBox = normalizeFaceBox(left.faceBox, left.imageWidth, left.imageHeight);
    const rightBox = normalizeFaceBox(right.faceBox, right.imageWidth, right.imageHeight);
    const duplicateThreshold = Number(this.engine.faces?.configuration?.thresholds?.duplicate ?? 0.998);
    const crossPhotoThreshold = Number(this.engine.faces?.configuration?.thresholds?.duplicateCrossPhoto ?? 0.9995);
    const samePhoto = left.photoId && right.photoId && left.photoId === right.photoId;
    if (samePhoto) {
      if (left.faceId && right.faceId && left.faceId === right.faceId) return true;
      if (leftBox && rightBox && this._isDuplicateFaceBox(leftBox, rightBox)) return true;
      return similarity >= duplicateThreshold;
    }
    if (similarity < crossPhotoThreshold || !leftBox || !rightBox) return false;
    return normalizedFaceBoxDistance(leftBox, rightBox) <= 0.018;
  }

  _cleanupUnknownFaceClusters(options = {}) {
    const state = this.engine.faces?.state || {};
    const clusters = state.unknownClusters || {};
    const embeddings = state.embeddings || {};
    let removedClusters = 0;
    let removedEmbeddings = 0;
    for (const [clusterId, cluster] of Object.entries(clusters)) {
      if (cluster.status !== 'unknown') continue;
      const validEmbeddingIds = (cluster.embeddingIds || []).filter(embeddingId => embeddings[embeddingId]);
      if (validEmbeddingIds.length === 0) {
        for (const embeddingId of cluster.embeddingIds || []) {
          if (embeddings[embeddingId]) {
            delete embeddings[embeddingId];
            removedEmbeddings += 1;
          }
        }
        delete clusters[clusterId];
        removedClusters += 1;
        continue;
      }
      cluster.embeddingIds = Array.from(new Set(validEmbeddingIds));
      cluster.photoIds = Array.from(new Set((cluster.photoIds || []).filter(Boolean)));
      cluster.faceIds = Array.from(new Set((cluster.faceIds || []).filter(Boolean)));
      cluster.faceBoxes = this._dedupeClusterFaceBoxes(cluster.faceBoxes || []);
      if (!cluster.representativeFaceBox && cluster.faceBoxes.length > 0) cluster.representativeFaceBox = cluster.faceBoxes[0];
    }

    const ordered = Object.values(clusters)
      .filter(cluster => cluster.status === 'unknown' && !cluster.ignoredAt && !cluster.neverAskAgain)
      .sort((left, right) => (right.photoIds?.length || 0) - (left.photoIds?.length || 0) ||
        (right.confidence || 0) - (left.confidence || 0));
    const kept = [];
    let mergedClusters = 0;
    for (const cluster of ordered) {
      if (!clusters[cluster.id]) continue;
      const duplicateTarget = this._findDuplicateUnknownClusterTarget(cluster, kept, options);
      if (duplicateTarget) {
        this._mergeUnknownFaceCluster(cluster.id, duplicateTarget.id);
        mergedClusters += 1;
      } else {
        kept.push(cluster);
      }
    }
    return { removedClusters, removedEmbeddings, mergedClusters };
  }

  _dedupeClusterFaceBoxes(faceBoxes = []) {
    const selected = [];
    for (const box of faceBoxes) {
      const normalized = normalizeFaceBox(box, box?.imageWidth, box?.imageHeight);
      if (!normalized) continue;
      const key = `${box.photoId || ''}:${box.faceId || ''}`;
      const duplicate = selected.some(existing => {
        const existingKey = `${existing.photoId || ''}:${existing.faceId || ''}`;
        const hasStableKey = Boolean(box.photoId || box.faceId) && Boolean(existing.photoId || existing.faceId);
        return (hasStableKey && key === existingKey) ||
          (box.photoId && existing.photoId && box.photoId === existing.photoId && this._isDuplicateFaceBox(box, existing));
      });
      if (!duplicate) selected.push({ ...box, ...normalized });
    }
    return selected;
  }

  _findDuplicateUnknownClusterTarget(cluster = {}, candidates = [], options = {}) {
    if (!cluster?.id || candidates.length === 0) return null;
    const sourceVector = this._clusterCentroidVector(cluster);
    if (!sourceVector.length) return null;
    const scored = candidates
      .filter(candidate => candidate?.id && candidate.id !== cluster.id)
      .map(candidate => ({
        cluster: candidate,
        similarity: cosineSimilarity(sourceVector, this._clusterCentroidVector(candidate))
      }))
      .filter(item => Number.isFinite(item.similarity))
      .sort((left, right) => right.similarity - left.similarity);
    const best = scored[0] || null;
    if (!best) return null;
    const second = scored[1] || null;
    const threshold = Number(options.duplicateClusterSimilarity) || DEFAULT_FACE_SCAN_OPTIONS.duplicateClusterSimilarity;
    const margin = best.similarity - (second?.similarity || 0);
    const requiredMargin = Number(options.duplicateClusterMargin) || DEFAULT_FACE_SCAN_OPTIONS.duplicateClusterMargin;
    return best.similarity >= threshold && margin >= requiredMargin ? best.cluster : null;
  }

  _clusterCentroidVector(cluster = {}) {
    const embeddings = cluster.embeddingIds
      ?.map(embeddingId => this.engine.faces?.state?.embeddings?.[embeddingId])
      .filter(embedding => embedding && Array.isArray(embedding.vector)) || [];
    return weightedMeanVector(embeddings.map(embedding => ({
      vector: embedding.vector,
      weight: Math.max(0.05, Number(embedding.quality ?? embedding.confidence ?? 0.75))
    })));
  }

  _mergeUnknownFaceCluster(sourceId, targetId) {
    const state = this.engine.faces?.state || {};
    const source = state.unknownClusters?.[sourceId];
    const target = state.unknownClusters?.[targetId];
    if (!source || !target || sourceId === targetId) return false;
    for (const embeddingId of source.embeddingIds || []) {
      const embedding = state.embeddings?.[embeddingId];
      if (!embedding) continue;
      embedding.clusterId = targetId;
      if (!target.embeddingIds.includes(embeddingId)) target.embeddingIds.push(embeddingId);
    }
    for (const photoId of source.photoIds || []) {
      if (photoId && !target.photoIds.includes(photoId)) target.photoIds.push(photoId);
    }
    for (const faceId of source.faceIds || []) {
      if (faceId && !target.faceIds.includes(faceId)) target.faceIds.push(faceId);
    }
    target.faceBoxes = this._dedupeClusterFaceBoxes([...(target.faceBoxes || []), ...(source.faceBoxes || [])]);
    const representative = [target.representativeFaceBox, source.representativeFaceBox, ...target.faceBoxes]
      .filter(Boolean)
      .sort((left, right) => (Number(right.confidence) || 0) - (Number(left.confidence) || 0))[0];
    target.representativeFaceBox = representative || target.representativeFaceBox || null;
    target.confidence = Math.max(Number(target.confidence) || 0, Number(source.confidence) || 0);
    target.quality = Math.max(Number(target.quality) || 0, Number(source.quality) || 0);
    target.duplicateCount = (Number(target.duplicateCount) || 0) + (Number(source.duplicateCount) || 0) + 1;
    target.latestSeenAt = [target.latestSeenAt, source.latestSeenAt]
      .filter(Boolean)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || target.latestSeenAt;
    delete state.unknownClusters[sourceId];
    return true;
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

  _logPeopleScanProgress(scanned, total, onProgress = null, summary = {}) {
    if (total <= 0) return;
    if (scanned !== 1 && scanned !== total && scanned % 25 !== 0) return;
    this._logInfo(`People scan progress: checked ${scanned} of ${total} photo${total === 1 ? '' : 's'}.`, {
      scanned,
      total,
      remaining: Math.max(0, total - scanned),
      detectedFaces: summary.detectedFaces || 0,
      verifiedFaces: summary.verifiedFaces || 0
    });
    this._emitPeopleScanProgress(onProgress, {
      stage: 'scanning-photos',
      message: `Scanning photos ${scanned} of ${total}.`,
      detail: `${summary.detectedFaces || 0} face${summary.detectedFaces === 1 ? '' : 's'} detected, ${summary.verifiedFaces || 0} clear face${summary.verifiedFaces === 1 ? '' : 's'} verified.`,
      scanned,
      total,
      detectedFaces: summary.detectedFaces || 0,
      verifiedFaces: summary.verifiedFaces || 0,
      duplicateFacesSkipped: summary.duplicateSuppressed || 0,
      skipped: summary.skipped || 0
    });
  }

  _emitPeopleScanProgress(onProgress, payload = {}) {
    if (typeof onProgress !== 'function') return;
    const scanned = Number(payload.scanned || 0);
    const total = Number(payload.total || 0);
    const percent = total > 0
      ? Math.max(0, Math.min(100, Math.round((scanned / total) * 100)))
      : Number.isFinite(Number(payload.percent)) ? Number(payload.percent) : null;
    try {
      onProgress({
        stage: String(payload.stage || 'scan'),
        message: String(payload.message || 'Scanning Gallery.'),
        detail: payload.detail ? String(payload.detail) : '',
        success: payload.success,
        reason: payload.reason || '',
        scanned,
        total,
        percent,
        indexedPhotos: Number(payload.indexedPhotos || 0),
        alreadyKnownPhotos: Number(payload.alreadyKnownPhotos || 0),
        detectedFaces: Number(payload.detectedFaces || 0),
        verifiedFaces: Number(payload.verifiedFaces || 0),
        newUnnamedPeople: Number(payload.newUnnamedPeople || 0),
        namedPeople: Number(payload.namedPeople || 0),
        readyToName: Number(payload.readyToName || 0),
        matchedKnownPeople: Number(payload.matchedKnownPeople || 0),
        duplicateFacesSkipped: Number(payload.duplicateFacesSkipped || 0),
        duplicatePeopleMerged: Number(payload.duplicatePeopleMerged || 0),
        unclearFacesRemoved: Number(payload.unclearFacesRemoved || 0),
        removedClusters: Number(payload.removedClusters || 0),
        removedEmbeddings: Number(payload.removedEmbeddings || 0),
        skipped: Number(payload.skipped || 0),
        warnings: Number(payload.warnings || 0),
        durationMs: Number(payload.durationMs || 0),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this._logDebug('People scan progress listener failed.', { error: error.message });
    }
  }

  _peopleScanSummaryText(summary = {}, peopleSummary = {}) {
    if (summary.scanned <= 0) return 'No indexed photos were available to scan.';
    const clearFaces = Number(summary.verifiedFaces || 0);
    const readyToName = Number(peopleSummary.readyToName || 0);
    const matchedKnown = Number(summary.autoAssigned || 0) + Number(summary.knownClustersReconciled || 0);
    const duplicateFaces = Number(summary.duplicateSuppressed || 0);
    const unclearFaces = Number(summary.lowQualityFaces || 0) + Number(summary.falsePositiveFaces || 0) + Number(summary.invalidClustersRemoved || 0);
    const parts = [
      `Checked ${summary.scanned} photo${summary.scanned === 1 ? '' : 's'}`,
      `verified ${clearFaces} clear face${clearFaces === 1 ? '' : 's'}`
    ];
    if (matchedKnown > 0) parts.push(`matched ${matchedKnown} to saved people`);
    if (readyToName > 0) parts.push(`${readyToName} unnamed ready to name`);
    if (duplicateFaces > 0) parts.push(`skipped ${duplicateFaces} duplicate face${duplicateFaces === 1 ? '' : 's'}`);
    if (unclearFaces > 0) parts.push(`removed ${unclearFaces} unclear or object-like face${unclearFaces === 1 ? '' : 's'}`);
    return `${parts.join(', ')}.`;
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
