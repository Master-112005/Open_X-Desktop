const closeWindowEl = document.getElementById('close-window');
const searchInputEl = document.getElementById('gallery-search-input');
const todayButtonEl = document.getElementById('today-button');
const timelineEl = document.getElementById('timeline');
const emptyStateEl = document.getElementById('empty-state');
const loadMoreEl = document.getElementById('load-more');
const photoCountEl = document.getElementById('photo-count');
const dateCountEl = document.getElementById('date-count');
const rangeLabelEl = document.getElementById('range-label');
const headingEl = document.getElementById('gallery-heading');
const photoScrollEl = document.getElementById('photo-scroll');
const viewerEl = document.getElementById('viewer');
const viewerImageEl = document.getElementById('viewer-image');
const viewerTitleEl = document.getElementById('viewer-title');
const viewerDateEl = document.getElementById('viewer-date');
const viewerCloseEl = document.getElementById('viewer-close');
const viewerFavoriteEl = document.getElementById('viewer-favorite');

const PAGE_SIZE = 80;
const MAX_IMAGE_LOADS = 6;
const SEARCH_DEBOUNCE_MS = 120;
let page = 1;
let hasMore = false;
let total = 0;
let photos = [];
let filteredPhotos = [];
let renderFrame = null;
let indexingPollTimer = null;
let imageObserver = null;
let imageLoadsInFlight = 0;
let scrollFrame = null;
let searchDebounceTimer = null;
let loadingPage = false;
let currentViewerPhotoId = '';
let currentViewerFavorite = false;
const imageLoadQueue = [];
const imageSrcCache = new Map();

function rememberImageSrc(photoId, src) {
  imageSrcCache.set(photoId, src);
  if (imageSrcCache.size > 800) {
    imageSrcCache.delete(imageSrcCache.keys().next().value);
  }
}

function formatAlpha(value) {
  return Math.min(0.96, value).toFixed(3);
}

function applyGlassTint(value, themeId = 'graphite') {
  const tint = Math.max(0, Math.min(100, Number(value) || 0));
  const strength = tint / 100;
  const tones = {
    graphite: [48, 50, 58],
    'white-glass': [255, 255, 255],
    'black-glass': [0, 0, 0]
  };
  const [red, green, blue] = tones[themeId] || tones.graphite;
  const useDarkText = themeId === 'white-glass' && tint >= 28;
  const textColor = useDarkText ? '#161619' : '#f8f8fa';
  const mutedColor = useDarkText ? 'rgba(22, 22, 25, 0.68)' : 'rgba(255, 255, 255, 0.72)';
  const controlTone = useDarkText ? '0, 0, 0' : '255, 255, 255';
  const borderTone = useDarkText ? '0, 0, 0' : '255, 255, 255';
  const shellAlpha = useDarkText ? 0.78 + (strength * 0.14) : 0.72 + (strength * 0.2);
  const surfaceAlpha = useDarkText ? 0.2 + (strength * 0.16) : 0.12 + (strength * 0.16);
  const surfaceStrongAlpha = useDarkText ? 0.28 + (strength * 0.18) : 0.18 + (strength * 0.2);
  const borderAlpha = 0.18 + (strength * 0.14);
  const controlAlpha = 0.12 + (strength * 0.1);
  const controlStrongAlpha = 0.18 + (strength * 0.12);
  const root = document.documentElement;
  root.style.setProperty('--adaptive-shell', `rgba(${red}, ${green}, ${blue}, ${formatAlpha(shellAlpha)})`);
  root.style.setProperty('--adaptive-surface', `rgba(${red}, ${green}, ${blue}, ${formatAlpha(surfaceAlpha)})`);
  root.style.setProperty('--adaptive-surface-strong', `rgba(${red}, ${green}, ${blue}, ${formatAlpha(surfaceStrongAlpha)})`);
  root.style.setProperty('--adaptive-border', `rgba(${borderTone}, ${formatAlpha(borderAlpha)})`);
  root.style.setProperty('--adaptive-text', textColor);
  root.style.setProperty('--adaptive-muted', mutedColor);
  root.style.setProperty('--adaptive-control', `rgba(${controlTone}, ${formatAlpha(controlAlpha)})`);
  root.style.setProperty('--adaptive-control-strong', `rgba(${controlTone}, ${formatAlpha(controlStrongAlpha)})`);
  root.style.setProperty('--adaptive-text-shadow', useDarkText ? '0 1px 2px rgba(255, 255, 255, 0.38)' : '0 1px 3px rgba(0, 0, 0, 0.72)');
  root.dataset.glassContrast = useDarkText ? 'dark-text' : 'light-text';
}

