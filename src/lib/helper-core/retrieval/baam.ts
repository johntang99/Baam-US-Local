import type { HelperIntent, RetrievalPayload, SourceItem } from '../types';

type AnyRow = Record<string, unknown>;

function uniqueByUrl(sources: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function toSnippet(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 180);
  }
  return fallback;
}

const invalidNamePatterns = [/点击查看地图/i, /^查看地图$/i, /^地图$/i, /^google\s*map/i];

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isInvalidBusinessName(name: string): boolean {
  if (!name) return true;
  return invalidNamePatterns.some((pattern) => pattern.test(name));
}

function getBusinessTitle(business: AnyRow): string {
  const zhName = normalizeName(business.display_name_zh);
  const enName = normalizeName(business.display_name);
  if (!isInvalidBusinessName(zhName)) return zhName;
  if (!isInvalidBusinessName(enName)) return enName;
  return '未命名商家';
}

function escapeLikeKeyword(keyword: string): string {
  return keyword.replace(/,/g, ' ').trim();
}

function buildOr(keywords: string[], columns: string[]): string {
  const conditions: string[] = [];
  for (const keyword of keywords) {
    const safeKeyword = escapeLikeKeyword(keyword);
    if (!safeKeyword) continue;
    for (const column of columns) {
      conditions.push(`${column}.ilike.%${safeKeyword}%`);
    }
  }
  return conditions.join(',');
}

const genericWords = new Set([
  '申请', '怎么', '如何', '哪里', '什么', '可以', '需要', '办理', '服务', '咨询', '推荐',
  '好的', '最好', '附近', '价格', '费用', '多少', '帮我', '一下', '纽约', '法拉盛',
  '家庭', '聚餐', '口碑', '评价', '筛选', '值得', '考虑', '餐厅', '饭店', '好吃',
]);

const locationHints = [
  { label: '法拉盛', patterns: ['法拉盛', 'flushing'] },
  { label: '曼哈顿', patterns: ['曼哈顿', 'manhattan'] },
  { label: '唐人街', patterns: ['唐人街', 'chinatown', 'mulberry'] },
  { label: '皇后区', patterns: ['皇后区', 'queens'] },
  { label: '布鲁克林', patterns: ['布鲁克林', 'brooklyn'] },
  { label: '东村', patterns: ['东村', 'east village', 'lower east side'] },
];

function buildBusinessOr(keywords: string[], columns: string[]): string {
  const specificKeywords = keywords.filter((keyword) => !genericWords.has(keyword) && keyword.length > 1);
  return buildOr(specificKeywords.length > 0 ? specificKeywords : keywords, columns);
}

function buildBusinessSnippet(business: AnyRow, reviews: string[] = []): string {
  const base = [
    business.avg_rating ? `评分 ${business.avg_rating}` : '',
    business.review_count ? `${business.review_count}条评价` : '',
    business.phone ? `电话 ${business.phone}` : '',
    business.address_full ? `地址 ${String(business.address_full).slice(0, 48)}` : '',
    Array.isArray(business.ai_tags) ? business.ai_tags.slice(0, 3).join(' / ') : '',
  ]
    .filter(Boolean)
    .join(' · ');

  if (reviews.length === 0) return base;
  return `${base}${base ? ' · ' : ''}评价摘录：${reviews.join('；')}`;
}

function hasStrongBusinessCoreData(business: AnyRow): boolean {
  const hasRating = Number(business.avg_rating || 0) > 0;
  const hasReviews = Number(business.review_count || 0) > 0;
  const hasPhone = String(business.phone || '').trim().length >= 8;
  const hasAddress = String(business.address_full || '').trim().length >= 6;
  const coreHits = [hasRating, hasReviews, hasPhone, hasAddress].filter(Boolean).length;
  return coreHits >= 3;
}

function getMatchedLocationLabels(query: string): string[] {
  const lower = query.toLowerCase();
  return locationHints
    .filter((item) => item.patterns.some((pattern) => lower.includes(pattern.toLowerCase())))
    .map((item) => item.label);
}

function businessMatchesLocation(business: AnyRow, labels: string[]): boolean {
  if (labels.length === 0) return false;
  const haystack = [
    String(business.address_full || ''),
    String(business.display_name || ''),
    String(business.display_name_zh || ''),
    String(business.short_desc_zh || ''),
  ]
    .join(' ')
    .toLowerCase();

  return locationHints.some(
    (item) =>
      labels.includes(item.label) &&
      item.patterns.some((pattern) => haystack.includes(pattern.toLowerCase())),
  );
}

