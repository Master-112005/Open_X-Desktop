'use strict';

const path = require('path');
const BaseLearningModule = require('./BaseLearningModule');
const { RoutineLearning } = require('./routines');

class RoutineTimeLearning extends BaseLearningModule {
  constructor(options = {}) {
    super(options);
    this.routineLearning = options.routineLearning || null;
  }

  supports(context) {
    const event = context.externalEvent || {};
    const type = String(event.type || event.event || '').trim().toLowerCase();
    return super.supports(context) && ['routine_observation', 'routine', 'time_routine'].includes(type);
  }

  learn(context) {
    const learner = this._learner(context);
    const result = learner.observe(context.externalEvent);
    if (!result?.learningEvent) return context;
    context.addEvent({
      ...result.learningEvent,
      module: this.id
    });
    return context;
  }

  _learner(context) {
    if (this.routineLearning) return this.routineLearning;
    const baseDir = context.configuration?.storage?.baseDir;
    const options = {};
    if (baseDir) {
      options.observationPath = path.join(baseDir, 'routines', 'observations.jsonl');
      options.summaryPath = path.join(baseDir, 'routines', 'summaries.json');
    }
    this.routineLearning = new RoutineLearning(options);
    return this.routineLearning;
  }
}

module.exports = RoutineTimeLearning;
