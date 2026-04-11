/**
 * Helper Answer Builders — one function per answer type.
 * Each builder returns { answer: string, sources: HelperSource[] }
 *
 * All layout structure is controlled by ./layout.ts
 */

import type { AllocationResult, HelperSource, EventItem } from './types';
import {
  section, divider, closingCta, joinSections,
  businessTable, comparisonTable, eventsTable,
  relatedContentSection,
  buildBusinessSources, buildRelatedSources,
  capitalize,
} from './layout';

interface BuildResult {
  answer: string;
  sources: HelperSource[];
}

// ─── Shared ──────────────────────────────────────────────────

function locationText(alloc: AllocationResult): string {
  if (!alloc.townLabel) return ' in Orange County';
  const cap = capitalize(alloc.townLabel);
  return alloc.locationFallback ? ` near ${cap}` : ` in ${cap}`;
}

// ─── Type 1: Business Recommendation ────────────────────────

export function buildBusinessRecommendation(alloc: AllocationResult): BuildResult {
  const { businesses, matchedCategory, related } = alloc;
  const categoryLabel = matchedCategory || alloc.keywords.join(' ');
  const loc = locationText(alloc);
  const total = businesses.length;
  const optionWord = total === 1 ? 'option' : 'options';

  const topPick = businesses[0];
  const highestRated = [...businesses].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))[0];

  const answer = joinSections(
    `Here are the top ${categoryLabel}${loc} — I found ${total} ${optionWord}, sorted by rating and reviews:`,
    businessTable(businesses, 10),
    [
      section('💡', 'My Picks'),
      topPick ? `- **Most popular:** ${topPick.display_name} — ${topPick.avg_rating || ''}⭐ with ${topPick.review_count || 0} reviews` : '',
      highestRated && highestRated.id !== topPick?.id ? `- **Highest rated:** ${highestRated.display_name} — ${highestRated.avg_rating}⭐` : '',
      businesses[1] && businesses[1].id !== highestRated?.id ? `- **Also great:** ${businesses[1].display_name} — ${businesses[1].avg_rating ? businesses[1].avg_rating + '⭐' : 'highly rated'}` : '',
      businesses[2] && businesses[2].id !== highestRated?.id && businesses[2].id !== topPick?.id ? `- **Worth trying:** ${businesses[2].display_name}` : '',
    ],
    [
      section('📌', 'Tips'),
      alloc.locationFallback && alloc.townLabel ? `- 📍 No ${categoryLabel} found directly in ${capitalize(alloc.townLabel)} — showing nearby options in Orange County` : '',
      `- 📞 Call ahead to check hours and wait times`,
      alloc.townLabel === 'middletown' ? `- 🅿️ NY-211 corridor has the most options — parking is usually easy` : `- 🅿️ Check Google Maps for parking near your pick`,
      `- 👆 Click any name above to see full details and reviews`,
    ],
    relatedContentSection(related),
    divider(),
    closingCta('Want me to narrow it down? Tell me your preferences — budget, dine-in vs takeout, or specific cuisine!'),
  );

  return {
    answer,
    sources: [...buildBusinessSources(businesses), ...buildRelatedSources(related)],
  };
}

// ─── Type 9: Specific Business Lookup ───────────────────────

