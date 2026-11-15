import { Prettify } from '@mi-gpt/utils/typing';
import { RequestOptions } from 'openai/core';
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { OpenAIConfig } from './config.cjs';
export { WebSearchResult, WebSearchSource, parseWebSearchResponse, sanitizeWebSearchText, shouldUseWebSearch } from './web-search.cjs';
import 'openai';

declare class _OpenAI {
    private _client?;
    private _abortCallbacks;
    config: OpenAIConfig;
    init(config?: OpenAIConfig): void;
    dispose(): void;
    cancel(requestId?: string): void;
    chat(options: {
        requestId?: string;
        onStream?: (text: string) => void;
        onError?: (error: Error) => Promise<void>;
        requestOptions?: Prettify<RequestOptions>;
        createParams: Prettify<Partial<ChatCompletionCreateParamsBase>>;
    }): Promise<string>;
}
declare const OpenAI: _OpenAI;

export { OpenAI };
