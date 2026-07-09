'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');

const GREETINGS = new Set(['hi', 'hello', 'hey']);
const FEEDBACK = new Set(['good', 'bad', 'wrong', 'correct', 'thanks', 'thank']);
const CORRECTIONS = new Set(['actually', 'instead', 'correction']);

class ConversationClassifier extends BaseSemanticAnalyzer {
  analyze(context) {
    const tokens = (context.linguisticGraph?.tokens || []).map(token => token.lower);
    const hasQuestion = (context.linguisticGraph?.questions || []).length > 0;
    let type = 'conversation';
    let confidence = 0.55;
    if (tokens.some(token => GREETINGS.has(token))) {
      type = 'greeting';
      confidence = 0.82;
    } else if (tokens.some(token => CORRECTIONS.has(token))) {
      type = 'correction';
      confidence = 0.72;
    } else if (tokens.some(token => FEEDBACK.has(token))) {
      type = 'feedback';
      confidence = 0.68;
    } else if (hasQuestion) {
      type = 'question';
      confidence = 0.8;
    } else if ((context.concepts || []).length > 0) {
      type = 'command';
      confidence = 0.62;
    }
    context.conversationType = { type, confidence, source: 'semantic.conversationClassifier' };
    return context;
  }
}

module.exports = ConversationClassifier;
