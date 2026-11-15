'use strict';

var fs = require('fs');
var path = require('path');
var parse = require('@mi-gpt/utils/parse');

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

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__namespace = /*#__PURE__*/_interopNamespace(path);

// src/utils/io.ts
var kRoot = process.cwd();
var kEnvs = process.env;
var exists = (filePath) => fs__namespace.existsSync(filePath);
var getFullPath = (filePath) => path__namespace.resolve(filePath);
var getExtname = (filePath) => path__namespace.extname(filePath).slice(1);
var deleteFile = (filePath) => {
  try {
    fs__namespace.rmSync(filePath);
    return true;
  } catch {
    return false;
  }
};
var readFile2 = (filePath, options) => {
  const dirname2 = path__namespace.dirname(filePath);
  if (!fs__namespace.existsSync(dirname2)) {
    return void 0;
  }
  return new Promise((resolve2) => {
    fs__namespace.readFile(filePath, options, (err, data) => {
      resolve2(err ? void 0 : data);
    });
  });
};
var writeFile2 = (filePath, data, options) => {
  const dirname2 = path__namespace.dirname(filePath);
  if (!fs__namespace.existsSync(dirname2)) {
    fs__namespace.mkdirSync(dirname2, { recursive: true });
  }
  return new Promise((resolve2) => {
    if (options) {
      fs__namespace.writeFile(filePath, data, options, (err) => {
        resolve2(!err);
      });
    } else {
      fs__namespace.writeFile(filePath, data, (err) => {
        resolve2(!err);
      });
    }
  });
};
var readString = (filePath) => readFile2(filePath, "utf8");
var writeString = (filePath, content) => writeFile2(filePath, content, "utf8");
var readJSON = async (filePath) => parse.jsonDecode(await readFile2(filePath, "utf8"));
var writeJSON = (filePath, content) => writeFile2(filePath, parse.jsonEncode(content) ?? "", "utf8");
var getFiles = (dir) => {
  return new Promise((resolve2) => {
    fs__namespace.readdir(dir, (err, files) => {
      resolve2(err ? [] : files);
    });
  });
};

exports.deleteFile = deleteFile;
exports.exists = exists;
exports.getExtname = getExtname;
exports.getFiles = getFiles;
exports.getFullPath = getFullPath;
exports.kEnvs = kEnvs;
exports.kRoot = kRoot;
exports.readFile = readFile2;
exports.readJSON = readJSON;
exports.readString = readString;
exports.writeFile = writeFile2;
exports.writeJSON = writeJSON;
exports.writeString = writeString;
