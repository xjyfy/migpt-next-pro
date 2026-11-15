interface WebSearchSource {
    title: string;
    url: string;
}
interface WebSearchResult {
    text: string;
    searched: boolean;
    sources: WebSearchSource[];
}
/**
 * 联网触发词表。
 *
 * 三段式判定：硬排除 → 显式求助 → 时效主题 × 时间词。
 * 所有表都是"以 | 分隔的正则片段"，可直接写在 config.js 里，改词不用重建镜像。
 */
interface WebSearchPatterns {
    /** 用户明确要求上网查：联网/搜索/查一下… */
    explicit: string;
    /** 时间词：只是必要条件，单独不触发 */
    freshness: string;
    /** 中性时效主题：价格/比分/版本/限行… */
    topic: string;
    /** 新闻时政主题：仅 junior 档放开 */
    newsTopic: string;
    /** 危险主题：不看小爱原生回答，且不联网 */
    danger: string;
    /** 绝对排除：任何档位都不联网 */
    alwaysBlock: string;
}
declare const kDefaultWebSearchPatterns: WebSearchPatterns;
interface WebSearchOptions {
    /** `primary`（6~11 岁，不触发新闻时政）｜`junior`（12~15 岁，放开时政） */
    ageBand?: 'primary' | 'junior';
    patterns?: Partial<WebSearchPatterns>;
}
/**
 * Decide locally whether the latest user question needs fresh external information.
 *
 * 顺序不能改：危险/绝对排除优先，其次显式求助，最后才是"主题 × 时间"的组合判定。
 * 组合判定是为了避免"新闻是什么""天气原理"这类定义性问题被拖进搜索。
 */
declare function shouldUseWebSearch(messages: any[], options?: WebSearchOptions): boolean;
/**
 * Remove links and provider citation markers that should not be read aloud by TTS.
 */
declare function sanitizeWebSearchText(text: string): string;
/**
 * Normalize the Responses API payload into text suitable for speech plus log-only sources.
 */
declare function parseWebSearchResponse(response: any): WebSearchResult;

export { type WebSearchOptions, type WebSearchPatterns, type WebSearchResult, type WebSearchSource, kDefaultWebSearchPatterns, parseWebSearchResponse, sanitizeWebSearchText, shouldUseWebSearch };