export function buildBusinessLookup(alloc: AllocationResult, query: string): BuildResult {
  const biz = alloc.singleBusiness;
  if (!biz) return { answer: 'Sorry, I could not find that business.', sources: [] };

  const q = query.toLowerCase();
  const asksHours = /open|hours|close|when|time|schedule|sunday|saturday|monday|tuesday|wednesday|thursday|friday/.test(q);
  const asksPhone = /phone|call|number|contact|reach/.test(q);
  const asksReviews = /review|rating|good|worth|recommend/.test(q);

  const header = [
    `## ${biz.display_name}`,
    '',
    biz.avg_rating ? `⭐ **${biz.avg_rating}/5** from ${biz.review_count || 0} reviews` : '',
    '',
    biz.short_desc_en || '',
  ];

  const details = [
    section('📍', 'Details'),
    biz.address_full ? `- **Address:** [${biz.address_full}](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address_full)})` : '',
    biz.phone ? `- **Phone:** [${biz.phone}](tel:${biz.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '+1$1')})` : '',
    biz.ai_tags.length > 0 ? `- **Categories:** ${biz.ai_tags.slice(0, 5).join(', ')}` : '',
  ];

  const contextual: string[] = [];
  if (asksHours) {
    contextual.push(section('🕐', 'Hours'));
    contextual.push(`I don't have exact hours in my database — I'd recommend calling **${biz.phone || 'them'}** directly or checking their Google listing for today's hours.`);
  }
  if (asksPhone && biz.phone) {
    contextual.push(section('📞', 'Contact'));
    contextual.push(`You can reach them at **[${biz.phone}](tel:${biz.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '+1$1')})**.`);
  }
  if (asksReviews) {
    contextual.push(section('⭐', 'What People Say'));
    if (biz.avg_rating && biz.avg_rating >= 4.5) {
      contextual.push(`With a **${biz.avg_rating}/5** rating from ${biz.review_count} reviews, this is one of the top-rated in the area!`);
    } else if (biz.avg_rating) {
      contextual.push(`Rated **${biz.avg_rating}/5** from ${biz.review_count} reviews — solid and reliable.`);
    }
  }

  const answer = joinSections(
    header,
    details,
    contextual.length > 0 ? contextual : null,
    `👆 [View full profile on Baam](/en/businesses/${biz.slug}) for photos, menu, and more reviews.`,
    divider(),
    closingCta('Need more? Ask me about **similar places**, **directions**, or **other businesses nearby**!'),
  );

  return { answer, sources: buildBusinessSources([biz]) };
}

// ─── Type 2: Guide / How-To ────────────────────────────────

export function buildGuideAnswer(_alloc: AllocationResult, aiAnswer: string): BuildResult {
  const answer = joinSections(
    aiAnswer,
    divider(),
    closingCta('Need more details? Just ask!'),
  );
  return { answer, sources: [] };
}

// ─── Type 3: Info Lookup ────────────────────────────────────

export function buildInfoLookup(_alloc: AllocationResult, aiAnswer: string): BuildResult {
  const answer = joinSections(
    aiAnswer,
    divider(),
    closingCta('Need more info? Just ask!'),
  );
  return { answer, sources: [] };
}

// ─── Type 4: Mixed (Info + Business) ────────────────────────

export function buildMixedAnswer(alloc: AllocationResult, aiAnswer: string): BuildResult {
  const { businesses, matchedCategory } = alloc;

  // Businesses are pre-filtered by actions.ts using expanded search_terms
  const bizToShow = businesses;

  let bizSection: string | null = null;
  if (bizToShow.length > 0 && !aiAnswer.includes('| # |') && !aiAnswer.includes('| Name |')) {
    const categoryLabel = matchedCategory || alloc.keywords.join(' ');
    const loc = locationText(alloc);
    bizSection = joinSections(
      section('🏪', `${categoryLabel} Professionals${loc}`),
      businessTable(bizToShow, 5),
    );
  }

  const answer = joinSections(
    aiAnswer,
    bizSection,
    divider(),
    closingCta('Want me to go deeper on the info side or the business recommendations?'),
  );

  return { answer, sources: buildBusinessSources(bizToShow.slice(0, 5)) };
}

// ─── Type 5: Community / Discover ───────────────────────────