const queryIntentAnchors: Array<{ trigger: string[]; terms: string[] }> = [
  { trigger: ['火锅', 'hotpot', 'hot pot', '涮锅', '麻辣锅'], terms: ['火锅', 'hotpot', 'hot pot', '涮锅', '麻辣锅'] },
  { trigger: ['烧烤', '烤肉', 'bbq'], terms: ['烧烤', '烤肉', 'bbq', 'barbecue'] },
  { trigger: ['奶茶', '茶饮', 'bubble tea', 'boba'], terms: ['奶茶', '茶饮', 'boba', 'bubble tea'] },
  { trigger: ['川菜', '四川菜', 'sichuan'], terms: ['川菜', '四川', '四川菜', 'sichuan', '麻辣', '辣子'] },
  { trigger: ['湘菜', 'hunan'], terms: ['湘菜', 'hunan', '剁椒'] },
  { trigger: ['粤菜', '广东菜', 'cantonese'], terms: ['粤菜', '广东菜', 'cantonese', '烧腊', '点心'] },
  { trigger: ['东北菜', 'dongbei'], terms: ['东北菜', 'dongbei', '锅包肉', '地三鲜'] },
  { trigger: ['上海菜', '本帮菜', 'shanghai'], terms: ['上海菜', '本帮菜', 'shanghai', '小笼包', '生煎'] },
  { trigger: ['日料', '寿司', 'sushi', 'japanese'], terms: ['日料', '寿司', '刺身', 'sushi', 'japanese'] },
  { trigger: ['韩餐', '韩国菜', 'korean'], terms: ['韩餐', '韩国菜', 'korean', '韩式', '泡菜'] },
  { trigger: ['律师', 'lawyer', 'attorney'], terms: ['律师', 'lawyer', 'attorney', 'law firm'] },
  { trigger: ['驾校', '学车', 'driving school'], terms: ['驾校', '学车', 'driving school'] },
];

type CuisineAnchorProfile = {
  key: string;
  queryTriggers: string[];
  categorySignals: string[];
  anchorTerms: string[];
  strictCategorySlugs?: string[];
  blockedCategorySlugs?: string[];
  requiredBusinessTerms?: string[];
  excludedBusinessTerms?: string[];
};

