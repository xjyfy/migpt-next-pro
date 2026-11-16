# 小爱音箱接豆包 · MiGPT-Next 增强版（migpt-next-pro）

让小爱音箱PLAY（L05B）接上大模型：**小爱答得上的自己答，答不上的交给豆包**，实时问题自动联网，危险问题强制换人答。

## 这个仓库从哪来

本仓库是**二次开发**，不是从零写的，血缘关系如下：

| 层级 | 仓库 | 做了什么 |
|---|---|---|
| 上游原版 | [idootop/migpt-next](https://github.com/idootop/migpt-next) | 项目本体，**已停止维护** |
| 本仓库的修改基础 | [whBettering/migpt-next-2](https://github.com/whBettering/migpt-next-2) | 在其基础上完成了防抢话、联网搜索、保留原生回答、代理、非流式问答等第一轮增强 |
| 当前仓库 | [xjyfy/migpt-next-pro](https://github.com/xjyfy/migpt-next-pro) | 在 `migpt-next-2` 基础上继续做参数调优、儿童安全分流、日志与观测、联网词表外置等增强 |

也就是说：**本仓库的代码 = `whBettering/migpt-next-2` + 我们在真机上踩坑后的继续优化**。所有改动都经过真机实测、日志复盘和参数调整，不是原版照搬。

## 开始之前先知道三件事

**1️⃣ 为什么选火山方舟（豆包）—— 因为有每月赠送额度**

火山方舟有**每月赠送的免费额度**（具体额度与活动规则以方舟控制台的「赠送/资源包」页为准，会随活动调整），日常家用（每天几十次问答）通常能用赠送额度覆盖。相比 OpenAI、DeepSeek 等纯按量付费的厂商，这是本仓库选择适配火山接口的主要原因。本仓库的请求参数也是照着方舟的字段写的（见下一节）。

**2️⃣ 基础镜像 `migpt-next-base.tar` 需要自己下载，仓库里没有**

构建镜像的第一行是 `FROM idootop/migpt-next:latest`，这层基础镜像（178MB）在 **Docker Hub 上**，国内网络经常拉不动。仓库**不包含**导出的 57.79MB tar 包（避免仓库臃肿），所以首次部署要自己准备一次：

```bash
# 在一台能访问 Docker Hub 的机器上（可挂代理）
crane pull --platform linux/amd64 idootop/migpt-next:latest migpt-next-base.tar

# 把 tar 拷到目标机器（NAS）后
docker load -i migpt-next-base.tar
docker images | grep migpt        # 能看到 idootop/migpt-next  latest  178MB 即成功
```

有这层本地缓存之后，`docker build` 就完全不需要联网。**只有重建镜像时才需要它，容器重启/重建都不用。**

**3️⃣ 只对接了火山方舟（见下一节，换别家要自己改代码）**

---

## ⚠️ 只对接了火山方舟（豆包）

**本仓库只为火山方舟（`ark.cn-beijing.volces.com/api/v3` + 豆包模型）做过适配和实测，其它厂商（OpenAI、DeepSeek、通义、智谱等）没有测试过，不保证可用。**

原因是本仓库有几处**火山专有**的写法，换成别家会直接报错或被静默忽略：

| 位置 | 火山专有写法 | 换别家的后果 |
|---|---|---|
| Chat 路径（`openai.extra.createParams`） | `thinking: { type: 'disabled' }` 关闭深度思考 | 多数厂商不认识该字段，可能 400，也可能被忽略（那就每次多等十几秒） |
| Responses 路径（联网搜索分支） | `reasoning: { effort: 'minimal' }` | 同上的问题 |
| 联网搜索 | `tools: [{ type: 'web_search' }]` + 顶层 `max_tool_calls` + `user_location` | 只有火山「联网内容插件」认这套参数 |
| 模型名 | `doubao-seed-evolving`（可直接用模型 ID，无需 `ep-` 接入点） | 其它厂商需换成自己的模型名 |

想让本仓库跑别家模型，需要自己改 `packages/openai/src/index.ts` 里的请求参数并重新构建——**那部分不在本仓库的支持范围**。

---

## 相比原版做了哪些改进

### 一、体验与稳定性

| 改进 | 说明 |
|---|---|
| 关闭深度思考 | Chat 用 `thinking.type=disabled`、Responses 用 `reasoning.effort=minimal`，单次回答 17.3s → 3.1s |
| 只保留 MIoT 抢占 | 实测 `doAction(5, 3)` 自带音频焦点抢占，移除 MiNA 双通道竞态，开口漏字从 5 字降到 0~2 字 |
| 自适应心跳 | 空闲 500ms、刚对话完 15 秒内 300ms，比全天 300ms 少约 65% 的小米接口请求 |
| 夜间暂停 | 默认 22:00–08:00 完全不轮询，小爱恢复纯原生，早上 8 点自动恢复（日志有 `🌙` / `☀️`） |
| 错误退避 | 认证类错误 3 秒重试一次、仍失败则退出；其它错误 1s→2s→5s→10s→30s→60s 递增，不再疯狂重连刷日志 |
| 播报清洗 | `toSpeakable()` 剥掉 Markdown、星号、编号、括号注释、短括号、颜文字，压空白，超 100 字在句末截断 |
| 剪短提示词 | 口语化、≤80 字，避免音箱念符号或长回答被截断 |

### 二、要不要接管（省 token 的核心）

| 改进 | 说明 |
|---|---|
| 保留小爱原生回答 | 小爱答得上来就**不调模型、零 token**；只有命中"答不上来"话术才切换 |
| 更全的"答不上来"词表 | 在原版基础上补了 `不太擅长 / 暂不支持 / 没找到 / 等我学习 / 学习再告诉 / 我也想知道答案 / 值得思考的问题` 等真实出现在日志里的话术 |
| 技能流静默放行（A 方案） | 900ms 内等不到文本回答 = 小爱在播技能（笑话/故事/音乐）或执行设备指令 → **返回 `handled: true` 直接放行**，不接管、不打断，让它自己播完 |
| 放行后复查 | 放行后每 300ms 复查一次、共 1.6s，若期间原生回答到了就记录 `🔎`；实测"放行后误判 0" |
| 控制指令永不进模型 | `退下 / 闭嘴 / 别说了 / 停止 / 安静 / 别播了 / 不用了` 直接交给小爱原生处理（`🛑`） |

### 三、联网搜索（火山方舟 Responses API）

| 改进 | 说明 |
|---|---|
| 本地词表先筛（`hybrid`） | ① 危险主题 → 不联网；② 明确要求联网 → 联网；③ 时效类主题 × 时间词 → 联网；④ 新闻时政 × 时间词 → 联网（`junior` 档）；其余一律不搜。常识题省下 3~5 秒和一次搜索费 |
| 词表外置 | 全部触发词写在 `config.js` 的 `webSearch.patterns` 里，改词只需 `docker restart`，不用重新构建 |
| 参数全部可配 | `maxKeyword`（优化关键词数）、`limit`（返回条数）、`maxToolCalls`（最大轮次）、`userLocation`（地理位置，提升本地类问题命中）、`ageBand` |
| 只走全网搜索 | 不传 `sources`，避开 `douyin` / `moji` / `toutiao` 三个额外付费源 |
| 结果清洗 | `sanitizeWebSearchText()` 移除 URL、Markdown 链接与引用角标，提示词也要求"不要念网址"——实测回答里一个网址都没有 |
| 失败自动降级 | 联网异常时回退普通模型回答，并在前面拼一句 `fallbackNotice`，不会静默给过时答案 |
| 实测数据 | 单次联网：5.3~7.7s、5.6k~6.7k 输入 tokens（普通问答 462 tokens 的 12~14 倍）；`tool_choice:'auto'` + `max_tool_calls` + `user_location` 全部被接受 |

### 四、儿童安全（可整体关闭）

| 改进 | 说明 |
|---|---|
| 总开关 | `CHILD_SAFETY = { enabled, ageBand }`，一处控制"提示词 + 危险分流"两件事。**不需要儿童防护的使用者设 `enabled: false`，即回落到通用提示词** |
| 分档提示词 | `primary`（6~11 岁）/ `junior`（12~15 岁，初中生通识教育需要时政新闻，所以放开新闻）；提示词要求口语化、≤80 字、不涉及暴力恐怖恋爱情色烟酒毒品、不提供医疗与危险操作建议 |
| 危险主题分流 | 命中 `kDangerPattern`（`跳下 / 自杀 / 吃什么药 / 剂量 / 抗生素 / 浓硫酸 / 制取 / 火药` 等）时**跳过小爱原生回答**，强制交给模型按安全模板温和拒绝，且**不联网** |
| 为什么需要 | 日志复盘发现小爱原生回答会给"肚子疼吃什么药"报"诺氟沙星等抗生素"、给"恐怖故事"直接播灵异音频、给"常见酸"讲工业制取——这些原生流拦不住，只能靠分流 |

### 五、可观测性

| 改进 | 说明 |
|---|---|
| 日志落盘 | 同步写 `${FILE_LOG.dir}/migpt-YYYY-MM-DD.log`，5MB 轮转，**启动时自动清理超过 `keepDays`（默认 7 天）的旧文件**；`FILE_LOG.enabled: false` 可整体关掉 |
| token 用量 | 每次调用打印 `📊 Chat/Responses 输入X 输出Y 缓存命中Z`，兼容 Chat 与 Responses 两套字段名，字段缺失会明确写"缓存字段缺失" |
| 关键节点日志 | `🔥` 收到问题、`🔈` 保留原生、`🤖` 切换模型、`🌐` 走了联网、`🛡` 安全分流、`⏸` 静默放行、`🔎` 放行后复查、`🔊` 播报内容与字数、`⏱` 原生回答到达耗时 |

---

## 快速开始

### 0. 前置准备

1. **小米账号的 `passToken`**（推荐）或密码。`passToken` 有 300+ 字符，等同密码，**不要发给任何人**。
   用 `password` 容易撞上小米安全验证，推荐 `passToken` + `password: ''`，`userId` 填米家账号的纯数字 ID。
2. **火山方舟 API Key**，并**开通「联网内容插件」**（控制台 → 在线推理 → 联网搜索）。不要开通 `douyin / moji / toutiao` 这三个付费源。
3. **Docker**。NAS 用自带套件（群晖 DSM 7 是 Container Manager，DSM 6 是 Docker），Windows/macOS 用 Docker Desktop。

### 1. 下载代码

```bash
git clone https://github.com/xjyfy/migpt-next-pro
cd migpt-next-pro
```

> 不会命令行也可以在 GitHub 页面点 **Download ZIP** 解压。

### 2. 写配置

```bash
cp config.example.js config.js
```

然后打开 `config.js`，**至少改这 5 处**：

```js
speaker: {
  userId: '米家账号的纯数字 ID',
  password: '',                    // 用 passToken 时留空
  passToken: '你的 passToken',
  did: '小爱音箱在米家里显示的名字',  // 必须与米家里的设备名完全一致
},
openai: {
  apiKey: '你的方舟 API Key',        // ark- 开头
  model: 'doubao-seed-evolving',     // 可直接用模型 ID
},
```

`config.js` 已在 `.gitignore` 里，**不会被提交**。

### 3. 构建镜像

**方式 A：不装 Node，直接用仓库内置的编译产物（推荐给 NAS）**

`deploy/build/packages/*/dist` 已随仓库提供，直接构建：

```bash
docker build -t migpt-next:local ./deploy/build
```

**方式 B：改了源码后自己编译**

```bash
npx pnpm@9.15.9 install
npx pnpm@9.15.9 build          # 8 个包全部 success
docker build -f Dockerfile.local -t migpt-next:local .
```

> 方式 A / B 的第一步都要先 `FROM idootop/migpt-next:latest`，这层基础镜像需要本地已 `docker load` 过
> （见开头「开始之前先知道 2️⃣ 基础镜像」）。否则 `docker build` 会卡在这行去拉 Docker Hub。

### 4. 启动容器

```bash
docker run -d \
  --name migpt-next \
  --restart unless-stopped \
  --network host \
  -e TZ=Asia/Shanghai \
  -v /path/to/config.js:/app/config.js:ro \
  -v /path/to/logs:/app/logs \
  --log-opt max-size=10m --log-opt max-file=3 \
  migpt-next:local
```

几条参数别省：

- **`--network host`**：群晖等 NAS 的防火墙默认拒 `172.17.0.0/16`，bridge 模式下容器连网关都通不出去，表现为 `EAI_AGAIN` / `ECONNABORTED timeout of 5000ms`。本服务不监听端口，host 网络无副作用。
- **`-e TZ=Asia/Shanghai`**：夜间暂停 22:00–08:00 按容器内本地时间判断，时区错了会整段错位，所以这个必须给对。
  ⚠️ **不要用 `docker exec migpt-next date` 来验证时区**：本项目基础镜像没装 tzdata，`date` 这类系统命令找不到时区文件就显示 `UTC`，这是**假象**；而 Node.js 用自带的 ICU 时区数据，`TZ=Asia/Shanghai` 对它照常生效，服务时间和日志都是北京时间。
  正确验证方式：
  ```bash
  docker exec migpt-next node -e 'console.log(new Date().toString())'
  # 期望：Sun Nov 15 2026 23:15:42 GMT+0800 (China Standard Time)
  ```
- **`--restart unless-stopped`**：NAS 重启后容器自动拉起（群晖 DSM 6.x 没有 systemd，这是等效开机自启）。
- **`config.js` 只读挂载**：改配置不用重建镜像，`docker restart migpt-next` 即可。

### 5. 跑起来之后确认

```bash
docker logs -f migpt-next
```

正常启动会有：

```
✅ 服务已启动...
⏱ 心跳：空闲 500ms / 对话后 300ms（窗口 15000ms）
🌙 夜间暂停：22:00-08:00（窗口内不轮询，小爱原生回答）
```

然后对着音箱说几句验收：

| 说什么 | 期望看到 |
|---|---|
| 小爱同学，今天天气怎么样 | `🔈 保留小爱原生回答`（不调模型、零 token） |
| 小爱同学，麦克风阵列声源定位的原理是什么 | `🤖 小爱无法回答，切换外接 LLM` + `🔊 播报：…（N字）` |
| 小爱同学，今天有什么新闻 | `🌐 已使用联网搜索` + `📊 Responses 输入5xxx …` |
| 小爱同学，肚子疼吃什么药 | `🛡 安全分流…`，且**没有** `🌐` |
| 小爱同学，退下 | `🛑 播报控制指令`，**没有** `🔊` |
| 小爱同学，给我讲个笑话 | `⏸ 静默放行` + `🔎 始终无文本`，小爱自己讲完不被打断 |

---

## 为什么建议部署在同局域网的 NAS 上

本项目的本质是**一个常驻轮询进程**：它每隔几百毫秒查一次小米云端有没有新消息，收到就决定"放行还是接管"。

放 NAS 上、并且和音箱同局域网，收益很直接：

| 收益 | 说明 |
|---|---|
| 7×24 常驻 | 电脑关机、笔记本换网，服务都不断；用 Docker `--restart unless-stopped` 开机自启 |
| 不占主力机 | 空闲时每分钟 120 次轮询、刚对话后 200 次/分钟，放笔记本上白烧电、睡眠就断 |
| 网络路径最短 | 音箱 → 小米云 → 你的 NAS（内网）→ 火山方舟。NAS 走有线，比 Wi-Fi 笔记本稳 |
| 与家里其它服务同机 | 已经在跑 AdGuard Home、Home Assistant 的 NAS，多一个不到 100MB 的容器没负担 |
| 延迟可见 | 同网段排查小米接口问题最直接：`docker exec` 进容器 `nslookup account.xiaomi.com` 就知道是 DNS 还是防火墙 |

反过来说：**不建议跑在群晖的 Docker 里再套代理、也不建议只在自己电脑上试**——前者会让小米接口绕一圈，后者一关机就哑。

---

## 关键配置速查

| 配置 | 作用 | 建议值 |
|---|---|---|
| `speaker.did` | 米家里的设备名 | 必须完全一致，否则 `❌ 找不到设备` |
| `speaker.ttsCommand` | TTS 播放指令 | L05B（小爱音箱 Play）用 `[5, 3]`；别的型号要自己试 |
| `speaker.streamResponse` | 是否流式 | L05B 必须 `false` |
| `context.historyMaxLength` | 每次带给模型的历史条数 | `2`。设 0 也会被兜底成 1（`Math.max(1, …)`），无法真正关闭 |
| `stream.maxReplyLength` | 流式分句长度 | 仅流式用；实际长度控制点在 `toSpeakable()` 的 MAX=100 |
| `callAIKeywords` | 消息前缀白名单 | `['']` 匹配一切。改成具体词等于放弃兜底 |
| `openai.webSearch.enabled` | 联网开关 | `true`；觉得慢/费钱改 `false`，重启即生效 |
| `openai.webSearch.strategy` | `hybrid` / `auto` | `hybrid` 用本地词表先筛；`auto` 每题都让模型判断（更贵更慢） |
| `openai.webSearch.maxToolCalls` | 最大工具轮次 | `1`（语音场景等不起第二轮） |
| `CHILD_SAFETY.enabled` | 儿童防护总开关 | `true`；不需要儿童防护的使用者改 `false` |
| `CHILD_SAFETY.ageBand` | 年龄档 | `primary`（6~11）/ `junior`（12~15，放开时政新闻） |
| `FILE_LOG.keepDays` | 日志保留天数 | `7` |
| `FILE_LOG.enabled` | 是否落盘日志 | `true`；关掉只留 `docker logs` |

---

## 日志与排障

日志同时进两处：`docker logs` 和挂载目录里的 `migpt-YYYY-MM-DD.log`（5MB 轮转，保留 7 天）。

| 日志 / 现象 | 含义与处理 |
|---|---|
| `📊 Chat 输入493 输出40 缓存命中0` | token 用量。本用法输入只有 460~500 tokens，**低于隐式缓存 1024 的门槛**，所以这里长期是 0，属正常；省 token 只能靠少发上下文（`historyMaxLength`） |
| `🌐 已使用联网搜索` + `📊 Responses 输入5xxx` | 联网生效。频次建议 <5%，太高就把 `newsTopic` 收窄到"新闻/时事/时政" |
| `❌ 联网搜索异常，将使用普通模型回答` | ① 没开通联网内容插件；② 参数被拒；③ `user_location` 字段名不对。看报错原文 |
| `🛡 安全分流` | 命中危险主题，已改由模型回答且不联网。误伤了就删 `kDangerPattern` 里对应词 |
| `⏸ 静默放行` + `🔎 始终无文本` | 小爱在播技能或执行指令，本次没接管——这是设计行为，不是故障 |
| `❌ 登录失败 … EAI_AGAIN` | 容器 DNS 不通。多半是 NAS 防火墙拦了 bridge 网段，改 `--network host` |
| `❌ 认证类错误且重试无效` | passToken 过期或小米风控，重新取 passToken 后重启 |
| 有 `🔊` 但音箱没声音 | 该分支没 `return { handled: true }` 就会落到引擎默认分支；也检查 `ttsCommand` 是否适配你的机型 |
| `⚠️ 联网词表正则无效，已忽略` | `webSearch.patterns` 里某个正则写错了，改回 `|` 连接的纯词串 |

---

## 已知限制（不是配置问题）

1. **L05B 不支持连续对话**。`streamResponse=false` 且无播放状态查询，每句都要「小爱同学，xxx」唤醒，体验上限是单轮问答，端到端 3~8 秒。
2. **漏字 0~2 字是物理下限**。必须等小米云端生成 `xiaoAIAnswer` 才能判断"答不上来"，那时小爱已经开始播了。
3. **隐式缓存不解决本场景**。火山隐式缓存要前缀 ≥ 1024 tokens 才写入（本模型走默认门槛）。实测 5253 tokens 前缀连发：带 `prompt_cache_key` 6 次命中 2 次、不带 3 次命中 1 次，说明能命中但不保证；而我们的真实输入只有 460~500 tokens，**永远够不到门槛**，所以 `缓存命中` 长期为 0，只能靠 `historyMaxLength` 控制上下文。
4. **联网是外部文本**。提示词只能约束"怎么转述"，无法保证搜索结果本身适合儿童——所以危险主题直接禁止联网。
5. **依赖小米私有接口**（MiNA / MiOT，非官方 SDK）。小米改协议或收紧风控会导致整体失效，属外部不可控。
6. **只测过火山方舟**（见开头）。换厂商需要自己改代码。

---

## 仓库结构

```
packages/
  miot/      小米接口封装（MiNA / MiOT / 云登录）
  openai/    大模型调用（Chat + Responses 联网搜索 + 用量日志）
  engine/    引擎（消息轮询、设备动作）
  next/      编排层（onMessage 决策、心跳、夜间暂停、退避）
  chat/      对话上下文
  config/    配置合并
  stream/    TTS 流式分句
  utils/     工具函数
deploy/
  build/     可直接构建的镜像上下文（Dockerfile + 4 个包的编译产物）
config.example.js   脱敏示例配置（复制成 config.js 再填凭证）
Dockerfile.local    从仓库根的编译产物构建镜像
```

> `deploy/build` 里的 dist 是我们调优后的产物；如果自己改了源码，记得重新 `pnpm build` 并覆盖 `deploy/build/packages/*/dist`，否则构建出来还是旧行为。

---

## 免责声明

本项目仅供学习研究，与小米官方无关，请勿用于商业用途。继续使用即代表同意 [用户协议](agreement.md)。

## License

MIT License © 2024-PRESENT [Del Wang](https://del.wang)
