const HomeCommandParser = require('../parser/HomeCommandParser');
const HomePacketBuilder = require('../packets/HomePacketBuilder');
const HomePacketValidator = require('../validators/HomePacketValidator');
const HomeResponseHandler = require('../responses/HomeResponseHandler');
const HomeAutomationState = require('../state/HomeAutomationState');
const { createHomeAutomationUiSnapshot } = require('../ui/HomeAutomationUiPlaceholders');

class HomeAutomationManager {
  constructor(options = {}) {
    this.parser = options.parser || new HomeCommandParser(options);
    this.packetBuilder = options.packetBuilder || new HomePacketBuilder(options.packet || options);
    this.packetValidator = options.packetValidator || new HomePacketValidator(options);
    this.responseHandler = options.responseHandler || new HomeResponseHandler(options);
    this.state = options.state || new HomeAutomationState(options.state || options);
    this.getPairedDevices = typeof options.getPairedDevices === 'function' ? options.getPairedDevices : null;
    this.commandClient = options.commandClient || null;
    this.ownerId = options.ownerId || '';
  }

  configureLiveExecution({ getPairedDevices, commandClient, ownerId } = {}) {
    if (typeof getPairedDevices === 'function') this.getPairedDevices = getPairedDevices;
    if (commandClient) this.commandClient = commandClient;
    if (ownerId) this.ownerId = ownerId;
  }

  listDevices({ scope = 'all' } = {}) {
    const sourceDevices = typeof this.getPairedDevices === 'function'
      ? this.getPairedDevices() || []
      : [];
    const normalizedScope = String(scope || 'all').trim().toLowerCase();
    const devices = sourceDevices.filter(device => {
      const pairingStatus = String(device.pairingStatus || device.pairStatus || '').toLowerCase();
      const connectionStatus = String(device.connectionStatus || '').toLowerCase();
      if (normalizedScope === 'paired' || normalizedScope === 'connected') return pairingStatus === 'paired';
      if (normalizedScope === 'online') return pairingStatus === 'paired' && connectionStatus === 'online';
      return pairingStatus === 'paired' || device.deviceId;
    });
    const paired = devices.filter(device => String(device.pairingStatus || device.pairStatus || '').toLowerCase() === 'paired');
    const online = paired.filter(device => String(device.connectionStatus || '').toLowerCase() === 'online');
    return {
      success: true,
      data: {
        action: 'home.devices.list',
        scope: normalizedScope,
        count: devices.length,
        pairedCount: paired.length,
        onlineCount: online.length,
        devices: devices.map(device => ({ ...device })),
        verified: true,
        verification: {
          status: 'passed',
          check: 'home-devices-list',
          count: devices.length,
          pairedCount: paired.length,
          onlineCount: online.length
        }
      }
    };
  }