function applySettingsTheme(snapshot) {
  const themeId = snapshot?.settings?.chat?.themeId || 'graphite';
  const theme = (snapshot?.availableThemes || []).find(entry => entry.id === themeId)
    || snapshot?.availableThemes?.[0];
  if (!theme?.colors) return;
  const root = document.documentElement;
  root.style.setProperty('--panel-bg', theme.colors.panel);
  root.style.setProperty('--surface-bg', theme.colors.surface);
  root.style.setProperty('--border-color', theme.colors.border);
  root.style.setProperty('--accent', theme.colors.accent);
  root.dataset.glassTheme = theme.id;
  applyGlassTint(snapshot?.settings?.chat?.glassTint ?? 42, theme.id);
}

async function loadTheme() {
  const snapshot = await window.openx?.getSettings?.();
  applySettingsTheme(snapshot);
}

function photoTime(photo) {
  const value = new Date(photo.createdAt || photo.modifiedAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function dateKey(photo) {
  const date = new Date(photoTime(photo) || Date.now());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(key) {
  const [year, month, day] = String(key || '').split('-').map(Number);
  const date = Number.isFinite(year) ? new Date(year, month - 1, day) : new Date();
  const today = dateKey({ createdAt: new Date().toISOString() });
  if (key === today) return 'Today';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatShortDate(photo) {
  return new Date(photoTime(photo) || Date.now()).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function groupByDate(list) {
  const groups = new Map();
  for (const photo of list) {
    const key = dateKey(photo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(photo);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function searchText(photo) {
  return [
    photo.fileName,
    photo.filePath,
    photo.city,
    photo.fileType,
    formatDate(dateKey(photo))
  ].join(' ').toLowerCase();
}

function applySearch() {
  const query = String(searchInputEl.value || '').trim().toLowerCase();
  filteredPhotos = query
    ? photos.filter(photo => searchText(photo).includes(query))
    : photos.slice();
  scheduleRender();
}

function scheduleSearch() {
  if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    searchDebounceTimer = null;
    applySearch();
  }, SEARCH_DEBOUNCE_MS);
}

function updateSummary(groups) {
  const count = filteredPhotos.length;
  photoCountEl.textContent = `${count} photo${count === 1 ? '' : 's'}`;
  dateCountEl.textContent = `${groups.length} day${groups.length === 1 ? '' : 's'}`;
  rangeLabelEl.textContent = indexingPollTimer
    ? 'Indexing Pictures...'
    : total
    ? `${count} shown from ${total}`
    : 'No indexed photos';
  loadMoreEl.hidden = !hasMore || filteredPhotos.length !== photos.length;
}

function createPhotoCard(photo) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'photo-card';
  button.dataset.photoId = photo.id;
  button.dataset.label = photo.fileName || 'Photo';
  button.setAttribute('aria-label', `${photo.fileName || 'Photo'}, ${formatShortDate(photo)}`);

  const image = document.createElement('img');
  image.alt = photo.fileName || 'Photo';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.fetchPriority = 'low';
  button.appendChild(image);

  button.addEventListener('click', async () => {
    await openViewer(photo, image.src);
  });
  return button;
}

function render() {
  const groups = groupByDate(filteredPhotos);
  updateSummary(groups);
  emptyStateEl.hidden = groups.length > 0;
  headingEl.textContent = searchInputEl.value.trim() ? 'Search Results' : 'Photos';

  imageObserver?.disconnect?.();
  const fragment = document.createDocumentFragment();
  groups.forEach(([key, list]) => {
    const section = document.createElement('section');
    section.className = 'date-section';
    section.dataset.date = key;

    const heading = document.createElement('div');
    heading.className = 'date-heading';
    const title = document.createElement('h2');
    title.textContent = formatDate(key);
    const count = document.createElement('span');
    count.textContent = `${list.length} photo${list.length === 1 ? '' : 's'}`;
    heading.append(title, count);

    const grid = document.createElement('div');
    grid.className = 'photo-grid';
    grid.replaceChildren(...list.map(createPhotoCard));
    section.append(heading, grid);
    fragment.append(section);
  });

  timelineEl.replaceChildren(fragment);
  setupObserver();
}

function scheduleRender() {
  if (renderFrame) return;
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = null;
    render();
  });
}

async function loadImageForCard(card) {
  if (!card || card.classList.contains('loaded') || card.dataset.loading === 'true') return;
  card.dataset.loading = 'true';
  const image = card.querySelector('img');
  try {
    const cached = imageSrcCache.get(card.dataset.photoId);
    const result = cached
      ? { success: true, data: { src: cached } }
      : await window.openx?.getGalleryImageData?.(card.dataset.photoId);
    const src = result?.data?.src || '';
    if (result?.success && src) {
      rememberImageSrc(card.dataset.photoId, src);
      image.addEventListener('load', () => card.classList.add('loaded'), { once: true });
      image.src = src;
      if (image.complete) card.classList.add('loaded');
    }
  } finally {
    delete card.dataset.loading;
    delete card.dataset.queued;
  }
}

function pumpImageLoadQueue() {
  while (imageLoadsInFlight < MAX_IMAGE_LOADS && imageLoadQueue.length > 0) {
    const card = imageLoadQueue.shift();
    if (!card || card.classList.contains('loaded')) continue;
    imageLoadsInFlight += 1;
    loadImageForCard(card).catch(() => {}).finally(() => {
      imageLoadsInFlight -= 1;
      pumpImageLoadQueue();
    });
  }
}

function queueImageLoad(card) {
  if (!card || card.dataset.queued === 'true' || card.classList.contains('loaded')) return;
  card.dataset.queued = 'true';
  imageLoadQueue.push(card);
  pumpImageLoadQueue();
}

function setupObserver() {
  imageObserver?.disconnect?.();
  imageObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      imageObserver.unobserve(entry.target);
      queueImageLoad(entry.target);
    });
  }, {
    root: photoScrollEl,
    rootMargin: '240px 0px',
    threshold: 0.01
  });
  timelineEl.querySelectorAll('.photo-card').forEach(card => imageObserver.observe(card));
}

