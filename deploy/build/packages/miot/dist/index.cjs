'use strict';

var chunkQAD544EJ_cjs = require('./chunk-QAD544EJ.cjs');
var chunk2XIN2INV_cjs = require('./chunk-2XIN2INV.cjs');
require('./chunk-O6WARVES.cjs');
require('./chunk-7QIAJWRJ.cjs');
require('./chunk-NBV7OMS2.cjs');
require('./chunk-GDJCZQM3.cjs');
require('./chunk-BTIFRWSP.cjs');

// src/index.ts
async function getMIoT(config) {
  chunk2XIN2INV_cjs.Debugger.debug = config.debug;
  chunkQAD544EJ_cjs.Http.timeout = config.timeout ?? chunkQAD544EJ_cjs.Http.timeout;
  return chunkQAD544EJ_cjs.getMiService({ service: "miot", ...config });
}
async function getMiNA(config) {
  chunk2XIN2INV_cjs.Debugger.debug = config.debug;
  chunkQAD544EJ_cjs.Http.timeout = config.timeout ?? chunkQAD544EJ_cjs.Http.timeout;
  return chunkQAD544EJ_cjs.getMiService({ service: "mina", ...config });
}

Object.defineProperty(exports, "MIoT", {
  enumerable: true,
  get: function () { return chunkQAD544EJ_cjs.MIoT; }
});
Object.defineProperty(exports, "MiNA", {
  enumerable: true,
  get: function () { return chunkQAD544EJ_cjs.MiNA; }
});
exports.getMIoT = getMIoT;
exports.getMiNA = getMiNA;
