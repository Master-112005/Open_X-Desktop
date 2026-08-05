const assert = require('assert');

describe('Home Automation foundation', function() {
  let homeAutomation;

  before(function() {
    homeAutomation = require('../../core/home-automation');
  });

  it('parses natural home device commands into structured commands', function() {
    const parser = new homeAutomation.HomeCommandParser();
    const command = parser.parse('Turn on bedroom light');

    assert.ok(command);
    assert.equal(command.intent, 'home.device_control');
    assert.equal(command.target, 'bedroom_light');
    assert.equal(command.action, homeAutomation.HOME_ACTIONS.TURN_ON);
    assert.equal(command.displayTarget, 'Bedroom Light');
  });

  it('does not claim normal desktop app commands', function() {
    const router = new homeAutomation.HomeAutomationRouter();

    assert.equal(router.resolve('open chrome'), null);
    assert.equal(router.resolve('turn on youtube'), null);
  });

  it('builds immutable valid device-command packets', function() {
    const parser = new homeAutomation.HomeCommandParser();
    const builder = new homeAutomation.HomePacketBuilder({ defaultTtlMs: 15000 });
    const validator = new homeAutomation.HomePacketValidator();
    const command = parser.parse('turn off kitchen fan');
    const packet = builder.buildDeviceCommand(command);

    assert.equal(packet.type, homeAutomation.HOME_PACKET_TYPES.DEVICE_COMMAND);
    assert.equal(packet.target, 'kitchen_fan');
    assert.equal(packet.action, homeAutomation.HOME_ACTIONS.TURN_OFF);
    assert.ok(packet.requestId.startsWith('home_'));
    assert.ok(Object.isFrozen(packet));
    assert.equal(validator.validate(packet).valid, true);
  });

  it('rejects malformed packets before transport exists', function() {
    const validator = new homeAutomation.HomePacketValidator();
    const result = validator.validate({
      type: 'home:device-command',
      requestId: 'home_test',
      target: 'bedroom_light',
      action: 'explode',
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000).toISOString()
    });

    assert.equal(result.valid, false);
    assert.equal(result.errors[0].code, 'home.packet.invalidAction');
  });

  it('creates pending requests without executing real devices', function() {
    const manager = new homeAutomation.HomeAutomationManager();
    const result = manager.handleAssistantRequest({
      rawCommand: 'switch on living room light',
      source: 'test'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.target, 'living_room_light');
    assert.equal(result.data.homeAction, homeAutomation.HOME_ACTIONS.TURN_ON);
    assert.equal(result.data.placeholder, true);
    assert.equal(manager.listPendingRequests().length, 1);
  });

  it('lists paired home devices for assistant inventory questions', function() {
    const manager = new homeAutomation.HomeAutomationManager({
      getPairedDevices: () => [
        {
          deviceId: 'home_device_1',
          deviceName: 'Bed Light',
          pairingStatus: 'paired',
          connectionStatus: 'online'
        },
        {
          deviceId: 'home_device_2',
          deviceName: 'Desk Light',
          pairingStatus: 'paired',
          connectionStatus: 'offline'
        }
      ]
    });

    const result = manager.listDevices();

    assert.equal(result.success, true);
    assert.equal(result.data.action, 'home.devices.list');
    assert.equal(result.data.count, 2);
    assert.equal(result.data.pairedCount, 2);
    assert.equal(result.data.onlineCount, 1);
    assert.equal(result.data.devices[0].deviceName, 'Bed Light');
    assert.equal(result.data.verification.status, 'passed');
  });

  it('returns live relay result details for assistant responses', async function() {
    const manager = new homeAutomation.HomeAutomationManager({
      getPairedDevices: () => [{
        deviceId: 'home_device_1',
        deviceName: 'Bed Light',
        pairingStatus: 'paired',
        connectionStatus: 'online'
      }],
      commandClient: {
        sendCommand: async () => ({
          success: true,
          message: 'relay already off',
          result: {
            message: 'relay already off',
            relayState: 'off',
            changed: false
          }
        })
      },
      ownerId: 'owner_1'
    });

    const result = await manager.handleAssistantRequest({
      rawCommand: 'turn off bed light',
      source: 'test'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.displayTarget, 'Bed Light');
    assert.equal(result.data.homeMessage, 'relay already off');
    assert.equal(result.data.relayState, 'off');
    assert.equal(result.data.relayChanged, false);
  });
});