async function openViewer(photo, existingSrc) {
  let src = existingSrc;
  let imageResult = null;
  if (!src) {
    imageResult = await window.openx?.getGalleryImageData?.(photo.id);
    src = imageResult?.data?.src || '';
  }
  if (!src) return;
  viewerImageEl.src = src;
  viewerImageEl.alt = photo.fileName || 'Photo';
  viewerTitleEl.textContent = photo.fileName || 'Photo';
  viewerDateEl.textContent = formatShortDate(photo);
  currentViewerPhotoId = photo.id;
  setViewerFavorite(Boolean(imageResult?.data?.favorite));
  viewerEl.hidden = false;
  const viewer = await window.openx?.openGalleryPhoto?.(photo.id);
  if (typeof viewer?.data?.favorite === 'boolean') setViewerFavorite(viewer.data.favorite);
}

async function openViewerFromPayload(payload = {}) {
  const photoId = payload.photoId || payload.viewer?.photo?.id || payload.photo?.id;
  const photo = payload.viewer?.photo || payload.photo || photos.find(item => item.id === photoId) || { id: photoId, fileName: 'Photo' };
  if (!photo?.id) return;
  const result = await window.openx?.getGalleryImageData?.(photo.id);
  await openViewer({
    id: photo.id,
    fileName: photo.fileName || 'Photo',
    createdAt: photo.createdAt || photo.metadata?.createdAt || new Date().toISOString()
  }, result?.data?.src || '');
  if (typeof payload.viewer?.favorite === 'boolean') setViewerFavorite(payload.viewer.favorite);
}

