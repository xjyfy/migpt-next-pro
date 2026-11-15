'use strict';

// src/web-search.ts
var kDefaultWebSearchPatterns = {
  explicit: "\u8054\u7F51|\u4E0A\u7F51|\u7F51\u4E0A|\u641C\u7D22|\u641C\u4E00\u4E0B|\u641C\u4E0B|\u67E5\u4E00\u4E0B|\u67E5\u4E0B|\u6700\u65B0\u6D88\u606F",
  freshness: "\u4ECA\u5929|\u4ECA\u65E5|\u73B0\u5728|\u5F53\u524D|\u76EE\u524D|\u6B64\u523B|\u6700\u65B0|\u6700\u8FD1|\u8FD1\u671F|\u672C\u5468|\u8FD9\u5468|\u672C\u6708|\u8FD9\u4E2A\u6708|\u4ECA\u5E74|\u660E\u5929|\u540E\u5929|\u6628\u5929|\u5B9E\u65F6|\u521A\u521A|\u521A\u624D",
  topic: "\u4EF7\u683C|\u591A\u5C11\u94B1|\u62A5\u4EF7|\u552E\u4EF7|\u80A1\u4EF7|\u80A1\u7968|\u5927\u76D8|\u6307\u6570|\u6C47\u7387|\u91D1\u4EF7|\u6CB9\u4EF7|\u7968\u4EF7|\u673A\u7968|\u706B\u8F66\u7968|\u6BD4\u5206|\u8D5B\u679C|\u8D5B\u7A0B|\u79EF\u5206\u699C|\u6392\u540D|\u5F00\u552E|\u53D1\u552E|\u4E0A\u5E02|\u5E93\u5B58|\u8865\u8D27|\u7248\u672C|\u66F4\u65B0|\u5347\u7EA7|\u53D1\u5E03\u65F6\u95F4|\u65B0\u89C4|\u9650\u884C|\u8DEF\u51B5|\u822A\u73ED|\u73ED\u6B21|\u8425\u4E1A\u65F6\u95F4|\u5F00\u653E\u65F6\u95F4|\u4E0A\u6620|\u6392\u7247|\u8003\u8BD5\u65F6\u95F4|\u62A5\u540D\u65F6\u95F4|\u653E\u5047|\u5F00\u5B66",
  newsTopic: "\u65B0\u95FB|\u65F6\u4E8B|\u65F6\u653F|\u56FD\u9645|\u56FD\u5185|\u7ECF\u6D4E|\u8D22\u7ECF|\u6C11\u751F|\u70ED\u70B9|\u70ED\u641C|\u5934\u6761|\u653F\u7B56|\u53D1\u5E03\u4F1A|\u79D1\u6280\u52A8\u6001|\u884C\u4E1A\u52A8\u6001",
  danger: "",
  alwaysBlock: "\u8272\u60C5|\u88F8|\u6210\u4EBA\u89C6\u9891|\u6027\u884C\u4E3A|\u81EA\u6740|\u81EA\u6B8B|\u5272\u8155|\u8840\u8165|\u788E\u5C38|\u5C38\u4F53|\u6740\u4EBA\u624B\u6CD5|\u600E\u4E48\u6740\u4EBA|\u6BD2\u54C1|\u5438\u6BD2|\u51B0\u6BD2|\u8D4C\u535A|\u535A\u5F69|\u836F\u91CF|\u8FC7\u91CF\u670D\u836F|\u5236\u4F5C\u70B8\u5F39|\u9020\u70B8\u836F|\u67AA\u652F|\u6539\u88C5\u67AA"
};
var kRegexCache = /* @__PURE__ */ new Map();
function toRegex(pattern) {
  const source = (pattern ?? "").trim();
  if (!source) return null;
  if (kRegexCache.has(source)) return kRegexCache.get(source);
  let regex = null;
  try {
    regex = new RegExp(`(?:${source})`, "i");
  } catch (error) {
    console.warn(
      `\u26A0\uFE0F \u8054\u7F51\u8BCD\u8868\u6B63\u5219\u65E0\u6548\uFF0C\u5DF2\u5FFD\u7565\uFF1A${source}\uFF08${error instanceof Error ? error.message : error}\uFF09`
    );
  }
  kRegexCache.set(source, regex);
  return regex;
}
function shouldUseWebSearch(messages, options = {}) {
  var _a, _b, _c, _d, _e;
  let text = "";
  for (let index = messages.length - 1; index >= 0; index--) {
    if (((_a = messages[index]) == null ? void 0 : _a.role) === "user" && typeof ((_b = messages[index]) == null ? void 0 : _b.content) === "string") {
      text = messages[index].content.trim();
      break;
    }
  }
  if (!text) return false;
  const patterns = { ...kDefaultWebSearchPatterns, ...options.patterns };
  const ageBand = options.ageBand ?? "junior";
  if ((_c = toRegex(patterns.danger)) == null ? void 0 : _c.test(text)) return false;
  if ((_d = toRegex(patterns.alwaysBlock)) == null ? void 0 : _d.test(text)) return false;
  const newsTopic = toRegex(patterns.newsTopic);
  if (ageBand === "primary" && (newsTopic == null ? void 0 : newsTopic.test(text))) return false;
  if ((_e = toRegex(patterns.explicit)) == null ? void 0 : _e.test(text)) return true;
  const topic = toRegex(patterns.topic);
  const freshness = toRegex(patterns.freshness);
  if ((topic == null ? void 0 : topic.test(text)) && (freshness == null ? void 0 : freshness.test(text))) return true;
  if (ageBand === "junior" && (newsTopic == null ? void 0 : newsTopic.test(text)) && (freshness == null ? void 0 : freshness.test(text))) return true;
  return false;
}
function sanitizeWebSearchText(text) {
  return text.replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, "").replace(/【[^\]]*?†[^\]]*?】/g, "").replace(/\s+/g, " ").trim();
}
function parseWebSearchResponse(response) {
  var _a, _b;
  const output = Array.isArray(response == null ? void 0 : response.output) ? response.output : [];
  const searched = output.some((item) => (item == null ? void 0 : item.type) === "web_search_call");
  const sources = [];
  const contentTexts = [];
  for (const item of output) {
    if ((item == null ? void 0 : item.type) !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if ((content == null ? void 0 : content.type) === "output_text" && typeof content.text === "string") {
        contentTexts.push(content.text);
      }
      for (const annotation of (content == null ? void 0 : content.annotations) ?? []) {
        if ((annotation == null ? void 0 : annotation.type) !== "url_citation") continue;
        const url = annotation.url ?? ((_a = annotation.url_citation) == null ? void 0 : _a.url);
        const title = annotation.title ?? ((_b = annotation.url_citation) == null ? void 0 : _b.title) ?? url;
        if (typeof url === "string" && url) {
          sources.push({ title: String(title), url });
        }
      }
    }
  }
  const uniqueSources = sources.filter(
    (source, index) => sources.findIndex((candidate) => candidate.url === source.url) === index
  );
  const rawText = typeof (response == null ? void 0 : response.output_text) === "string" && response.output_text ? response.output_text : contentTexts.join("\n");
  return {
    text: sanitizeWebSearchText(rawText),
    searched,
    sources: uniqueSources
  };
}

exports.kDefaultWebSearchPatterns = kDefaultWebSearchPatterns;
exports.parseWebSearchResponse = parseWebSearchResponse;
exports.sanitizeWebSearchText = sanitizeWebSearchText;
exports.shouldUseWebSearch = shouldUseWebSearch;
