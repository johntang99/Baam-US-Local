/**
 * Helper Layout System — centralized control for all answer type layouts.
 *
 * All visual structure (section spacing, table format, footer style)
 * is controlled here. Builders import these helpers instead of
 * hardcoding markdown structure.
 */

import type { BusinessResult, ContentItem, EventItem, RelatedContent, HelperSource } from './types';

// ─── Section Spacing ──────────────────────────────────────────
// h3 margin is controlled by chat.tsx CSS ([&_h3]:mt-10 [&_h3]:mb-3)
// These helpers just ensure consistent markdown structure.

/** Start a new section with a heading. Returns markdown lines. */
export function section(icon: string, title: string): string {
  return `### ${icon} ${title}`;
}

/** Horizontal rule separator before closing CTA */
export function divider(): string {
  return '---';
}

/** Closing CTA line */
export function closingCta(text: string): string {
  return text;
}

/** Join sections with proper spacing — each section gets blank lines before it */
export function joinSections(...blocks: (string | string[] | null | undefined | false)[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block) continue;
    const text = Array.isArray(block) ? block.filter(Boolean).join('\n') : block;
    if (!text.trim()) continue;
    if (parts.length > 0) parts.push(''); // blank line between sections
    parts.push(text);
  }
  return parts.join('\n');
}

// ─── Business Table ───────────────────────────────────────────

/** Shorten address to street + city (drop state, zip, country) */
export function shortAddress(addr: string | null): string {
  if (!addr) return '';
  const parts = addr.split(',').map(p => p.trim());
  return parts.slice(0, 2).join(', ') || parts[0] || '';
}

/** Build a ranked business table (used by Type 1, 4) */
export function businessTable(businesses: BusinessResult[], maxRows = 10): string {
  const header = '| # | Name | Rating | Phone | Address |\n| --- | --- | --- | --- | --- |';
  const rows = businesses.slice(0, maxRows).map((b, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
    const name = `[${b.display_name}](/en/businesses/${b.slug})`;
    const rating = b.avg_rating ? `${b.avg_rating}⭐ (${b.review_count || 0})` : 'N/A';
    const addr = shortAddress(b.address_full) || 'N/A';
    return `| ${medal} | ${name} | ${rating} | ${b.phone || 'N/A'} | ${addr} |`;
  });
  return header + '\n' + rows.join('\n');
}

/** Build a comparison table (used by Type 10) */
export function comparisonTable(a: BusinessResult, b: BusinessResult): string {
  const lines: string[] = [];
  lines.push(`| | ${a.display_name} | ${b.display_name} |`);
  lines.push('| --- | --- | --- |');
  const aRating = a.avg_rating ? `${a.avg_rating}⭐ (${a.review_count || 0})` : 'N/A';
  const bRating = b.avg_rating ? `${b.avg_rating}⭐ (${b.review_count || 0})` : 'N/A';
  lines.push(`| ⭐ Rating | ${aRating} | ${bRating} |`);
  lines.push(`| 📞 Phone | ${a.phone || 'N/A'} | ${b.phone || 'N/A'} |`);
  lines.push(`| 📍 Location | ${shortAddress(a.address_full) || 'N/A'} | ${shortAddress(b.address_full) || 'N/A'} |`);
  return lines.join('\n');
}

/** Build an events table (used by Type 6) */
export function eventsTable(events: EventItem[], maxRows = 6): string {
  const lines: string[] = [];
  lines.push('| Date | Event | Venue | Free? |');
  lines.push('| --- | --- | --- | --- |');
  for (const e of events.slice(0, maxRows)) {
    const date = new Date(e.startAt);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const freeLabel = e.isFree ? '✅ Free' : (e.ticketPrice || '💲 Paid');
    lines.push(`| ${dateStr} | [${e.title}](/en/events/${e.slug}) | ${e.venueName} | ${freeLabel} |`);
  }
  return lines.join('\n');
}

// ─── Related Content Section ──────────────────────────────────

export function relatedContentSection(related: RelatedContent): string {
  const blocks: string[] = [];

  const formatItem = (title: string, url: string, snippet?: string) => {
    // Use bullet with bold title, then snippet on next line with hard line break
    if (snippet) {
      return `- **[${title}](${url})**  \n  *${snippet}*`;
    }
    return `- **[${title}](${url})**`;
  };

  if (related.guides.length > 0) {
    blocks.push('', section('📘', 'Related Guides'), '');
    for (const g of related.guides) blocks.push(formatItem(g.title, `/en/guides/${g.slug}`, g.snippet));
  }
  if (related.news.length > 0) {
    blocks.push('', section('📰', 'Related News'), '');
    for (const n of related.news) blocks.push(formatItem(n.title, `/en/news/${n.slug}`, n.snippet));
  }
  if (related.forum.length > 0) {
    blocks.push('', section('💬', 'Community Discussions'), '');
    for (const t of related.forum) blocks.push(formatItem(t.title, `/en/forum/${t.boardSlug || 'general'}/${t.slug}`, t.snippet));
  }
  if (related.discover.length > 0) {
    blocks.push('', section('📝', 'Community Posts'), '');
    for (const d of related.discover) blocks.push(formatItem(d.title, `/en/discover/${d.slug}`, d.snippet));
  }
  return blocks.join('\n');
}

// ─── Sources Builders ─────────────────────────────────────────

export function buildBusinessSources(businesses: BusinessResult[]): HelperSource[] {
  return businesses.map((b) => ({
    type: 'Business',
    title: b.display_name || 'Business',
    url: `/businesses/${b.slug}`,
    snippet: b.short_desc_en || [
      b.avg_rating ? `Rating ${b.avg_rating}` : '',
      b.review_count ? `${b.review_count} reviews` : '',
      b.phone || '',
    ].filter(Boolean).join(' · '),
    metadata: {
      avgRating: b.avg_rating,
      reviewCount: b.review_count,
      phone: b.phone,
      address: b.address_full,
      displayName: b.display_name,
      briefDesc: b.short_desc_en,
    },
  }));
}

export function buildRelatedSources(related: RelatedContent): HelperSource[] {
  const sources: HelperSource[] = [];
  for (const g of related.guides) sources.push({ type: 'Guide', title: g.title, url: `/guides/${g.slug}`, snippet: g.snippet });
  for (const n of related.news) sources.push({ type: 'News', title: n.title, url: `/news/${n.slug}`, snippet: n.snippet });
  for (const t of related.forum) sources.push({ type: 'Forum', title: t.title, url: `/forum/${t.boardSlug || 'general'}/${t.slug}`, snippet: t.snippet });
  for (const d of related.discover) sources.push({ type: 'Discover', title: d.title, url: `/discover/${d.slug}`, snippet: d.snippet });
  return sources;
}

// ─── Utility ──────────────────────────────────────────────────

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
