import { IMessage } from '@mi-gpt/chat';
import { ChatConfig } from '@mi-gpt/chat/config';
import { BaseEngine, IReply } from './base.cjs';
import '@mi-gpt/stream';

type EngineConfig<E extends BaseEngine> = ChatConfig & {
    debug?: boolean;
    /**
     * 唤醒词
     *
     * 当消息以唤醒词开头时，会调用 AI 来响应用户消息
     *
     * 比如：请，你
     */
    callAIKeywords?: string[];
    /**
     * 自定义消息处理钩子
     */
    onMessage?: (engine: E, msg: IMessage) => Promise<IReply | undefined>;
};
declare abstract class MiGPTEngine extends BaseEngine {
    config: EngineConfig<this>;
    start(config?: EngineConfig<this>): Promise<void>;
    stop(): Promise<void>;
    lastMsg?: IMessage;
    onMessage(msg: IMessage): Promise<void>;
    askAI(msg: IMessage, options?: {
        stream?: boolean;
    }): Promise<IReply>;
    private _response;
    private _hasNewMsg;
}

export { type EngineConfig, MiGPTEngine };
