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
