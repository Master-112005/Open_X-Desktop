'use strict';

const VISION_ENGINE_VERSION = '4.0.0';

const MODEL_IDS = Object.freeze({
  MOBILE_CLIP: 'mobileclip-s2',
  SCRFD: 'scrfd',
  MOBILE_FACE_NET: 'mobilefacenet',
  PADDLE_OCR: 'paddleocr'
});

const CAPABILITIES = Object.freeze({
  IMAGE_EMBEDDING: 'image-embedding',
  IMAGE_TEXT_SIMILARITY: 'image-text-similarity',
  SCENE_UNDERSTANDING: 'scene-understanding',
  OBJECT_UNDERSTANDING: 'object-understanding',
  FACE_DETECTION: 'face-detection',
  FACE_EMBEDDING: 'face-embedding',
  OCR: 'ocr'
});

const MODEL_STATES = Object.freeze({
  REGISTERED: 'registered',
  LOADING: 'loading',
  READY: 'ready',
  PAUSED: 'paused',
  UNLOADING: 'unloading',
  UNLOADED: 'unloaded',
  ERROR: 'error'
});

const ENGINE_STATES = Object.freeze({
  CREATED: 'created',
  INITIALIZING: 'initializing',
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  SHUTDOWN: 'shutdown',
  ERROR: 'error'
});

const VisionEngineContract = Object.freeze({
  lifecycle: Object.freeze(['initialize', 'infer', 'pause', 'resume', 'shutdown', 'healthCheck']),
  forbiddenResponsibilities: Object.freeze([
    'natural-language-understanding',
    'photo-search',
    'candidate-filtering',
    'gallery-management',
    'assistant-response-generation',
    'face-naming',
    'embedding-storage'
  ])
});

module.exports = Object.freeze({
  VISION_ENGINE_VERSION,
  MODEL_IDS,
  CAPABILITIES,
  MODEL_STATES,
  ENGINE_STATES,
  VisionEngineContract
});
