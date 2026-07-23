'use strict';

const {
  clamp01,
  faceEmbeddingSimilarity,
  weightedMeanVector
} = require('../utils/face-utils');

class FaceComparisonEngine {
  constructor({ configuration } = {}) {
    this.configuration = configuration || {};
  }

  comparePair(left = {}, right = {}, options = {}) {
    const leftVector = Array.isArray(left?.vector) ? left.vector : left;
    const rightVector = Array.isArray(right?.vector) ? right.vector : right;
    if (!Array.isArray(leftVector) || !Array.isArray(rightVector) || leftVector.length === 0 || rightVector.length === 0) {
      return {
        comparable: false,
        match: false,
        strong: false,
        review: false,
        decision: 'invalid',
        reason: 'missing-vector',
        score: 0,
        threshold: 1,
        strongThreshold: 1,
        quality: 0,
        localDescriptorPair: false
      };
    }

    const localDescriptorPair = options.localDescriptorPair === true || this.usesLocalDescriptors(left, right);
    const quality = Math.min(this.quality(left), this.quality(right));
    const thresholds = this.thresholds({ ...options, localDescriptorPair, quality });
    const score = faceEmbeddingSimilarity(left, right);
    const strong = score >= thresholds.strongThreshold;
    const match = score >= thresholds.threshold;
    const review = !strong && score >= thresholds.reviewThreshold;
    return {
      comparable: true,
      match,
      strong,
      review,
      decision: strong ? 'strong-match' : match ? 'match' : review ? 'review' : 'no-match',
      reason: strong ? 'above-strong-threshold' : match ? 'above-match-threshold' : review ? 'near-threshold' : 'below-threshold',
      score: Number(score.toFixed(4)),
      rawScore: score,
      threshold: Number(thresholds.threshold.toFixed(4)),
      rawThreshold: thresholds.threshold,
      strongThreshold: Number(thresholds.strongThreshold.toFixed(4)),
      reviewThreshold: Number(thresholds.reviewThreshold.toFixed(4)),
      quality: Number(quality.toFixed(4)),
      localDescriptorPair
    };
  }

  rankProbe(probe = {}, candidates = [], options = {}) {
    const records = candidates
      .map(candidate => {
        const comparison = this.comparePair(probe, candidate, options);
        return comparison.comparable
          ? { ...candidate, comparison, confidence: comparison.rawScore }
          : null;
      })
      .filter(Boolean)
      .sort((left, right) => right.confidence - left.confidence);
    const best = records[0] || null;
    const second = records[1] || null;
    const margin = best ? best.confidence - (second?.confidence || 0) : 0;
    const requiredMargin = this.requiredMargin(options);
    return {
      matches: records,
      best,
      second,
      margin: Number(margin.toFixed(4)),
      requiredMargin,
      ambiguous: Boolean(best && second && margin < requiredMargin)
    };
  }

  scoreProbeAgainstSet(probe = {}, embeddings = [], options = {}) {
    const comparable = embeddings
      .filter(embedding => embedding && Array.isArray(embedding.vector) && embedding.vector.length > 0);
    if (comparable.length === 0) {
      return this._emptySetDecision('missing-evidence');
    }

    const scored = comparable
      .map(embedding => ({
        embedding,
        comparison: this.comparePair(probe, embedding, options),
        quality: this.quality(embedding)
      }))
      .filter(item => item.comparison.comparable)
      .sort((left, right) => right.comparison.rawScore - left.comparison.rawScore);
    if (scored.length === 0) {
      return this._emptySetDecision('missing-comparable-evidence');
    }

    const top = scored.slice(0, Math.min(5, scored.length));
    const bestScore = top[0]?.comparison.rawScore || 0;
    const topMean = top.reduce((sum, item) => sum + item.comparison.rawScore, 0) / Math.max(1, top.length);
    const evidenceQuality = top.reduce((sum, item) => sum + item.quality, 0) / Math.max(1, top.length);
    const probeQuality = this.quality(probe);
    const centroid = weightedMeanVector(scored.map(item => ({
      vector: item.embedding.vector,
      weight: Math.max(0.05, item.quality)
    })));
    const centroidComparison = centroid.length
      ? this.comparePair(
        { vector: Array.isArray(probe.vector) ? probe.vector : probe, quality: probeQuality },
        { vector: centroid, quality: evidenceQuality, metadata: this._setMetadata(scored.map(item => item.embedding)) },
        options
      )
      : null;
    const centroidScore = centroidComparison?.rawScore || bestScore;
    const threshold = this.thresholds({
      ...options,
      localDescriptorPair: top.some(item => item.comparison.localDescriptorPair),
      quality: Math.min(probeQuality, evidenceQuality)
    }).threshold;
    const supportCount = scored.filter(item => item.comparison.rawScore >= Math.max(0.72, threshold - 0.045)).length;
    const strongSupportCount = scored.filter(item => item.comparison.strong || item.comparison.rawScore >= threshold).length;
    const supportBoost = Math.min(0.024, supportCount * 0.004);
    const qualityFactor = 0.94 + (Math.min(probeQuality, evidenceQuality) * 0.06);
    const confidence = clamp01(((bestScore * 0.54) + (topMean * 0.20) + (centroidScore * 0.24) + supportBoost) * qualityFactor);
    const setThresholds = this.thresholds({
      ...options,
      localDescriptorPair: top.some(item => item.comparison.localDescriptorPair),
      quality: Math.min(probeQuality, evidenceQuality),
      evidenceCount: scored.length,
      supportCount: strongSupportCount
    });
    return {
      comparable: true,
      confidence,
      confidenceRounded: Number(confidence.toFixed(4)),
      bestSimilarity: bestScore,
      bestSimilarityRounded: Number(bestScore.toFixed(4)),
      centroidSimilarity: centroidScore,
      centroidSimilarityRounded: Number(centroidScore.toFixed(4)),
      topMean,
      topMeanRounded: Number(topMean.toFixed(4)),
      supportCount,
      strongSupportCount,
      evidenceCount: scored.length,
      quality: Math.min(probeQuality, evidenceQuality),
      qualityRounded: Number(Math.min(probeQuality, evidenceQuality).toFixed(4)),
      threshold: setThresholds.threshold,
      strongThreshold: setThresholds.strongThreshold,
      localDescriptorPair: top.some(item => item.comparison.localDescriptorPair),
      scored
    };
  }

