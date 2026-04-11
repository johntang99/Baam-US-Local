/**
 * Recommendation table building and post-processing utilities.
 * Extracted from helper-core v1 index.ts.
 */

import type { SourceItem } from '../types';

type BusinessMetadata = {
  avgRating?: number | null;
  reviewCount?: number | null;
  phone?: string | null;
  address?: string | null;
  displayName?: string | null;
  displayNameZh?: string | null;
  briefDesc?: string | null;
  isFeatured?: boolean;
  locationMatched?: boolean;
};

export function readBusinessMetadata(source: SourceItem): BusinessMetadata {
  const metadata: Record<string, unknown> =
    source.metadata && typeof source.metadata === 'object' ? source.metadata : {};
  return {
    avgRating: typeof metadata.avgRating === 'number' ? metadata.avgRating : null,
    reviewCount: typeof metadata.reviewCount === 'number' ? metadata.reviewCount : null,
    phone: typeof metadata.phone === 'string' ? metadata.phone : null,
    address: typeof metadata.address === 'string' ? metadata.address : null,
    displayName: typeof metadata.displayName === 'string' ? metadata.displayName : null,
    displayNameZh: typeof metadata.displayNameZh === 'string' ? metadata.displayNameZh : null,
    briefDesc: typeof metadata.briefDesc === 'string' ? metadata.briefDesc : null,
    isFeatured: Boolean(metadata.isFeatured),
    locationMatched: Boolean(metadata.locationMatched),
  };
}

export function normalizeCell(value: string): string {
  return value.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
}

const invalidNamePatterns = [/点击查看地图/i, /^查看地图$/i, /^地图$/i, /^google\s*map/i];

function isInvalidName(name: string): boolean {
  if (!name) return true;
  const normalized = name.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').trim();
  if (!normalized) return true;
  return invalidNamePatterns.some((pattern) => pattern.test(normalized));
}