export function buildCommunityAnswer(
  alloc: AllocationResult,
  forum: { title: string; slug: string; snippet: string; boardSlug?: string; replyCount?: number }[],
  discover: { title: string; slug: string; snippet: string; likeCount?: number }[],
): BuildResult {
  const topic = alloc.keywords.join(' ') || 'this topic';

  if (forum.length === 0 && discover.length === 0) {
    const answer = joinSections(
      `I didn't find community discussions about "${topic}" yet.`,
      [
        section('💡', 'Be the First!'),
        `- 💬 [Start a discussion on the Forum](/en/forum) — locals are quick to respond`,
        `- 📝 [Share your experience on Discover](/en/discover) — help others in the community`,
      ],
      divider(),
      closingCta('Want me to find **businesses** or **guides** related to this topic instead?'),
    );
    return { answer, sources: [] };
  }

  const forumBlock = forum.length > 0 ? [
    section('💬', 'Community Discussions'),
    ...forum.slice(0, 5).flatMap((t) => {
      const replies = t.replyCount ? ` · ${t.replyCount} replies` : '';
      const lines = [`- [${t.title}](/en/forum/${t.boardSlug || 'general'}/${t.slug})${replies}`];
      if (t.snippet) lines.push(`  > ${t.snippet.slice(0, 120)}...`);
      return lines;
    }),
  ] : null;

  const discoverBlock = discover.length > 0 ? [
    section('📝', 'Community Posts'),
    ...discover.slice(0, 5).flatMap((d) => {
      const likes = d.likeCount ? ` · ❤️ ${d.likeCount}` : '';
      const lines = [`- [${d.title}](/en/discover/${d.slug})${likes}`];
      if (d.snippet) lines.push(`  > ${d.snippet.slice(0, 120)}...`);
      return lines;
    }),
  ] : null;

  const answer = joinSections(
    `Here's what the community is saying about **${topic}**:`,
    forumBlock,
    discoverBlock,
    [
      section('💡', 'Join the Conversation'),
      `- 💬 [Share your thoughts on the Forum](/en/forum)`,
      `- 📝 [Write a post on Discover](/en/discover)`,
    ],
    divider(),
    closingCta('Want me to find **businesses** or **guides** related to this topic instead?'),
  );

  const sources: HelperSource[] = [
    ...forum.slice(0, 5).map((t) => ({ type: 'Forum', title: t.title, url: `/forum/${t.boardSlug || 'general'}/${t.slug}`, snippet: t.snippet })),
    ...discover.slice(0, 5).map((d) => ({ type: 'Discover', title: d.title, url: `/discover/${d.slug}`, snippet: d.snippet })),
  ];

  return { answer, sources };
}

// ─── Type 6: News & Events ─────────────────────────────────

export function buildNewsEventsAnswer(
  alloc: AllocationResult,
  news: { title: string; slug: string; snippet: string }[],
  events: EventItem[],
): BuildResult {
  const topic = alloc.keywords.join(' ') || 'what\'s happening';

  if (news.length === 0 && events.length === 0) {
    const answer = joinSections(
      `I don't have recent news or events about "${topic}" right now.`,
      [
        section('🧭', 'Try These'),
        '- 📰 [Browse all local news](/en/news)',
        '- 🎉 [See upcoming events](/en/events)',
      ],
      divider(),
      closingCta('Want more details on any of these, or looking for something else?'),
    );
    return { answer, sources: [] };
  }

  const newsBlock = news.length > 0 ? [
    section('📰', 'Recent News'),
    ...news.slice(0, 5).flatMap((n) => {
      const lines = [`- [${n.title}](/en/news/${n.slug})`];
      if (n.snippet) lines.push(`  > ${n.snippet.slice(0, 140)}`);
      return lines;
    }),
  ] : null;

  const eventsBlock = events.length > 0 ? joinSections(
    section('🎉', 'Upcoming Events'),
    eventsTable(events, 6),
  ) : null;

  const answer = joinSections(
    `Here's what's happening with **${topic}** in the area:`,
    newsBlock,
    eventsBlock,
    divider(),
    closingCta('Want more details on any of these, or looking for something else?'),
  );

  const sources: HelperSource[] = [
    ...news.slice(0, 5).map((n) => ({ type: 'News', title: n.title, url: `/news/${n.slug}`, snippet: n.snippet })),
    ...events.slice(0, 6).map((e) => ({ type: 'Event', title: e.title, url: `/events/${e.slug}`, snippet: e.summary || '' })),
  ];

  return { answer, sources };
}

// ─── Type 10: Comparison ────────────────────────────────────

