const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Gallery Renderer UI', function() {
  const rendererRoot = path.join(__dirname, '..', '..', 'apps', 'desktop', 'renderer', 'gallery');
  const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rendererRoot, 'index.css'), 'utf8');
  const script = fs.readFileSync(path.join(rendererRoot, 'index.js'), 'utf8');

  it('should open assistant-selected photos and expose a floating favorite control', function() {
    assert.match(html, /id="viewer-favorite"/);
    assert.match(html, /aria-label="Add to favorites"/);
    assert.match(script, /const viewerFavoriteEl = document\.getElementById\('viewer-favorite'\)/);
    assert.match(script, /function openViewerFromPayload\(payload = \{\}\)/);
    assert.match(script, /window\.openx\?\.onGalleryOpenPhoto\?\./);
    assert.match(script, /window\.openx\?\.toggleGalleryFavorite\?\./);
    assert.match(script, /function setViewerFavorite\(favorite\)/);
    assert.match(script, /\\u2605/);
    assert.match(script, /\\u2606/);
    assert.match(css, /\.viewer-favorite\s*\{/);
    assert.match(css, /right:\s*72px/);
    assert.match(css, /\.viewer-favorite\.active\s*\{/);
  });

  it('should expose real Favorites, Recent, and People gallery views', function() {
    assert.match(html, /id="people-scan-button"/);
    assert.match(html, /data-view="favorites"/);
    assert.match(html, /data-view="recent"/);
    assert.match(html, /data-view="people"/);
    assert.match(script, /let activeView = 'timeline'/);
    assert.match(script, /function loadGalleryView\(view = activeView\)/);
    assert.match(script, /window\.openx\?\.getGalleryView\?\.\(activeView/);
    assert.match(script, /function renderPeople\(\)/);
    assert.match(script, /function loadPersonAvatar\(avatar, person = \{\}\)/);
    assert.match(script, /function scanPeople\(\)/);
    assert.match(script, /window\.openx\?\.scanGalleryPeople\?\./);
    assert.match(script, /window\.openx\?\.nameGalleryFace\?\./);
    assert.match(script, /No photos opened in the last 3 days\./);
    assert.match(script, /AI Vision runtime is not available for face scanning\./);
    assert.match(css, /\.people-grid\s*\{/);
    assert.match(css, /\.person-name-form\s*\{/);
    assert.match(css, /\.person-avatar img\s*\{/);
    assert.match(css, /\.people-scan-button\s*\{/);
  });
});
