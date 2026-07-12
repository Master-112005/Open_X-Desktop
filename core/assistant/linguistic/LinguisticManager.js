'use strict';

const AnalyzerRegistry = require('./AnalyzerRegistry');
const LinguisticConfiguration = require('./LinguisticConfiguration');
const LinguisticContext = require('./LinguisticContext');
const LinguisticPipeline = require('./LinguisticPipeline');
const Tokenizer = require('./Tokenizer');
const SentenceSplitter = require('./SentenceSplitter');
const ClauseAnalyzer = require('./ClauseAnalyzer');
const DependencyParser = require('./DependencyParser');
const POSTagger = require('./POSTagger');
const VerbDetector = require('./VerbDetector');
const SubjectDetector = require('./SubjectDetector');
const ObjectDetector = require('./ObjectDetector');
const ModifierDetector = require('./ModifierDetector');
const QuestionDetector = require('./QuestionDetector');
const NegationDetector = require('./NegationDetector');
const PronounResolver = require('./PronounResolver');

class LinguisticManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof LinguisticConfiguration
      ? options.configuration
      : new LinguisticConfiguration(options.configuration || options);
    this.registry = options.registry || new AnalyzerRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultAnalyzers !== false) this._registerDefaults();
  }

  _registerDefaults() {
    const defaults = [
      [Tokenizer, 'linguistic.tokenizer', 10],
      [SentenceSplitter, 'linguistic.sentenceSplitter', 20],
      [ClauseAnalyzer, 'linguistic.clauseAnalyzer', 30],
      [DependencyParser, 'linguistic.dependencyParser', 40],
      [POSTagger, 'linguistic.posTagger', 50],
      [VerbDetector, 'linguistic.verbDetector', 60],
      [SubjectDetector, 'linguistic.subjectDetector', 70],
      [ObjectDetector, 'linguistic.objectDetector', 80],
      [ModifierDetector, 'linguistic.modifierDetector', 90],
      [QuestionDetector, 'linguistic.questionDetector', 100],
      [NegationDetector, 'linguistic.negationDetector', 110],
      [PronounResolver, 'linguistic.pronounResolver', 120]
    ];
    defaults.forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getAnalyzerOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority });
    });
  }

  async analyze(normalizedInput, options = {}) {
    const context = new LinguisticContext({
      normalizedInput,
      text: normalizedInput?.normalizedText || '',
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (!this.pipeline) {
      this.pipeline = new LinguisticPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    const linguisticContext = await this.pipeline.run(context);
    return linguisticContext.toGraph();
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      analyzers: this.registry.health()
    };
  }

  destroy() {
    this.registry.list().forEach(analyzer => {
      if (typeof analyzer.destroy === 'function') analyzer.destroy();
    });
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultLinguisticManager(options = {}) {
  return new LinguisticManager(options);
}

module.exports = {
  LinguisticManager,
  createDefaultLinguisticManager
};