  compareClusters(leftEmbeddings = [], rightEmbeddings = [], options = {}) {
    const left = this._validEmbeddings(leftEmbeddings);
    const right = this._validEmbeddings(rightEmbeddings);
    const evidenceCount = Math.min(left.length, right.length);
    if (evidenceCount === 0) {
      return {
        comparable: false,
        merge: false,
        decision: 'skip',
        reason: 'missing-embedding',
        score: 0,
        evidenceCount: 0,
        highPairCount: 0
      };
    }

    const leftQuality = this._setQuality(left);
    const rightQuality = this._setQuality(right);
    const localDescriptorPair = this.clusterUsesLocalDescriptors(left, right);
    const pairScores = [];
    for (const leftEmbedding of left.slice(0, 16)) {
      for (const rightEmbedding of right.slice(0, 16)) {
        const comparison = this.comparePair(leftEmbedding, rightEmbedding, {
          ...options,
          localDescriptorPair,
          quality: Math.min(this.quality(leftEmbedding), this.quality(rightEmbedding))
        });
        if (comparison.comparable) pairScores.push(comparison);
      }
    }
    if (pairScores.length === 0) {
      return {
        comparable: false,
        merge: false,
        decision: 'skip',
        reason: 'missing-comparable-pair',
        score: 0,
        evidenceCount,
        highPairCount: 0
      };
    }

    pairScores.sort((leftScore, rightScore) => rightScore.rawScore - leftScore.rawScore);
    const topScores = pairScores.slice(0, Math.min(8, pairScores.length));
    const topPairSimilarity = topScores[0]?.rawScore || 0;
    const meanPairSimilarity = topScores.reduce((sum, item) => sum + item.rawScore, 0) / Math.max(1, topScores.length);
    const thresholds = this.thresholds({
      ...options,
      localDescriptorPair,
      quality: Math.min(leftQuality, rightQuality),
      evidenceCount,
      supportCount: topScores.filter(item => item.match || item.strong).length
    });
    const highPairCount = pairScores.filter(score => score.rawScore >= thresholds.reviewThreshold).length;
    const strongPairCount = pairScores.filter(score => score.rawScore >= thresholds.threshold || score.strong).length;
    const leftCentroid = weightedMeanVector(left.map(embedding => ({
      vector: embedding.vector,
      weight: Math.max(0.05, this.quality(embedding))
    })));
    const rightCentroid = weightedMeanVector(right.map(embedding => ({
      vector: embedding.vector,
      weight: Math.max(0.05, this.quality(embedding))
    })));
    const centroidComparison = this.comparePair(
      { vector: leftCentroid, quality: leftQuality, metadata: this._setMetadata(left) },
      { vector: rightCentroid, quality: rightQuality, metadata: this._setMetadata(right) },
      { ...options, localDescriptorPair }
    );
    const centroidSimilarity = centroidComparison.rawScore || 0;
    const supportBoost = Math.min(0.026, highPairCount * 0.004);
    const score = clamp01((centroidSimilarity * 0.46) +
      (topPairSimilarity * 0.34) +
      (meanPairSimilarity * 0.18) +
      supportBoost);
    const enoughPairSupport = strongPairCount >= Math.min(2, Math.max(1, evidenceCount)) ||
      topPairSimilarity >= thresholds.strongThreshold ||
      (localDescriptorPair &&
        topPairSimilarity >= thresholds.reviewThreshold &&
        centroidSimilarity >= Math.max(0.74, thresholds.reviewThreshold - 0.05));
    const merge = score >= thresholds.threshold && enoughPairSupport;
    return {
      comparable: true,
      merge,
      decision: merge ? 'merge' : highPairCount > 0 ? 'review' : 'separate',
      reason: merge ? 'cluster-evidence-accepted' : enoughPairSupport ? 'below-cluster-threshold' : 'insufficient-pair-support',
      score: Number(score.toFixed(4)),
      rawScore: score,
      centroidSimilarity: Number(centroidSimilarity.toFixed(4)),
      topPairSimilarity: Number(topPairSimilarity.toFixed(4)),
      meanPairSimilarity: Number(meanPairSimilarity.toFixed(4)),
      highPairCount,
      strongPairCount,
      evidenceCount,
      threshold: Number(thresholds.threshold.toFixed(4)),
      rawThreshold: thresholds.threshold,
      strongThreshold: Number(thresholds.strongThreshold.toFixed(4)),
      reviewThreshold: Number(thresholds.reviewThreshold.toFixed(4)),
      localDescriptorPair,
      quality: Number(Math.min(leftQuality, rightQuality).toFixed(4))
    };
  }

