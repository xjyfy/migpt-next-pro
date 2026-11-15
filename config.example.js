// 这是脱敏后的示例配置：复制为 config.js 后填入自己的小米账号与方舟 API Key。
// config.js 已被 .gitignore 忽略，不会被提交。

import fs from 'node:fs';
import path from 'node:path';

/**
 * 运行日志落盘开关。
 *
 * - `enabled`：false 时只走 docker logs，不写文件（开源给不需要落盘的使用者）
 * - `keepDays`：保留天数，启动时清理超过 N 天的 migpt-*.log / migpt-*.log.1
 * - `maxFileMB`：单文件超过该体积就轮转为 .1（一天问得特别多时才会触发）
 *
 * 落盘失败不影响主流程（全部 try/catch 兜住）。
 */
const FILE_LOG = {
  enabled: true,
  dir: process.env.MIGPT_LOG_DIR || '/app/logs',
  maxFileMB: 5,
  keepDays: 7,
};

function initFileLog() {
  if (!FILE_LOG.enabled) {
    console.log('🗒 文件日志已关闭（仅输出到 docker logs）');
    return;
  }

  const dir = FILE_LOG.dir;
  const maxBytes = FILE_LOG.maxFileMB * 1024 * 1024;
  const pad = (n) => String(n).padStart(2, '0');
  const now = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // 启动时清理过期日志：只动自己写的 migpt-*.log / migpt-*.log.N，别的一概不碰
  const cleanup = () => {
    try {
      const expireMs = FILE_LOG.keepDays * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - expireMs;
      let removed = 0;
      for (const name of fs.readdirSync(dir)) {
        if (!/^migpt-.*\.log(\.\d+)?$/.test(name)) continue;
        const file = path.join(dir, name);
        try {
          if (fs.statSync(file).mtimeMs < cutoff) {
            fs.unlinkSync(file);
            removed += 1;
          }
        } catch {}
      }
      if (removed > 0) {
        console.log(`🧹 已清理 ${removed} 个超过 ${FILE_LOG.keepDays} 天的日志文件`);
      }
    } catch {}
  };

  const write = (level, args) => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `migpt-${today()}.log`);
      try {
        if (fs.statSync(file).size > maxBytes) fs.renameSync(file, `${file}.1`);
      } catch {}
      const line =
        `[${now()}] [${level}] ` +
        args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' ') +
        '\n';
      fs.appendFileSync(file, line);
    } catch {}
  };

  cleanup();
  for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      write(level, args);
    };
  }
}

initFileLog();

/**
 * 儿童安全防护总开关（含提示词与安全分流）。
 *
 * - `enabled: false` → 使用通用提示词，不启用"危险主题跳过原生回答"的分流。
 *   开源给不需要儿童防护的使用者时，改这一处即可。
 * - `ageBand` → 传给联网词表：`primary`（6~11 岁，不触发新闻时政）｜`junior`（12~15 岁，放开时政）
 */
const CHILD_SAFETY = {
  enabled: true,
  ageBand: 'junior',
};

/**
 * 危险主题词表：命中后不看小爱原生回答，直接交给 LLM（由提示词温和拒绝），
 * 同时联网层也会命中同一份词表并判定为"不联网"，避免把危险细节抓回来。
 *
 * 仅 CHILD_SAFETY.enabled 时生效。
 */
const kDangerPattern =
  '跳下|跳楼|自杀|割腕|失血|吃什么药|药量|剂量|抗生素|毒药|浓硫酸|浓硝酸|制取|火药|炸药';
const kDangerRegex = new RegExp(`(?:${kDangerPattern})`, 'i');

/**
 * 通用提示词（CHILD_SAFETY.enabled = false 时使用）
 */
const PROMPT_DEFAULT =
  '你是一个智能音箱的语音助手，回答会被直接朗读出来。' +
  '说话自然、简短，每次不超过 80 个字，先给结论再补一句原因。' +
  '不要用 Markdown、星号、井号、编号列表、括号注释或表情符号，不要分点。' +
  '拿不准的事就说这个我不太确定，不要编。' +
  '和地点有关的问题按实际城市说，别讲得太笼统。' +
  '知识问题讲得简单、准确；作业题给出思路和答案，并鼓励自己再想一遍。';

