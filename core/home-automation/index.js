const HomeAutomationManager = require('./managers/HomeAutomationManager');
const HomeAutomationRouter = require('./routing/HomeAutomationRouter');
const HomeCommandParser = require('./parser/HomeCommandParser');
const HomePacketBuilder = require('./packets/HomePacketBuilder');
const HomePacketValidator = require('./validators/HomePacketValidator');
const HomeResponseHandler = require('./responses/HomeResponseHandler');
const HomeAutomationState = require('./state/HomeAutomationState');
const { HOME_PACKET_TYPES } = require('./constants/PacketTypes');
const { HOME_ACTIONS } = require('./constants/HomeActions');
const { createHomeAutomationUiSnapshot } = require('./ui/HomeAutomationUiPlaceholders');
const homeOnboarding = require('./onboarding');

module.exports = {
  HomeAutomationManager,
  HomeAutomationRouter,
  HomeCommandParser,
  HomePacketBuilder,
  HomePacketValidator,
  HomeResponseHandler,
  HomeAutomationState,
  HOME_PACKET_TYPES,
  HOME_ACTIONS,
  createHomeAutomationUiSnapshot,
  ...homeOnboarding
};
