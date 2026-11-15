// 本地（非 Docker）验证入口：直接读取根目录 config.js 并启动 MiGPT
// 用法：在该仓库根目录执行  node run.mjs
import { MiGPT } from './packages/next/dist/index.js';
import config from './config.js';

await MiGPT.start(config);
