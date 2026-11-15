'use strict';

var crypto = require('crypto');

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

var crypto__namespace = /*#__PURE__*/_interopNamespace(crypto);

// src/utils/hash.ts
function md5(s) {
  return crypto__namespace.createHash("md5").update(s).digest("hex");
}
function sha1(s) {
  return crypto__namespace.createHash("sha1").update(s).digest("base64");
}
function sha256(snonce, msg) {
  return crypto__namespace.createHmac("sha256", Buffer.from(snonce, "base64")).update(msg).digest("base64");
}
function signNonce(ssecurity, nonce) {
  const m = crypto__namespace.createHash("sha256");
  m.update(ssecurity, "base64");
  m.update(nonce, "base64");
  return m.digest().toString("base64");
}
function uuid() {
  return crypto__namespace.randomUUID();
}
function randomString(len) {
  if (len < 1) return "";
  const s = Math.random().toString(36).slice(2);
  return s + randomString(len - s.length);
}
function randomNoise() {
  return Buffer.from(
    Array(12).fill(0).map(() => Math.floor(Math.random() * 256))
  ).toString("base64");
}

exports.md5 = md5;
exports.randomNoise = randomNoise;
exports.randomString = randomString;
exports.sha1 = sha1;
exports.sha256 = sha256;
exports.signNonce = signNonce;
exports.uuid = uuid;
