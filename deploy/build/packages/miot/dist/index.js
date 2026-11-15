import { Http, getMiService } from './chunk-NVXOWJEJ.js';
export { MIoT, MiNA } from './chunk-NVXOWJEJ.js';
import { Debugger } from './chunk-3NNRBEOI.js';
import './chunk-VMRORFAB.js';
import './chunk-LJ4UQOR2.js';
import './chunk-JEOJUCC4.js';
import './chunk-ZKYHC3VJ.js';
import './chunk-34CBAQZN.js';

// src/index.ts
async function getMIoT(config) {
  Debugger.debug = config.debug;
  Http.timeout = config.timeout ?? Http.timeout;
  return getMiService({ service: "miot", ...config });
}
async function getMiNA(config) {
  Debugger.debug = config.debug;
  Http.timeout = config.timeout ?? Http.timeout;
  return getMiService({ service: "mina", ...config });
}

export { getMIoT, getMiNA };
