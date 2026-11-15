import { deepMerge } from '@mi-gpt/utils';
import type { Prettify } from '@mi-gpt/utils/typing';
import OpenAIClient from 'openai';
import type { RequestOptions } from 'openai/core';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { ProxyAgent } from 'proxy-agent';
import { type OpenAIConfig, kDefaultOpenAIConfig } from './config.js';
import { parseWebSearchResponse, shouldUseWebSearch } from './web-search.js';

export {
  parseWebSearchResponse,
  sanitizeWebSearchText,
  shouldUseWebSearch,
} from './web-search.js';
export type { WebSearchResult, WebSearchSource } from './web-search.js';

/**
 * 打印本次调用的 token 用量，用于观察隐式缓存/联网是否生效。
 * 不同厂商字段名不一致，这里把常见的几种都试一遍。
 */
function logUsage(tag: string, usage: any) {
  if (!usage) return;
  const input = usage.input_tokens ?? usage.prompt_tokens;
  const output = usage.output_tokens ?? usage.completion_tokens;
  const cached =
    usage.input_tokens_details?.cached_tokens ??
    usage.prompt_tokens_details?.cached_tokens ??
    usage.cached_tokens ??
    usage.prompt_cache_hit_tokens;
  const parts = [`输入${input ?? '?'}`, `输出${output ?? '?'}`];
  parts.push(cached === undefined ? '缓存字段缺失' : `缓存命中${cached}`);
  console.log(`📊 ${tag} ${parts.join(' ')}`);
}

class _OpenAI {
  private _client?: OpenAIClient;
  private _abortCallbacks: Record<string, VoidFunction> = {};

  config: OpenAIConfig = {};

  init(config?: OpenAIConfig) {
    this.config = deepMerge(kDefaultOpenAIConfig, config);
    this._client ??= new OpenAIClient({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      httpAgent: this.config.enableProxy ? new ProxyAgent() : undefined,
      ...(this.config.extra?.clientOptions as any),
    });
  }

  dispose() {
    this._client = null as any;
    this._abortCallbacks = {};
  }

  cancel(requestId?: string) {
    if (requestId && this._abortCallbacks[requestId]) {
      this._abortCallbacks[requestId]();
      delete this._abortCallbacks[requestId];
    }
  }

  async chat(options: {
    requestId?: string;
    onStream?: (text: string) => void;
    onError?: (error: Error) => Promise<void>;
    requestOptions?: Prettify<RequestOptions>;
    createParams: Prettify<Partial<ChatCompletionCreateParamsBase>>;
  }) {
    const { requestId, onStream, requestOptions, createParams, onError } = options;

    let signal: AbortSignal | undefined;
    if (requestId) {
      const controller = new AbortController();
      this._abortCallbacks[requestId] = () => controller.abort();
      signal = controller.signal;
    }

    const params = deepMerge(
      {
        model: this.config.model,
        ...(this.config.extra?.createParams as any),
      },
      createParams,
    );

    const mergedRequestOptions = deepMerge(
      {
        ...(this.config.extra?.requestOptions as any),
      },
      { ...requestOptions, signal },
    );

    let fallbackNotice = '';
    const webSearch = this.config.webSearch;
    const webSearchEnabled =
      !params.stream &&
      webSearch?.enabled &&
      (webSearch.strategy === 'auto' ||
        shouldUseWebSearch(params.messages as any[], {
          ageBand: webSearch.ageBand,
          patterns: webSearch.patterns,
        }));
    if (webSearchEnabled) {
      try {
        // 火山方舟联网内容插件只支持 Responses API；不传 sources 时默认走全网搜索，
        // 从而避开 douyin / moji / toutiao 这三个额外付费源。
        const searchTool: Record<string, any> = { type: 'web_search' };
        if (webSearch?.maxKeyword) searchTool.max_keyword = webSearch.maxKeyword;
        if (webSearch?.limit) searchTool.limit = webSearch.limit;
        if (webSearch?.userLocation?.region || webSearch?.userLocation?.city) {
          searchTool.user_location = webSearch.userLocation;
        }
        const responsesParams: Record<string, any> = {
          model: params.model!,
          input: params.messages as any,
          tools: [searchTool],
          tool_choice: 'auto',
          // 火山方舟：Responses API 用 reasoning.effort 控制深度思考，
          // minimal 即关闭思考直接回答，避免语音场景等待过长。
          reasoning: { effort: 'minimal' },
        };
        if (webSearch?.maxToolCalls) {
          responsesParams.max_tool_calls = webSearch.maxToolCalls;
        }

        const response = await this._client!.responses.create(
          responsesParams as any,
          mergedRequestOptions,
        );
        logUsage('Responses', (response as any)?.usage);
        const result = parseWebSearchResponse(response);
        if (!result.text) {
          throw new Error('Responses API 未返回可播放的文字');
        }
        if (result.searched) {
          if (result.sources.length > 0) {
            console.log(
              '🌐 联网来源：',
              result.sources.map((source) => `${source.title}: ${source.url}`).join('\n'),
            );
          } else {
            console.log('🌐 已使用联网搜索');
          }
        }
        if (requestId) {
          delete this._abortCallbacks[requestId];
        }
        return result.text;
      } catch (error) {
        if (signal?.aborted) {
          if (requestId) {
            delete this._abortCallbacks[requestId];
          }
          return '';
        }
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ 联网搜索异常，将使用普通模型回答：${message}`);
        fallbackNotice = this.config.webSearch?.fallbackNotice ?? '';
      }
    }

    const res = await this._client!.chat.completions.create(params, mergedRequestOptions).catch(
      async (e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`❌ LLM 响应异常：${message}`);
        await onError?.(e);
        return null;
      },
    );

    let result = '';

    if (params.stream) {
      for await (const chunk of (res ?? []) as any) {
        const text = chunk.choices[0]?.delta?.content || '';
        const aborted = requestId && !Object.keys(this._abortCallbacks).includes(requestId);
        if (aborted) {
          result = '';
          break;
        }
        if (text) {
          result += text;
          onStream?.(text);
        }
      }
    } else {
      result = res?.choices?.[0]?.message?.content ?? '';
      logUsage('Chat', (res as any)?.usage);
      if (fallbackNotice && result) {
        result = `${fallbackNotice}${result}`;
      }
    }

    if (requestId) {
      delete this._abortCallbacks[requestId];
    }

    return result;
  }
}

export const OpenAI = new _OpenAI();