/**
 * 儿童提示词（CHILD_SAFETY.enabled = true 时使用）
 *
 * 面向 6~15 岁，四类约束：
 * 1) 表达：口语化、短句、≤80 字（与 toSpeakable 的 100 字上限留余量）
 * 2) 内容：不涉暴力血腥/恐怖/恋爱性/烟酒毒品/自伤方法/危险动作指导
 * 3) 安全：不索取个人信息、不引荐陌生人、不推销充值、不冒充真人家长医生
 * 4) 求助：被欺负、难过、想伤害自己时，鼓励告诉信任的大人，而不是说教
 */
const PROMPT_CHILD =
  '你在给 6 到 15 岁的孩子当语音助手，回答会被直接朗读出来。' +
  '说话像个亲切的大人，用词简单、句子短，每次不超过 80 个字，先给结论再补一句原因。' +
  '不要用 Markdown、星号、井号、编号列表、括号注释或表情符号，不要分点。' +
  '先想一想：这个问题是不是这个年龄的孩子会问、也该知道的；只有符合年龄、同时确实需要最新消息时，才去联网查。' +
  '只讲适合孩子的内容：不涉及暴力血腥、恐怖惊悚、恋爱和性、烟酒赌博毒品，' +
  '不讲自杀自伤的方法，也不教玩火、触电、吞异物、爬高这类危险动作，不给任何伤害人的做法。' +
  '碰到这类问题，就用一句话温和拒绝，再说这个可以问问爸爸妈妈或老师，不解释细节、不猎奇。' +
  '时政和新闻类问题，只说公开的事实和背景：发生了什么、在哪里、涉及谁、结果怎样；不评价、不站立场、不猜测动机、不转述传言。' +
  '新闻里如果出现伤亡、暴力、灾难的细节，用一句话概括就好，不渲染、不描述过程。' +
  '不看病、不开药、不说药量；身体不舒服就说要告诉家长、去看医生。' +
  '不追问也不记住孩子的姓名、住址、电话、学校、密码，不鼓励和陌生人联系或单独见面，不推销东西、不引导充值。' +
  '不假装自己是真人、家长或医生；拿不准的事就说这个我不太确定。' +
  '如果孩子说自己难过、被欺负或想伤害自己，先认真听，再鼓励他告诉信任的大人，不要说教。' +
  '联网结果只说结论，不念网址、不提网站名字、不带序号或来源编号；没查到就说没查到，不要编。' +
  '和地点有关的问题按实际城市说，别讲得太笼统。' +
  '知识问题讲得简单、准确；作业题给出思路和答案，并鼓励自己再想一遍。';

function isXiaoAIAnswerFailure(text) {
  return /(?:我(?:还|暂时|暂不|也)?(?:不知道|不知道咋说|不太清楚|不支持|不会|回答不上)|不太清楚|无法(?:回答|理解|获取|处理)|没法回答|回答不了|没听懂|不明白.{0,8}(?:说|意思)|换个问题|我还在学习|(?:你|我).{0,4}(?:问住|难住)了|被难住了(?:诶|呢|呀|哦)?|暂不支持(?:该|此)?功能|暂不支持|不知道咋说|还.{0,4}(?:支持.{0,6}功能|学习)|不如换.{0,6}(?:方式|问题|说)|超出.{0,6}(?:能力|范围)|(?:没有|没)找到|(?:没有|无法)找到.{0,8}(?:答案|结果|内容)|(?:暂时|还)回答不|不(?:太)?擅长|等我学习|学习了再(?:告诉|说)|我也想知道答案|值得思考的问题)/i.test(
    text,
  );
}

/**
 * 把模型输出清洗成"能直接念"的文本：
 * L05B 的 TTS 会把星号、井号、编号读出来，且单次文本过长会被截断。
 */