function setViewerFavorite(favorite) {
  currentViewerFavorite = favorite === true;
  viewerFavoriteEl.textContent = currentViewerFavorite ? '\u2605' : '\u2606';
  viewerFavoriteEl.classList.toggle('active', currentViewerFavorite);
  viewerFavoriteEl.setAttribute('aria-pressed', String(currentViewerFavorite));
  viewerFavoriteEl.setAttribute('aria-label', currentViewerFavorite ? 'Remove from favorites' : 'Add to favorites');
}

function closeViewer() {
  viewerEl.hidden = true;
  viewerImageEl.removeAttribute('src');
  currentViewerPhotoId = '';
  setViewerFavorite(false);
}

async function toggleViewerFavorite() {
  if (!currentViewerPhotoId) return;
  viewerFavoriteEl.disabled = true;
  try {
    const result = await window.openx?.toggleGalleryFavorite?.(currentViewerPhotoId, !currentViewerFavorite);
    if (result?.success && typeof result.data?.favorite === 'boolean') {
      setViewerFavorite(result.data.favorite);
    }
  } finally {
    viewerFavoriteEl.disabled = false;
  }
}

async function loadPage(reset = false) {
  if (loadingPage) return;
  loadingPage = true;
  if (reset) {
    page = 1;
    photos = [];
    filteredPhotos = [];
    imageLoadQueue.length = 0;
  }
  loadMoreEl.disabled = true;
  try {
    const result = await window.openx?.getGalleryPhotos?.({ page, pageSize: PAGE_SIZE });
    const data = result?.data || {};
    const nextItems = Array.isArray(data.items) ? data.items : [];
    photos = reset ? nextItems : [...photos, ...nextItems];
    total = Number(data.total) || photos.length;
    hasMore = data.hasMore === true;
    page = (Number(data.page) || page) + 1;
    setIndexingPoll(data.indexing === true);
    applySearch();
  } finally {
    loadMoreEl.disabled = false;
    loadingPage = false;
  }
}

function setIndexingPoll(indexing) {
  if (!indexing) {
    if (indexingPollTimer) {
      window.clearInterval(indexingPollTimer);
      indexingPollTimer = null;
    }
    return;
  }
  if (indexingPollTimer) return;
  indexingPollTimer = window.setInterval(() => {
    loadPage(true).catch(() => {});
  }, 2500);
}

function scrollToToday() {
  const today = dateKey({ createdAt: new Date().toISOString() });
  const target = timelineEl.querySelector(`[data-date="${today}"]`);
  if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  else photoScrollEl.scrollTo({ top: 0, behavior: 'smooth' });
}

function maybeLoadMoreOnScroll() {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = null;
    if (!hasMore || loadingPage || searchInputEl.value.trim()) return;
    const remaining = photoScrollEl.scrollHeight - photoScrollEl.scrollTop - photoScrollEl.clientHeight;
    if (remaining < 700) loadPage(false).catch(() => {});
  });
}

closeWindowEl.addEventListener('click', () => window.openx?.closeGallery?.());
window.addEventListener('beforeunload', () => {
  if (indexingPollTimer) window.clearInterval(indexingPollTimer);
  if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer);
  imageObserver?.disconnect?.();
  imageLoadQueue.length = 0;
});
viewerCloseEl.addEventListener('click', closeViewer);
viewerFavoriteEl.addEventListener('click', toggleViewerFavorite);
viewerEl.addEventListener('click', event => {
  if (event.target === viewerEl) closeViewer();
});
todayButtonEl.addEventListener('click', scrollToToday);
loadMoreEl.addEventListener('click', () => loadPage(false));
photoScrollEl.addEventListener('scroll', maybeLoadMoreOnScroll, { passive: true });
searchInputEl.addEventListener('input', scheduleSearch);
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
  });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !viewerEl.hidden) closeViewer();
});

window.openx?.onGalleryView?.(() => {});
window.openx?.onGalleryOpenPhoto?.(payload => {
  openViewerFromPayload(payload).catch(() => {});
});
loadTheme();
window.openx?.onSettingsChanged?.(snapshot => applySettingsTheme(snapshot));
loadPage(true);
