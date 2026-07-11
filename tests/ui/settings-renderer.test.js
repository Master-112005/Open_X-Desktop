const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Settings Updates Renderer UI', function() {
  const rendererRoot = path.join(__dirname, '..', '..', 'apps', 'desktop', 'renderer', 'settings');
  const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rendererRoot, 'index.css'), 'utf8');
  const script = fs.readFileSync(path.join(rendererRoot, 'index.js'), 'utf8');

  it('should provide the update status, action, preference, and release-note surfaces', function() {
    [
      'status-summary',
      'state-pill',
      'progress-bar',
      'current-version',
      'latest-version',
      'update-actions',
      'release-summary',
      'release-sections'
    ].forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /href="#update-actions"/);
  });

  it('should consume the shared update presentation API instead of legacy one-off status calls', function() {
    assert.match(script, /getUpdatePresentation\(\{ source: 'settings'/);
    assert.match(script, /executeUpdateAction\(actionId/);
    assert.match(script, /selfUpdate\(\{ source: 'settings' \}\)/);
    assert.match(script, /model\(\)\.actions/);
    assert.match(script, /model\(\)\.releaseNotes/);
  });

  it('should expose persisted update presentation preferences', function() {
    [
      'pref-check-startup',
      'pref-auto-download',
      'pref-auto-install',
      'pref-install-enabled',
      'pref-install-confirm',
      'pref-self-update-enabled',
      'pref-self-update-restart',
      'pref-self-update-preserve',
      'pref-self-update-future-auto',
      'pref-recovery-enabled',
      'pref-recovery-startup-validation',
      'pref-recovery-logging',
      'pref-recovery-diagnostics',
      'pref-recovery-startup-timeout',
      'pref-recovery-health-timeout',
      'pref-notify',
      'pref-island',
      'pref-assistant',
      'pref-voice',
      'pref-high-contrast',
      'pref-reduced-motion',
      'pref-update-logging',
      'pref-diagnostics'
    ].forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
    assert.match(script, /presentation:\s*\{/);
    assert.match(script, /installation:\s*\{/);
    assert.match(script, /selfUpdate:\s*\{/);
    assert.match(script, /recovery:\s*\{/);
    assert.match(script, /startupValidationEnabled/);
    assert.match(script, /healthTimeoutMs/);
    assert.match(script, /requireConfirmation:\s*true/);
    assert.match(script, /windowState:\s*\{ width, height, maximized: false \}/);
  });

  it('should include accessibility and reduced-motion styling', function() {
    assert.match(css, /\.skip-link/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /body\.high-contrast/);
    assert.match(css, /font-size:\s*clamp/);
  });
});
