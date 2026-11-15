'use strict';

var chunkGDJCZQM3_cjs = require('./chunk-GDJCZQM3.cjs');
var chunkBTIFRWSP_cjs = require('./chunk-BTIFRWSP.cjs');
var parse = require('@mi-gpt/utils/parse');
var pako = require('pako');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var pako__namespace = /*#__PURE__*/_interopNamespace(pako);

function encodeBase64(text) {
  return Buffer.from(text).toString("base64");
}
function decodeBase64(base64Encoded) {
  return Buffer.from(base64Encoded, "base64").toString();
}
function parseAuthPass(res) {
  try {
    return parse.jsonDecode(
      res.replace("&&&START&&&", "").replace(/:(\d{9,})/g, ':"$1"')
      // 把 userId 和 nonce 转成 string
    ) ?? {};
  } catch {
    return {};
  }
}
function encodeQuery(data) {
  return Object.entries(data).map(
    ([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value == null ? "" : value.toString())}`
  ).join("&");
}
function decodeQuery(str) {
  const data = {};
  if (!str) {
    return data;
  }
  const ss = str.split("&");
  for (let i = 0; i < ss.length; i++) {
    const s = ss[i].split("=");
    if (s.length != 2) {
      continue;
    }
    const k = decodeURIComponent(s[0]);
    let v = decodeURIComponent(s[1]);
    if (/^\[{/.test(v)) {
      try {
        v = parse.jsonDecode(v);
      } catch {
      }
    }
    data[k] = v;
  }
  return data;
}
function encodeMIoT(method, uri, data, ssecurity) {
  const nonce = chunkBTIFRWSP_cjs.randomNoise();
  const snonce = chunkBTIFRWSP_cjs.signNonce(ssecurity, nonce);
  const key = Buffer.from(snonce, "base64");
  const rc4 = new chunkGDJCZQM3_cjs.RC4(key);
  rc4.update(Buffer.alloc(1024));
  const json = parse.jsonEncode(data);
  const map = { data: json };
  map.rc4_hash__ = chunkGDJCZQM3_cjs.rc4Hash(method, uri, map, snonce);
  for (const k in map) {
    const v = map[k];
    map[k] = rc4.update(Buffer.from(v)).toString("base64");
  }
  map.signature = chunkGDJCZQM3_cjs.rc4Hash(method, uri, map, snonce);
  map._nonce = nonce;
  map.ssecurity = ssecurity;
  return map;
}
function decodeMIoT(ssecurity, nonce, data, gzip) {
  const key = Buffer.from(chunkBTIFRWSP_cjs.signNonce(ssecurity, nonce), "base64");
  const rc4 = new chunkGDJCZQM3_cjs.RC4(key);
  rc4.update(Buffer.alloc(1024));
  let decrypted = rc4.update(Buffer.from(data, "base64"));
  let error = void 0;
  if (gzip) {
    try {
      decrypted = pako__namespace.ungzip(decrypted, { to: "string" });
    } catch (err) {
      error = err;
    }
  }
  const res = parse.jsonDecode(decrypted.toString());
  if (!res) {
    console.error("\u274C decodeMIoT failed", error);
  }
  return Promise.resolve(res);
}

exports.decodeBase64 = decodeBase64;
exports.decodeMIoT = decodeMIoT;
exports.decodeQuery = decodeQuery;
exports.encodeBase64 = encodeBase64;
exports.encodeMIoT = encodeMIoT;
exports.encodeQuery = encodeQuery;
exports.parseAuthPass = parseAuthPass;
