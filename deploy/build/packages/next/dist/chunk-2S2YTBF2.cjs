'use strict';

var chunk4NFIC7L2_cjs = require('./chunk-4NFIC7L2.cjs');

// src/speaker.ts
var SpeakerManager = class {
  /**
   * 播放文字、音频链接
   */
  async play({ text, url } = {}) {
    if (!chunk4NFIC7L2_cjs.MiService.MiNA) {
      return false;
    }
    if (url) {
      return chunk4NFIC7L2_cjs.MiService.MiNA.play({ url });
    }
    if (text) {
      return chunk4NFIC7L2_cjs.MiService.MiNA.play({ text });
    }
    return false;
  }
  /**
   * 中断原来小爱的运行
   */
  async abortXiaoAI() {
    if (!chunk4NFIC7L2_cjs.MiService.MiNA) {
      return false;
    }
    return chunk4NFIC7L2_cjs.MiService.MiNA.stop();
  }
};
var MiSpeaker = new SpeakerManager();

exports.MiSpeaker = MiSpeaker;
