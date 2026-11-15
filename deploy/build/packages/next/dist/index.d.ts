import * as _mi_gpt_miot from '@mi-gpt/miot';
import { IMessage } from '@mi-gpt/chat';
import { IReply } from '@mi-gpt/engine/base';
import { EngineConfig, MiGPTEngine } from '@mi-gpt/engine/index';
import { Prettify, DeepPartial } from '@mi-gpt/utils/typing';
import { MiServiceConfig } from './service.js';
export { NativeAnswer, extractNativeAnswer } from './native-answer.js';

type MiGPTConfig = Prettify<EngineConfig<MiJiaEngine> & DeepPartial<{
    debug: boolean;
    speaker: MiServiceConfig & {
        /**
         * 消息轮询间隔（毫秒）
         *
         * 默认 1000（最低 1 秒）
         */
        heartbeat?: number;
    };
}>>;
declare class MiJiaEngine extends MiGPTEngine {
    #private;
    config: MiGPTConfig;
    speaker: {
        play({ text, url }?: {
            text?: string;
            url?: string;
        }): Promise<boolean>;
        abortXiaoAI(): Promise<boolean>;
    };
    get MiNA(): _mi_gpt_miot.MiNA;
    get MiOT(): _mi_gpt_miot.MIoT;
    start(config: MiGPTConfig): Promise<void>;
    askAI(msg: IMessage): Promise<IReply>;
}
declare const MiGPT: MiJiaEngine;

export { MiGPT, type MiGPTConfig };
