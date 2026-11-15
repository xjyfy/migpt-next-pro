import { kDefaultWebSearchPatterns } from './chunk-QXHDY2X7.js';

// src/config.ts
var kDefaultOpenAIConfig = {
  enableProxy: false,
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "sk-1234567890",
  webSearch: {
    enabled: false,
    strategy: "hybrid",
    fallbackNotice: "\u8054\u7F51\u641C\u7D22\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u4EE5\u4E0B\u5185\u5BB9\u53EF\u80FD\u4E0D\u662F\u6700\u65B0\u3002",
    ageBand: "junior",
    maxKeyword: 1,
    limit: 5,
    maxToolCalls: 1,
    userLocation: { type: "approximate" },
    patterns: { ...kDefaultWebSearchPatterns }
  },
  extra: {
    clientOptions: {},
    createParams: {},
    requestOptions: {}
  }
};

export { kDefaultOpenAIConfig };
