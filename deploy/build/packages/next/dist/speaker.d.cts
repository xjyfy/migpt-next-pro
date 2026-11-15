import { ISpeaker } from '@mi-gpt/engine/base';

declare class SpeakerManager implements ISpeaker {
    /**
     * 播放文字、音频链接
     */
    play({ text, url }?: {
        text?: string;
        url?: string;
    }): Promise<boolean>;
    /**
     * 中断原来小爱的运行
     */
    abortXiaoAI(): Promise<boolean>;
}
declare const MiSpeaker: SpeakerManager;

export { MiSpeaker };
