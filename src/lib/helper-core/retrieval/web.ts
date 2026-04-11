import type { RetrievalPayload, SourceItem } from '../types';

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function normalizeDuckDuckGoUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'https://duckduckgo.com');
    const actual = parsed.searchParams.get('uddg');
    return actual ? decodeURIComponent(actual) : parsed.toString();
  } catch {
    return rawUrl;
  }
}

function parseDuckDuckGoResults(html: string): SourceItem[] {
  const resultRegex =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,500}?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;

  const results: SourceItem[] = [];
  let match: RegExpExecArray | null = resultRegex.exec(html);

  while (match && results.length < 5) {
    const href = normalizeDuckDuckGoUrl(match[1]);
    const title = decodeHtml(match[2] || '');
    const snippet = decodeHtml(match[3] || match[4] || '');
    if (href && title) {
      results.push({
        type: '网页',
        title,
        url: href,
        snippet,
        isExternal: true,
      });
    }
    match = resultRegex.exec(html);
  }

  return results;
}

export async function searchWebFallback(query: string): Promise<RetrievalPayload> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BaamHelper2/1.0)',
      },
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      return { sources: [], contextBlocks: [], counts: { web: 0 } };
    }

    const html = await response.text();
    const sources = parseDuckDuckGoResults(html);
    const contextBlocks =
      sources.length > 0
        ? [`网页结果：\n${sources.map((item) => `- ${item.title} | ${item.snippet || ''} | ${item.url}`).join('\n')}`]
        : [];

    return {
      sources,
      contextBlocks,
      counts: { web: sources.length },
    };
  } catch {
    return { sources: [], contextBlocks: [], counts: { web: 0 } };
  }
}
