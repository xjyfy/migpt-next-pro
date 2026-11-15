import { Debugger } from './chunk-3NNRBEOI.js';
import { readJSON, writeJSON } from './chunk-VMRORFAB.js';
import { updateMiAccount } from './chunk-LJ4UQOR2.js';
import { parseAuthPass, encodeQuery, encodeMIoT, decodeMIoT } from './chunk-JEOJUCC4.js';
import { uuid, md5, sha1 } from './chunk-34CBAQZN.js';
import { sleep, clamp } from '@mi-gpt/utils';
import { isNotEmpty } from '@mi-gpt/utils/is';
import { jsonEncode, jsonDecode } from '@mi-gpt/utils/parse';
import axios from 'axios';
import { ProxyAgent } from 'proxy-agent';

var MiNA = class _MiNA {
  account;
  constructor(account) {
    this.account = account;
  }
  static async getDevice(account) {
    if (account.sid !== "micoapi") {
      return account;
    }
    const devices = await _MiNA.__callMiNA(account, "GET", "/admin/v2/device_list");
    if (Debugger.debug) {
      console.log("\u{1F41B} MiNA \u8BBE\u5907\u5217\u8868: ", jsonEncode(devices, { prettier: true }));
    }
    const device = (devices ?? []).find(
      (e) => [e.deviceID, e.miotDID, e.name, e.alias, e.mac].includes(account.did)
    );
    if (device) {
      account.device = { ...device, deviceId: device.deviceID };
    }
    return account;
  }
  static async __callMiNA(account, method, path, _data) {
    var _a, _b, _c, _d;
    const data = {
      ..._data,
      requestId: uuid(),
      timestamp: Math.floor(Date.now() / 1e3)
    };
    const url = `https://api2.mina.mi.com${path}`;
    const config = {
      account,
      setAccount: updateMiAccount(account),
      headers: { "User-Agent": "MICO/AndroidApp/@SHIP.TO.2A2FE0D7@/2.4.40" },
      cookies: {
        userId: account.userId,
        serviceToken: account.serviceToken,
        sn: (_a = account.device) == null ? void 0 : _a.serialNumber,
        hardware: (_b = account.device) == null ? void 0 : _b.hardware,
        deviceId: (_c = account.device) == null ? void 0 : _c.deviceId,
        deviceSNProfile: (_d = account.device) == null ? void 0 : _d.deviceSNProfile
      }
    };
    let res;
    if (method === "GET") {
      res = await Http.get(url, data, config);
    } else {
      res = await Http.post(url, encodeQuery(data), config);
    }
    if (res.code !== 0) {
      if (Debugger.debug) {
        console.error("\u274C _callMiNA failed", res);
      }
      return void 0;
    }
    return res.data;
  }
  async _callMiNA(method, path, data) {
    return _MiNA.__callMiNA(this.account, method, path, data);
  }
  /**
   * 调用小爱音箱上的 ubus 服务
   *
   * 比如：
   *
   * ```ts
   * await MiNA.callUbus("mediaplayer", "player_get_play_status");
   * await MiNA.callUbus("mediaplayer", "player_set_volume", { volume: 100 });
   * ```
   */
  callUbus(scope, command, _message) {
    var _a;
    const message = jsonEncode(_message ?? {});
    return this._callMiNA("POST", "/remote/ubus", {
      deviceId: (_a = this.account.device) == null ? void 0 : _a.deviceId,
      path: scope,
      method: command,
      message
    });
  }
  /**
   * 获取设备列表
   */
  getDevices() {
    return this._callMiNA("GET", "/admin/v2/device_list");
  }
  /**
   * 获取设备播放状态
   */
  async getStatus() {
    const data = await this.callUbus("mediaplayer", "player_get_play_status");
    const res = jsonDecode(data == null ? void 0 : data.info);
    if (!data || data.code !== 0 || !res) {
      return;
    }
    const map = { 0: "idle", 1: "playing", 2: "paused", 3: "stopped" };
    return {
      ...res,
      status: map[res.status] ?? "unknown",
      volume: res.volume
    };
  }
  /**
   * 获取音量
   */
  async getVolume() {
    const data = await this.getStatus();
    return data == null ? void 0 : data.volume;
  }
  /**
   * 设置音量
   */
  async setVolume(_volume) {
    const volume = Math.round(clamp(_volume, 6, 100));
    const res = await this.callUbus("mediaplayer", "player_set_volume", {
      volume
    });
    return (res == null ? void 0 : res.code) === 0;
  }
  /**
   * 播放
   */
  async play({ text, url, save = 0 } = {}) {
    let res;
    if (url) {
      res = await this.callUbus("mediaplayer", "player_play_url", {
        url,
        type: 1
      });
    } else if (text) {
      res = await this.callUbus("mibrain", "text_to_speech", {
        text,
        save
      });
    } else {
      res = await this.callUbus("mediaplayer", "player_play_operation", {
        action: "play"
      });
    }
    return (res == null ? void 0 : res.code) === 0;
  }
  /**
   * 暂停播放
   */
  async pause() {
    const res = await this.callUbus("mediaplayer", "player_play_operation", {
      action: "pause"
    });
    return (res == null ? void 0 : res.code) === 0;
  }
  /**
   * 播放或暂停
   */
  async playOrPause() {
    const res = await this.callUbus("mediaplayer", "player_play_operation", {
      action: "toggle"
    });
    return (res == null ? void 0 : res.code) === 0;
  }
  /**
   * 停止播放
   */
  async stop() {
    const res = await this.callUbus("mediaplayer", "player_play_operation", {
      action: "stop"
    });
    return (res == null ? void 0 : res.code) === 0;
  }
  /**
   * 获取对话消息列表
   *
   * - 消息列表从新到旧排序
   * - 从游标处由新到旧拉取
   * - 结果包含游标消息本身
   */
  async getConversations(options) {
    var _a, _b;
    const { limit = 10, timestamp } = options ?? {};
    const res = await Http.get(
      "https://userprofile.mina.mi.com/device_profile/v2/conversation",
      {
        limit,
        timestamp,
        requestId: uuid(),
        source: "dialogu",
        hardware: (_a = this.account.device) == null ? void 0 : _a.hardware
      },
      {
        account: this.account,
        setAccount: updateMiAccount(this.account),
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; 000; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 /XiaoMi/HybridView/ micoSoundboxApp/i appVersion/A_2.4.40",
          Referer: "https://userprofile.mina.mi.com/dialogue-note/index.html"
        },
        cookies: {
          userId: this.account.userId,
          serviceToken: this.account.serviceToken,
          deviceId: (_b = this.account.device) == null ? void 0 : _b.deviceId
        }
      }
    );
    if (res.code !== 0) {
      if (Debugger.debug) {
        console.error("\u274C getConversations failed", res);
      }
      return void 0;
    }
    return jsonDecode(res.data);
  }
};
var MIoT = class _MIoT {
  account;
  constructor(account) {
    this.account = account;
  }
  static async getDevice(account) {
    if (account.sid !== "xiaomiio") {
      return account;
    }
    const devices = await _MIoT.__callMIoT(account, "POST", "/home/device_list", {
      getVirtualModel: false,
      getHuamiDevices: 0
    });
    if (Debugger.debug) {
      console.log("\u{1F41B} MIoT \u8BBE\u5907\u5217\u8868: ", jsonEncode(devices, { prettier: true }));
    }
    const device = ((devices == null ? void 0 : devices.list) ?? []).find(
      (e) => [e.did, e.name, e.mac].includes(account.did)
    );
    if (device) {
      account.device = device;
    }
    return account;
  }
  static async __callMIoT(account, method, path, _data) {
    var _a;
    const url = `https://api.io.mi.com/app${path}`;
    const config = {
      account,
      setAccount: updateMiAccount(account),
      rawResponse: true,
      validateStatus: () => true,
      headers: {
        "User-Agent": "MICO/AndroidApp/@SHIP.TO.2A2FE0D7@/2.4.40",
        "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
        "miot-accept-encoding": "GZIP",
        "miot-encrypt-algorithm": "ENCRYPT-RC4"
      },
      cookies: {
        countryCode: "CN",
        locale: "zh_CN",
        timezone: "GMT+08:00",
        timezone_id: "Asia/Shanghai",
        userId: account.userId,
        cUserId: (_a = account.pass) == null ? void 0 : _a.cUserId,
        PassportDeviceId: account.deviceId,
        serviceToken: account.serviceToken,
        yetAnotherServiceToken: account.serviceToken
      }
    };
    let res;
    const data = encodeMIoT(method, path, _data, account.pass.ssecurity);
    if (method === "GET") {
      res = await Http.get(url, data, config);
    } else {
      res = await Http.post(url, encodeQuery(data), config);
    }
    if (typeof res.data !== "string") {
      if (Debugger.debug) {
        console.error("\u274C _callMIoT failed", res);
      }
      return void 0;
    }
    res = await decodeMIoT(
      account.pass.ssecurity,
      data._nonce,
      res.data,
      res.headers["miot-content-encoding"] === "GZIP"
    );
    return res == null ? void 0 : res.result;
  }
  async _callMIoT(method, path, data) {
    return _MIoT.__callMIoT(this.account, method, path, data);
  }
  /**
   * - datasource=1  优先从服务器缓存读取，没有读取到下发rpc；不能保证取到的一定是最新值
   * - datasource=2  直接下发rpc，每次都是设备返回的最新值
   * - datasource=3  直接读缓存；没有缓存的 code 是 -70xxxx；可能取不到值
   */
  _callMIoTSpec(command, params, datasource = 2) {
    return this._callMIoT("POST", `/miotspec/${command}`, {
      params,
      datasource
    });
  }
  /**
   * 获取 MIoT 设备列表
   */
  async getDevices(getVirtualModel = false, getHuamiDevices = 0) {
    const res = await this._callMIoT("POST", "/home/device_list", {
      getVirtualModel,
      getHuamiDevices
    });
    return res == null ? void 0 : res.list;
  }
  /**
   * 获取 MIoT 设备属性值
   */
  async getProperty(scope, property) {
    var _a, _b;
    const res = await this._callMIoTSpec("prop/get", [
      {
        did: this.account.device.did,
        siid: scope,
        piid: property
      }
    ]);
    return (_b = (_a = res ?? []) == null ? void 0 : _a[0]) == null ? void 0 : _b.value;
  }
  /**
   * 设置 MIoT 设备属性值
   */
  async setProperty(scope, property, value) {
    var _a, _b;
    const res = await this._callMIoTSpec("prop/set", [
      {
        did: this.account.device.did,
        siid: scope,
        piid: property,
        value
      }
    ]);
    return ((_b = (_a = res ?? []) == null ? void 0 : _a[0]) == null ? void 0 : _b.code) === 0;
  }
  /**
   * 调用 MIoT 设备能力指令（你可以在 https://home.miot-spec.com/ 查询具体指令）
   *
   * 比如：
   *
   * ```ts
   * await MIoT.doAction(3, 1);
   * await MIoT.doAction(5, 1, "Hello world, 你好！");
   * ```
   */
  async doAction(scope, action, args = []) {
    const res = await this._callMIoTSpec("action", {
      did: this.account.device.did,
      siid: scope,
      aiid: action,
      in: Array.isArray(args) ? args : [args]
    });
    return (res == null ? void 0 : res.code) === 0;
  }
  /**
   * 调用 MIoT 设备 RPC 指令
   */
  rpc(method, params, id = 1) {
    return this._callMIoT("POST", `/home/rpc/${this.account.device.did}`, {
      id,
      method,
      params
    });
  }
};