function titleFromSlug(url: string): string {
  const parts = url.split('/').filter(Boolean);
  const slug = parts[parts.length - 1] || '';
  if (!slug) return 'Unnamed';
  return slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function resolveBusinessTitle(candidate: SourceItem, meta: BusinessMetadata): string {
  const candidateTitle = normalizeCell(candidate.title || '');
  if (!isInvalidName(candidateTitle)) return candidateTitle;
  const zh = normalizeCell(meta.displayNameZh || '');
  if (!isInvalidName(zh)) return zh;
  const en = normalizeCell(meta.displayName || '');
  if (!isInvalidName(en)) return en;
  return titleFromSlug(candidate.url);
}

export interface TableConfig {
  /** Table headers. Default: Chinese headers */
  headers: string[];
  /** Locale path prefix, e.g., '/zh' or '/en' */
  localePathPrefix: string;
  /** Business path prefix, e.g., '/businesses/' */
  businessPathPrefix: string;
  /** Placeholder for missing data */
  placeholder: string;
}

const defaultTableConfig: TableConfig = {
  headers: ['排名', '店名', '评分', '评价数', '电话', '地址', '推荐理由'],
  localePathPrefix: '/zh',
  businessPathPrefix: '/businesses/',
  placeholder: '待确认',
};

function buildReasonFromMetadata(meta: BusinessMetadata, locale: 'zh' | 'en'): string {
  const briefDesc = normalizeCell(meta.briefDesc || '').replace(/[。！!？?]+$/g, '');
  if (briefDesc) {
    return briefDesc.length > 28 ? `${briefDesc.slice(0, 28)}...` : briefDesc;
  }
  const reasons: string[] = [];
  if (locale === 'zh') {
    if (typeof meta.avgRating === 'number' && meta.avgRating >= 4.7) reasons.push('评分高');
    if (typeof meta.reviewCount === 'number' && meta.reviewCount >= 1000) reasons.push('评价基数大');
    if (meta.locationMatched) reasons.push('区域匹配');
    if (meta.isFeatured) reasons.push('平台精选');
    return reasons.length > 0 ? reasons.join('，') : '信息完整，建议先电话确认';
  }
  if (typeof meta.avgRating === 'number' && meta.avgRating >= 4.7) reasons.push('highly rated');
  if (typeof meta.reviewCount === 'number' && meta.reviewCount >= 1000) reasons.push('popular');
  if (meta.locationMatched) reasons.push('nearby');
  if (meta.isFeatured) reasons.push('featured');
  return reasons.length > 0 ? reasons.join(', ') : 'verified listing';
}

/**
 * Resolve how many businesses the user requested (e.g., "top 5", "3家").
 */
export function resolveRequestedBusinessCount(query: string): number {
  const topMatch = query.toLowerCase().match(/\btop\s*(\d{1,2})\b/);
  if (topMatch) {
    const value = Number(topMatch[1]);
    if (Number.isFinite(value) && value > 0) return Math.min(20, Math.max(1, value));
  }
  const cnMatch = query.match(/(\d{1,2})\s*(家|个|间|条)/);
  if (cnMatch) {
    const value = Number(cnMatch[1]);
    if (Number.isFinite(value) && value > 0) return Math.min(20, Math.max(1, value));
  }
  return 15;
}

/**
 * Build a strict recommendation table from business candidates.
 */
export function buildStrictRecommendationTable(
  candidates: SourceItem[],
  query: string,
  locale: 'zh' | 'en' = 'zh',
  config?: Partial<TableConfig>,
): string {
  if (candidates.length === 0) return '';
  const cfg = { ...defaultTableConfig, ...config };
  if (locale === 'en') {
    cfg.headers = config?.headers ?? ['Rank', 'Name', 'Rating', 'Reviews', 'Phone', 'Address', 'Why'];
    cfg.localePathPrefix = config?.localePathPrefix ?? '/en';
    cfg.placeholder = config?.placeholder ?? 'TBD';
  }

  const requestedCount = resolveRequestedBusinessCount(query);
  const rowCount = Math.min(requestedCount, candidates.length);

  const header = [
    `| ${cfg.headers.join(' | ')} |`,
    `| ${cfg.headers.map(() => '---').join(' | ')} |`,
  ];

  const rows = candidates.slice(0, rowCount).map((candidate, index) => {
    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : String(index + 1);
    const meta = readBusinessMetadata(candidate);
    const rating = typeof meta.avgRating === 'number' ? String(meta.avgRating) : cfg.placeholder;
    const reviewCount = typeof meta.reviewCount === 'number' ? String(meta.reviewCount) : cfg.placeholder;
    const phone = meta.phone ? normalizeCell(meta.phone) : cfg.placeholder;
    const address = meta.address ? normalizeCell(meta.address) : cfg.placeholder;
    const reason = buildReasonFromMetadata(meta, locale);
    const resolvedTitle = resolveBusinessTitle(candidate, meta);
    const safeTitle = resolvedTitle.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
    const href = candidate.url.startsWith('/')
      ? `${cfg.localePathPrefix}${candidate.url}`
      : `${cfg.localePathPrefix}${cfg.businessPathPrefix}${candidate.url}`;
    const linkedTitle = `[${safeTitle}](${href})`;
    return `| ${rank} | ${linkedTitle} | ${rating} | ${reviewCount} | ${phone} | ${address} | ${reason} |`;
  });

  return [...header, ...rows].join('\n');
}

/**
 * Count markdown table data rows (excludes header and divider).
 */
export function countMarkdownTableRows(table: string): number {
  const lines = table.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return 0;
  return Math.max(0, lines.length - 2);
}

/**
 * Harmonize the "N 家" / "Top N" count in answer text to match actual table count.
 */
export function harmonizeRecommendationCount(answer: string, finalCount: number): string {
  if (!answer || finalCount <= 0) return answer;
  const replaced = answer
    .replace(/(筛出[^。\n]*?)(\d+)\s*家/g, (_, prefix) => `${prefix}${finalCount} 家`)
    .replace(/(推荐[^。\n]*?)(\d+)\s*家/g, (_, prefix) => `${prefix}${finalCount} 家`)
    .replace(/(给你[^。\n]*?)(\d+)\s*家/g, (_, prefix) => `${prefix}${finalCount} 家`);
  return replaced.replace(/\bTop\s*\d+\b/gi, `Top ${finalCount}`);
}

/**
 * Replace existing markdown table in answer with a strict one, or append after first paragraph.
 */
export function injectStrictRecommendationTable(answer: string, strictTable: string): string {
  if (!strictTable) return answer;
  const tableRegex = /\|[^\n]*\|\n\|(?:\s*:?-+:?\s*\|)+\n(?:\|[^\n]*\|\n?)*/m;
  if (tableRegex.test(answer)) {
    return answer.replace(tableRegex, strictTable);
  }
  const sections = answer.split('\n\n');
  if (sections.length <= 1) {
    return `${answer}\n\n${strictTable}`;
  }
  return `${sections[0]}\n\n${strictTable}\n\n${sections.slice(1).join('\n\n')}`;
}