export function buildComparisonAnswer(alloc: AllocationResult): BuildResult {
  const pair = alloc.comparisonPair;
  if (!pair) {
    return { answer: 'Sorry, I could not find both businesses to compare. Try naming them more specifically.', sources: [] };
  }

  const [a, b] = pair;

  // Quick verdict with tradeoff explanation
  const aRat = a.avg_rating || 0;
  const bRat = b.avg_rating || 0;
  const aRev = a.review_count || 0;
  const bRev = b.review_count || 0;
  const aScore = aRat * Math.log2(aRev + 1);
  const bScore = bRat * Math.log2(bRev + 1);

  const verdictLines: string[] = [];
  if (Math.abs(aScore - bScore) < 0.5) {
    verdictLines.push(`Both are solid choices! They're closely matched overall.`);
    if (aRat > bRat) verdictLines.push(`- **${a.display_name}** is slightly higher rated (${aRat} vs ${bRat})`);
    else if (bRat > aRat) verdictLines.push(`- **${b.display_name}** is slightly higher rated (${bRat} vs ${aRat})`);
    if (aRev > bRev * 1.3) verdictLines.push(`- **${a.display_name}** has significantly more reviews (${aRev} vs ${bRev}) — more proven`);
    else if (bRev > aRev * 1.3) verdictLines.push(`- **${b.display_name}** has significantly more reviews (${bRev} vs ${aRev}) — more proven`);
  } else {
    const winner = aScore > bScore ? a : b;
    const loser = aScore > bScore ? b : a;
    const wRat = aScore > bScore ? aRat : bRat;
    const lRat = aScore > bScore ? bRat : aRat;
    const wRev = aScore > bScore ? aRev : bRev;
    const lRev = aScore > bScore ? bRev : aRev;

    verdictLines.push(`**${winner.display_name}** has the edge overall.`);
    if (wRat > lRat && wRev > lRev) {
      verdictLines.push(`- Higher rated (${wRat} vs ${lRat}) AND more reviews (${wRev} vs ${lRev}) — the clear winner`);
    } else if (wRat > lRat) {
      verdictLines.push(`- Higher rated (${wRat} vs ${lRat}), though ${loser.display_name} has more reviews (${lRev} vs ${wRev})`);
    } else if (wRev > lRev) {
      verdictLines.push(`- Many more reviews (${wRev} vs ${lRev}), though ${loser.display_name} is slightly higher rated (${lRat} vs ${wRat})`);
    }
    verdictLines.push(`- **${loser.display_name}** is still a great option — ${lRat}⭐ from ${lRev} reviews`);
  }

  const answer = joinSections(
    `## ${a.display_name} vs ${b.display_name}`,
    comparisonTable(a, b),
    (a.short_desc_en || b.short_desc_en) ? [
      section('📋', 'About'),
      a.short_desc_en ? `- **${a.display_name}:** ${a.short_desc_en}` : '',
      b.short_desc_en ? `- **${b.display_name}:** ${b.short_desc_en}` : '',
    ] : null,
    [
      section('💡', 'Quick Take'),
      ...verdictLines,
    ],
    `👆 View full profiles: [${a.display_name}](/en/businesses/${a.slug}) · [${b.display_name}](/en/businesses/${b.slug})`,
    divider(),
    closingCta('Want me to compare specific aspects like menu, prices, or location convenience?'),
  );

  return { answer, sources: buildBusinessSources([a, b]) };
}

// ─── Type 8: No Match ───────────────────────────────────────

export function buildNoMatch(query: string, _keywords: string[]): BuildResult {
  const answer = joinSections(
    `⚠️ I couldn't find specific results for "${query}" in our local database.`,
    [
      section('🧭', "Here's What I Can Do"),
      '- 🔍 **Try a different search** — rephrase with a more specific category (e.g., "pizza" instead of "food")',
      '- 🌐 **Search the web** — I can check Google for options near you',
      '- 💬 **Ask the community** — post on the [Baam Forum](/en/forum) and locals will chime in',
    ],
    divider(),
    closingCta("Try another question — I'm great with businesses, services, local guides, and events!"),
  );

  return { answer, sources: [] };
}