// src/mi/account.ts
var kLoginAPI = "https://account.xiaomi.com/pass";
async function getAccount(_account) {
  var _a;
  let account = _account;
  let res = await Http.get(
    `${kLoginAPI}/serviceLogin`,
    { sid: account.sid, _json: true, _locale: "zh_CN" },
    { cookies: _getLoginCookies(account) }
  );
  if (res.isError) {
    console.error("\u274C \u767B\u5F55\u5931\u8D25", res);
    return void 0;
  }
  let pass = parseAuthPass(res);
  if (pass.code !== 0) {
    const data = {
      _json: "true",
      qs: pass.qs,
      sid: account.sid,
      _sign: pass._sign,
      callback: pass.callback,
      user: account.userId,
      hash: md5(account.password).toUpperCase()
    };
    res = await Http.post(`${kLoginAPI}/serviceLoginAuth2`, encodeQuery(data), {
      cookies: _getLoginCookies(account)
    });
    if (res.isError) {
      console.error("\u274C OAuth2 \u767B\u5F55\u5931\u8D25", res);
      return void 0;
    }
    pass = parseAuthPass(res);
  }
  if ((_a = pass.notificationUrl) == null ? void 0 : _a.includes("identity/authStart")) {
    console.error("\u274C \u672C\u6B21\u767B\u5F55\u9700\u8981\u9A8C\u8BC1\u7801\uFF0C\u8BF7\u4F7F\u7528 passToken \u91CD\u65B0\u767B\u5F55");
    console.log("\u{1F4A1} \u83B7\u53D6 passToken \u6559\u7A0B\uFF1Ahttps://github.com/idootop/migpt-next/issues/4");
    return void 0;
  }
  if (!pass.location || !pass.nonce || !pass.passToken) {
    console.error("\u274C \u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u4F60\u7684\u8D26\u53F7\u5BC6\u7801\u662F\u5426\u6B63\u786E", res);
    return void 0;
  }
  const serviceToken = await _getServiceToken(pass);
  if (!serviceToken) {
    return void 0;
  }
  account = { ...account, pass, serviceToken };
  account = await MiNA.getDevice(account);
  account = await MIoT.getDevice(account);
  if (account.did && !account.device) {
    console.error(`\u274C \u627E\u4E0D\u5230\u8BBE\u5907\uFF1A${account.did}`);
    console.log(
      "\u{1F41B} \u8BF7\u68C0\u67E5\u4F60\u7684 did \u4E0E\u7C73\u5BB6\u4E2D\u7684\u8BBE\u5907\u540D\u79F0\u662F\u5426\u4E00\u81F4\u3002\u6CE8\u610F\u9519\u522B\u5B57\u3001\u7A7A\u683C\u548C\u5927\u5C0F\u5199\uFF0C\u6BD4\u5982\uFF1A\u97F3\u54CD \u{1F449} \u97F3\u7BB1"
    );
    console.log(
      "\u{1F4A1} \u5EFA\u8BAE\u6253\u5F00 debug \u9009\u9879\uFF0C\u67E5\u770B\u76EE\u6807\u8BBE\u5907\u7684\u771F\u5B9E name\u3001miotDID \u6216 mac \u5730\u5740\uFF0C\u66F4\u65B0 did \u53C2\u6570"
    );
    return void 0;
  }
  return account;
}
function _getLoginCookies(account) {
  var _a;
  return {
    userId: account.userId,
    deviceId: account.deviceId,
    passToken: (_a = account.pass) == null ? void 0 : _a.passToken
  };
}
async function _getServiceToken(pass) {
  var _a;
  const { location, nonce, ssecurity } = pass ?? {};
  const res = await Http.get(
    location,
    {
      _userIdNeedEncrypt: true,
      clientSign: sha1(`nonce=${nonce}&${ssecurity}`)
    },
    { rawResponse: true }
  );
  const cookies = ((_a = res.headers) == null ? void 0 : _a["set-cookie"]) ?? [];
  for (const cookie of cookies) {
    if (cookie.includes("serviceToken")) {
      return cookie.split(";")[0].replace("serviceToken=", "");
    }
  }
  console.error("\u274C \u83B7\u53D6 Mi Service Token \u5931\u8D25", res);
  return void 0;
}

