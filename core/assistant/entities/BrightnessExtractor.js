'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class BrightnessExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.text(context);
    const match = text.match(/\b(?:brightness|screen|display)\b.*?\b(\d{1,3})\s*%?\b/i) || text.match(/\b(\d{1,3})\s*%?\s+(?:brightness|screen|display)\b/i);
    if (match) this.addEntity(context, 'brightnessLevel', Math.min(100, Number(match[1])), { confidence: 0.86, metadata: { control: 'brightness' } });
    if (/\b(?:max|maximum|full)\s+(?:brightness|screen|display)\b/i.test(text)) this.addEntity(context, 'brightnessLevel', 100, { confidence: 0.82, metadata: { control: 'brightness' } });
    if (/\b(?:minimum|zero|dim)\s+(?:brightness|screen|display)?\b/i.test(text)) this.addEntity(context, 'brightnessLevel', 0, { confidence: 0.72, metadata: { control: 'brightness' } });
    return context;
  }
}

module.exports = BrightnessExtractor;
