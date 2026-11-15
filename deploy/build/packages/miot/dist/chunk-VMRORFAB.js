import * as fs from 'node:fs';
import * as path from 'node:path';
import { jsonDecode, jsonEncode } from '@mi-gpt/utils/parse';

// src/utils/io.ts
var kRoot = process.cwd();
var kEnvs = process.env;
var exists = (filePath) => fs.existsSync(filePath);
var getFullPath = (filePath) => path.resolve(filePath);
var getExtname = (filePath) => path.extname(filePath).slice(1);
var deleteFile = (filePath) => {
  try {
    fs.rmSync(filePath);
    return true;
  } catch {
    return false;
  }
};
var readFile2 = (filePath, options) => {
  const dirname2 = path.dirname(filePath);
  if (!fs.existsSync(dirname2)) {
    return void 0;
  }
  return new Promise((resolve2) => {
    fs.readFile(filePath, options, (err, data) => {
      resolve2(err ? void 0 : data);
    });
  });
};
var writeFile2 = (filePath, data, options) => {
  const dirname2 = path.dirname(filePath);
  if (!fs.existsSync(dirname2)) {
    fs.mkdirSync(dirname2, { recursive: true });
  }
  return new Promise((resolve2) => {
    if (options) {
      fs.writeFile(filePath, data, options, (err) => {
        resolve2(!err);
      });
    } else {
      fs.writeFile(filePath, data, (err) => {
        resolve2(!err);
      });
    }
  });
};
var readString = (filePath) => readFile2(filePath, "utf8");
var writeString = (filePath, content) => writeFile2(filePath, content, "utf8");
var readJSON = async (filePath) => jsonDecode(await readFile2(filePath, "utf8"));
var writeJSON = (filePath, content) => writeFile2(filePath, jsonEncode(content) ?? "", "utf8");
var getFiles = (dir) => {
  return new Promise((resolve2) => {
    fs.readdir(dir, (err, files) => {
      resolve2(err ? [] : files);
    });
  });
};

export { deleteFile, exists, getExtname, getFiles, getFullPath, kEnvs, kRoot, readFile2 as readFile, readJSON, readString, writeFile2 as writeFile, writeJSON, writeString };
