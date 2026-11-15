'use strict';

var chunkRIGCVXS7_cjs = require('./chunk-RIGCVXS7.cjs');
var chunk4NFIC7L2_cjs = require('./chunk-4NFIC7L2.cjs');
var crypto = require('crypto');
var utils = require('@mi-gpt/utils');

var MiMessageManager = class {
  _lastQueryMsg;
  _tempQueryMsgs = [];
  _getConversations;
  _sleep;
  _pendingPollInterval;
  _pendingPollTimeout;
  /** 实际等待上限（ms），日志与等待循环共用同一值 */
  _pendingPollTimeoutCap;
  constructor(options = {}) {
    this._getConversations = options.getConversations ?? ((request) => {
      var _a;
      return (_a = chunk4NFIC7L2_cjs.MiService.MiNA) == null ? void 0 : _a.getConversations(request);
    });
    this._sleep = options.sleep ?? utils.sleep;
    this._pendingPollInterval = Math.max(50, options.pendingPollInterval ?? 100);
    this._pendingPollTimeout = Math.max(
      this._pendingPollInterval,
      options.pendingPollTimeout ?? 2e3
    );
    this._pendingPollTimeoutCap = Math.min(this._pendingPollTimeout, 900);
  }
  async fetchNextMessage() {
    if (!this._lastQueryMsg) {
      return this._fetchFirstMessage();
    }
    return this._fetchNextMessage();
  }
  async _fetchFirstMessage() {
    const msgs = await this._fetchHistoryMsgs({
      limit: 1,
      filterAnswer: false
    });
    this._lastQueryMsg = msgs[0];
    return void 0;
  }
  async _fetchNextMessage() {
    if (this._tempQueryMsgs.length > 0) {
      return this._fetchNextTempMessage();
    }
    const nextMsg = await this._fetchNext2Messages();
    if (nextMsg !== "continue") {
      return nextMsg;
    }
    return this._fetchNextRemainingMessages();
  }
  /**
   * 拉取最新的 2 条消息，用于和上一条消息比对是否连续
   */
  async _fetchNext2Messages() {
    let msgs = await this._fetchHistoryMsgs({ limit: 2, filterAnswer: false });
    const newest = utils.firstOf(msgs);
    if (newest && newest.timestamp > this._lastQueryMsg.timestamp && !this._hasNativeAnswer(newest)) {
      const completed = await this._waitForNativeAnswer(newest);
      if (completed) {
        msgs = completed;
      } else {
        this._lastQueryMsg = newest;
        console.log(`\u23F1 \u539F\u751F\u56DE\u7B54\u8D85\u65F6\uFF08${this._pendingPollTimeoutCap}ms \u5185\u65E0\u6587\u672C\uFF09\uFF0C\u4EA4\u7ED9\u540E\u7EED\u5224\u65AD\uFF1A${newest.text}`);
        this._watchLateNativeAnswer(newest);
        return newest;
      }
    }
    if (msgs.length < 1 || utils.firstOf(msgs).timestamp <= this._lastQueryMsg.timestamp) {
      return;
    }
    if (utils.firstOf(msgs).timestamp > this._lastQueryMsg.timestamp && (msgs.length === 1 || utils.lastOf(msgs).timestamp <= this._lastQueryMsg.timestamp)) {
      this._lastQueryMsg = utils.firstOf(msgs);
      return this._lastQueryMsg;
    }
    for (const msg of msgs) {
      if (msg.timestamp > this._lastQueryMsg.timestamp) {
        this._tempQueryMsgs.push(msg);
      }
    }
    return "continue";
  }
  _hasNativeAnswer(msg) {
    var _a;
    return typeof ((_a = msg.metadata) == null ? void 0 : _a.xiaoAIAnswer) === "string";
  }
  async _waitForNativeAnswer(pending) {
    const timeout = this._pendingPollTimeoutCap;
    for (let elapsed = 0; elapsed < timeout; elapsed += this._pendingPollInterval) {
      await this._sleep(this._pendingPollInterval);
      const msgs = await this._fetchHistoryMsgs({ limit: 2, filterAnswer: false });
      const current = msgs.find(
        (msg) => msg.id === pending.id || msg.timestamp === pending.timestamp
      );
      if (current && this._hasNativeAnswer(current)) {
        console.log(`\u23F1 \u539F\u751F\u56DE\u7B54\u5230\u8FBE\uFF1A\u7EA6 ${elapsed + this._pendingPollInterval}ms`);
        return msgs;
      }
    }
    return void 0;
  }
  /**
   * 放行后的观察（只记录日志，不改变任何行为）：
   * 用来量化"900ms 阈值"的误判情况——
   * - 若 1.6s 内文本才到，说明是网络抖动导致的误判（小爱其实能答）
   * - 若始终无文本，判定为技能流/指令，符合预期
   */
  _watchLateNativeAnswer(pending) {
    void (async () => {
      var _a;
      const deadline = 1600;
      const step = 300;
      for (let waited = step; waited <= deadline; waited += step) {
        await this._sleep(step);
        try {
          const msgs = await this._fetchHistoryMsgs({ limit: 2, filterAnswer: false });
          const current = msgs.find(
            (msg) => msg.id === pending.id || msg.timestamp === pending.timestamp
          );
          const answer = (_a = current == null ? void 0 : current.metadata) == null ? void 0 : _a.xiaoAIAnswer;
          if (typeof answer === "string" && answer.trim()) {
            console.log(
              `\u{1F50E} \u653E\u884C\u540E\u89C2\u5BDF\uFF1A\u539F\u751F\u56DE\u7B54\u5728\u653E\u884C\u540E\u7EA6 ${waited}ms \u624D\u5230\u8FBE\uFF08\u8D85\u65F6\u8BEF\u5224\uFF0C\u5185\u5BB9\uFF1A\u300C${answer.trim()}\u300D\uFF09`
            );
            return;
          }
        } catch (error) {
          console.warn(`\u{1F50E} \u653E\u884C\u540E\u89C2\u5BDF\u5931\u8D25\uFF1A${(error == null ? void 0 : error.message) ?? error}`);
          return;
        }
      }
      console.log("\u{1F50E} \u653E\u884C\u540E\u89C2\u5BDF\uFF1A\u653E\u884C\u540E 1.6s \u5185\u59CB\u7EC8\u65E0\u6587\u672C\u56DE\u7B54\uFF08\u5224\u5B9A\u4E3A\u6280\u80FD\u6D41/\u6307\u4EE4\uFF0C\u653E\u884C\u6B63\u786E\uFF09");
    })();
  }
  /**
   * 继续向上拉取其他新消息
   */
  async _fetchNextRemainingMessages(options) {
    let currentPage = 0;
    const { maxPage = 3, pageSize = 10 } = options ?? {};
    while (true) {
      currentPage++;
      if (currentPage > maxPage) {
        return this._fetchNextTempMessage();
      }
      const nextTimestamp = utils.lastOf(this._tempQueryMsgs).timestamp;
      const msgs = await this._fetchHistoryMsgs({
        limit: pageSize,
        timestamp: nextTimestamp
      });
      for (const msg of msgs) {
        if (msg.timestamp >= nextTimestamp) ; else if (msg.timestamp > this._lastQueryMsg.timestamp) {
          this._tempQueryMsgs.push(msg);
        } else {
          return this._fetchNextTempMessage();
        }
      }
    }
  }
  /**
   * 读取暂存的消息
   */
  _fetchNextTempMessage() {
    const nextMsg = this._tempQueryMsgs.pop();
    this._lastQueryMsg = nextMsg;
    return nextMsg;
  }
  async _fetchHistoryMsgs(options) {
    const filterAnswer = (options == null ? void 0 : options.filterAnswer) ?? true;
    const conversation = await this._getConversations(options);
    let records = (conversation == null ? void 0 : conversation.records) ?? [];
    if (filterAnswer) {
      records = records.filter(
        (e) => {
          var _a;
          return ["TTS", "LLM"].includes(((_a = e.answers[0]) == null ? void 0 : _a.type) ?? "") && // 过滤 TTS 和 LLM 消息
          e.answers.length === 1;
        }
        // 播放音乐时会有 TTS、Audio 两个 Answer
      );
    }
    return records.map((e) => {
      const nativeAnswer = chunkRIGCVXS7_cjs.extractNativeAnswer(e);
      return {
        id: e.requestId || crypto.randomUUID(),
        sender: "user",
        text: e.query,
        timestamp: e.time,
        metadata: nativeAnswer ? {
          xiaoAIAnswer: nativeAnswer.text,
          xiaoAIAnswerType: nativeAnswer.type
        } : void 0
      };
    });
  }
};
var MiMessage = new MiMessageManager();

exports.MiMessage = MiMessage;
exports.MiMessageManager = MiMessageManager;
