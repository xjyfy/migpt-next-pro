'use strict';

var chunkDJW75OG4_cjs = require('./chunk-DJW75OG4.cjs');
var chunk4RNSZ2C6_cjs = require('./chunk-4RNSZ2C6.cjs');
var utils = require('@mi-gpt/utils');
var OpenAIClient = require('openai');
var proxyAgent = require('proxy-agent');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var OpenAIClient__default = /*#__PURE__*/_interopDefault(OpenAIClient);

function logUsage(tag, usage) {
  var _a, _b;
  if (!usage) return;
  const input = usage.input_tokens ?? usage.prompt_tokens;
  const output = usage.output_tokens ?? usage.completion_tokens;
  const cached = ((_a = usage.input_tokens_details) == null ? void 0 : _a.cached_tokens) ?? ((_b = usage.prompt_tokens_details) == null ? void 0 : _b.cached_tokens) ?? usage.cached_tokens ?? usage.prompt_cache_hit_tokens;
  const parts = [`\u8F93\u5165${input ?? "?"}`, `\u8F93\u51FA${output ?? "?"}`];
  parts.push(cached === void 0 ? "\u7F13\u5B58\u5B57\u6BB5\u7F3A\u5931" : `\u7F13\u5B58\u547D\u4E2D${cached}`);
  console.log(`\u{1F4CA} ${tag} ${parts.join(" ")}`);
}
var _OpenAI = class {
  _client;
  _abortCallbacks = {};
  config = {};
  init(config) {
    var _a;
    this.config = utils.deepMerge(chunkDJW75OG4_cjs.kDefaultOpenAIConfig, config);
    this._client ??= new OpenAIClient__default.default({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      httpAgent: this.config.enableProxy ? new proxyAgent.ProxyAgent() : void 0,
      ...(_a = this.config.extra) == null ? void 0 : _a.clientOptions
    });
  }
  dispose() {
    this._client = null;
    this._abortCallbacks = {};
  }
  cancel(requestId) {
    if (requestId && this._abortCallbacks[requestId]) {
      this._abortCallbacks[requestId]();
      delete this._abortCallbacks[requestId];
    }
  }
  async chat(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const { requestId, onStream, requestOptions, createParams, onError } = options;
    let signal;
    if (requestId) {
      const controller = new AbortController();
      this._abortCallbacks[requestId] = () => controller.abort();
      signal = controller.signal;
    }
    const params = utils.deepMerge(
      {
        model: this.config.model,
        ...(_a = this.config.extra) == null ? void 0 : _a.createParams
      },
      createParams
    );
    const mergedRequestOptions = utils.deepMerge(
      {
        ...(_b = this.config.extra) == null ? void 0 : _b.requestOptions
      },
      { ...requestOptions, signal }
    );
    let fallbackNotice = "";
    const webSearch = this.config.webSearch;
    const webSearchEnabled = !params.stream && (webSearch == null ? void 0 : webSearch.enabled) && (webSearch.strategy === "auto" || chunk4RNSZ2C6_cjs.shouldUseWebSearch(params.messages, {
      ageBand: webSearch.ageBand,
      patterns: webSearch.patterns
    }));
    if (webSearchEnabled) {
      try {
        const searchTool = { type: "web_search" };
        if (webSearch == null ? void 0 : webSearch.maxKeyword) searchTool.max_keyword = webSearch.maxKeyword;
        if (webSearch == null ? void 0 : webSearch.limit) searchTool.limit = webSearch.limit;
        if (((_c = webSearch == null ? void 0 : webSearch.userLocation) == null ? void 0 : _c.region) || ((_d = webSearch == null ? void 0 : webSearch.userLocation) == null ? void 0 : _d.city)) {
          searchTool.user_location = webSearch.userLocation;
        }
        const responsesParams = {
          model: params.model,
          input: params.messages,
          tools: [searchTool],
          tool_choice: "auto",
          // 火山方舟：Responses API 用 reasoning.effort 控制深度思考，
          // minimal 即关闭思考直接回答，避免语音场景等待过长。
          reasoning: { effort: "minimal" }
        };
        if (webSearch == null ? void 0 : webSearch.maxToolCalls) {
          responsesParams.max_tool_calls = webSearch.maxToolCalls;
        }
        const response = await this._client.responses.create(
          responsesParams,
          mergedRequestOptions
        );
        logUsage("Responses", response == null ? void 0 : response.usage);
        const result2 = chunk4RNSZ2C6_cjs.parseWebSearchResponse(response);
        if (!result2.text) {
          throw new Error("Responses API \u672A\u8FD4\u56DE\u53EF\u64AD\u653E\u7684\u6587\u5B57");
        }
        if (result2.searched) {
          if (result2.sources.length > 0) {
            console.log(
              "\u{1F310} \u8054\u7F51\u6765\u6E90\uFF1A",
              result2.sources.map((source) => `${source.title}: ${source.url}`).join("\n")
            );
          } else {
            console.log("\u{1F310} \u5DF2\u4F7F\u7528\u8054\u7F51\u641C\u7D22");
          }
        }
        if (requestId) {
          delete this._abortCallbacks[requestId];
        }
        return result2.text;
      } catch (error) {
        if (signal == null ? void 0 : signal.aborted) {
          if (requestId) {
            delete this._abortCallbacks[requestId];
          }
          return "";
        }
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\u274C \u8054\u7F51\u641C\u7D22\u5F02\u5E38\uFF0C\u5C06\u4F7F\u7528\u666E\u901A\u6A21\u578B\u56DE\u7B54\uFF1A${message}`);
        fallbackNotice = ((_e = this.config.webSearch) == null ? void 0 : _e.fallbackNotice) ?? "";
      }
    }
    const res = await this._client.chat.completions.create(
      params,
      mergedRequestOptions
    ).catch(async (e) => {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`\u274C LLM \u54CD\u5E94\u5F02\u5E38\uFF1A${message}`);
      await (onError == null ? void 0 : onError(e));
      return null;
    });
    let result = "";
    if (params.stream) {
      for await (const chunk of res ?? []) {
        const text = ((_g = (_f = chunk.choices[0]) == null ? void 0 : _f.delta) == null ? void 0 : _g.content) || "";
        const aborted = requestId && !Object.keys(this._abortCallbacks).includes(requestId);
        if (aborted) {
          result = "";
          break;
        }
        if (text) {
          result += text;
          onStream == null ? void 0 : onStream(text);
        }
      }
    } else {
      result = ((_j = (_i = (_h = res == null ? void 0 : res.choices) == null ? void 0 : _h[0]) == null ? void 0 : _i.message) == null ? void 0 : _j.content) ?? "";
      logUsage("Chat", res == null ? void 0 : res.usage);
      if (fallbackNotice && result) {
        result = `${fallbackNotice}${result}`;
      }
    }
    if (requestId) {
      delete this._abortCallbacks[requestId];
    }
    return result;
  }
};
var OpenAI = new _OpenAI();

Object.defineProperty(exports, "parseWebSearchResponse", {
  enumerable: true,
  get: function () { return chunk4RNSZ2C6_cjs.parseWebSearchResponse; }
});
Object.defineProperty(exports, "sanitizeWebSearchText", {
  enumerable: true,
  get: function () { return chunk4RNSZ2C6_cjs.sanitizeWebSearchText; }
});
Object.defineProperty(exports, "shouldUseWebSearch", {
  enumerable: true,
  get: function () { return chunk4RNSZ2C6_cjs.shouldUseWebSearch; }
});
exports.OpenAI = OpenAI;