function toSpeakable(raw) {
  let t = String(raw ?? '')
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接只留文字
    .replace(/[*_`~#>]/g, '') // 强调/标题/引用符号
    .replace(/^[ \t]*[-•·]\s+/gm, '') // 无序列表
    .replace(/^[ \t]*\d+[.、)）]\s*/gm, '') // 有序列表
    .replace(/（[^）]{0,12}）/g, '') // 短括号注释
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const MAX = 100;
  if (t.length > MAX) {
    const head = t.slice(0, MAX);
    const cut = Math.max(
      head.lastIndexOf('。'),
      head.lastIndexOf('！'),
      head.lastIndexOf('？'),
      head.lastIndexOf('；'),
    );
    t = (cut > 20 ? head.slice(0, cut + 1) : head).trim();
  }
  return t;
}

/**
 * 实验开关：是否同时发送 MiNA 的 abortXiaoAI 来打断小爱。
 * false = 只依赖 MIoT 的 doAction(5,3) 抢占（验证它自身是否具备打断能力）
 * true  = 保持原逻辑（abort + doAction 双通道）
 */
const PREEMPT_VIA_ABORT = false;

/**
 * @type {import('@mi-gpt/next').MiGPTConfig}
 */
export default {
  debug: false, // 是否开启调试模式
  speaker: {
    /**
     * 小爱音箱在米家中设置的名称
     *
     * 如果提示找不到设备，请打开调试模式获取设备真实的 name、miotDID 或 mac 地址填入
     */
    did: '小爱音箱Play',
    /**
     * 消息轮询间隔（毫秒）
     * heartbeat：空闲时（无人对话）的慢速档，省小米接口调用、降风控风险
     * burstHeartbeat：检测到对话后 burstWindowMs 内使用的快速档，减少"小爱先说半句"的漏字
     * 若日志出现小米接口报错/限流，把这两个值都调大
     */
    heartbeat: 500,
    burstHeartbeat: 300,
    burstWindowMs: 15000,
    /**
     * 夜间暂停轮询
     * enabled：是否启用（默认开启）
     * start / end：HH:MM 格式，支持跨零点（如 22:00 → 08:00）
     * 窗口内完全不发小米请求，小爱恢复原生回答；到点自动恢复，无需重启。
     */
    nightPause: {
      enabled: true,
      start: '22:00',
      end: '08:00',
    },
    /**
     * 小米 ID（一串数字）
     *
     * 注意：不是手机号或邮箱，请在小米账号「个人信息」-「小米 ID」查看
     */
    userId: '',
    /**
     * 小米账号登录密码
     *
     * 如果提示登录失败，请使用 passToken 登录
     */
    password: '',
    /**
     * （可选）小米账号 passToken
     *
     * 获取教程：https://github.com/idootop/migpt-next/issues/4
     */
    passToken: '',
  },
  openai: {
    enableProxy: false,
    /**
     * 你的大模型服务提供商的接口地址
     *
     * 支持兼容 OpenAI 接口的大模型服务，比如：DeepSeek V3 等
     *
     * 注意：一般以 /v1 结尾，不包含 /chat/completions 部分
     * - ✅ https://api.openai.com/v1
     * - ❌ https://api.openai.com/v1/（最后多了一个 /
     * - ❌ https://api.openai.com/v1/chat/completions（不需要加 /chat/completions）
     */
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3', //这里是火山引擎 baseURL示例
    /**
     * API 密钥
     */
    apiKey: '',
    /**
     * 模型名称，注意这里填的是火山引擎的模型接入点，ep 开头
     */
    model: 'doubao-seed-evolving',
    /**
     * 按需联网：本地词表先筛（hybrid），命中才走 Responses API + 联网内容插件。
     *
     * 注意：不传 sources，默认走全网 search_engine，
     * 从而避开 douyin / moji / toutiao 三个额外付费源。
     * 插件未开通时会在日志打出 `❌ 联网搜索异常`，并自动回退普通回答。
     */
    webSearch: {
      enabled: true,
      strategy: 'hybrid',
      ageBand: CHILD_SAFETY.ageBand,
      maxKeyword: 1, // 单轮最多 1 个关键词，砍掉多词并发计费
      limit: 5, // 单次返回 5 条（默认 10，太多费 token）
      maxToolCalls: 1, // 整次响应只允许 1 轮工具调用，语音场景等不起
      userLocation: {
        type: 'approximate',
        country: '中国',
        region: '江苏省',
        city: '南京市',
      },
      fallbackNotice: '联网搜索暂时不可用，以下内容可能不是最新。',
      /**
       * 触发词表：以 | 分隔的正则片段，改词不用重建镜像。
       *
       * 判定顺序：danger → alwaysBlock →（primary 档挡 newsTopic）→ explicit → topic×freshness → newsTopic×freshness
       */
      patterns: {
        explicit: '联网|上网|网上|搜索|搜一下|搜下|查一下|查下|最新消息',
        freshness:
          '今天|今日|现在|当前|目前|此刻|最新|最近|近期|本周|这周|本月|这个月|今年|明天|后天|昨天|实时|刚刚|刚才',
        topic:
          '价格|多少钱|报价|售价|股价|股票|大盘|指数|汇率|金价|油价|票价|机票|火车票|比分|赛果|赛程|积分榜|排名|开售|发售|上市|库存|补货|版本|更新|升级|发布时间|新规|限行|路况|航班|班次|营业时间|开放时间|上映|排片|考试时间|报名时间|放假|开学',
        newsTopic: '新闻|时事|时政|国际|国内|经济|财经|民生|热点|热搜|头条|政策|发布会|科技动态|行业动态',
        // 与顶部 kDangerPattern 同一份词：危险问题既不保留原生回答，也不联网
        danger: kDangerPattern,
        alwaysBlock:
          '色情|裸|成人视频|性行为|自杀|自残|割腕|血腥|碎尸|尸体|杀人手法|怎么杀人|毒品|吸毒|冰毒|赌博|博彩|药量|过量服药|制作炸弹|造炸药|枪支|改装枪',
      },
    },
    /**
     * 扩展配置
     */
    extra: {
      /**
       * 透传给 /chat/completions 的额外请求体参数
       * 火山方舟：关闭深度思考（语音场景要低延迟，思考会拖慢首字）
       */
      createParams: {
        thinking: { type: 'disabled' },
      },
      /**
       * 请求超时时间（毫秒），默认 30 秒
       */
      requestOptions: {
        timeout: 60000,
      },
    },
  },
  prompt: {
    /**
     * 系统提示词，如需关闭可设置为：''（空字符串）
     *
     * 由 CHILD_SAFETY.enabled 决定用儿童版还是通用版（见文件顶部）。
     */
    system: CHILD_SAFETY.enabled ? PROMPT_CHILD : PROMPT_DEFAULT,
  },
  context: {
    /**
     * 每次对话携带的最大历史消息数（用户+助手各算一条）
     *
     * L05B 不支持连续对话，本质是单轮问答：带太多历史既费 token、又会把
     * "退下/讲个笑话/天气播报" 这类噪音塞进上下文，导致模型答非所问。
     * 2 条 = 上一次"用户问 + 模型答"，足够承接一句追问（如"再详细点"）。
     *
     * 注意：代码里是 Math.max(1, historyMaxLength)，设 0 会被强制成 1，无法真正关闭。
     */
    historyMaxLength: 2,
  },
  /**
   * 流式响应配置
   */
  stream: {
    /**
     * 单次响应的最大长度（控制分句大小）
     * 小爱音箱 L05B 对 TTS 文本长度有限制，建议不超过 100
     */
    maxReplyLength: 100,
  },
  /**
   * 只回答以下关键词开头的消息：
   *
   * - 请问地球为什么是圆的？
   * - 你知道世界上跑的最快的动物是什么吗？
   */
  callAIKeywords: [''],
  /**
   * 自定义消息回复
   */
  async onMessage(engine, msg) {
    if (!engine.config.callAIKeywords?.some((keyword) => msg.text.startsWith(keyword))) {
      return;
    }

    // 播报控制类指令必须放行给小爱原生处理：
    // 这类话没有"文本回答"，会被 900ms 超时判定为"答不上来"而交给 LLM，
    // 结果就是用户喊"退下"，模型反而开始讲道理，指令失效。
    const STOP_COMMANDS = ['退下', '闭嘴', '别说了', '停止', '安静', '别播了', '不用了'];
    if (STOP_COMMANDS.some((w) => msg.text.trim().startsWith(w))) {
      console.log(`🛑 播报控制指令，放行给小爱原生处理：${msg.text}`);
      // 必须返回 handled:true —— 返回 undefined 会掉进引擎默认分支（abort + 调 LLM + MiNA TTS），
      // 而 L05B 不支持 MiNA TTS，结果就是小爱原生回复被 abort 打断、LLM 的回复没声音。
      return { handled: true };
    }

    const xiaoAIAnswer =
      typeof msg.metadata?.xiaoAIAnswer === 'string' ? msg.metadata.xiaoAIAnswer.trim() : '';

    // 安全分流：危险主题无论小爱答什么，都不保留原生回答（小爱会给吃药建议、放恐怖音频等）
    const dangerHit = CHILD_SAFETY.enabled && kDangerRegex.test(msg.text);
    if (dangerHit) {
      console.log(
        `🛡 安全分流：命中危险主题，跳过小爱原生回答，改由外接 LLM 处理${
          xiaoAIAnswer ? `（原生：${xiaoAIAnswer}）` : '（原生无文本）'
        }`,
      );
    } else {
      if (xiaoAIAnswer && !isXiaoAIAnswerFailure(xiaoAIAnswer)) {
        console.log(`🔈 保留小爱原生回答：${xiaoAIAnswer}`);
        return { handled: true };
      }
      if (xiaoAIAnswer) {
        console.log(`🤖 小爱无法回答，切换外接 LLM：${xiaoAIAnswer}`);
      } else {
        // 无文本回答 = 900ms 内始终等不到 xiaoAIAnswer。
        // 小爱"答不上来"一定会产出文本（这个我暂时还回答不上诶），所以无文本更可能是：
        //   a) 技能流（讲笑话/讲故事/放音乐），音频是流式的，不产生文本
        //   b) 播报控制指令（退下/闭嘴）
        // 这两种都由小爱自己处理，接管只会把它打断并白烧 token，所以静默放行。
        console.log('⏸ 无文本回答（技能流/指令），静默放行，不接管');
        return { handled: true };
      }
    }

    // 抢占策略：
    // - 小爱给出了"答不上来"的文本回答 → 只下发 MIoT 5,3（实测自带 TTS 焦点抢占，漏字最少）
    // - xiaoAIAnswer 为空说明是 900ms 超时（对话式/技能类），这类音频是流式的
    //   （讲笑话、讲故事、放音乐连播），MIoT 5,3 只抢 TTS 焦点抢不掉，必须先 abort 终止，
    //   否则 LLM 答完后小爱会继续把剩下的音频播完（实测连播 4 个笑话）。
    const needHardStop = PREEMPT_VIA_ABORT || !xiaoAIAnswer;
    if (needHardStop) {
      console.log(`🧪 抢占方式：abort（技能流）+ MIoT，原因：${xiaoAIAnswer ? '手动启用' : '超时无文本回答'}`);
      try {
        await engine.speaker.abortXiaoAI();
      } catch (error) {
        console.warn(`⚠️ abort 失败，继续切换 LLM：${error?.message ?? error}`);
      }
    } else {
      console.log('🧪 抢占方式：仅 MIoT 5,3');
    }
    await engine.MiOT.doAction(5, 3, '正在思考中');

    const { text } = await engine.askAI(msg, { stream: false });
    if (text) {
      const spoken = toSpeakable(text);
      console.log(`🔊 原文：${text}`);
      console.log(`🔊 播报：${spoken}（${spoken.length}字）`);
      await engine.MiOT.doAction(5, 3, spoken);
    }

    // 阻止引擎再走默认的 MiNA TTS 链路。
    return { handled: true };
  },
};
