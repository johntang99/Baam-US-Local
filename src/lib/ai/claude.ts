import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

type Model = 'haiku' | 'sonnet' | 'opus';

const MODELS: Record<Model, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
};

interface AIResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
  prompt?: string;
}

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function callClaude<T>(params: {
  prompt: string;
  system?: string;
  model?: Model;
  maxTokens?: number;
  parseJson?: boolean;
}): Promise<AIResult<T>> {
  const model = params.model || 'haiku';
  const modelId = MODELS[model];

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: params.prompt },
  ];

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: params.maxTokens || 1024,
    system: params.system,
    messages,
  });

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text : '';

  let data;
  if (params.parseJson) {
    // Strip markdown code fences
    const stripped = rawText
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    // Try parsing directly first
    data = tryParseJson(stripped);

    if (data === undefined) {
      // Try to find the outermost JSON object { ... }
      const objStart = stripped.indexOf('{');
      const objEnd = stripped.lastIndexOf('}');
      if (objStart !== -1 && objEnd > objStart) {
        data = tryParseJson(stripped.slice(objStart, objEnd + 1));
      }
    }

    if (data === undefined) {
      // Try to find outermost JSON array [ ... ]
      const arrStart = stripped.indexOf('[');
      const arrEnd = stripped.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd > arrStart) {
        data = tryParseJson(stripped.slice(arrStart, arrEnd + 1));
      }
    }

    if (data === undefined) {
      // Last resort: try to find individual JSON objects and build array
      const objectMatches = [...stripped.matchAll(/\{\s*"[^"]+"\s*:/g)];
      if (objectMatches.length > 0) {
        const items: unknown[] = [];
        for (const match of objectMatches) {
          const start = match.index!;
          // Find matching closing brace
          let depth = 0;
          let end = start;
          for (let i = start; i < stripped.length; i++) {
            if (stripped[i] === '{') depth++;
            if (stripped[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
          }
          const item = tryParseJson(stripped.slice(start, end));
          if (item) items.push(item);
        }
        if (items.length > 0) data = items;
      }
    }

    if (data === undefined) {
      console.error('[AI] Failed to parse JSON from response:', stripped.slice(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }
  } else {
    data = rawText;
  }

  return {
    data: data as T,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: modelId,
  };
}

/**
 * Generate a 3-sentence summary of content.
 */
export async function generateSummary(
  text: string,
  language: 'zh' | 'en' = 'zh'
): Promise<AIResult<string>> {
  const langInstructions =
    language === 'zh'
      ? '用简体中文回答，生成3句话的摘要。'
      : 'Generate a 3-sentence summary in English.';

  const result = await callClaude<string>({
    system: `You are a content summarizer for a local community portal. ${langInstructions} Be concise and focus on actionable information. Return ONLY the summary text, no headers or labels.`,
    prompt: `Summarize the following content in exactly 3 sentences. Do NOT include any prefix like "# 摘要" or "Summary:". Just output the 3 sentences directly:\n\n${text}`,
    model: 'haiku',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (result as any).data = cleanSummary(result.data as string);
  return result;
}

/**
 * Translate content between Chinese and English.
 */
export async function translateContent(
  text: string,
  fromLang: 'zh' | 'en',
  toLang: 'zh' | 'en'
): Promise<AIResult<string>> {
  const direction =
    fromLang === 'zh' ? 'Translate from Chinese to English' : 'Translate from English to Chinese (Simplified)';

  return callClaude<string>({
    system: `You are a professional translator for a local community platform serving Chinese immigrants in New York. ${direction}. Maintain the original tone and meaning. For Chinese output, use Simplified Chinese.`,
    prompt: text,
    model: 'haiku',
  });
}

/**
 * Extract topic tags from content.
 */
export async function generateTags(
  text: string
): Promise<AIResult<string[]>> {
  return callClaude<string[]>({
    system:
      'Extract 3-5 topic tags from the content. Return as a JSON array of strings in Chinese. Example: ["租房","法拉盛","新移民"]',
    prompt: text,
    model: 'haiku',
    parseJson: true,
  });
}

/**
 * Generate FAQ pairs from content.
 */
export async function generateFAQ(
  context: string,
  count: number = 5
): Promise<AIResult<Array<{ q: string; a: string }>>> {
  return callClaude<Array<{ q: string; a: string }>>({
    system: `You are an FAQ generator for a local community portal serving Chinese immigrants. Generate ${count} frequently asked questions and answers based on the provided content. Use Simplified Chinese. IMPORTANT: Return ONLY a raw JSON array, no markdown, no code fences, no explanation. Format: [{"q":"问题","a":"回答"}]`,
    prompt: `Based on the following content, generate ${count} FAQ pairs as a JSON array. Return ONLY the JSON array, nothing else.\n\n${context}`,
    model: 'sonnet',
    maxTokens: 2048,
    parseJson: true,
  });
}

// ─── Native Chinese Writing System Prompt ──────────────────────────────

const CHINESE_WRITER_SYSTEM = `你是一位资深的华人社区媒体编辑，在纽约华文媒体工作多年。你的中文写作风格：

【核心原则】
- 你写的是"原生中文"，不是从英文翻译过来的。绝对不能有翻译腔。
- 像澎湃新闻、新京报、南方周末的记者/编辑那样写作。
- 语言自然流畅，像在和老朋友聊天一样亲切，但保持专业。

【禁止事项】
- 禁止"在...方面"、"关于...的问题"、"值得注意的是"这类翻译腔句式
- 禁止"首先...其次...最后"这种八股文结构（除非写清单）
- 禁止"随着...的发展"、"在当今社会"这类空洞开头
- 禁止过度使用被动句，中文习惯用主动句
- 禁止生硬地罗列信息，要有故事感和画面感

【鼓励事项】
- 用具体的例子和数字说话（"法拉盛Main Street上的王医生诊所"比"某诊所"好）
- 用短句，节奏明快
- 适当用口语化表达（"说白了"、"不少人踩过坑"、"亲测有效"）
- 写给真实的人看——新移民妈妈、刚来纽约的留学生、法拉盛的小商家老板
- 标题要有吸引力，像微信公众号爆款标题那样（但不标题党）

【英文版本】
- 英文版独立写作，不是中文的翻译
- 用美国本地英文媒体的风格（如Patch、local news blog）
- 语气友好实用，像写给邻居看的
`;

/**
 * Generate a full article from scratch.
 */
export interface ArticleGenerationInput {
  topic: string;
  keywords?: string;
  region?: string;
  category?: string;
  style?: string;     // 实用指导 | 新闻报道 | 深度分析 | 生活分享
  tone?: string;      // 亲切友好 | 专业严谨 | 轻松活泼
  audience?: string;  // 新移民 | 家庭 | 商家 | 学生 | 所有人
  sourceUrl?: string;
  notes?: string;
}

export interface GeneratedArticle {
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
  ai_summary_zh: string;
  ai_summary_en: string;
  ai_tags: string[];
  ai_faq: Array<{ q: string; a: string }>;
  seo_title_zh: string;
  seo_desc_zh: string;
}

const SECTION_DELIMITER = '===SECTION===';

function cleanSummary(text: string): string {
  return text
    .replace(/^#+\s*(摘要|Summary|概要|SUMMARY)\s*/i, '')
    .replace(/^(摘要|Summary|概要)[：:]\s*/i, '')
    .trim();
}

function parseDelimitedArticle(text: string): GeneratedArticle {
  const sections = text.split(SECTION_DELIMITER).map(s => s.trim());
  // Expected order: title_zh, title_en, body_zh, body_en, summary_zh, summary_en, tags, faq, seo_title, seo_desc
  const get = (i: number) => (sections[i] || '').trim();

  let tags: string[] = [];
  try { tags = JSON.parse(get(6)); } catch { tags = get(6).split(/[,，]/).map(t => t.trim()).filter(Boolean); }

  let faq: Array<{ q: string; a: string }> = [];
  try { faq = JSON.parse(get(7)); } catch { faq = []; }

  return {
    title_zh: get(0),
    title_en: get(1),
    body_zh: get(2),
    body_en: get(3),
    ai_summary_zh: cleanSummary(get(4)),
    ai_summary_en: cleanSummary(get(5)),
    ai_tags: tags,
    ai_faq: faq,
    seo_title_zh: get(8),
    seo_desc_zh: get(9),
  };
}

function buildArticlePrompt(instructions: string): string {
  return `${instructions}

请按以下格式输出，每个部分用 ${SECTION_DELIMITER} 分隔。不要加任何其他标记或解释。

中文标题（15-25字，吸引人）
${SECTION_DELIMITER}
English Title
${SECTION_DELIMITER}
中文正文（Markdown格式，800-1500字，用##做小标题）
${SECTION_DELIMITER}
English body (Markdown, 500-1000 words, use ## for subheadings)
${SECTION_DELIMITER}
中文3句话摘要
${SECTION_DELIMITER}
English 3-sentence summary
${SECTION_DELIMITER}
["标签1","标签2","标签3","标签4"]
${SECTION_DELIMITER}
[{"q":"常见问题1","a":"回答1"},{"q":"常见问题2","a":"回答2"},{"q":"常见问题3","a":"回答3"},{"q":"常见问题4","a":"回答4"},{"q":"常见问题5","a":"回答5"}]
${SECTION_DELIMITER}
SEO标题（含关键词，50字以内）
${SECTION_DELIMITER}
SEO描述（150字以内）`;
}

export async function generateArticleFromScratch(
  input: ArticleGenerationInput
): Promise<AIResult<GeneratedArticle>> {
  const styleMap: Record<string, string> = {
    '实用指导': '写一篇实用指导类文章，重点是"怎么做"，给出具体步骤和建议',
    '新闻报道': '写一篇新闻报道，交代清楚时间地点人物事件，客观但有温度',
    '深度分析': '写一篇深度分析，帮读者理解来龙去脉和影响',
    '生活分享': '写一篇生活分享，用第一人称或亲历者视角，有故事感',
  };
  const toneMap: Record<string, string> = {
    '亲切友好': '语气亲切，像邻居大姐在跟你聊天',
    '专业严谨': '语气专业，像医生/律师在给你建议',
    '轻松活泼': '语气轻松，像年轻博主在分享',
  };

  const styleInstruction = styleMap[input.style || ''] || styleMap['实用指导'];
  const toneInstruction = toneMap[input.tone || ''] || toneMap['亲切友好'];

  const instructions = `请为纽约华人社区门户网站 Baam 撰写一篇文章。

【主题】${input.topic}
【关键词】${input.keywords || '无'}
【地区】${input.region || '纽约'}
【分类】${input.category || '指南'}
【目标读者】${input.audience || '所有人'}
【写作要求】${styleInstruction}。${toneInstruction}。
${input.sourceUrl ? `【参考来源】${input.sourceUrl}` : ''}
${input.notes ? `【编辑备注】${input.notes}` : ''}`;

  const prompt = buildArticlePrompt(instructions);

  const result = await callClaude<string>({
    system: CHINESE_WRITER_SYSTEM,
    prompt,
    model: 'opus',
    maxTokens: 8192,
  });

  return {
    data: parseDelimitedArticle(result.data),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
    prompt, // expose for "show prompt" feature
  };
}

/**
 * Rewrite an existing article for the platform.
 */
export async function rewriteArticle(
  input: {
    sourceContent: string;
    style?: string;
    tone?: string;
    audience?: string;
    notes?: string;
  }
): Promise<AIResult<GeneratedArticle>> {
  const instructions = `以下是一篇原始文章/素材，请为纽约华人社区门户网站 Baam 改写。

【原文/素材】
${input.sourceContent.slice(0, 6000)}

【改写要求】
- 不是简单改词换句，而是用你自己的语言重新写一篇
- 保留核心信息和事实，但加入本地化视角（纽约华人社区）
- 加入实用建议、本地资源链接建议
- 风格：${input.style || '实用指导'}
- 语气：${input.tone || '亲切友好'}
- 目标读者：${input.audience || '纽约华人'}
${input.notes ? `- 编辑备注：${input.notes}` : ''}`;

  const prompt = buildArticlePrompt(instructions);

  const result = await callClaude<string>({
    system: CHINESE_WRITER_SYSTEM,
    prompt,
    model: 'opus',
    maxTokens: 8192,
  });

  return {
    data: parseDelimitedArticle(result.data),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
    prompt,
  };
}

/**
 * Classify forum post intent.
 */
export async function classifyIntent(
  text: string
): Promise<
  AIResult<{
    intent: string;
    confidence: number;
    entities: string[];
  }>
> {
  return callClaude({
    system:
      'Classify the intent of this forum post. Return JSON: {"intent":"recommendation_request|question|complaint|review|news|discussion","confidence":0.0-1.0,"entities":["entity1","entity2"]}',
    prompt: text,
    model: 'haiku',
    parseJson: true,
  });
}

/**
 * Match businesses to a query based on semantic similarity.
 */
export async function matchBusinesses(
  query: string,
  businesses: Array<{ id: string; name: string; description: string; tags: string[] }>
): Promise<AIResult<string[]>> {
  return callClaude<string[]>({
    system:
      'You are a business matching engine. Given a user query and a list of businesses, return the IDs of the top 3 most relevant businesses as a JSON array. Consider name, description, and tags.',
    prompt: `Query: ${query}\n\nBusinesses:\n${businesses.map((b) => `ID: ${b.id}, Name: ${b.name}, Desc: ${b.description}, Tags: ${b.tags.join(',')}`).join('\n')}`,
    model: 'haiku',
    parseJson: true,
  });
}

/**
 * Generate an AI overview for search results.
 */
export async function generateSearchSummary(
  query: string,
  results: { type: string; count: number }[]
): Promise<AIResult<string>> {
  const resultSummary = results
    .map((r) => `${r.count}个${r.type}`)
    .join('，');

  return callClaude<string>({
    system:
      'You are an AI search assistant for a Chinese community portal in New York. Generate a helpful 2-3 sentence summary of search results in Simplified Chinese. Be specific and actionable.',
    prompt: `用户搜索了「${query}」，找到了：${resultSummary}。请生成一段简短的AI摘要，帮助用户理解搜索结果。`,
    model: 'haiku',
  });
}
