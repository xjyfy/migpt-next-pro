import { MiService } from './chunk-QDFX3624.js';

// src/speaker.ts
var SpeakerManager = class {
  /**
   * 播放文字、音频链接
   */
  async play({ text, url } = {}) {
    if (!MiService.MiNA) {
      return false;
    }
    if (url) {
      return MiService.MiNA.play({ url });
    }
    if (text) {
      return MiService.MiNA.play({ text });
    }
    return false;
  }
  /**
   * 中断原来小爱的运行
   */
  async abortXiaoAI() {
    if (!MiService.MiNA) {
      return false;
    }
    return MiService.MiNA.stop();
  }
};
var MiSpeaker = new SpeakerManager();

export { MiSpeaker };
