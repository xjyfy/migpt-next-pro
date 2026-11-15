import { assert } from './chunk-BTZWFDFN.js';
import { getMiNA, getMIoT } from '@mi-gpt/miot';
import { jsonEncode } from '@mi-gpt/utils/parse';

var _MiService = class {
  MiNA;
  MiOT;
  async init(config) {
    var _a, _b;
    const { debug = false, speaker } = config;
    assert(!!speaker.did, "\u274C Speaker \u7F3A\u5C11 did \u53C2\u6570");
    assert(
      !!speaker.passToken || !!speaker.userId && !!speaker.password,
      "\u274C Speaker \u7F3A\u5C11 passToken \u6216 userId \u548C password"
    );
    speaker.debug = debug;
    speaker.timeout = Math.max(1e3, speaker.timeout ?? 5e3);
    this.MiNA = await getMiNA(speaker);
    this.MiOT = await getMIoT(speaker);
    assert(!!this.MiNA && !!this.MiOT, "\u274C \u521D\u59CB\u5316 Mi Services \u5931\u8D25");
    if (debug) {
      const device = (_a = this.MiOT.account) == null ? void 0 : _a.device;
      console.debug(
        "\u{1F41B} \u8BBE\u5907\u4FE1\u606F\uFF1A",
        jsonEncode(
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

export { MiService };
