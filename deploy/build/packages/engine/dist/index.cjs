'use strict';

var chunkIYG37CDU_cjs = require('./chunk-IYG37CDU.cjs');
var chat = require('@mi-gpt/chat');
var openai = require('@mi-gpt/openai');
var utils = require('@mi-gpt/utils');
var parse = require('@mi-gpt/utils/parse');

// package.json
var version = "1.2.1";

// src/index.ts
var kBannerASCII = `

/ $$      /$$ /$$   /$$$$$$  /$$$$$$$ /$$$$$$$$$
| $$$    /$$$|__/ /$$__  $$| $$__  $$|__  $$__/
| $$$$  /$$$$ /$$| $$  \\__/| $$  \\ $$   | $$   
| $$ $$/$$ $$| $$| $$ /$$$$| $$$$$$$/   | $$   
| $$  $$$| $$| $$| $$|_  $$| $$____/    | $$   
| $$\\  $ | $$| $$| $$  \\ $$| $$         | $$   
| $$ \\/  | $$| $$|  $$$$$$/| $$         | $$   
|__/     |__/|__/ \\______/ |__/         |__/                         
                                                                                                                 
    MiGPT-Next v0.0.0  by: https://del.wang

`.replace("0.0.0", version);
var kDefaultConfig = {
  debug: false,
  callAIKeywords: ["\u8BF7", "\u4F60"]
};
var MiGPTEngine = class extends chunkIYG37CDU_cjs.BaseEngine {
  config = {};
  async start(config) {
    console.log(kBannerASCII);
    this.status = "running";
    this.config = utils.deepMerge(kDefaultConfig, config);
    if (this.config.debug) {
      console.log("\u{1F41B} \u914D\u7F6E\u53C2\u6570\uFF1A", parse.jsonEncode(config, { prettier: true }));
    }
    chat.ChatBot.init(config);
  }
  async stop() {
    this.status = "stopped";
    chat.ChatBot.dispose();
  }
  lastMsg;
  async onMessage(msg) {
    var _a, _b, _c, _d;
    console.log(`\u{1F525} ${msg.text}`);
    openai.OpenAI.cancel((_a = this.lastMsg) == null ? void 0 : _a.id);
    this.lastMsg = msg;
    let reply = await ((_c = (_b = this.config).onMessage) == null ? void 0 : _c.call(_b, this, msg));
    if (reply == null ? void 0 : reply.handled) {
      return;
    }
    if (reply && !reply.default) {
      await this._response(msg, reply);
      return;
    }
    if ((_d = this.config.callAIKeywords) == null ? void 0 : _d.some((k) => msg.text.startsWith(k))) {
      await this.speaker.abortXiaoAI();
      await this.speaker.play({ text: "\u6B63\u5728\u601D\u8003\u4E2D" });
      await utils.sleep(500);
      reply = await this.askAI(msg);
      await this._response(msg, reply);
    }
  }
  async askAI(msg, options) {
    if ((options == null ? void 0 : options.stream) === false) {
      const text = await chat.ChatBot.chat(msg);
      return { text };
    }
    const stream = await chat.ChatBot.chatWithStream(msg, async () => {
      await this._response(msg, { text: "\u51FA\u9519\u4E86\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u5427\uFF01" });
    });
    return { stream };
  }
  async _response(ctx, reply) {
    const { text, url, stream } = reply ?? {};
    if (!text && !stream && !url) {
      return;
    }
    if (this._hasNewMsg(ctx) || this.status !== "running") {
      stream == null ? void 0 : stream.cancel();
      return;
    }
    if (url || text) {
      console.log(`\u{1F50A} ${url || text}`);
      return this.speaker.play({ url, text, blocking: true });
    }
    while (true) {
      const { next, noMore } = stream.read();
      if (!next && noMore) {
        break;
      }
      if (next) {
        if (this._hasNewMsg(ctx) || this.status !== "running") {
          stream.cancel();
          return;
        }
        console.log(`\u{1F50A} ${next}`);
        await this.speaker.play({ text: next, blocking: true });
      }
      await utils.sleep(100);
    }
  }
  _hasNewMsg(ctx) {
    var _a;
    return (((_a = this.lastMsg) == null ? void 0 : _a.timestamp) ?? 0) > ctx.timestamp;
  }
};

exports.MiGPTEngine = MiGPTEngine;
