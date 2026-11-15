import { IMessage } from '@mi-gpt/chat';

interface ConversationRecord {
    answers: Array<{
        type: string;
        tts?: {
            text?: string;
        };
        llm?: {
            text?: string;
        };
    }>;
    query: string;
    requestId?: string;
    time: number;
}
interface MiMessageManagerOptions {
    getConversations?: (options?: {
        limit?: number;
        timestamp?: number;
    }) => Promise<{
        records: ConversationRecord[];
    } | undefined> | undefined;
    sleep?: (milliseconds: number) => Promise<void>;
    pendingPollInterval?: number;
    pendingPollTimeout?: number;
}
declare class MiMessageManager {
    private _lastQueryMsg?;
    private _tempQueryMsgs;
    private readonly _getConversations;
    private readonly _sleep;
    private readonly _pendingPollInterval;
    private readonly _pendingPollTimeout;
    /** 实际等待上限（ms），日志与等待循环共用同一值 */
    private readonly _pendingPollTimeoutCap;
    constructor(options?: MiMessageManagerOptions);
    fetchNextMessage(): Promise<IMessage | undefined>;
    private _fetchFirstMessage;
    private _fetchNextMessage;
    /**
     * 拉取最新的 2 条消息，用于和上一条消息比对是否连续
     */
    private _fetchNext2Messages;
    private _hasNativeAnswer;
    private _waitForNativeAnswer;
    /**
     * 放行后的观察（只记录日志，不改变任何行为）：
     * 用来量化"900ms 阈值"的误判情况——
     * - 若 1.6s 内文本才到，说明是网络抖动导致的误判（小爱其实能答）
     * - 若始终无文本，判定为技能流/指令，符合预期
     */
    private _watchLateNativeAnswer;
    /**
     * 继续向上拉取其他新消息
     */
    private _fetchNextRemainingMessages;
    /**
     * 读取暂存的消息
     */
    private _fetchNextTempMessage;
    private _fetchHistoryMsgs;
}
declare const MiMessage: MiMessageManager;

export { MiMessage, MiMessageManager };
