import type { DeepPartial, Prettify } from '@mi-gpt/utils/typing';
import type { ClientOptions } from 'openai';
import type { RequestOptions } from 'openai/core';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { type WebSearchPatterns, kDefaultWebSearchPatterns } from './web-search.js';

export type OpenAIConfig = DeepPartial<{
  /**
   * 是否启用代理
   *
   * 默认：false
   */
  enableProxy: boolean;
  /**
   * 你的大模型服务提供商的接口地址
   *
   * 支持兼容 OpenAI 接口的大模型服务，比如：DeepSeek V3 等
   *
   * 注意：一般以 /v1 结尾，不包含 /chat/completions 部分
   * - ✅ https://api.openai.com/v1
   * - ❌ https://api.openai.com/v1/（最后多了一个 /）
   * - ❌ https://api.openai.com/v1/chat/completions（不需要加 /chat/completions）
   */
  baseURL: string;
  /**
   * 密钥
   *
   * 示例：sk-1234567890
   */
  apiKey: string;
  /**
   * 模型
   *
   * 默认：gpt-4o-mini
   */
  model: string;
  /**
   * 火山方舟 Responses API 内置联网搜索。
   *
   * 开启后由本地词表（hybrid）或模型（auto）判断当前问题是否需要搜索。
   */
  webSearch: {
    enabled: boolean;
    /** `hybrid` 先本地判断时效性，`auto` 则每次都交给模型判断。 */
    strategy: 'auto' | 'hybrid';
    /** Responses 或搜索失败时，普通模型回答前的提示。 */
    fallbackNotice: string;
    /** 词表档位：`primary` 6~11 岁（不触发新闻时政）｜`junior` 12~15 岁（放开时政）。 */
    ageBand: 'primary' | 'junior';
    /** 单轮最多几个搜索关键词（火山 `tools.max_keyword`，控制计费）。 */
    maxKeyword: number;
    /** 单次搜索返回多少条结果（火山 `tools.limit`）。 */
    limit: number;
    /** 整次响应最多几轮工具调用（火山 `max_tool_calls`，语音场景建议 1）。 */
    maxToolCalls: number;
    /** 搜索地域，用于改写关键词（火山 `tools.user_location`）。 */
    userLocation: { type: string; country?: string; region?: string; city?: string };
    /** 联网触发词表，支持只覆盖其中几项。 */
    patterns: Partial<WebSearchPatterns>;
  };
  /**
   * 扩展配置
   */
  extra: {
    clientOptions: Prettify<ClientOptions>;
    createParams: Prettify<ChatCompletionCreateParamsBase>;
    requestOptions: Prettify<RequestOptions>;
  };
}>;

export const kDefaultOpenAIConfig: OpenAIConfig = {
  enableProxy: false,
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: 'sk-1234567890',
  webSearch: {
    enabled: false,
    strategy: 'hybrid',
    fallbackNotice: '联网搜索暂时不可用，以下内容可能不是最新。',
    ageBand: 'junior',
    maxKeyword: 1,
    limit: 5,
    maxToolCalls: 1,
    userLocation: { type: 'approximate' },
    patterns: { ...kDefaultWebSearchPatterns },
  },
  extra: {
    clientOptions: {},
    createParams: {},
    requestOptions: {},
  },
};
