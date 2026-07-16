'use strict';

const crypto = require('crypto');

function normalizeVector(vector = []) {
  const values = Array.isArray(vector) ? vector.map(Number).filter(Number.isFinite) : [];
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? values.map(value => value / magnitude) : values;
}

function cosineSimilarity(left = [], right = []) {
  const a = normalizeVector(left);
  const b = normalizeVector(right);
  const length = Math.min(a.length, b.length);
  if (!length) return 0;
  let dot = 0;
  for (let index = 0; index < length; index += 1) dot += a[index] * b[index];
  return Math.max(-1, Math.min(1, dot));
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function weightedMeanVector(items = []) {
  const valid = items
    .map(item => ({
      vector: normalizeVector(item?.vector),
      weight: Math.max(0.0001, Number(item?.weight ?? item?.quality ?? item?.confidence ?? 1))
    }))
    .filter(item => item.vector.length > 0);
  if (valid.length === 0) return [];
  const length = Math.min(...valid.map(item => item.vector.length));
  const output = new Array(length).fill(0);
  let totalWeight = 0;
  for (const item of valid) {
    totalWeight += item.weight;
    for (let index = 0; index < length; index += 1) {
      output[index] += item.vector[index] * item.weight;
    }
  }
  return normalizeVector(output.map(value => value / Math.max(0.0001, totalWeight)));
}

function normalizeFaceBox(faceBox = null, imageWidth = null, imageHeight = null) {
  if (!faceBox || typeof faceBox !== 'object') return null;
  return {
    x: Number(faceBox.x) || 0,
    y: Number(faceBox.y) || 0,
    width: Math.max(0, Number(faceBox.width) || 0),
    height: Math.max(0, Number(faceBox.height) || 0),
    imageWidth: Number(imageWidth) || Number(faceBox.imageWidth) || null,
    imageHeight: Number(imageHeight) || Number(faceBox.imageHeight) || null
  };
}

function faceBoxIoU(left = {}, right = {}) {
  const lx1 = Number(left.x) || 0;
  const ly1 = Number(left.y) || 0;
  const lx2 = lx1 + (Number(left.width) || 0);
  const ly2 = ly1 + (Number(left.height) || 0);
  const rx1 = Number(right.x) || 0;
  const ry1 = Number(right.y) || 0;
  const rx2 = rx1 + (Number(right.width) || 0);
  const ry2 = ry1 + (Number(right.height) || 0);
  const intersectionWidth = Math.max(0, Math.min(lx2, rx2) - Math.max(lx1, rx1));
  const intersectionHeight = Math.max(0, Math.min(ly2, ry2) - Math.max(ly1, ry1));
  const intersection = intersectionWidth * intersectionHeight;
  const leftArea = Math.max(0, lx2 - lx1) * Math.max(0, ly2 - ly1);
  const rightArea = Math.max(0, rx2 - rx1) * Math.max(0, ry2 - ry1);
  const union = leftArea + rightArea - intersection;
  return union > 0 ? intersection / union : 0;
}

function normalizedFaceBoxDistance(left = {}, right = {}) {
  const leftBox = normalizeFaceBox(left);
  const rightBox = normalizeFaceBox(right);
  if (!leftBox || !rightBox || !leftBox.imageWidth || !leftBox.imageHeight || !rightBox.imageWidth || !rightBox.imageHeight) {
    return 1;
  }
  const leftCenterX = (leftBox.x + (leftBox.width / 2)) / leftBox.imageWidth;
  const leftCenterY = (leftBox.y + (leftBox.height / 2)) / leftBox.imageHeight;
  const rightCenterX = (rightBox.x + (rightBox.width / 2)) / rightBox.imageWidth;
  const rightCenterY = (rightBox.y + (rightBox.height / 2)) / rightBox.imageHeight;
  const leftWidth = leftBox.width / leftBox.imageWidth;
  const leftHeight = leftBox.height / leftBox.imageHeight;
  const rightWidth = rightBox.width / rightBox.imageWidth;
  const rightHeight = rightBox.height / rightBox.imageHeight;
  return Math.hypot(
    leftCenterX - rightCenterX,
    leftCenterY - rightCenterY,
    leftWidth - rightWidth,
    leftHeight - rightHeight
  );
}

function faceQualityScore({ confidence = 0, faceBox = null, imageWidth = null, imageHeight = null, vector = [] } = {}) {
  const detectionScore = clamp01(confidence || 0.75);
  const box = normalizeFaceBox(faceBox, imageWidth, imageHeight);
  let boxScore = 0.74;
  let aspectScore = 0.78;
  let edgeScore = 0.8;
  if (box?.width > 0 && box?.height > 0 && box.imageWidth > 0 && box.imageHeight > 0) {
    const faceArea = box.width * box.height;
    const imageArea = box.imageWidth * box.imageHeight;
    const faceScale = Math.sqrt(faceArea / Math.max(1, imageArea));
    boxScore = clamp01((faceScale - 0.015) / 0.16);
    const aspect = box.width / Math.max(1, box.height);
    aspectScore = clamp01(1 - (Math.abs(aspect - 0.82) / 0.9));
    const leftMargin = box.x / box.imageWidth;
    const topMargin = box.y / box.imageHeight;
    const rightMargin = (box.imageWidth - (box.x + box.width)) / box.imageWidth;
    const bottomMargin = (box.imageHeight - (box.y + box.height)) / box.imageHeight;
    edgeScore = clamp01(Math.min(leftMargin, topMargin, rightMargin, bottomMargin) / 0.035);
  }
  const magnitude = Math.sqrt((Array.isArray(vector) ? vector : []).reduce((sum, value) => {
    const number = Number(value);
    return Number.isFinite(number) ? sum + number * number : sum;
  }, 0));
  const vectorScore = magnitude > 0 ? 1 : 0.35;
  return clamp01((detectionScore * 0.38) + (boxScore * 0.28) + (aspectScore * 0.14) + (edgeScore * 0.12) + (vectorScore * 0.08));
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  clamp01,
  cosineSimilarity,
  faceBoxIoU,
  faceQualityScore,
  id,
  normalizeFaceBox,
  normalizedFaceBoxDistance,
  normalizeVector,
  nowIso,
  weightedMeanVector
};
