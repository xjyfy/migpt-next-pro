import { ChatBot, type IMessage } from '@mi-gpt/chat';
import type { IReply } from '@mi-gpt/engine/base';
import { type EngineConfig, MiGPTEngine } from '@mi-gpt/engine/index';
import { deepMerge, sleep } from '@mi-gpt/utils';
import type { DeepPartial, Prettify } from '@mi-gpt/utils/typing';
import { MiMessage } from './message.js';
import { MiService, type MiServiceConfig } from './service.js';
import { MiSpeaker } from './speaker.js';

export { extractNativeAnswer } from './native-answer.js';
export type { NativeAnswer } from './native-answer.js';

export type MiGPTConfig = Prettify<
  EngineConfig<MiJiaEngine> &
    DeepPartial<{
      debug: boolean;
      speaker: MiServiceConfig & {
        /**
         * 消息轮询间隔（毫秒）
         *
         * 默认 1000（最低 1 秒）
         */
        heartbeat?: number;
      };
    }>
>;

const kDefaultMiGPTConfig: MiGPTConfig = {
  debug: false,
  speaker: {
    heartbeat: 500,
  },
};

class MiJiaEngine extends MiGPTEngine {
  config: MiGPTConfig = kDefaultMiGPTConfig;

  speaker = MiSpeaker;

  get MiNA() {
    return MiService.MiNA!;
  }

  get MiOT() {
    return MiService.MiOT!;
  }

  // 轮询消息
  #processing = false;
  // 最近一次有对话的时间，用于自适应心跳（空闲低频、对话后短时高频）
  #activeUntil = 0;
  async #processMessage(msg: IMessage) {
    if (this.#processing) return;
    this.#processing = true;
    try {
      await this.onMessage(msg);
    } finally {
      this.#processing = false;
    }
  }

  async start(config: MiGPTConfig) {
    await super.start(deepMerge(kDefaultMiGPTConfig, config));

    await MiService.init(this.config as any);

    console.log('✅ 服务已启动...');

    // 自适应心跳：空闲用较慢频率（省小米接口调用、降风控风险），
    // 对话发生后 15 秒内切到较快的频率（这段时间漏字最敏感）。
    const speakerCfg = this.config.speaker as any;
    const idleHeartbeat = Math.max(300, Number(speakerCfg?.heartbeat ?? 500));
    const burstHeartbeat = Math.max(200, Number(speakerCfg?.burstHeartbeat ?? 300));
    const burstWindowMs = Math.max(0, Number(speakerCfg?.burstWindowMs ?? 15000));
    console.log(
      `⏱ 心跳：空闲 ${idleHeartbeat}ms / 对话后 ${burstHeartbeat}ms（窗口 ${burstWindowMs}ms）`,
    );

    // 夜间暂停轮询：窗口内完全不发小米请求，音箱恢复小爱原生回答
    const parseHM = (value: unknown) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
      if (!m) return undefined;
      const hour = Number(m[1]);
      const minute = Number(m[2]);
      if (hour > 23 || minute > 59) return undefined;
      return hour * 60 + minute;
    };
    const pauseCfg = speakerCfg?.nightPause ?? {};
    const pauseEnabled = pauseCfg.enabled !== false;
    const pauseStart = parseHM(pauseCfg.start ?? '22:00');
    const pauseEnd = parseHM(pauseCfg.end ?? '08:00');
    const inPauseWindow = () => {
      if (!pauseEnabled) return false;
      if (pauseStart === undefined || pauseEnd === undefined) return false;
      if (pauseStart === pauseEnd) return false; // 起止相同视为不暂停
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      return pauseStart < pauseEnd
        ? current >= pauseStart && current < pauseEnd
        : current >= pauseStart || current < pauseEnd; // 跨零点
    };
    const pauseLabel = `${String(Math.floor((pauseStart ?? 0) / 60)).padStart(2, '0')}:${String(
      (pauseStart ?? 0) % 60,
    ).padStart(2, '0')}-${String(Math.floor((pauseEnd ?? 0) / 60)).padStart(2, '0')}:${String(
      (pauseEnd ?? 0) % 60,
    ).padStart(2, '0')}`;
    console.log(
      pauseEnabled
        ? `🌙 夜间暂停：${pauseLabel}（窗口内不轮询，小爱原生回答）`
        : '🌙 夜间暂停：已关闭',
    );

    // 连续异常时的退避计数
    let failures = 0;
    let paused = false;
    // 认证类错误是否已经重试过一次（重试仍失败则直接停止）
    let authRetried = false;
    // 认证类错误关键词：这类问题重试也没用，只是给一次自愈机会（凭证刷新）
    const kAuthError = /401|70016|登录|token|凭证|未授权|无权|auth/i;
    // 其他错误的退避节奏：1s → 2s → 5s → 10s → 30s，之后每分钟一次
    const kBackoffSeries = [1000, 2000, 5000, 10000, 30000];
    const kBackoffIdle = 60000;

    // 轮询消息
    while (this.status === 'running') {
      if (inPauseWindow()) {
        if (!paused) {
          console.log(`🌙 进入夜间暂停（${pauseLabel}），暂停轮询`);
          paused = true;
        }
        await sleep(60000); // 每分钟检查一次，到点准时恢复
        continue;
      }
      if (paused) {
        console.log('☀️ 退出夜间暂停，恢复轮询');
        paused = false;
      }
      try {
        const msg = await MiMessage.fetchNextMessage();
        failures = 0;
        authRetried = false;
        if (msg) {
          this.#activeUntil = Date.now() + burstWindowMs;
          await this.#processMessage(msg);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (kAuthError.test(message)) {
          if (authRetried) {
            // 3 秒后重试仍失败：停止服务，留日志给人工处理，避免反复撞风控
            console.error(`❌ 认证类错误且重试无效，停止轮询：${message}`);
            console.error('💡 请更新 config.js 里的 passToken 后重启服务');
            process.exit(1);
          }
          authRetried = true;
          failures++;
          console.warn(`⚠️ 疑似登录态失效，3 秒后重试一次：${message}`);
          await sleep(3000);
          continue;
        }
        failures++;
        const backoff =
          failures <= kBackoffSeries.length
            ? (kBackoffSeries[failures - 1] ?? kBackoffIdle)
            : kBackoffIdle;
        console.error(`❌ 轮询异常（连续 ${failures} 次），退避 ${backoff}ms：${message}`);
        await sleep(backoff);
        continue;
      }
      const heartbeat = Date.now() < this.#activeUntil ? burstHeartbeat : idleHeartbeat;
      await sleep(heartbeat);
    }
  }

  async askAI(msg: IMessage): Promise<IReply> {
    const text = await ChatBot.chat(msg);
    return { text };
  }
}

export const MiGPT = new MiJiaEngine();