const cuisineAnchorProfiles: CuisineAnchorProfile[] = [
  {
    key: 'hotpot',
    queryTriggers: ['火锅', 'hotpot', 'hot pot', '涮锅', '麻辣锅'],
    categorySignals: ['火锅', 'hotpot', 'hot pot', '涮锅', '麻辣锅', '串串香'],
    anchorTerms: ['火锅', 'hotpot', 'hot pot', '涮锅', '麻辣锅', '串串', '牛油锅'],
    strictCategorySlugs: ['food-hotpot'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
    requiredBusinessTerms: ['火锅', 'hotpot', 'hot pot', '涮', '锅底', '串串', '麻辣锅', 'shabu'],
  },
  {
    key: 'bbq',
    queryTriggers: ['烧烤', '烤肉', 'bbq', 'barbecue'],
    categorySignals: ['烧烤', '烤肉', 'bbq', 'barbecue', '串烧'],
    anchorTerms: ['烧烤', '烤肉', 'bbq', 'barbecue', '烤串', '串烧'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
    requiredBusinessTerms: ['烧烤', '烤肉', 'bbq', 'barbecue', 'k-bbq', '炭火', '烤串', '串烧', 'grill'],
  },
  {
    key: 'japanese',
    queryTriggers: ['日料', '寿司', 'sushi', 'japanese'],
    categorySignals: ['日料', '日本料理', '寿司', 'sushi', 'japanese', '居酒屋', '拉面'],
    anchorTerms: ['日料', '日本料理', '寿司', '刺身', 'sushi', 'japanese', '居酒屋', '拉面'],
    strictCategorySlugs: ['food-japanese'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
  },
  {
    key: 'korean',
    queryTriggers: ['韩餐', '韩国菜', 'korean'],
    categorySignals: ['韩餐', '韩国菜', 'korean', '韩式', '泡菜', '部队锅'],
    anchorTerms: ['韩餐', '韩国菜', 'korean', '韩式', '泡菜', '部队锅', '石锅拌饭'],
    strictCategorySlugs: ['food-korean'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
  },
  {
    key: 'sichuan',
    queryTriggers: ['川菜', '四川菜', 'sichuan'],
    categorySignals: ['川菜', '四川', 'sichuan', '麻辣'],
    anchorTerms: ['川菜', '四川', '四川菜', 'sichuan', '麻辣', '辣子'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
    requiredBusinessTerms: ['川菜', '四川', 'sichuan', '麻辣', '辣子', '酸菜鱼', '水煮', '回锅', '宫保'],
    excludedBusinessTerms: ['火锅', 'hotpot', '涮', 'bbq', '烧烤', '烤肉', 'k-bbq'],
  },
  {
    key: 'hunan',
    queryTriggers: ['湘菜', 'hunan'],
    categorySignals: ['湘菜', 'hunan', '剁椒'],
    anchorTerms: ['湘菜', 'hunan', '剁椒'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
    requiredBusinessTerms: ['湘菜', 'hunan', '剁椒', '小炒', '农家菜'],
    excludedBusinessTerms: ['火锅', 'hotpot', '涮', 'bbq', '烧烤', '烤肉', 'k-bbq'],
  },
  {
    key: 'cantonese',
    queryTriggers: ['粤菜', '广东菜', 'cantonese'],
    categorySignals: ['粤菜', '广东菜', 'cantonese', '点心', '烧腊'],
    anchorTerms: ['粤菜', '广东菜', 'cantonese', '烧腊', '点心'],
    strictCategorySlugs: ['food-dim-sum'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
  },
  {
    key: 'dongbei',
    queryTriggers: ['东北菜', 'dongbei'],
    categorySignals: ['东北菜', 'dongbei'],
    anchorTerms: ['东北菜', 'dongbei', '锅包肉', '地三鲜'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
    requiredBusinessTerms: ['东北菜', 'dongbei', '锅包肉', '地三鲜', '铁锅炖'],
    excludedBusinessTerms: ['火锅', 'hotpot', '涮', 'bbq', '烧烤', '烤肉', 'k-bbq'],
  },
  {
    key: 'shanghai',
    queryTriggers: ['上海菜', '本帮菜', 'shanghai'],
    categorySignals: ['上海菜', '本帮菜', 'shanghai'],
    anchorTerms: ['上海菜', '本帮菜', 'shanghai', '小笼包', '生煎'],
    blockedCategorySlugs: ['food-dining', 'food-grocery', 'food-bakery'],
    requiredBusinessTerms: ['上海菜', '本帮', 'shanghai', '小笼', '生煎', '蟹粉'],
    excludedBusinessTerms: ['火锅', 'hotpot', '涮', 'bbq', '烧烤', '烤肉', 'k-bbq'],
  },
];

function getCuisineAnchorProfile(query: string): CuisineAnchorProfile | null {
  const lower = query.toLowerCase();
  return cuisineAnchorProfiles.find((profile) =>
    profile.queryTriggers.some((item) => lower.includes(item.toLowerCase())),
  ) || null;
}

function categoryMatchesCuisineProfile(category: AnyRow, profile: CuisineAnchorProfile): boolean {
  const nameZh = String(category.name_zh || '').toLowerCase();
  const slug = String(category.slug || '').toLowerCase();
  const terms = Array.isArray(category.search_terms)
    ? category.search_terms.map((item) => String(item).toLowerCase()).filter((item) => item.length >= 2)
    : [];
  const blockedSlugs = new Set((profile.blockedCategorySlugs || []).map((item) => item.toLowerCase()));
  const strictSlugs = new Set((profile.strictCategorySlugs || []).map((item) => item.toLowerCase()));

  if (blockedSlugs.has(slug)) return false;
  if (strictSlugs.size > 0) {
    return strictSlugs.has(slug);
  }

  return profile.categorySignals.some((signal) => {
    const lowerSignal = signal.toLowerCase();
    return (
      nameZh.includes(lowerSignal) ||
      slug.includes(lowerSignal) ||
      terms.some((term) => term.includes(lowerSignal))
    );
  });
}

function getQueryAnchorTerms(query: string): string[] {
  const lower = query.toLowerCase();
  const terms = new Set<string>();
  for (const anchor of queryIntentAnchors) {
    if (anchor.trigger.some((item) => lower.includes(item.toLowerCase()))) {
      anchor.terms.forEach((item) => terms.add(item.toLowerCase()));
    }
  }
  return [...terms];
}

function businessMatchesAnchorTerms(business: AnyRow, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const aiTags = Array.isArray(business.ai_tags) ? business.ai_tags.map((item) => String(item).toLowerCase()) : [];
  const haystack = [
    String(business.display_name || ''),
    String(business.display_name_zh || ''),
    String(business.short_desc_zh || ''),
    String(business.ai_summary_zh || ''),
    aiTags.join(' '),
  ]
    .join(' ')
    .toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function businessMatchesCuisineBoundary(business: AnyRow, profile: CuisineAnchorProfile): boolean {
  const requiredTerms = (profile.requiredBusinessTerms || []).map((item) => item.toLowerCase());
  const excludedTerms = (profile.excludedBusinessTerms || []).map((item) => item.toLowerCase());
  if (requiredTerms.length === 0) return true;
  const aiTags = Array.isArray(business.ai_tags) ? business.ai_tags.map((item) => String(item).toLowerCase()) : [];
  const haystack = [
    String(business.display_name || ''),
    String(business.display_name_zh || ''),
    String(business.short_desc_zh || ''),
    String(business.ai_summary_zh || ''),
    aiTags.join(' '),
  ]
    .join(' ')
    .toLowerCase();
  if (excludedTerms.some((term) => haystack.includes(term))) return false;
  return requiredTerms.some((term) => haystack.includes(term));
}

function cuisineEvidenceScore(business: AnyRow, profile: CuisineAnchorProfile): number {
  const requiredTerms = (profile.requiredBusinessTerms || []).map((item) => item.toLowerCase());
  const anchorTerms = (profile.anchorTerms || []).map((item) => item.toLowerCase());
  const titleHaystack = [String(business.display_name || ''), String(business.display_name_zh || '')]
    .join(' ')
    .toLowerCase();
  const aiTags = Array.isArray(business.ai_tags) ? business.ai_tags.map((item) => String(item).toLowerCase()) : [];
  const haystack = [
    String(business.display_name || ''),
    String(business.display_name_zh || ''),
    String(business.short_desc_zh || ''),
    String(business.ai_summary_zh || ''),
    aiTags.join(' '),
  ]
    .join(' ')
    .toLowerCase();
  const titleRequiredHitCount = requiredTerms.filter((term) => titleHaystack.includes(term)).length;
  const titleAnchorHitCount = anchorTerms.filter((term) => titleHaystack.includes(term)).length;
  const requiredHitCount = requiredTerms.filter((term) => haystack.includes(term)).length;
  const anchorHitCount = anchorTerms.filter((term) => haystack.includes(term)).length;
  // Title hits are strongest, then full-context required hits, then generic anchors.
  return titleRequiredHitCount * 6 + titleAnchorHitCount * 4 + requiredHitCount * 3 + anchorHitCount;
}

function compareRecommendationQuality(a: AnyRow, b: AnyRow): number {
  // Use DB-computed total_score: 6×Rating + 3×log(Reviews+2)×2 + P_score
  return (Number(b.total_score) || 0) - (Number(a.total_score) || 0);
}

async function searchBusinesses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  keywords: string[],
  query: string,
  intent: HelperIntent,
): Promise<SourceItem[]> {
  const businessFields =
    'id, slug, display_name, display_name_zh, short_desc_zh, ai_summary_zh, ai_tags, avg_rating, review_count, phone, address_full, is_featured, total_score';

  const results: AnyRow[] = [];
  const effectiveKeywords = keywords.filter((keyword) => !genericWords.has(keyword) && keyword.length > 1);
  const relevanceKeywords = effectiveKeywords.length > 0 ? effectiveKeywords : keywords;
  const seenIds = new Set<string>();
  const categoryBizIds = new Set<string>();
  const cuisineAnchorBizIds = new Set<string>();
  const MAX_TERMS_ONLY_SIZE = 50;

  const addResults = (data: AnyRow[] | null | undefined) => {
    for (const business of data || []) {
      const id = String(business.id || '');
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      results.push(business);
    }
  };

  const { data: allBizCats } = await supabase
    .from('categories')
    .select('id, name_zh, slug, parent_id, search_terms')
    .eq('type', 'business')
    .eq('site_scope', 'zh');
  const cuisineAnchorProfile = intent === 'localRecommendation' ? getCuisineAnchorProfile(query) : null;

  const matchedCats: { cat: AnyRow; matchType: 'name' | 'terms' | 'anchor' }[] = [];
  for (const cat of (allBizCats || []) as AnyRow[]) {
    const nameZh = String(cat.name_zh || '');
    const terms = Array.isArray(cat.search_terms) ? cat.search_terms.map(String) : [];
    const anchorMatch = cuisineAnchorProfile ? categoryMatchesCuisineProfile(cat, cuisineAnchorProfile) : false;
    if (anchorMatch) {
      matchedCats.push({ cat, matchType: 'anchor' });
      continue;
    }

    for (const keyword of relevanceKeywords) {
      if (keyword.length < 2) continue;
      const nameMatch = nameZh && (nameZh.includes(keyword) || keyword.includes(nameZh));
      const termsMatch = terms.some((term) => term.includes(keyword) || (term.length >= 3 && keyword.includes(term)));
      if (nameMatch || termsMatch) {
        matchedCats.push({ cat, matchType: nameMatch ? 'name' : 'terms' });
        break;
      }
    }
  }

  if (matchedCats.length > 0) {
    const catIdsByMatch = new Map<string, 'name' | 'terms' | 'anchor'>();
    for (const { cat, matchType } of matchedCats) {
      catIdsByMatch.set(String(cat.id), matchType);
    }

    const parentMatches = matchedCats.filter((item) => !item.cat.parent_id);
    if (parentMatches.length > 0) {
      const { data: children } = await supabase
        .from('categories')
        .select('id, parent_id')
        .in('parent_id', parentMatches.map((item) => item.cat.id));

      for (const child of (children || []) as AnyRow[]) {
        const parentType = catIdsByMatch.get(String(child.parent_id));
        if (parentType) {
          catIdsByMatch.set(String(child.id), parentType);
        }
      }
    }

    const { data: allBizCatLinks } = await supabase
      .from('business_categories')
      .select('business_id, category_id')
      .in('category_id', [...catIdsByMatch.keys()]);

    const bizPerCat = new Map<string, string[]>();
    for (const link of (allBizCatLinks || []) as AnyRow[]) {
      const categoryId = String(link.category_id);
      const businessId = String(link.business_id);
      if (!bizPerCat.has(categoryId)) bizPerCat.set(categoryId, []);
      bizPerCat.get(categoryId)!.push(businessId);
    }

    const includedBizIds = new Set<string>();
    for (const [categoryId, matchType] of catIdsByMatch.entries()) {
      const businessList = bizPerCat.get(categoryId) || [];
      if (matchType === 'anchor' || matchType === 'name' || businessList.length <= MAX_TERMS_ONLY_SIZE) {
        businessList.forEach((id) => {
          includedBizIds.add(id);
          categoryBizIds.add(id);
          if (matchType === 'anchor') cuisineAnchorBizIds.add(id);
        });
      }
    }

    if (includedBizIds.size > 0) {
      const { data } = await supabase
        .from('businesses')
        .select(businessFields)
        .eq('is_active', true)
        .in('id', [...includedBizIds].slice(0, 100))
        .order('total_score', { ascending: false, nullsFirst: false })
        .limit(30);

      addResults(data as AnyRow[] | undefined);
    }
  }

  for (const keyword of relevanceKeywords) {
    if (keyword.length < 2 || results.length >= 30) continue;
    const { data } = await supabase
      .from('businesses')
      .select(businessFields)
      .eq('is_active', true)
      .contains('ai_tags', [keyword])
      .order('total_score', { ascending: false, nullsFirst: false })
      .limit(10);

    addResults(data as AnyRow[] | undefined);
  }

  {
    const { data } = await supabase
      .from('businesses')
      .select(businessFields)
      .eq('is_active', true)
      .or(buildBusinessOr(relevanceKeywords, ['display_name', 'display_name_zh', 'short_desc_zh', 'ai_summary_zh']))
      .order('total_score', { ascending: false, nullsFirst: false })
      .limit(12);

    addResults(data as AnyRow[] | undefined);
  }

  const matchedLocationLabels = getMatchedLocationLabels(query);

  const anchorTerms = getQueryAnchorTerms(query);
  const cuisineCategoryFilteredResults =
    intent === 'localRecommendation' && cuisineAnchorProfile
      ? results.filter((business) => {
          const businessId = String(business.id || '');
          if (!businessId || !cuisineAnchorBizIds.has(businessId)) return false;
          const strictSlugMode = (cuisineAnchorProfile.strictCategorySlugs || []).length > 0;
          if (!businessMatchesCuisineBoundary(business, cuisineAnchorProfile)) return false;
          if (!strictSlugMode) return true;
          return businessMatchesAnchorTerms(business, cuisineAnchorProfile.anchorTerms);
        })
      : [];
  const cuisineTextFilteredResults =
    intent === 'localRecommendation' && cuisineAnchorProfile
      ? results.filter(
          (business) =>
            businessMatchesAnchorTerms(business, cuisineAnchorProfile.anchorTerms) &&
            businessMatchesCuisineBoundary(business, cuisineAnchorProfile),
        )
      : [];
  const cuisineHardFilteredResults =
    cuisineCategoryFilteredResults.length > 0 ? cuisineCategoryFilteredResults : cuisineTextFilteredResults;
  const anchorFilteredResults =
    intent === 'localRecommendation' && anchorTerms.length > 0
      ? results.filter((business) => businessMatchesAnchorTerms(business, anchorTerms))
      : [];
  const scopedResults =
    intent === 'localRecommendation' && cuisineAnchorProfile
      ? cuisineHardFilteredResults
      : anchorFilteredResults.length > 0
        ? anchorFilteredResults
        : results;
  const locationScopedResults =
    intent === 'localRecommendation' && matchedLocationLabels.length > 0
      ? scopedResults.filter((business) => businessMatchesLocation(business, matchedLocationLabels))
      : [];
  const recommendationPool =
    intent === 'localRecommendation' && locationScopedResults.length >= 5
      ? locationScopedResults
      : scopedResults;

  recommendationPool.sort((a, b) => {
    const aText = [a.display_name_zh, a.display_name, a.short_desc_zh, a.ai_summary_zh].filter(Boolean).join(' ');
    const bText = [b.display_name_zh, b.display_name, b.short_desc_zh, b.ai_summary_zh].filter(Boolean).join(' ');
    const aHasKeyword = relevanceKeywords.some((keyword) => aText.includes(keyword));
    const bHasKeyword = relevanceKeywords.some((keyword) => bText.includes(keyword));
    const aInCategory = categoryBizIds.has(String(a.id));
    const bInCategory = categoryBizIds.has(String(b.id));
    const aLocationMatch = businessMatchesLocation(a, matchedLocationLabels);
    const bLocationMatch = businessMatchesLocation(b, matchedLocationLabels);
    const aTier = aHasKeyword ? 0 : aInCategory ? 1 : 2;
    const bTier = bHasKeyword ? 0 : bInCategory ? 1 : 2;

    if (intent === 'localRecommendation' && aLocationMatch !== bLocationMatch) {
      return aLocationMatch ? -1 : 1;
    }
    if (intent === 'localRecommendation') {
      if (cuisineAnchorProfile) {
        const aCuisineScore = cuisineEvidenceScore(a, cuisineAnchorProfile);
        const bCuisineScore = cuisineEvidenceScore(b, cuisineAnchorProfile);
        if (aCuisineScore !== bCuisineScore) return bCuisineScore - aCuisineScore;
      }
      const qualityDiff = compareRecommendationQuality(a, b);
      if (qualityDiff !== 0) return qualityDiff;
      if (aTier !== bTier) return aTier - bTier;
    } else if (aTier !== bTier) {
      return aTier - bTier;
    }
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (Number(b.total_score) || 0) - (Number(a.total_score) || 0);
  });

  const rankedBusinesses =
    intent === 'localRecommendation'
      ? [
          ...recommendationPool.filter((business) => hasStrongBusinessCoreData(business)),
          ...recommendationPool.filter((business) => !hasStrongBusinessCoreData(business)),
        ]
      : recommendationPool;

  const recommendationReadyBusinesses = rankedBusinesses.filter((business) => hasStrongBusinessCoreData(business));
  const finalBusinesses =
    intent === 'localRecommendation'
      ? (recommendationReadyBusinesses.length > 0 ? recommendationReadyBusinesses : rankedBusinesses).slice(0, 15)
      : rankedBusinesses.slice(0, 15);
  const topBusinessIds = finalBusinesses.slice(0, 8).map((business) => String(business.id));
  let reviewsByBiz: Record<string, string[]> = {};

  if (topBusinessIds.length > 0) {
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('business_id, rating, body, google_author_name')
      .eq('status', 'approved')
      .in('business_id', topBusinessIds)
      .order('rating', { ascending: false })
      .limit(24);

    for (const review of (reviewData || []) as AnyRow[]) {
      const businessId = String(review.business_id || '');
      if (!businessId) continue;
      if (!reviewsByBiz[businessId]) reviewsByBiz[businessId] = [];
      if (reviewsByBiz[businessId].length >= 2) continue;
      const body = String(review.body || '').trim();
      if (!body) continue;
      const author = String(review.google_author_name || '用户');
      const rating = review.rating ? `${review.rating}星` : '';
      reviewsByBiz[businessId].push(`“${body.slice(0, 36)}”(${author}${rating ? `, ${rating}` : ''})`);
    }
  }

  return finalBusinesses.map((business) => ({
    type: '商家',
    title: getBusinessTitle(business),
    url: `/businesses/${String(business.slug || '')}`,
    snippet: toSnippet(
      business.short_desc_zh || business.ai_summary_zh,
      buildBusinessSnippet(business, reviewsByBiz[String(business.id)] || []),
    ),
    metadata: {
      avgRating: business.avg_rating || null,
      reviewCount: business.review_count || null,
      phone: business.phone || null,
      address: business.address_full || null,
      displayName: business.display_name || null,
      displayNameZh: business.display_name_zh || null,
      briefDesc: business.short_desc_zh || business.ai_summary_zh || null,
      isFeatured: Boolean(business.is_featured),
      locationMatched: businessMatchesLocation(business, matchedLocationLabels),
      reviewSnippets: reviewsByBiz[String(business.id)] || [],
    },
  }));
}

async function searchArticles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  keywords: string[],
  verticals: string[],
  typeLabel: '新闻' | '指南',
): Promise<SourceItem[]> {
  const { data } = await supabase
    .from('articles')
    .select('slug, title_zh, title_en, ai_summary_zh, summary_zh, body_zh, content_vertical')
    .eq('editorial_status', 'published')
    .in('content_vertical', verticals)
    .or(buildOr(keywords, ['title_zh', 'title_en', 'ai_summary_zh', 'summary_zh', 'body_zh']))
    .limit(10);

  return ((data || []) as AnyRow[]).map((article) => ({
    type: typeLabel,
    title: String(article.title_zh || article.title_en || '未命名内容'),
    url: typeLabel === '新闻' ? `/news/${String(article.slug || '')}` : `/guides/${String(article.slug || '')}`,
    snippet: toSnippet(article.ai_summary_zh || article.summary_zh || article.body_zh),
  }));
}

async function searchForum(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  keywords: string[],
): Promise<SourceItem[]> {
  const { data } = await supabase
    .from('forum_threads')
    .select('slug, title, body, ai_summary_zh, categories:board_id(slug)')
    .eq('status', 'published')
    .or(buildOr(keywords, ['title', 'body', 'ai_summary_zh']))
    .limit(8);

  return ((data || []) as AnyRow[]).map((thread) => {
    const boardSlug =
      typeof thread.categories === 'object' && thread.categories && 'slug' in thread.categories
        ? String((thread.categories as AnyRow).slug || 'general')
        : 'general';

    return {
      type: '论坛',
      title: String(thread.title || '论坛帖子'),
      url: `/forum/${boardSlug}/${String(thread.slug || '')}`,
      snippet: toSnippet(thread.ai_summary_zh || thread.body),
    };
  });
}

async function searchDiscover(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  keywords: string[],
): Promise<SourceItem[]> {
  const [posts, profiles] = await Promise.all([
    supabase
      .from('voice_posts')
      .select('slug, title, excerpt, ai_summary_zh')
      .eq('status', 'published')
      .or(buildOr(keywords, ['title', 'content', 'excerpt', 'ai_summary_zh']))
      .limit(6),
    supabase
      .from('profiles')
      .select('username, display_name, headline')
      .neq('profile_type', 'user')
      .or(buildOr(keywords, ['display_name', 'headline', 'username']))
      .limit(4),
  ]);

  return uniqueByUrl([
    ...((posts.data || []) as AnyRow[]).map((post) => ({
      type: '笔记',
      title: String(post.title || '社区笔记'),
      url: `/discover/${String(post.slug || '')}`,
      snippet: toSnippet(post.ai_summary_zh || post.excerpt),
    })),
    ...((profiles.data || []) as AnyRow[]).map((profile) => ({
      type: '达人',
      title: String(profile.display_name || profile.username || '本地达人'),
      url: `/discover/voices/${String(profile.username || '')}`,
      snippet: toSnippet(profile.headline),
    })),
  ]);
}

async function searchEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  keywords: string[],
): Promise<SourceItem[]> {
  const { data } = await supabase
    .from('events')
    .select('slug, title_zh, title_en, summary_zh, venue_name')
    .eq('status', 'published')
    .or(buildOr(keywords, ['title_zh', 'title_en', 'summary_zh', 'venue_name']))
    .limit(6);

  return ((data || []) as AnyRow[]).map((event) => ({
    type: '活动',
    title: String(event.title_zh || event.title_en || '本地活动'),
    url: `/events/${String(event.slug || '')}`,
    snippet: toSnippet(event.summary_zh || event.venue_name),
  }));
}

export async function searchBaamContent(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  query: string;
  keywords: string[];
  intent: HelperIntent;
}): Promise<RetrievalPayload> {
  const contentKeywords = [...new Set([params.query, ...params.keywords].map((item) => item.trim()).filter(Boolean))].slice(0, 6);
  const businessKeywords = [...new Set(params.keywords.map((item) => item.trim()).filter(Boolean))];
  const cuisineHardFilterApplied = params.intent === 'localRecommendation' && Boolean(getCuisineAnchorProfile(params.query));

  const [businesses, news, guides, forum, discover, events] = await Promise.all([
    searchBusinesses(
      params.supabase,
      businessKeywords.length > 0 ? businessKeywords : contentKeywords,
      params.query,
      params.intent,
    ),
    searchArticles(params.supabase, contentKeywords, ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'], '新闻'),
    searchArticles(params.supabase, contentKeywords, ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'], '指南'),
    searchForum(params.supabase, contentKeywords),
    searchDiscover(params.supabase, contentKeywords),
    searchEvents(params.supabase, contentKeywords),
  ]);

  const businessTable =
    businesses.length > 0
      ? [
          '| 店名 | 评分 | 评价数 | 电话 | 地址 |',
          '| --- | --- | --- | --- | --- |',
          ...businesses.slice(0, 8).map((item) => {
            const rating = item.metadata?.avgRating ? String(item.metadata.avgRating) : '';
            const reviewCount = item.metadata?.reviewCount ? String(item.metadata.reviewCount) : '';
            const phone = item.metadata?.phone ? String(item.metadata.phone) : '';
            const address = item.metadata?.address ? String(item.metadata.address) : '';
            return `| ${item.title} | ${rating} | ${reviewCount} | ${phone} | ${address} |`;
          }),
        ].join('\n')
      : '';

  const businessDetailContext =
    businesses.length > 0
      ? `商家候选详情：\n${businesses
          .slice(0, 8)
          .map((item, index) => {
            const reasons = [
              item.metadata?.locationMatched ? '和用户提到的区域更匹配' : '',
              item.metadata?.isFeatured ? '平台精选' : '',
              item.metadata?.avgRating ? `评分${item.metadata.avgRating}` : '',
              item.metadata?.reviewCount ? `${item.metadata.reviewCount}条评价` : '',
            ]
              .filter(Boolean)
              .join('，');
            const reviewSnippets = Array.isArray(item.metadata?.reviewSnippets)
              ? (item.metadata?.reviewSnippets as string[]).join('；')
              : '';
            return `${index + 1}. ${item.title}
- 电话：${item.metadata?.phone || '暂无'}
- 地址：${item.metadata?.address || '暂无'}
- 推荐信号：${reasons || '暂无'}
- 简介：${item.snippet || '暂无'}
${reviewSnippets ? `- 用户评价：${reviewSnippets}` : ''}`;
          })
          .join('\n')}`
      : '';

  const fullContextBlocks = [
    businesses.length > 0
      ? `商家结果（按相关度和评分排序）：\n${businesses.map((item, index) => `${index + 1}. ${item.title} | ${item.snippet || ''} | ${item.url}`).join('\n')}${params.intent === 'localRecommendation' && businessTable ? `\n\n推荐表格候选：\n${businessTable}` : ''}${params.intent === 'localRecommendation' && businessDetailContext ? `\n\n${businessDetailContext}` : ''}`
      : '',
    guides.length > 0
      ? `指南结果：\n${guides.map((item) => `- ${item.title} | ${item.snippet || ''} | ${item.url}`).join('\n')}`
      : '',
    news.length > 0
      ? `新闻结果：\n${news.map((item) => `- ${item.title} | ${item.snippet || ''} | ${item.url}`).join('\n')}`
      : '',
    forum.length > 0
      ? `论坛结果：\n${forum.map((item) => `- ${item.title} | ${item.snippet || ''} | ${item.url}`).join('\n')}`
      : '',
    discover.length > 0
      ? `发现结果：\n${discover.map((item) => `- ${item.title} | ${item.snippet || ''} | ${item.url}`).join('\n')}`
      : '',
    events.length > 0
      ? `活动结果：\n${events.map((item) => `- ${item.title} | ${item.snippet || ''} | ${item.url}`).join('\n')}`
      : '',
  ].filter(Boolean);

  const contextBlocks =
    params.intent === 'localRecommendation'
      ? fullContextBlocks.filter((block) => block.startsWith('商家结果'))
      : fullContextBlocks;

  const sources = uniqueByUrl([
    ...businesses,
    ...guides,
    ...news,
    ...discover,
    ...forum,
    ...events,
  ]);

  return {
    sources,
    contextBlocks,
    businessCandidates: businesses.slice(0, 15),
    counts: {
      businesses: businesses.length,
      news: news.length,
      guides: guides.length,
      forum: forum.length,
      discover: discover.length,
      events: events.length,
      cuisineHardFilterApplied: cuisineHardFilterApplied ? 1 : 0,
    },
  };
}
