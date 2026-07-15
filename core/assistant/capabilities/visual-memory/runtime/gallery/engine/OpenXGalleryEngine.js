'use strict';

const GalleryExperienceConfiguration = require('../configuration/GalleryExperienceConfiguration');
const GalleryExperienceDiagnostics = require('../diagnostics/GalleryExperienceDiagnostics');
const { GalleryExperienceEventBus, GALLERY_EXPERIENCE_EVENTS } = require('../events/GalleryExperienceEvents');
const GalleryExperienceLifecycle = require('../lifecycle/GalleryExperienceLifecycle');
const GalleryExperienceValidator = require('../validation/GalleryExperienceValidator');
const GalleryNavigationManager = require('../navigation/GalleryNavigationManager');
const GalleryTimelineExperience = require('../timeline/GalleryTimelineExperience');
const GalleryCollectionExperience = require('../collections/GalleryCollectionExperience');
const GalleryPeopleExperience = require('../people/GalleryPeopleExperience');
const GalleryPlacesExperience = require('../places/GalleryPlacesExperience');
const GalleryObjectsExperience = require('../objects/GalleryObjectsExperience');
const EventGalleryExperience = require('../events/EventGalleryExperience');
const GalleryAlbumManager = require('../albums/GalleryAlbumManager');
const FavoriteManager = require('../favorites/FavoriteManager');
const RecentManager = require('../recent/RecentManager');
const SelectionManager = require('../selection/SelectionManager');
const GalleryFilterManager = require('../filters/GalleryFilterManager');
const GallerySearchExperience = require('../search/GallerySearchExperience');
const GalleryViewer = require('../viewer/GalleryViewer');
const GallerySimilarityExperience = require('../similarity/GallerySimilarityExperience');
const GalleryInteractionManager = require('../interactions/GalleryInteractionManager');
const GalleryAccessibilityManager = require('../accessibility/GalleryAccessibilityManager');
const { nowIso } = require('../utils/gallery-utils');

function createExperienceState() {
  return {
    activeView: 'timeline',
    selection: { mode: 'multiple', ids: [], updatedAt: null },
    favorites: {
      images: {},
      memories: {},
      people: {},
      collections: {},
      albums: {},
      locations: {}
    },
    recent: {
      images: [],
      memories: [],
      searches: [],
      people: [],
      collections: [],
      locations: []
    },
    collections: {},
    filters: {},
    openedAt: null,
    updatedAt: null
  };
}

class OpenXGalleryEngine {
  constructor(options = {}) {
    this.visualMemoryEngine = options.visualMemoryEngine || null;
    this.configuration = options.configuration instanceof GalleryExperienceConfiguration
      ? options.configuration
      : new GalleryExperienceConfiguration(options.configuration || options);
    this.events = options.events || new GalleryExperienceEventBus();
    this.diagnostics = options.diagnostics || new GalleryExperienceDiagnostics({
      logger: options.logger || null,
      maxEvents: this.configuration.performance.maxDiagnostics
    });
    this.lifecycle = new GalleryExperienceLifecycle({ events: this.events, diagnostics: this.diagnostics });
    this.validator = options.validator || new GalleryExperienceValidator();
    this.initialized = false;
    this.persist = options.persist || null;
    this.stateProvider = options.stateProvider || (() => createExperienceState());

    this.navigation = new GalleryNavigationManager({ configuration: this.configuration, diagnostics: this.diagnostics });
    this.timeline = new GalleryTimelineExperience({ configuration: this.configuration });
    this.collections = new GalleryCollectionExperience();
    this.people = new GalleryPeopleExperience();
    this.places = new GalleryPlacesExperience();
    this.objects = new GalleryObjectsExperience();
    this.eventsView = new EventGalleryExperience();
    this.albums = new GalleryAlbumManager();
    this.filters = new GalleryFilterManager({ validator: this.validator });
    this.interactions = new GalleryInteractionManager();
    this.accessibility = new GalleryAccessibilityManager({ configuration: this.configuration });
    this.recent = new RecentManager({ getState: () => this.getExperienceState(), saveState: state => this.saveExperienceState(state), configuration: this.configuration, events: this.events });
    this.favorites = new FavoriteManager({ getState: () => this.getExperienceState(), saveState: state => this.saveExperienceState(state), events: this.events });
    this.selection = new SelectionManager({ getState: () => this.getExperienceState(), saveState: state => this.saveExperienceState(state), validator: this.validator, events: this.events });
    this.search = new GallerySearchExperience({ recent: this.recent, validator: this.validator, diagnostics: this.diagnostics });
    this.viewer = new GalleryViewer({ recent: this.recent, configuration: this.configuration, diagnostics: this.diagnostics });
    this.similarity = new GallerySimilarityExperience();
  }

  async initialize() {
    if (this.initialized) return this;
    this.initialized = true;
    this.lifecycle.transition('ready');
    this.events.emit(GALLERY_EXPERIENCE_EVENTS.INITIALIZED, this.getStatus());
    return this;
  }

  async open(view = this.configuration.layout.defaultView, options = {}) {
    await this.initialize();
    const result = await this.openView(view, options);
    this.lifecycle.transition('open', { view: result.view });
    this.events.emit(GALLERY_EXPERIENCE_EVENTS.OPENED, { view: result.view });
    return result;
  }

  async close(reason = 'manual') {
    const state = this.getExperienceState();
    state.openedAt = null;
    await this.saveExperienceState(state);
    this.lifecycle.transition('ready', { reason });
    this.events.emit(GALLERY_EXPERIENCE_EVENTS.CLOSED, { reason });
    return this.getStatus();
  }

