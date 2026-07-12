const assert = require('assert');

describe('Communications Controller', function() {
  let CommunicationsController;

  before(function() {
    CommunicationsController = require('../../core/automation/communications');
  });

  function createController() {
    return new CommunicationsController({});
  }

  it('should reject unsupported chat-provider message composition', async function() {
    const controller = createController();

    const result = await controller.composeMessage('daddy', 'call me', 'signal');

    assert.equal(result.success, false);
    assert.equal(result.error, 'Messaging platform not supported: signal');
  });

  it('should reject generic message composition when no messaging provider exists', async function() {
    const controller = createController();

    const result = await controller.composeMessage('daddy', 'call me');

    assert.equal(result.success, false);
    assert.equal(result.error, 'Messaging is not supported by this assistant');
  });

  it('should reject unsupported chat-provider calls', async function() {
    const controller = createController();

    const result = await controller.startCall('daddy', 'signal');

    assert.equal(result.success, false);
    assert.equal(result.error, 'Calling platform not supported: signal');
  });

  it('should start a standard call when a phone number is supplied directly', async function() {
    const controller = createController();
    let launchedUri = null;
    controller._launchUri = uri => { launchedUri = uri; };

    const result = await controller.startCall('+91 12345 67890', 'phone');

    assert.equal(result.success, true);
    assert.equal(result.data.phone, '+911234567890');
    assert.equal(launchedUri, 'tel:+911234567890');
  });

  it('should require a direct phone number for standard calls', async function() {
    const controller = createController();
    const result = await controller.startCall('daddy', 'phone');
    assert.equal(result.success, false);
    assert.match(result.error, /phone number directly/i);
  });

  it('should request missing email draft details for a supplied address', async function() {
    const controller = createController();
    const result = await controller.composeEmail('rakesh@example.com', '', '');
    assert.equal(result.success, true);
    assert.equal(result.data.needsDetails, true);
    assert.equal(result.data.email, 'rakesh@example.com');
  });

  it('should prepare a mailto draft from a supplied email address', async function() {
    const controller = createController();
    let launchedUri = null;
    controller._launchUri = uri => { launchedUri = uri; };

    const result = await controller.composeEmail('rakesh@example.com', 'Project update', 'The build passed.');

    assert.equal(result.success, true);
    assert.equal(result.data.delivery, 'draft');
    assert.equal(launchedUri, 'mailto:rakesh%40example.com?subject=Project+update&body=The+build+passed.');
  });

  it('should reject an email recipient name without storing or resolving it', async function() {
    const controller = createController();
    const result = await controller.composeEmail('rakesh', 'Hello', 'Test');
    assert.equal(result.success, false);
    assert.match(result.error, /email address directly/i);
  });
});
