'use strict';

const STEP_TYPES = {
  open_application: {
    label: 'Open Application',
    category: 'launch',
    engineIntent: 'app.open',
    describe: entities => `open the app ${String(entities.appName || entities.targetApp || '').trim() || 'requested'}`
  },
  close_application: {
    label: 'Close Application',
    category: 'launch',
    engineIntent: 'app.close',
    describe: entities => `close the app ${String(entities.appName || 'requested').trim()}`
  },
  focus_window: {
    label: 'Focus Window',
    category: 'launch',
    engineIntent: 'app.switch',
    describe: entities => `switch to ${String(entities.appName || entities.windowName || 'the requested window').trim()}`
  },
  window_control: {
    label: 'Control Window',
    category: 'window',
    engineIntent: null,
    describe: entities => `${String(entities.operation || 'change')} the window`
  },
  type_text: {
    label: 'Type Text',
    category: 'input',
    engineIntent: 'text.write',
    describe: entities => `type "${String(entities.text || '').trim()}"`
  },
  save_file: {
    label: 'Save File',
    category: 'files',
    engineIntent: 'text.write',
    describe: entities => `save content to ${String(entities.filename || 'a file').trim()}`
  },
  create_file: {
    label: 'Create File',
    category: 'files',
    engineIntent: 'file.create',
    describe: entities => `create the file ${String(entities.filename || 'requested').trim()}`
  },
  calculate: {
    label: 'Calculate',
    category: 'computation',
    engineIntent: 'system.calculate',
    describe: entities => `calculate ${String(entities.expression || '').trim() || 'the requested expression'}`
  },
  press_key: {
    label: 'Press Key',
    category: 'input',
    engineIntent: 'window.keys',
    describe: entities => `press ${String(entities.keys || 'the requested key').trim()}`
  },
  hotkey: {
    label: 'Send Hotkey',
    category: 'input',
    engineIntent: 'window.keys',
    describe: entities => `send the hotkey ${String(entities.keys || '').trim()}`
  },
  wait: {
    label: 'Wait',
    category: 'timing',
    engineIntent: null,
    describe: entities => `wait ${Number(entities.ms) || 0}ms`
  },
  open_url: {
    label: 'Open URL',
    category: 'launch',
    engineIntent: 'browser.open',
    describe: entities => `open ${String(entities.url || 'the URL').trim()}`
  },
  read_screen: {
    label: 'Read Screen',
    category: 'sensing',
    engineIntent: 'system.screenshot',
    describe: () => 'capture the screen'
  },
  find_element: {
    label: 'Find Element',
    category: 'sensing',
    engineIntent: 'window.find',
    describe: entities => `find ${String(entities.name || 'the requested element').trim()}`
  },
  move_mouse: {
    label: 'Move Mouse',
    category: 'input',
    engineIntent: 'mouse.move',
    describe: entities => `move the mouse to (${entities.x}, ${entities.y})`
  },
  click: {
    label: 'Click',
    category: 'input',
    engineIntent: 'mouse.click',
    describe: entities => `click at (${entities.x}, ${entities.y})`
  }
};

function describeStep(step = {}) {
  const definition = STEP_TYPES[step.type];
  if (!definition) return `execute step ${String(step.type || 'unknown')}`;
  return definition.describe(step.entities || step.params || {});
}

function isSupportedStepType(type) {
  return Boolean(STEP_TYPES[type]);
}

module.exports = {
  STEP_TYPES,
  describeStep,
  isSupportedStepType
};