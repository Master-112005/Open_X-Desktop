const { HOME_ACTIONS } = require('../constants/HomeActions');
const { createExecutionResult } = require('../models/ExecutionResult');
const { createHomeResponse } = require('../models/HomeResponse');

const ACTION_COPY = Object.freeze({
  [HOME_ACTIONS.TURN_ON]: 'turn on',
  [HOME_ACTIONS.TURN_OFF]: 'turn off',
  [HOME_ACTIONS.TOGGLE]: 'toggle',
  [HOME_ACTIONS.OPEN]: 'open',
  [HOME_ACTIONS.CLOSE]: 'close',
  [HOME_ACTIONS.SET_LEVEL]: 'set'
});

class HomeResponseHandler {
  buildPreparedResponse(command, packet, validation) {
    if (!validation?.valid) {
      const message = validation?.errors?.[0]?.message || 'The home automation packet is not valid.';
      return createHomeResponse({
        success: false,
        target: command?.target || '',
        action: command?.action || '',
        message,
        error: message,
        packet
      });
    }

    const verb = ACTION_COPY[command.action] || command.action;
    const target = command.displayTarget || command.target;
    const message = `Prepared a home automation packet to ${verb} ${target}. Device execution is not connected in this phase.`;
    return createHomeResponse({
      success: true,
      requestId: packet.requestId,
      target: command.target,
      action: command.action,
      message,
      pending: true,
      packet
    });
  }

  handleExecutionResponse(response = {}) {
    return createExecutionResult({
      success: response.success === true,
      requestId: response.requestId,
      target: response.target,
      action: response.action,
      status: response.status || (response.success ? 'completed' : 'failed'),
      message: response.message || '',
      error: response.error || null,
      data: response.data || {}
    });
  }
}

module.exports = HomeResponseHandler;