  thresholds(options = {}) {
    const localDescriptorPair = options.localDescriptorPair ?? false;
    const quality = clamp01(options.quality ?? 0.75);
    const thresholds = this.configuration.thresholds || {};
    const qualityPenalty = quality < 0.58 ? 0.035 : quality < 0.7 ? 0.018 : 0;
    const evidenceDiscount = Number(options.evidenceCount || 0) >= 3 || Number(options.supportCount || 0) >= 2 ? 0.012 : 0;
    const optionMatch = Number(options.matchThreshold);
    const localConfigured = Number(options.faceComparisonSimilarity ?? thresholds.faceComparison ?? 0.84);
    const localStrongConfigured = Number(options.faceComparisonStrongSimilarity ?? thresholds.faceComparisonStrong ?? 0.91);
    const deepConfigured = Number(options.duplicateClusterSimilarity ?? thresholds.grouping ?? 0.94);
    const rawThreshold = Number.isFinite(optionMatch)
      ? optionMatch
      : localDescriptorPair
        ? localConfigured
        : deepConfigured;
    const lowerBound = localDescriptorPair ? 0.82 : 0.91;
    const upperBound = localDescriptorPair ? 0.985 : 0.995;
    const threshold = Math.max(lowerBound, Math.min(upperBound, rawThreshold + qualityPenalty - evidenceDiscount));
    const strongThreshold = localDescriptorPair
      ? Math.max(threshold, Math.min(0.995, localStrongConfigured + qualityPenalty))
      : Math.max(threshold, Math.min(0.998, threshold + 0.025));
    const reviewThreshold = Math.max(localDescriptorPair ? 0.78 : 0.88, threshold - (localDescriptorPair ? 0.045 : 0.025));
    return { threshold, strongThreshold, reviewThreshold, qualityPenalty, evidenceDiscount };
  }

  requiredMargin(options = {}) {
    const configured = Number(options.margin ?? options.matchingMargin ?? this.configuration.thresholds?.matchingMargin ?? 0.035);
    return Number(Math.max(0, Math.min(0.12, configured)).toFixed(4));
  }

  quality(embedding = {}) {
    return clamp01(embedding?.quality ?? embedding?.confidence ?? 0.75);
  }

  usesLocalDescriptors(left = {}, right = {}) {
    if (left?.localDescriptorPair === true || right?.localDescriptorPair === true) return true;
    return this.isLocalDescriptor(left) && this.isLocalDescriptor(right);
  }

  clusterUsesLocalDescriptors(leftEmbeddings = [], rightEmbeddings = []) {
    return leftEmbeddings.some(embedding => this.isLocalDescriptor(embedding)) &&
      rightEmbeddings.some(embedding => this.isLocalDescriptor(embedding));
  }

  isLocalDescriptor(embedding = {}) {
    const vectorType = String(embedding?.metadata?.vectorType || embedding?.vectorType || '').toLowerCase();
    const source = String(embedding?.source || embedding?.metadata?.source || '').toLowerCase();
    return vectorType.startsWith('local-face-region') || vectorType.includes('face-region') || source.includes('face-region');
  }

  _validEmbeddings(embeddings = []) {
    return embeddings.filter(embedding => embedding && Array.isArray(embedding.vector) && embedding.vector.length > 0);
  }

  _setQuality(embeddings = []) {
    const qualities = embeddings
      .map(embedding => this.quality(embedding))
      .sort((left, right) => right - left)
      .slice(0, Math.min(5, embeddings.length));
    return qualities.length
      ? qualities.reduce((sum, value) => sum + value, 0) / qualities.length
      : 0.75;
  }

  _setMetadata(embeddings = []) {
    const hasLocal = embeddings.some(embedding => this.isLocalDescriptor(embedding));
    return hasLocal ? { vectorType: 'local-face-region-set' } : {};
  }

  _emptySetDecision(reason) {
    return {
      comparable: false,
      confidence: 0,
      confidenceRounded: 0,
      bestSimilarity: 0,
      bestSimilarityRounded: 0,
      centroidSimilarity: 0,
      centroidSimilarityRounded: 0,
      supportCount: 0,
      strongSupportCount: 0,
      evidenceCount: 0,
      quality: 0,
      qualityRounded: 0,
      reason,
      scored: []
    };
  }
}

module.exports = FaceComparisonEngine;
