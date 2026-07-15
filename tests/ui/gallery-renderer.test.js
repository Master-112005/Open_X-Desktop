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
});