// src/mi/index.ts
var kConfigFile = ".mi.json";
async function getMiService(config) {
  var _a;
  const { service, relogin, ...rest } = config;
  const overrides = relogin ? {} : rest;
  if (overrides.passToken) {
    overrides.pass = {
      ...overrides.pass,
      passToken: overrides.passToken
    };
  }
  const randomDeviceId = `android_${uuid()}`;
  const store = await readJSON(kConfigFile) ?? {};
  let account = {
    deviceId: randomDeviceId,
    ...store[service],
    ...overrides,
    sid: service === "miot" ? "xiaomiio" : "micoapi"
  };
  if (!account.passToken && (!account.userId || !account.password)) {
    console.error("\u274C \u6CA1\u6709\u627E\u5230\u8D26\u53F7\u6216\u5BC6\u7801\uFF0C\u8BF7\u68C0\u67E5\u662F\u5426\u5DF2\u914D\u7F6E\u76F8\u5173\u53C2\u6570\uFF1AuserId, password");
    return;
  }
  account = await getAccount(account);
  if (!(account == null ? void 0 : account.serviceToken) || !((_a = account.pass) == null ? void 0 : _a.ssecurity)) {
    return void 0;
  }
  store[service] = account;
  await writeJSON(kConfigFile, store);
  return service === "miot" ? new MIoT(account) : new MiNA(account);
}

