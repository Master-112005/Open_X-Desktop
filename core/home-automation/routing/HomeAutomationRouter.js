const HomeCommandParser = require('../parser/HomeCommandParser');

class HomeAutomationRouter {
  constructor(options = {}) {
    this.parser = options.parser || new HomeCommandParser(options);
  }

  resolve(rawText, preparedInput = {}, options = {}) {
    const rawCommand = String(rawText || '').trim();
    const corrected = String(preparedInput?.correctedText || '').trim();
    const command = this.parser.parse(rawCommand, options) ||
      (corrected && corrected !== rawCommand ? this.parser.parse(corrected, options) : null);
    if (!command) {
      return null;
    }
    return {
      intentId: command.intent,
      confidence: 0.99,
      entities: {
        target: command.target,
        action: command.action,
        displayTarget: command.displayTarget,
        value: command.value,
        rawCommand: command.rawText,
        routeSource: 'home-automation-router-v1'
      },
      command
    };
  }

  isHomeAutomationCommand(rawText, preparedInput = {}) {
    return Boolean(this.resolve(rawText, preparedInput));
  }
}

module.exports = HomeAutomationRouter;
