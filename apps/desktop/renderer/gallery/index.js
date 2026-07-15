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

const PAGE_SIZE = 80;
let page = 1;
let hasMore = false;
let total = 0;
let photos = [];
let filteredPhotos = [];
let renderFrame = null;
let indexingPollTimer = null;
let imageObserver = null;

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
  button.appendChild(image);

  button.addEventListener('click', async () => {
    await openViewer(photo, image.src);
  });
  imageObserver?.observe(button);
  return button;
}

function render() {
  const groups = groupByDate(filteredPhotos);
  updateSummary(groups);
  emptyStateEl.hidden = groups.length > 0;
  headingEl.textContent = searchInputEl.value.trim() ? 'Search Results' : 'Photos';

  const sections = groups.map(([key, list]) => {
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
    return section;
  });

  timelineEl.replaceChildren(...sections);
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
    const result = await window.openx?.getGalleryImageData?.(card.dataset.photoId);
    if (result?.success && result.data?.src) {
      image.src = result.data.src;
      image.addEventListener('load', () => card.classList.add('loaded'), { once: true });
    }
  } finally {
    delete card.dataset.loading;
  }
}

function setupObserver() {
  imageObserver?.disconnect?.();
  imageObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      imageObserver.unobserve(entry.target);
      loadImageForCard(entry.target);
    });
  }, {
    root: photoScrollEl,
    rootMargin: '360px 0px',
    threshold: 0.01
  });
}

async function openViewer(photo, existingSrc) {
  let src = existingSrc;
  if (!src) {
    const result = await window.openx?.getGalleryImageData?.(photo.id);
    src = result?.data?.src || '';
  }
  if (!src) return;
  viewerImageEl.src = src;
  viewerImageEl.alt = photo.fileName || 'Photo';
  viewerTitleEl.textContent = photo.fileName || 'Photo';
  viewerDateEl.textContent = formatShortDate(photo);
  viewerEl.hidden = false;
  await window.openx?.openGalleryPhoto?.(photo.id);
}

function closeViewer() {
  viewerEl.hidden = true;
  viewerImageEl.removeAttribute('src');
}

async function loadPage(reset = false) {
  if (reset) {
    page = 1;
    photos = [];
    filteredPhotos = [];
  }
  loadMoreEl.disabled = true;
  const result = await window.openx?.getGalleryPhotos?.({ page, pageSize: PAGE_SIZE });
  const data = result?.data || {};
  const nextItems = Array.isArray(data.items) ? data.items : [];
  photos = reset ? nextItems : [...photos, ...nextItems];
  photos.sort((left, right) => photoTime(right) - photoTime(left));
  total = Number(data.total) || photos.length;
  hasMore = data.hasMore === true;
  page = (Number(data.page) || page) + 1;
  setIndexingPoll(data.indexing === true);
  applySearch();
  loadMoreEl.disabled = false;
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

closeWindowEl.addEventListener('click', () => window.openx?.closeGallery?.());
window.addEventListener('beforeunload', () => {
  if (indexingPollTimer) window.clearInterval(indexingPollTimer);
  imageObserver?.disconnect?.();
});
viewerCloseEl.addEventListener('click', closeViewer);
viewerEl.addEventListener('click', event => {
  if (event.target === viewerEl) closeViewer();
});
todayButtonEl.addEventListener('click', scrollToToday);
loadMoreEl.addEventListener('click', () => loadPage(false));
searchInputEl.addEventListener('input', applySearch);
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
  });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !viewerEl.hidden) closeViewer();
});

window.openx?.onGalleryView?.(() => {});
loadTheme();
window.openx?.onSettingsChanged?.(snapshot => applySettingsTheme(snapshot));
setupObserver();
loadPage(true);
