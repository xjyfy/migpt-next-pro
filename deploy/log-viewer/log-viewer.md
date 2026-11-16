# 日志查看（网页版，无需 PHP）

一个单文件 HTML 页面：选日期看历史日志，选当天则每 5 秒自动刷新。

- 页面文件：`index.html`（纯静态、无外部依赖、无 CDN，可离线打开）
- 适用环境：群晖 DSM 6.2 + Web Station（Nginx / Apache 均可）
- 日志来源：容器挂载出来的 `/volume1/docker/migpt/logs/migpt-YYYY-MM-DD.log`

## 为什么不需要 PHP / 不需要新建虚拟主机

Web Station 的默认站点本身就提供服务：DSM 6.2 装好 Web Station 后，**80 端口已经在服务 `/volume1/web`**
（响应头 `Server: willen`）。页面用浏览器 `fetch()` 取同源下的 `.log` 文件，在浏览器端解析、着色、
统计，全程没有后端脚本参与。

> 实测：8080 端口上新建的虚拟主机并没有监听（连接直接被拒），**完全不需要它**。
> 只要把页面和日志都放到 `/volume1/web` 下面，走 80 端口即可。

## 部署（三步）

### 1. 放页面

把 `index.html` 传到 NAS 的 `/volume1/web/logs-view/`：

```bash
mkdir -p /volume1/web/logs-view
# 上传 index.html 到该目录（File Station 拖拽，或 scp）
scp index.html root@<NAS地址>:/volume1/web/logs-view/
```

### 2. 让日志目录可被访问

软链接和虚拟主机别名在实测的 Web Station 配置里都**没有生效**（软链被 Nginx 拒绝、别名未落地），
用 **bind mount**：

```bash
mkdir -p /volume1/web/logs-view/logsdata
mount --bind /volume1/docker/migpt/logs /volume1/web/logs-view/logsdata
```

### 3. 开机自动挂载（必做，否则重启后失效）

DSM 控制面板 → 任务计划 → 新增 → 触发的任务 → 开机 → 用户 `root` → 脚本：

```bash
mkdir -p /volume1/web/logs-view/logsdata
mount --bind /volume1/docker/migpt/logs /volume1/web/logs-view/logsdata
```

### 4. 验证

```bash
# 1) 目录不再 403（说明 index.html 到位）
curl -I http://127.0.0.1/logs-view/
# 2) 日志可读（应 200，Content-Type 为 application/octet-stream）
curl -I http://127.0.0.1/logs-view/logsdata/migpt-$(date +%F).log
```

浏览器访问：`http://<NAS地址>/logs-view/`

## 实测记录（部署时踩过的坑）

| 请求 | 结果 | 说明 |
|---|---|---|
| `http://NAS:8080/logs-view/` | 连接被拒 | 8080 虚拟主机未监听，**不需要它** |
| `http://NAS/logs-view/`（无 index） | 403 | 目录存在但没 index 文件，且禁了目录列表 |
| `http://NAS/logs-view/index.html`（未上传时） | 404 | 页面没放上去 |
| `http://NAS/logs-view/logsdata/migpt-2026-11-16.log` | 200，`application/octet-stream` | bind mount 通过 HTTP 完全可读 |
| `http://NAS/` | 200 | 80 端口默认站点正常，`/volume1/web` 可服务 |

结论：**卡点从来不在挂载，而在页面文件是否到位、以及走的是哪个端口。**

## 页面功能

| 功能 | 说明 |
|---|---|
| 日期选择 | 默认今天，可翻任意一天；无文件时提示"该日没有日志" |
| 当天自动刷新 | 每 5 秒重新取一次，只在行数变化时重绘（不打断滚动） |
| 跟随最新 | 开着就自动滚到底部；手动上滑后可点右下角「回到底部」 |
| 分类筛选 | 🔥提问 / 🤖切大模型 / 🔊播报 / 🔈小爱原生 / ⏸放行超时 / 🛡安全 / 🌐联网 / 📊用量 / ❌错误 / 🧹维护 |
| 关键词过滤 | 对日志正文做包含匹配，可与分类叠加 |
| 统计条 | 顶部显示当天各类事件条数，直接看出"保留原生 vs 切 LLM"的比例 |
| 轮转兼容 | 优先取 `migpt-日期.log`，404 时回退读 `migpt-日期.log.1` |

## 需要改的只有三行

`index.html` 顶部：

```js
const CONFIG = {
  logDir: 'logsdata',               // 日志目录对外路径（bind mount 的目录名）
  fileName: d => `migpt-${d}.log`,  // 与 config.js 的 FILE_LOG 命名一致
  refreshMs: 5000,                  // 当天刷新间隔
};
```

## 常见问题

| 现象 | 原因与处理 |
|---|---|
| 打开 `/logs-view/` 报 403 | `index.html` 没放进去；目录列表是关闭的，没有 index 就 403 |
| 页面能打开但一直"无该日日志" | ① bind mount 没挂（`ls /volume1/web/logs-view/logsdata` 看有没有文件）；② 日期选错；③ 页面 `logDir` 与挂载目录名不一致 |
| 日志文件 403 / 无法读取 | 权限问题：`chmod 755` 目录、`chmod 644 *.log`。容器以 root 写文件，默认 644 即可读 |
| 重启后页面空白 | `mount --bind` 失效，检查第 3 步开机任务是否执行 |
| 通过代理访问返回 503 | 局域网地址被代理接管了，把 NAS 网段加进"不使用代理"名单 |

## 安全提醒

- 日志正文是**家里的语音对话内容**，页面只在内网使用，不要做端口映射到公网。
- 这个目录里**没有** `config.js`，不会暴露 apiKey / passToken。
- 想更稳一层：DSM 防火墙只放行内网网段访问 80；或在 Web Station 上开 HTTP 认证。

## 已知限制

1. 只按"浏览器本地日期"选文件；如果设备时区和 NAS 不一致，日期可能对不上。
2. 全量重取，不做增量 `Range` 请求。单日几百行、几十 KB，5 秒一次无压力；
   将来日志涨到几 MB 再考虑改为续读。
3. 页面纯只读，不写文件、不改日志。