  async shutdown() {
    this.lifecycle.transition('shutdown');
    this.initialized = false;
    this.events.emit(GALLERY_EXPERIENCE_EVENTS.SHUTDOWN, this.getStatus());
    return this.getStatus();
  }

  async openView(view, options = {}) {
    const validation = this.validator.validateView(view);
    if (!validation.valid) throw new Error(validation.reason);
    const snapshot = this.snapshot();
    const state = this.getExperienceState();
    state.activeView = validation.view;
    state.openedAt = state.openedAt || nowIso();
    await this.saveExperienceState(state);
    const navigationEvent = this.navigation.open(validation.view, options);
    this.events.emit(GALLERY_EXPERIENCE_EVENTS.VIEW_CHANGED, navigationEvent);

    if (validation.view === 'timeline') return this.getTimeline(options);
    if (validation.view === 'people') return this.getPeople();
    if (validation.view === 'places') return this.getPlaces();
    if (validation.view === 'events') return this.getEvents(options.memorySearchResult || {});
    if (validation.view === 'objects') return this.getObjects(options.visionResults || {});
    if (validation.view === 'collections') return this.getCollections();
    if (validation.view === 'albums') return this.getAlbums();
    if (validation.view === 'favorites') return this.getFavorites(options.type || 'images');
    if (validation.view === 'recent') return this.getRecent(options.type || 'images');
    if (validation.view === 'screenshots') return this._typedPhotoView('screenshots', snapshot, 'screenshot', options);
    if (validation.view === 'documents') return this._typedPhotoView('documents', snapshot, 'document', options);
    if (validation.view === 'receipts') return this._typedPhotoView('receipts', snapshot, 'receipt', options);
    return { view: validation.view, items: [] };
  }

  getNavigation() {
    return this.navigation.getNavigation(this.snapshot());
  }

  getTimeline(options = {}) {
    return this.timeline.build(this.snapshot(), options);
  }

  getPeople() {
    return this.people.build(this.snapshot().faceMemory || {});
  }

  getPlaces() {
    return this.places.build(this.snapshot());
  }

  getEvents(memorySearchResult = {}) {
    return this.eventsView.build(memorySearchResult, this.snapshot());
  }

  getObjects(visionResults = {}) {
    return this.objects.build(visionResults);
  }

  getCollections() {
    return this.collections.build(this.snapshot(), this.visualMemoryEngine?.intelligence?.healthCheck?.() || null);
  }

  getAlbums() {
    return this.albums.build(this.snapshot());
  }

  getFavorites(type = 'images') {
    return { view: 'favorites', type, items: this.favorites.list(type) };
  }

  getRecent(type = 'images') {
    return { view: 'recent', type, items: this.recent.list(type) };
  }

  async openSearchResults(memorySearchResult = {}, options = {}) {
    await this.initialize();
    const result = await this.search.openResults(memorySearchResult, options);
    this.events.emit(GALLERY_EXPERIENCE_EVENTS.SEARCH_RESULTS_OPENED, { total: result.total, queryId: result.queryId });
    return result;
  }

  async openViewer(photoId, options = {}) {
    await this.initialize();
    const result = await this.viewer.open(photoId, this.snapshot(), options);
    this.events.emit(GALLERY_EXPERIENCE_EVENTS.VIEWER_OPENED, { photoId });
    return result;
  }

  async setSelection(ids, mode = 'multiple') {
    return this.selection.setSelection(ids, mode);
  }

  getSelection() {
    return this.selection.getSelection();
  }

  async toggleFavorite(type, id, value = null) {
    return this.favorites.toggle(type, id, value);
  }

  async addRecent(type, item) {
    return this.recent.add(type, item);
  }

  presentSimilar(memorySearchResult = {}) {
    return this.similarity.present(memorySearchResult);
  }

  getQuickActions() {
    return this.interactions.quickActions();
  }

  getAccessibility() {
    return this.accessibility.getCapabilities();
  }

  getExperienceState() {
    const raw = this.stateProvider() || {};
    return {
      ...createExperienceState(),
      ...raw,
      selection: { ...createExperienceState().selection, ...(raw.selection || {}) },
      favorites: { ...createExperienceState().favorites, ...(raw.favorites || {}) },
      recent: { ...createExperienceState().recent, ...(raw.recent || {}) }
    };
  }

  async saveExperienceState(state) {
    const next = { ...state, updatedAt: nowIso() };
    if (this.persist) await this.persist(next);
    return next;
  }

  healthCheck() {
    return {
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      activeView: this.getExperienceState().activeView,
      diagnostics: this.diagnostics.summary(),
      noAiExecution: true
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      activeView: this.getExperienceState().activeView,
      configuration: this.configuration.toJSON(),
      localOnly: true
    };
  }

  snapshot() {
    return this.visualMemoryEngine?.database?.snapshot?.() || {};
  }

  _typedPhotoView(view, snapshot, type, options = {}) {
    const metadata = snapshot.metadata || {};
    const photos = Object.values(snapshot.photos || {})
      .filter(photo => metadata[photo.id]?.photoType === type || new RegExp(type, 'i').test(`${photo.fileName || ''} ${photo.filePath || ''}`))
      .map(photo => ({ ...photo, metadata: metadata[photo.id] || null }));
    const filtered = this.filters.apply(photos, options.filter || {});
    return { view, type, items: filtered, total: filtered.length, virtualized: true };
  }
}

OpenXGalleryEngine.createExperienceState = createExperienceState;

module.exports = OpenXGalleryEngine;
