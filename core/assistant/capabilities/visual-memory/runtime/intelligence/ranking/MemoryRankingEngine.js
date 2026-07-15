'use strict';

const MemoryRecord = require('../memories/MemoryRecord');
const { MEMORY_RESULT_TYPES } = require('../contracts/MemoryIntelligenceContracts');
const { candidateEvidence, constraintValues, includesAny } = require('../utils/intelligence-utils');

class MemoryRankingEngine {
  constructor({ configuration, confidenceEngine, similarityEngine } = {}) {
    this.configuration = configuration;
    this.confidenceEngine = confidenceEngine;
    this.similarityEngine = similarityEngine;
  }

  rank(context, reasoning) {
    const candidates = reasoning.timelinePlan.sort(context.getCandidates());
    const records = candidates.map(candidate => this._recordForCandidate(context, reasoning, candidate));
    records.sort((left, right) => right.score - left.score || Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
    const limit = Number(context.options.limit || this.configuration.search.defaultLimit);
    return records.slice(0, limit);
  }

  _recordForCandidate(context, reasoning, candidate) {
    const vision = context.getVisionFor(candidate);
    const evidence = candidateEvidence(candidate, vision);
    const locations = constraintValues(context.visualQuery, ['locations']);
    const eventConstraints = constraintValues(context.visualQuery, ['events']);
    const scenes = constraintValues(context.visualQuery, ['scenes']);
    const documents = constraintValues(context.visualQuery, ['documentTypes']);
    const sourceApps = constraintValues(context.visualQuery, ['sourceApps']);
    const visualScore = this._visualScore(evidence, { locations, events: eventConstraints, scenes, documents, sourceApps });
    const relationshipScore = reasoning.relationshipPlan.score(candidate, evidence);
    const timelineScore = reasoning.timelinePlan.score(candidate);
    const matchedEvents = reasoning.eventPlan.classify(candidate, evidence);
    const eventScore = matchedEvents.reduce((best, event) => Math.max(best, event.confidence || 0), 0);
    const candidateScore = Math.max(0, Math.min(1, Number(candidate.rankingScore || 0) / 100));
    const similarityScore = this.similarityEngine.score(vision, context.options.referenceEmbedding || null);
    const confidence = this.confidenceEngine.combine({
      weights: this.configuration.ranking,
      scores: {
        visual: visualScore,
        relationship: relationshipScore,
        timeline: Math.max(timelineScore, eventScore),
        candidate: candidateScore,
        similarity: similarityScore,
        context: context.assistantContext ? 0.55 : 0.2
      }
    });
    const collections = reasoning.collections.filter(collection => includesAny(evidence.text, [collection.id, collection.title]));
    const type = this._type(context, evidence);
    return new MemoryRecord({
      id: `memory:${candidate.photoId}`,
      photoId: candidate.photoId,
      type,
      title: this._title(type, reasoning, evidence),
      path: candidate.path,
      candidate,
      vision,
      evidence: {
        visualScore,
        relationshipScore,
        timelineScore,
        eventScore,
        candidateScore,
        similarityScore
      },
      collections,
      reasoning: { strategies: reasoning.strategies, events: matchedEvents },
      confidence,
      score: Number((confidence * 100).toFixed(3)),
      createdAt: candidate.metadata?.createdAt || candidate.photo?.createdAt || null
    });
  }

  _visualScore(evidence, constraints) {
    let score = 0;
    if (constraints.locations.length && includesAny(evidence.text, constraints.locations)) score += 0.22;
    if (constraints.events.length && includesAny(evidence.text, constraints.events)) score += 0.22;
    if (constraints.scenes.length && includesAny(evidence.text, constraints.scenes)) score += 0.18;
    if (constraints.documents.length && includesAny(evidence.text, constraints.documents)) score += 0.18;
    if (constraints.sourceApps.length && includesAny(evidence.text, constraints.sourceApps)) score += 0.18;
    if (Array.isArray(evidence.vision.objects) && evidence.vision.objects.length) score += 0.12;
    if (Array.isArray(evidence.vision.scenes) && evidence.vision.scenes.length) score += 0.12;
    if (Array.isArray(evidence.vision.ocr) && evidence.vision.ocr.length) score += 0.12;
    return Math.min(1, score || 0.18);
  }

  _type(context, evidence) {
    if (includesAny(evidence.text, ['screenshot'])) return MEMORY_RESULT_TYPES.SCREENSHOT;
    if (includesAny(evidence.text, ['receipt', 'invoice', 'passport', 'license', 'document', 'bill'])) return MEMORY_RESULT_TYPES.DOCUMENT;
    if (constraintValues(context.visualQuery, ['events']).length) return MEMORY_RESULT_TYPES.EVENT;
    return MEMORY_RESULT_TYPES.PHOTO;
  }

  _title(type, reasoning, evidence) {
    const collection = reasoning.collections.find(item => includesAny(evidence.text, [item.id, item.title]));
    if (collection) return collection.title;
    if (type === MEMORY_RESULT_TYPES.SCREENSHOT) return 'Screenshot Memory';
    if (type === MEMORY_RESULT_TYPES.DOCUMENT) return 'Document Memory';
    if (type === MEMORY_RESULT_TYPES.EVENT) return 'Event Memory';
    return 'Photo Memory';
  }
}

module.exports = MemoryRankingEngine;
