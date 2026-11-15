import { MiMessage } from './chunk-XMZOHTHK.js';
export { extractNativeAnswer } from './chunk-JPQHRPUD.js';
import { MiSpeaker } from './chunk-24ZPLFYI.js';
import { MiService } from './chunk-QDFX3624.js';
import './chunk-BTZWFDFN.js';
import { ChatBot } from '@mi-gpt/chat';
import { MiGPTEngine } from '@mi-gpt/engine/index';
import { deepMerge, sleep } from '@mi-gpt/utils';

var kDefaultMiGPTConfig = {
  debug: false,
  speaker: {
    heartbeat: 500
  }
};
var MiJiaEngine = class extends MiGPTEngine {
  config = kDefaultMiGPTConfig;
  speaker = MiSpeaker;
  get MiNA() {
    return MiService.MiNA;
  }
  get MiOT() {
    return MiService.MiOT;
  }
  // 轮询消息
  #processing = false;
  // 最近一次有对话的时间，用于自适应心跳（空闲低频、对话后短时高频）
  #activeUntil = 0;
  async #processMessage(msg) {
    if (this.#processing) return;
    this.#processing = true;
    try {
      await this.onMessage(msg);
    } finally {
      this.#processing = false;
    }
  }
  async start(config) {
    await super.start(deepMerge(kDefaultMiGPTConfig, config));
    await MiService.init(this.config);
    console.log("\u2705 \u670D\u52A1\u5DF2\u542F\u52A8...");
    const speakerCfg = this.config.speaker;
    const idleHeartbeat = Math.max(300, Number((speakerCfg == null ? void 0 : speakerCfg.heartbeat) ?? 500));
    const burstHeartbeat = Math.max(200, Number((speakerCfg == null ? void 0 : speakerCfg.burstHeartbeat) ?? 300));
    const burstWindowMs = Math.max(0, Number((speakerCfg == null ? void 0 : speakerCfg.burstWindowMs) ?? 15e3));
    console.log(`\u23F1 \u5FC3\u8DF3\uFF1A\u7A7A\u95F2 ${idleHeartbeat}ms / \u5BF9\u8BDD\u540E ${burstHeartbeat}ms\uFF08\u7A97\u53E3 ${burstWindowMs}ms\uFF09`);
    const parseHM = (value) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
      if (!m) return void 0;
      const hour = Number(m[1]);
      const minute = Number(m[2]);
      if (hour > 23 || minute > 59) return void 0;
      return hour * 60 + minute;
    };
    const pauseCfg = (speakerCfg == null ? void 0 : speakerCfg.nightPause) ?? {};
    const pauseEnabled = pauseCfg.enabled !== false;
    let pauseStart = parseHM(pauseCfg.start ?? "22:00");
    let pauseEnd = parseHM(pauseCfg.end ?? "08:00");
    const inPauseWindow = () => {
      if (!pauseEnabled) return false;
      if (pauseStart === void 0 || pauseEnd === void 0) return false;
      if (pauseStart === pauseEnd) return false;
      const now = /* @__PURE__ */ new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      return pauseStart < pauseEnd ? current >= pauseStart && current < pauseEnd : current >= pauseStart || current < pauseEnd;
    };
    const pauseLabel = `${String(Math.floor((pauseStart ?? 0) / 60)).padStart(2, "0")}:${String(
      (pauseStart ?? 0) % 60
    ).padStart(2, "0")}-${String(Math.floor((pauseEnd ?? 0) / 60)).padStart(2, "0")}:${String(
      (pauseEnd ?? 0) % 60
    ).padStart(2, "0")}`;
    console.log(
      pauseEnabled ? `\u{1F319} \u591C\u95F4\u6682\u505C\uFF1A${pauseLabel}\uFF08\u7A97\u53E3\u5185\u4E0D\u8F6E\u8BE2\uFF0C\u5C0F\u7231\u539F\u751F\u56DE\u7B54\uFF09` : "\u{1F319} \u591C\u95F4\u6682\u505C\uFF1A\u5DF2\u5173\u95ED"
    );
    let failures = 0;
    let paused = false;
    let authRetried = false;
    const kAuthError = /401|70016|登录|token|凭证|未授权|无权|auth/i;
    const kBackoffSeries = [1e3, 2e3, 5e3, 1e4, 3e4];
    const kBackoffIdle = 6e4;
    while (this.status === "running") {
      if (inPauseWindow()) {
        if (!paused) {
          console.log(`\u{1F319} \u8FDB\u5165\u591C\u95F4\u6682\u505C\uFF08${pauseLabel}\uFF09\uFF0C\u6682\u505C\u8F6E\u8BE2`);
          paused = true;
        }
        await sleep(6e4);
        continue;
      }
      if (paused) {
        console.log("\u2600\uFE0F \u9000\u51FA\u591C\u95F4\u6682\u505C\uFF0C\u6062\u590D\u8F6E\u8BE2");
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
            console.error(`\u274C \u8BA4\u8BC1\u7C7B\u9519\u8BEF\u4E14\u91CD\u8BD5\u65E0\u6548\uFF0C\u505C\u6B62\u8F6E\u8BE2\uFF1A${message}`);
            console.error("\u{1F4A1} \u8BF7\u66F4\u65B0 config.js \u91CC\u7684 passToken \u540E\u91CD\u542F\u670D\u52A1");
            process.exit(1);
          }
          authRetried = true;
          failures++;
          console.warn(`\u26A0\uFE0F \u7591\u4F3C\u767B\u5F55\u6001\u5931\u6548\uFF0C3 \u79D2\u540E\u91CD\u8BD5\u4E00\u6B21\uFF1A${message}`);
          await sleep(3e3);
          continue;
        }
        failures++;
        const backoff = failures <= kBackoffSeries.length ? kBackoffSeries[failures - 1] ?? kBackoffIdle : kBackoffIdle;
        console.error(`\u274C \u8F6E\u8BE2\u5F02\u5E38\uFF08\u8FDE\u7EED ${failures} \u6B21\uFF09\uFF0C\u9000\u907F ${backoff}ms\uFF1A${message}`);
        await sleep(backoff);
        continue;
      }
      const heartbeat = Date.now() < this.#activeUntil ? burstHeartbeat : idleHeartbeat;
      await sleep(heartbeat);
    }
  }
  async askAI(msg) {
    const text = await ChatBot.chat(msg);
    return { text };
  }
};
var MiGPT = new MiJiaEngine();

export { MiGPT };
