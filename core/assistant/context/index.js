'use strict';

const CONTEXT_LAYER_VERSION = '1.1.0';

module.exports = {
  CONTEXT_LAYER_VERSION,
  ApplicationContext: require('./ApplicationContext'),
  DesktopContext: require('./DesktopContext'),
  BrowserContext: require('./BrowserContext'),
  ScreenContext: require('./ScreenContext'),
  ClipboardContext: require('./ClipboardContext'),
  SystemContext: require('./SystemContext'),
  CalendarContext: require('./CalendarContext'),
  MediaContext: require('./MediaContext'),
  TimeContext: require('./TimeContext'),
  UserContext: require('./UserContext'),
  SelectionContext: require('./SelectionContext'),
  WindowContext: require('./WindowContext'),
  ContextManager: require('./ContextManager')
};
