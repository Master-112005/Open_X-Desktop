'use strict';

function finiteNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function compactText(value, maxLength = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

class SystemContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.system');
    this.priority = Number.isFinite(options.priority) ? options.priority : 160;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const system = context.snapshots?.system || {};
    context.context.system = {
      os: process.platform,
      arch: process.arch,
      version: compactText(system.version || system.osVersion || '', 80) || null,
      batteryPercent: finiteNumber(system.batteryPercent ?? system.battery),
      pluggedIn: system.pluggedIn === undefined ? null : Boolean(system.pluggedIn),
      cpuPercent: finiteNumber(system.cpuPercent ?? system.cpu),
      memoryPercent: finiteNumber(system.memoryPercent ?? system.memory),
      network: compactText(system.network || system.networkState || '', 80) || null,
      powerMode: compactText(system.powerMode || '', 80) || null,
      state: system.state || 'available'
    };
    return context;
  }
}

module.exports = SystemContext;
