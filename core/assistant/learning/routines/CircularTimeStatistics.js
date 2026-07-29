'use strict';

const { minutesToTime } = require('./RoutineNormalizer');

const DAY_MINUTES = 1440;
const TWO_PI = Math.PI * 2;

function normalizeMinutes(value) {
  return ((Math.round(Number(value) || 0) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function circularDistanceMinutes(left, right) {
  const delta = Math.abs(normalizeMinutes(left) - normalizeMinutes(right));
  return Math.min(delta, DAY_MINUTES - delta);
}

class CircularTimeStatistics {
  summarize(minutes = []) {
    const values = minutes.map(normalizeMinutes).filter(value => Number.isFinite(value));
    if (!values.length) return null;
    let sin = 0;
    let cos = 0;
    for (const minute of values) {
      const angle = (minute / DAY_MINUTES) * TWO_PI;
      sin += Math.sin(angle);
      cos += Math.cos(angle);
    }
    const meanAngle = Math.atan2(sin / values.length, cos / values.length);
    const meanMinutes = normalizeMinutes((meanAngle < 0 ? meanAngle + TWO_PI : meanAngle) / TWO_PI * DAY_MINUTES);
    const distances = values.map(value => circularDistanceMinutes(value, meanMinutes));
    const variance = distances.reduce((total, value) => total + value * value, 0) / values.length;
    const standardDeviationMinutes = Math.sqrt(variance);
    const normalRangeMinutes = Math.max(10, Math.round(standardDeviationMinutes * 2));
    return {
      typicalMinutes: meanMinutes,
      typicalTime: minutesToTime(meanMinutes),
      standardDeviationMinutes: Number(standardDeviationMinutes.toFixed(2)),
      normalRangeMinutes,
      normalStart: minutesToTime(meanMinutes - normalRangeMinutes),
      normalEnd: minutesToTime(meanMinutes + normalRangeMinutes),
      count: values.length
    };
  }
}

module.exports = {
  CircularTimeStatistics,
  normalizeMinutes,
  circularDistanceMinutes
};
