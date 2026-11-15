'use strict';

var chunkUOHFW2HR_cjs = require('./chunk-UOHFW2HR.cjs');
var miot = require('@mi-gpt/miot');
var parse = require('@mi-gpt/utils/parse');

var _MiService = class {
  MiNA;
  MiOT;
  async init(config) {
    var _a, _b;
    const { debug = false, speaker } = config;
    chunkUOHFW2HR_cjs.assert(!!speaker.did, "\u274C Speaker \u7F3A\u5C11 did \u53C2\u6570");
    chunkUOHFW2HR_cjs.assert(
      !!speaker.passToken || !!speaker.userId && !!speaker.password,
      "\u274C Speaker \u7F3A\u5C11 passToken \u6216 userId \u548C password"
    );
    speaker.debug = debug;
    speaker.timeout = Math.max(1e3, speaker.timeout ?? 5e3);
    this.MiNA = await miot.getMiNA(speaker);
    this.MiOT = await miot.getMIoT(speaker);
    chunkUOHFW2HR_cjs.assert(!!this.MiNA && !!this.MiOT, "\u274C \u521D\u59CB\u5316 Mi Services \u5931\u8D25");
    if (debug) {
      const device = (_a = this.MiOT.account) == null ? void 0 : _a.device;
      console.debug(
        "\u{1F41B} \u8BBE\u5907\u4FE1\u606F\uFF1A",
        parse.jsonEncode(
          {
            name: device == null ? void 0 : device.name,
            desc: device == null ? void 0 : device.desc,
            model: device == null ? void 0 : device.model,
            rom: (_b = device == null ? void 0 : device.extra) == null ? void 0 : _b.fw_version
          },
          { prettier: true }
        )
      );
    }
  }
};
var MiService = new _MiService();

exports.MiService = MiService;