  handleAssistantRequest(request = {}) {
    const command = request.target && request.action
      ? {
          intent: 'home.device_control',
          target: String(request.target || '').trim(),
          action: String(request.action || '').trim(),
          displayTarget: String(request.displayTarget || request.target || '').trim(),
          value: request.value === undefined ? null : request.value,
          rawText: String(request.rawCommand || request.rawText || '').trim(),
          source: String(request.source || 'assistant').trim()
        }
      : this.parser.parse(request.rawCommand || request.input || '', { source: request.source || 'assistant' });

    if (!command) {
      return {
        success: false,
        error: 'Could not understand the home automation command.',
        data: {
          action: 'home.device_control',
          verified: false,
          validation: {
            status: 'failed',
            check: 'home-command-parse',
            message: 'No valid home device target or action was found.'
          }
        }
      };
    }

    if (this.getPairedDevices && this.commandClient) {
      return this.executeRealCommand(command);
    }

    const packet = this.packetBuilder.buildDeviceCommand(command);
    const validation = this.packetValidator.validate(packet);
    const response = this.responseHandler.buildPreparedResponse(command, packet, validation);

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        data: {
          action: 'home.device_control',
          target: command.target,
          displayTarget: command.displayTarget,
          homeAction: command.action,
          packet,
          validation,
          verified: false,
          verification: {
            status: 'failed',
            check: 'home-packet-created',
            message: response.error
          }
        }
      };
    }

    const pending = this.state.addPendingRequest(packet, command);
    return {
      success: true,
      data: {
        action: 'home.device_control',
        target: command.target,
        displayTarget: command.displayTarget,
        homeAction: command.action,
        value: command.value,
        packet,
        requestId: packet.requestId,
        pendingRequest: pending,
        pending: true,
        placeholder: true,
        message: response.message,
        ui: this.getUiSnapshot(),
        verified: true,
        verification: {
          status: 'passed',
          check: 'home-packet-created',
          method: 'home-automation-foundation',
          requestId: packet.requestId,
          target: command.target,
          action: command.action
        }
      }
    };
  }

  async executeRealCommand(command) {
    const baseData = {
      action: 'home.device_control',
      target: command.target,
      displayTarget: command.displayTarget,
      homeAction: command.action,
      value: command.value
    };
    const devices = this.getPairedDevices() || [];
    const paired = devices.filter(device => String(device.pairingStatus || device.pairStatus || '').toLowerCase() === 'paired');
    if (!paired.length) {
      return {
        success: false,
        error: "You don't have any Home Devices set up yet.",
        data: { ...baseData, verified: false, verification: { status: 'failed', check: 'home-device-not-found', message: 'No paired devices.' } }
      };
    }

    const targetDevice = this.resolveTargetDevice(paired, command);
    if (!targetDevice) {
      const label = command.displayTarget || command.target || 'that device';
      return {
        success: false,
        error: paired.length > 1
          ? `You have a few Home Devices - which one did you mean by "${label}"?`
          : `I couldn't find a Home Device matching "${label}".`,
        data: { ...baseData, verified: false, verification: { status: 'failed', check: 'home-device-not-found', message: `No paired device matched "${label}".` } }
      };
    }

    if (String(targetDevice.connectionStatus || '').toLowerCase() !== 'online') {
      return {
        success: false,
        error: `${targetDevice.deviceName || 'That device'} is offline right now, so I can't control it.`,
        data: { ...baseData, displayTarget: targetDevice.deviceName || baseData.displayTarget, verified: false, verification: { status: 'failed', check: 'home-device-offline', message: 'Target device is not online.' } }
      };
    }

    const result = await this.commandClient.sendCommand({
      deviceId: targetDevice.deviceId,
      ownerId: this.ownerId,
      action: command.action,
      // Do not forward the parsed phrase as the firmware relay
      // channel name: it reflects whatever the user renamed the *device*
      // to (e.g. "bed_light"), which has no relationship to the relay's
      // own internal channel names. The device to target was already
      // resolved above by matching the paired device's real name, so leave
      // this blank and let the firmware fall back to its primary relay.
      target: '',
      value: command.value
    });

    if (!result.success) {
      return {
        success: false,
        error: result.message || `${targetDevice.deviceName || 'The device'} could not run that command.`,
        data: {
          ...baseData,
          displayTarget: targetDevice.deviceName || baseData.displayTarget,
          verified: false,
          verification: { status: 'failed', check: result.code || 'home-command-failed', message: result.message || '' }
        }
      };
    }

    return {
      success: true,
      data: {
        ...baseData,
        displayTarget: targetDevice.deviceName || baseData.displayTarget,
        homeResult: result.result || null,
        homeMessage: result.message || result.result?.message || '',
        relayState: result.result?.relayState || '',
        relayChanged: result.result?.changed,
        verified: true,
        verification: {
          status: 'passed',
          check: 'home-command-executed',
          method: 'home-command-client',
          deviceId: targetDevice.deviceId,
          result: result.result || null
        }
      }
    };
  }

  resolveTargetDevice(paired, command) {
    if (paired.length === 1) return paired[0];
    const needle = String(command.displayTarget || command.target || '').toLowerCase().trim();
    if (!needle) return null;
    return paired.find(device => {
      const name = String(device.deviceName || '').toLowerCase().trim();
      return name && (name.includes(needle) || needle.includes(name));
    }) || null;
  }

  handleExecutionResponse(response = {}) {
    const result = this.responseHandler.handleExecutionResponse(response);
    if (result.requestId) {
      this.state.completePendingRequest(result.requestId);
    }
    return result;
  }

  getUiSnapshot() {
    return createHomeAutomationUiSnapshot(this.state);
  }

  listPendingRequests() {
    return this.state.listPendingRequests();
  }
}

module.exports = HomeAutomationManager;
