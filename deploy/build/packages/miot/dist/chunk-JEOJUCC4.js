import { RC4, rc4Hash } from './chunk-ZKYHC3VJ.js';
import { randomNoise, signNonce } from './chunk-34CBAQZN.js';
import { jsonDecode, jsonEncode } from '@mi-gpt/utils/parse';
import * as pako from 'pako';

function encodeBase64(text) {
  return Buffer.from(text).toString("base64");
}
function decodeBase64(base64Encoded) {
  return Buffer.from(base64Encoded, "base64").toString();
}
function parseAuthPass(res) {
  try {
    return jsonDecode(
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
        v = jsonDecode(v);
      } catch {
      }
    }
    data[k] = v;
  }
  return data;
}
function encodeMIoT(method, uri, data, ssecurity) {
  const nonce = randomNoise();
  const snonce = signNonce(ssecurity, nonce);
  const key = Buffer.from(snonce, "base64");
  const rc4 = new RC4(key);
  rc4.update(Buffer.alloc(1024));
  const json = jsonEncode(data);
  const map = { data: json };
  map.rc4_hash__ = rc4Hash(method, uri, map, snonce);
  for (const k in map) {
    const v = map[k];
    map[k] = rc4.update(Buffer.from(v)).toString("base64");
  }
  map.signature = rc4Hash(method, uri, map, snonce);
  map._nonce = nonce;
  map.ssecurity = ssecurity;
  return map;
}
function decodeMIoT(ssecurity, nonce, data, gzip) {
  const key = Buffer.from(signNonce(ssecurity, nonce), "base64");
  const rc4 = new RC4(key);
  rc4.update(Buffer.alloc(1024));
  let decrypted = rc4.update(Buffer.from(data, "base64"));
  let error = void 0;
  if (gzip) {
    try {
      decrypted = pako.ungzip(decrypted, { to: "string" });
    } catch (err) {
      error = err;
    }
  }
  const res = jsonDecode(decrypted.toString());
  if (!res) {
    console.error("\u274C decodeMIoT failed", error);
  }
  return Promise.resolve(res);
}

export { decodeBase64, decodeMIoT, decodeQuery, encodeBase64, encodeMIoT, encodeQuery, parseAuthPass };
