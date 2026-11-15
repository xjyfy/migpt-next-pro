'use strict';

// src/native-answer.ts
function extractNativeAnswer(record) {
  var _a, _b, _c, _d;
  const answer = record.answers[0];
  if ((answer == null ? void 0 : answer.type) === "TTS") {
    const text = (_b = (_a = answer.tts) == null ? void 0 : _a.text) == null ? void 0 : _b.trim();
    return text ? { text, type: "TTS" } : void 0;
  }
  if ((answer == null ? void 0 : answer.type) === "LLM") {
    const text = (_d = (_c = answer.llm) == null ? void 0 : _c.text) == null ? void 0 : _d.trim();
    return text ? { text, type: "LLM" } : void 0;
  }
  return void 0;
}

exports.extractNativeAnswer = extractNativeAnswer;
