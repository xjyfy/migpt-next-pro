import * as crypto from 'node:crypto';

// src/utils/hash.ts
function md5(s) {
  return crypto.createHash("md5").update(s).digest("hex");
}
function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("base64");
}
function sha256(snonce, msg) {
  return crypto.createHmac("sha256", Buffer.from(snonce, "base64")).update(msg).digest("base64");
}
function signNonce(ssecurity, nonce) {
  const m = crypto.createHash("sha256");
  m.update(ssecurity, "base64");
  m.update(nonce, "base64");
  return m.digest().toString("base64");
}
function uuid() {
  return crypto.randomUUID();
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

export { md5, randomNoise, randomString, sha1, sha256, signNonce, uuid };
