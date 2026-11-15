export interface WebSearchSource {
  title: string;
  url: string;
}

export interface WebSearchResult {
  text: string;
  searched: boolean;
  sources: WebSearchSource[];
}

/**
 * 联网触发词表。
 *
 * 三段式判定：硬排除 → 显式求助 → 时效主题 × 时间词。
 * 所有表都是"以 | 分隔的正则片段"，可直接写在 config.js 里，改词不用重建镜像。
 */
export interface WebSearchPatterns {
  /** 用户明确要求上网查：联网/搜索/查一下… */
  explicit: string;
  /** 时间词：只是必要条件，单独不触发 */
  freshness: string;
  /** 中性时效主题：价格/比分/版本/限行… */
  topic: string;
  /** 新闻时政主题：仅 junior 档放开 */
  newsTopic: string;
  /** 危险主题：不看小爱原生回答，且不联网 */
  danger: string;
  /** 绝对排除：任何档位都不联网 */
  alwaysBlock: string;
}

export const kDefaultWebSearchPatterns: WebSearchPatterns = {
  explicit: '联网|上网|网上|搜索|搜一下|搜下|查一下|查下|最新消息',
  freshness:
    '今天|今日|现在|当前|目前|此刻|最新|最近|近期|本周|这周|本月|这个月|今年|明天|后天|昨天|实时|刚刚|刚才',
  topic:
    '价格|多少钱|报价|售价|股价|股票|大盘|指数|汇率|金价|油价|票价|机票|火车票|比分|赛果|赛程|积分榜|排名|开售|发售|上市|库存|补货|版本|更新|升级|发布时间|新规|限行|路况|航班|班次|营业时间|开放时间|上映|排片|考试时间|报名时间|放假|开学',
  newsTopic: '新闻|时事|时政|国际|国内|经济|财经|民生|热点|热搜|头条|政策|发布会|科技动态|行业动态',
  danger: '',
  alwaysBlock:
    '色情|裸|成人视频|性行为|自杀|自残|割腕|血腥|碎尸|尸体|杀人手法|怎么杀人|毒品|吸毒|冰毒|赌博|博彩|药量|过量服药|制作炸弹|造炸药|枪支|改装枪',
};

const kRegexCache = new Map<string, RegExp | null>();

function toRegex(pattern?: string): RegExp | null {
  const source = (pattern ?? '').trim();
  if (!source) return null;
  if (kRegexCache.has(source)) return kRegexCache.get(source)!;
  let regex: RegExp | null = null;
  try {
    regex = new RegExp(`(?:${source})`, 'i');
  } catch (error) {
    console.warn(
      `⚠️ 联网词表正则无效，已忽略：${source}（${error instanceof Error ? error.message : error}）`,
    );
  }
  kRegexCache.set(source, regex);
  return regex;
}

export interface WebSearchOptions {
  /** `primary`（6~11 岁，不触发新闻时政）｜`junior`（12~15 岁，放开时政） */
  ageBand?: 'primary' | 'junior';
  patterns?: Partial<WebSearchPatterns>;
}

/**
 * Decide locally whether the latest user question needs fresh external information.
 *
 * 顺序不能改：危险/绝对排除优先，其次显式求助，最后才是"主题 × 时间"的组合判定。
 * 组合判定是为了避免"新闻是什么""天气原理"这类定义性问题被拖进搜索。
 */
export function shouldUseWebSearch(messages: any[], options: WebSearchOptions = {}) {
  let text = '';
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user' && typeof messages[index]?.content === 'string') {
      text = messages[index].content.trim();
      break;
    }
  }
  if (!text) return false;

  const patterns: WebSearchPatterns = { ...kDefaultWebSearchPatterns, ...options.patterns };
  const ageBand = options.ageBand ?? 'junior';

  // 1. 危险主题：不联网（由模型用安全模板回答，搜索只会把细节抓回来）
  if (toRegex(patterns.danger)?.test(text)) return false;

  // 2. 绝对排除
  if (toRegex(patterns.alwaysBlock)?.test(text)) return false;

  // 3. 小学档挡新闻时政
  const newsTopic = toRegex(patterns.newsTopic);
  if (ageBand === 'primary' && newsTopic?.test(text)) return false;

  // 4. 用户明确要求上网查
  if (toRegex(patterns.explicit)?.test(text)) return true;

  // 5. 中性时效：主题 × 时间
  const topic = toRegex(patterns.topic);
  const freshness = toRegex(patterns.freshness);
  if (topic?.test(text) && freshness?.test(text)) return true;

  // 6. 初中档放开时政：新闻 × 时间
  if (ageBand === 'junior' && newsTopic?.test(text) && freshness?.test(text)) return true;

  return false;
}

/**
 * Remove links and provider citation markers that should not be read aloud by TTS.
 */
export function sanitizeWebSearchText(text: string) {
  return text
    .replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/【[^\]]*?†[^\]]*?】/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize the Responses API payload into text suitable for speech plus log-only sources.
 */
export function parseWebSearchResponse(response: any): WebSearchResult {
  const output = Array.isArray(response?.output) ? response.output : [];
  const searched = output.some((item: any) => item?.type === 'web_search_call');
  const sources: WebSearchSource[] = [];
  const contentTexts: string[] = [];

  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        contentTexts.push(content.text);
      }

      for (const annotation of content?.annotations ?? []) {
        if (annotation?.type !== 'url_citation') continue;
        const url = annotation.url ?? annotation.url_citation?.url;
        const title = annotation.title ?? annotation.url_citation?.title ?? url;
        if (typeof url === 'string' && url) {
          sources.push({ title: String(title), url });
        }
      }
    }
  }

  const uniqueSources = sources.filter(
    (source, index) => sources.findIndex((candidate) => candidate.url === source.url) === index,
  );
  const rawText =
    typeof response?.output_text === 'string' && response.output_text
      ? response.output_text
      : contentTexts.join('\n');

  return {
    text: sanitizeWebSearchText(rawText),
    searched,
    sources: uniqueSources,
  };
}
