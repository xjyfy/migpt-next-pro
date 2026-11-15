import { randomUUID } from 'node:crypto';
import type { IMessage } from '@mi-gpt/chat';
import { firstOf, lastOf, sleep } from '@mi-gpt/utils';
import { extractNativeAnswer } from './native-answer.js';
import { MiService } from './service.js';

interface ConversationRecord {
  answers: Array<{
    type: string;
    tts?: { text?: string };
    llm?: { text?: string };
  }>;
  query: string;
  requestId?: string;
  time: number;
}

interface MiMessageManagerOptions {
  getConversations?: (options?: {
    limit?: number;
    timestamp?: number;
  }) => Promise<{ records: ConversationRecord[] } | undefined> | undefined;
  sleep?: (milliseconds: number) => Promise<void>;
  pendingPollInterval?: number;
  pendingPollTimeout?: number;
}

export class MiMessageManager {
  private _lastQueryMsg?: IMessage;
  private _tempQueryMsgs: IMessage[] = [];
  private readonly _getConversations: NonNullable<MiMessageManagerOptions['getConversations']>;
  private readonly _sleep: NonNullable<MiMessageManagerOptions['sleep']>;
  private readonly _pendingPollInterval: number;
  private readonly _pendingPollTimeout: number;
  /** 实际等待上限（ms），日志与等待循环共用同一值 */
  private readonly _pendingPollTimeoutCap: number;

  constructor(options: MiMessageManagerOptions = {}) {
    this._getConversations =
      options.getConversations ?? ((request) => MiService.MiNA?.getConversations(request));
    this._sleep = options.sleep ?? sleep;
    this._pendingPollInterval = Math.max(50, options.pendingPollInterval ?? 100);
    this._pendingPollTimeout = Math.max(
      this._pendingPollInterval,
      options.pendingPollTimeout ?? 2000,
    );
    // L05B 上原逻辑等 2s 会漏出半句"我还回答不上"，故压到 900ms
    this._pendingPollTimeoutCap = Math.min(this._pendingPollTimeout, 900);
  }

  async fetchNextMessage(): Promise<IMessage | undefined> {
    if (!this._lastQueryMsg) {
      return this._fetchFirstMessage();
    }
    return this._fetchNextMessage();
  }

  private async _fetchFirstMessage() {
    const msgs = await this._fetchHistoryMsgs({
      limit: 1,
      filterAnswer: false,
    });
    this._lastQueryMsg = msgs[0];
    return undefined;
  }

  private async _fetchNextMessage(): Promise<IMessage | undefined> {
    if (this._tempQueryMsgs.length > 0) {
      // 当前有暂存的新消息（从新到旧），依次处理之
      return this._fetchNextTempMessage();
    }
    // 拉取最新的 2 条 msg（用于和上一条消息比对是否连续）
    const nextMsg = await this._fetchNext2Messages();
    if (nextMsg !== 'continue') {
      return nextMsg;
    }
    // 继续向上拉取其他新消息
    return this._fetchNextRemainingMessages();
  }

  /**
   * 拉取最新的 2 条消息，用于和上一条消息比对是否连续
   */
  private async _fetchNext2Messages() {
    let msgs = await this._fetchHistoryMsgs({ limit: 2, filterAnswer: false });
    const newest = firstOf(msgs);
    if (
      newest &&
      newest.timestamp > this._lastQueryMsg!.timestamp &&
      !this._hasNativeAnswer(newest)
    ) {
      const completed = await this._waitForNativeAnswer(newest);
      if (completed) {
        msgs = completed;
      } else {
        // 超时仍未等到原生回答：不再丢弃这条消息，交给后续流程判断。
        // 注意：onMessage 会把它当作"无文本回答"，静默放行（技能流/指令不接管）。
        this._lastQueryMsg = newest;
        console.log(
          `⏱ 原生回答超时（${this._pendingPollTimeoutCap}ms 内无文本），交给后续判断：${newest.text}`,
        );
        this._watchLateNativeAnswer(newest);
        return newest;
      }
    }
    if (msgs.length < 1 || firstOf(msgs)!.timestamp <= this._lastQueryMsg!.timestamp) {
      // 没有拉到新消息
      return;
    }
    if (
      firstOf(msgs)!.timestamp > this._lastQueryMsg!.timestamp &&
      (msgs.length === 1 || lastOf(msgs)!.timestamp <= this._lastQueryMsg!.timestamp)
    ) {
      // 刚好收到一条新消息
      this._lastQueryMsg = firstOf(msgs);
      return this._lastQueryMsg;
    }
    // 还有其他新消息，暂存当前的新消息
    for (const msg of msgs) {
      if (msg.timestamp > this._lastQueryMsg!.timestamp) {
        this._tempQueryMsgs.push(msg);
      }
    }
    return 'continue';
  }

