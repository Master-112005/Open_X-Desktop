'use strict';

function clamp(value, fallback = 0) {
  const number = Number(value);
  return Math.max(0, Math.min(1, Number.isFinite(number) ? number : fallback));
}

class RoutineConfidence {
  constructor(options = {}) {
    this.minimumEvidence = Math.max(1, Number(options.minimumEvidence || 7));
  }

  score({ observations = 0, exceptions = 0, recencyWeight = 1, sourceWeight = 1, consistency = 1 } = {}) {
    const count = Math.max(0, Number(observations) || 0);
    const exceptionCount = Math.max(0, Number(exceptions) || 0);
    const base = count / (count + exceptionCount + this.minimumEvidence);
    return Number(clamp(base * clamp(recencyWeight, 1) * clamp(sourceWeight, 1) * clamp(consistency, 1)).toFixed(4));
  }
}

module.exports = RoutineConfidence;