// src/utils/http.ts
var kProxyEnvKeys = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy"
];
var proxyAgent = kProxyEnvKeys.some((key) => process.env[key]) ? new ProxyAgent() : void 0;
var _baseConfig = {
  proxy: false,
  httpAgent: proxyAgent,
  httpsAgent: proxyAgent,
  decompress: true,
  headers: {
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 10; RMX2111 Build/QP1A.190711.020) APP/xiaomi.mico APPV/2004040 MK/Uk1YMjExMQ== PassportSDK/3.8.3 passport-ui/3.8.3"
  }
};
var _http = axios.create(_baseConfig);
_http.interceptors.response.use(
  (res) => {
    if (res.config.rawResponse) {
      return res;
    }
    return res.data;
  },
  async (err) => {
    var _a, _b, _c, _d, _e;
    const newResult = await tokenRefresher.refreshTokenAndRetry(err);
    if (newResult) {
      return newResult;
    }
    const error = ((_b = (_a = err.response) == null ? void 0 : _a.data) == null ? void 0 : _b.error) || ((_c = err.response) == null ? void 0 : _c.data);
    const request = {
      method: err.config.method,
      url: err.config.url,
      headers: jsonEncode(err.config.headers),
      data: jsonEncode({ body: err.config.data })
    };
    const response = !err.response ? void 0 : {
      url: err.config.url,
      status: err.response.status,
      headers: jsonEncode(err.response.headers),
      data: jsonEncode({ body: err.response.data })
    };
    return {
      isError: true,
      code: (error == null ? void 0 : error.code) || ((_d = err.response) == null ? void 0 : _d.status) || err.code || "\u672A\u77E5",
      message: (error == null ? void 0 : error.message) || ((_e = err.response) == null ? void 0 : _e.statusText) || err.message || "\u672A\u77E5",
      error: { request, response }
    };
  }
);
var HTTPClient = class _HTTPClient {
  // 默认 5 秒超时
  timeout = 5 * 1e3;
  async get(url, _query, _config) {
    let query = _query;
    let config = _config;
    if (_config === void 0) {
      config = _query;
      query = void 0;
    }
    return _http.get(_HTTPClient.buildURL(url, query), _HTTPClient.buildConfig(config));
  }
  async post(url, data, config) {
    return _http.post(url, data, _HTTPClient.buildConfig(config));
  }
  static buildURL = (url, query) => {
    const _url = new URL(url);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (isNotEmpty(value)) {
        _url.searchParams.append(key, value.toString());
      }
    }
    return _url.href;
  };
  static buildConfig = (config) => {
    if (config == null ? void 0 : config.cookies) {
      config.headers = {
        ...config.headers,
        Cookie: Object.entries(config.cookies).map(([key, value]) => `${key}=${value == null ? "" : value.toString()};`).join(" ")
      };
    }
    if (config && !config.timeout) {
      config.timeout = Http.timeout;
    }
    return config;
  };
};
var Http = new HTTPClient();
var TokenRefresher = class {
  isRefreshing = false;
  /**
   * 自动刷新过期的凭证，并重新发送请求
   */
  async refreshTokenAndRetry(err, maxRetry = 3) {
    var _a, _b, _c, _d, _e;
    const isMiNA = (_b = (_a = err == null ? void 0 : err.config) == null ? void 0 : _a.url) == null ? void 0 : _b.includes("mina.mi.com");
    const isMIoT = (_d = (_c = err == null ? void 0 : err.config) == null ? void 0 : _c.url) == null ? void 0 : _d.includes("io.mi.com");
    if (!isMiNA && !isMIoT || ((_e = err.response) == null ? void 0 : _e.status) !== 401) {
      return;
    }
    if (this.isRefreshing) {
      return;
    }
    let result;
    this.isRefreshing = true;
    let newServiceAccount = void 0;
    for (let i = 0; i < maxRetry; i++) {
      if (Debugger.debug) {
        console.log(`\u274C \u767B\u5F55\u51ED\u8BC1\u5DF2\u8FC7\u671F\uFF0C\u6B63\u5728\u5C1D\u8BD5\u5237\u65B0 Token ${i + 1}`);
      }
      newServiceAccount = await this.refreshToken(err);
      if (newServiceAccount) {
        result = await this.retry(err, newServiceAccount);
        break;
      }
      await sleep(3e3);
    }
    this.isRefreshing = false;
    if (!newServiceAccount) {
      console.error("\u274C \u5237\u65B0\u767B\u5F55\u51ED\u8BC1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8D26\u53F7\u5BC6\u7801\u662F\u5426\u4ECD\u7136\u6709\u6548\u3002");
    }
    return result;
  }
  /**
   * 刷新登录凭证并同步到本地
   */
  async refreshToken(err) {
    var _a, _b, _c;
    const isMiNA = (_b = (_a = err == null ? void 0 : err.config) == null ? void 0 : _a.url) == null ? void 0 : _b.includes("mina.mi.com");
    const account = (_c = await getMiService({ service: isMiNA ? "mina" : "miot", relogin: true })) == null ? void 0 : _c.account;
    if (account && err.config.account) {
      for (const key in account) {
        err.config.account[key] = account[key];
      }
      err.config.setAccount(err.config.account);
    }
    return account;
  }
  /**
   * 重新请求
   */
  async retry(err, account) {
    const cookies = err.config.cookies ?? {};
    for (const key of ["serviceToken"]) {
      if (cookies[key] && account[key]) {
        cookies[key] = account[key];
      }
    }
    for (const key of ["deviceSNProfile"]) {
      if (cookies[key] && account.device[key]) {
        cookies[key] = account.device[key];
      }
    }
    return _http(HTTPClient.buildConfig(err.config));
  }
};
var tokenRefresher = new TokenRefresher();

export { Http, MIoT, MiNA, getAccount, getMiService };