  private _hasNativeAnswer(msg: IMessage) {
    return typeof msg.metadata?.xiaoAIAnswer === 'string';
  }

  private async _waitForNativeAnswer(pending: IMessage): Promise<IMessage[] | undefined> {
    // 等待上限：原逻辑最多等 2s，L05B 上这 2s 会漏出半句"我还回答不上"。
    // 压到 900ms：小爱答得上的问题通常能在这段时间内刷出原生回答，
    // 答不上的则尽早抢断交给 LLM，兼顾省 token 和少漏字。
    const timeout = this._pendingPollTimeoutCap;
    for (let elapsed = 0; elapsed < timeout; elapsed += this._pendingPollInterval) {
      await this._sleep(this._pendingPollInterval);
      const msgs = await this._fetchHistoryMsgs({ limit: 2, filterAnswer: false });
      const current = msgs.find(
        (msg) => msg.id === pending.id || msg.timestamp === pending.timestamp,
      );
      if (current && this._hasNativeAnswer(current)) {
        console.log(`⏱ 原生回答到达：约 ${elapsed + this._pendingPollInterval}ms`);
        return msgs;
      }
    }
    return undefined;
  }

  /**
   * 放行后的观察（只记录日志，不改变任何行为）：
   * 用来量化"900ms 阈值"的误判情况——
   * - 若 1.6s 内文本才到，说明是网络抖动导致的误判（小爱其实能答）
   * - 若始终无文本，判定为技能流/指令，符合预期
   */
  private _watchLateNativeAnswer(pending: IMessage) {
    void (async () => {
      const deadline = 1600;
      const step = 300;
      for (let waited = step; waited <= deadline; waited += step) {
        await this._sleep(step);
        try {
          const msgs = await this._fetchHistoryMsgs({ limit: 2, filterAnswer: false });
          const current = msgs.find(
            (msg) => msg.id === pending.id || msg.timestamp === pending.timestamp,
          );
          const answer = current?.metadata?.xiaoAIAnswer;
          if (typeof answer === 'string' && answer.trim()) {
            console.log(
              `🔎 放行后观察：原生回答在放行后约 ${waited}ms 才到达（超时误判，内容：「${answer.trim()}」）`,
            );
            return;
          }
        } catch (error) {
          console.warn(`🔎 放行后观察失败：${(error as Error)?.message ?? error}`);
          return;
        }
      }
      console.log('🔎 放行后观察：放行后 1.6s 内始终无文本回答（判定为技能流/指令，放行正确）');
    })();
  }

  /**
   * 继续向上拉取其他新消息
   */
  private async _fetchNextRemainingMessages(options?: {
    maxPage?: number;
    pageSize?: number;
  }) {
    let currentPage = 0;
    const { maxPage = 3, pageSize = 10 } = options ?? {};
    while (true) {
      currentPage++;
      if (currentPage > maxPage) {
        // 拉取新消息超长，取消拉取
        return this._fetchNextTempMessage();
      }
      const nextTimestamp = lastOf(this._tempQueryMsgs)!.timestamp;
      const msgs = await this._fetchHistoryMsgs({
        limit: pageSize,
        timestamp: nextTimestamp,
      });
      for (const msg of msgs) {
        if (msg.timestamp >= nextTimestamp) {
          // 忽略上一页的消息
        } else if (msg.timestamp > this._lastQueryMsg!.timestamp) {
          // 继续添加新消息
          this._tempQueryMsgs.push(msg);
        } else {
          // 拉取到历史消息处
          return this._fetchNextTempMessage();
        }
      }
    }
  }

  /**
   * 读取暂存的消息
   */
  private _fetchNextTempMessage() {
    const nextMsg = this._tempQueryMsgs.pop();
    this._lastQueryMsg = nextMsg;
    return nextMsg;
  }

  private async _fetchHistoryMsgs(options?: {
    limit?: number;
    timestamp?: number;
    filterAnswer?: boolean;
  }): Promise<IMessage[]> {
    const filterAnswer = options?.filterAnswer ?? true;
    const conversation = await this._getConversations(options);
    let records = conversation?.records ?? [];
    if (filterAnswer) {
      // 过滤有小爱回答的消息
      records = records.filter(
        (e) =>
          ['TTS', 'LLM'].includes(e.answers[0]?.type ?? '') && // 过滤 TTS 和 LLM 消息
          e.answers.length === 1, // 播放音乐时会有 TTS、Audio 两个 Answer
      );
    }
    return records.map((e) => {
      const nativeAnswer = extractNativeAnswer(e);
      return {
        id: e.requestId || randomUUID(),
        sender: 'user',
        text: e.query,
        timestamp: e.time,
        metadata: nativeAnswer
          ? {
              xiaoAIAnswer: nativeAnswer.text,
              xiaoAIAnswerType: nativeAnswer.type,
            }
          : undefined,
      };
    });
  }
}

export const MiMessage = new MiMessageManager();
