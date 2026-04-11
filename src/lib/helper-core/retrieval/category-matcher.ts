/**
 * CategoryMatcher — shared utility for matching keywords against category search_terms.
 *
 * Implements the 3-strategy category matching from the NY assistant:
 * 1. Name match: keyword ↔ category name (always expand)
 * 2. Terms match: keyword ↔ search_terms (expand only if category ≤ MAX_SIZE)
 * 3. Parent → children expansion
 *
 * Used by site-level fetchers to leverage the categories table's search_terms column.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export interface CategoryMatch {
  categoryId: string;
  matchType: 'name' | 'terms' | 'anchor';
  slug: string;
}

export interface CategoryMatchResult {
  /** Business IDs matched via category expansion */
  businessIds: Set<string>;
  /** Business IDs specifically from category matches (for ranking boost) */
  categoryBizIds: Set<string>;
  /** Which categories matched and how */
  matches: CategoryMatch[];
}

/**
 * Match keywords against categories using name + search_terms bidirectional matching.
 * Then expand to business IDs via business_categories junction table.
 *
 * @param supabase - Supabase admin client
 * @param keywords - Extracted search keywords
 * @param options.categoryType - Category type filter (default: 'business')
 * @param options.siteScope - Site scope filter (e.g., 'zh', 'en')
 * @param options.nameColumn - Column name for category name (default: 'name_zh')
 * @param options.maxTermsOnlySize - Max category size for terms-only matches (default: 50)
 * @param options.anchorMatcher - Optional function to check anchor profile match on a category
 */
export async function matchCategories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  keywords: string[],
  options: {
    categoryType?: string;
    siteScope?: string;
    nameColumn?: string;
    maxTermsOnlySize?: number;
    anchorMatcher?: (cat: AnyRow) => 'anchor' | false;
  } = {},
): Promise<CategoryMatchResult> {
  const {
    categoryType = 'business',
    siteScope,
    nameColumn = 'name_zh',
    maxTermsOnlySize = 50,
    anchorMatcher,
  } = options;

  // Step 1: Fetch all categories of this type
  let query = supabase
    .from('categories')
    .select('id, slug, parent_id, search_terms, ' + nameColumn)
    .eq('type', categoryType);

  if (siteScope) {
    query = query.eq('site_scope', siteScope);
  }

  const { data: allCategories } = await query;
  if (!allCategories || allCategories.length === 0) {
    return { businessIds: new Set(), categoryBizIds: new Set(), matches: [] };
  }

  // Step 2: Match keywords against category names + search_terms
  const matchedCats: { cat: AnyRow; matchType: 'name' | 'terms' | 'anchor' }[] = [];

  for (const cat of allCategories as AnyRow[]) {
    // Check anchor matcher first (e.g., cuisine profiles)
    if (anchorMatcher) {
      const anchorResult = anchorMatcher(cat);
      if (anchorResult === 'anchor') {
        matchedCats.push({ cat, matchType: 'anchor' });
        continue;
      }
    }

    const catName = String(cat[nameColumn] || '');
    const terms: string[] = Array.isArray(cat.search_terms) ? cat.search_terms.map(String) : [];

    for (const kw of keywords) {
      if (kw.length < 2) continue;

      // Bidirectional name match
      const nameMatch = catName && (catName.includes(kw) || kw.includes(catName));

      // Terms match: t.includes(kw) always OK; kw.includes(t) only if t >= 3 chars
      const termsMatch = terms.some((t) =>
        t.includes(kw) || (t.length >= 3 && kw.includes(t)),
      );

      if (nameMatch || termsMatch) {
        matchedCats.push({ cat, matchType: nameMatch ? 'name' : 'terms' });
        break;
      }
    }
  }

  if (matchedCats.length === 0) {
    return { businessIds: new Set(), categoryBizIds: new Set(), matches: [] };
  }

  // Step 3: Track category IDs by match type
  const catIdsByMatch = new Map<string, 'name' | 'terms' | 'anchor'>();
  for (const { cat, matchType } of matchedCats) {
    catIdsByMatch.set(String(cat.id), matchType);
  }

  // Step 4: Expand parent categories to include their children
  const parentMatches = matchedCats.filter((m) => !m.cat.parent_id);
  if (parentMatches.length > 0) {
    const { data: children } = await supabase
      .from('categories')
      .select('id, parent_id')
      .in('parent_id', parentMatches.map((m) => m.cat.id));

    for (const child of (children || []) as AnyRow[]) {
      const parentType = catIdsByMatch.get(String(child.parent_id));
      if (parentType) {
        catIdsByMatch.set(String(child.id), parentType);
      }
    }
  }

  // Step 5: Count businesses per category via junction table
  const { data: bizCatLinks } = await supabase
    .from('business_categories')
    .select('business_id, category_id')
    .in('category_id', [...catIdsByMatch.keys()])
    .limit(10000);

  const bizPerCat = new Map<string, string[]>();
  for (const link of (bizCatLinks || []) as AnyRow[]) {
    const catId = String(link.category_id);
    const bizId = String(link.business_id);
    if (!bizPerCat.has(catId)) bizPerCat.set(catId, []);
    bizPerCat.get(catId)!.push(bizId);
  }

  // Step 6: Decide which categories to expand
  const businessIds = new Set<string>();
  const categoryBizIds = new Set<string>();
  const matches: CategoryMatch[] = [];

  for (const [catId, matchType] of catIdsByMatch) {
    const bizList = bizPerCat.get(catId) || [];

    // Name/anchor match → always expand
    // Terms-only match → expand only if category is small enough
    if (matchType === 'anchor' || matchType === 'name' || bizList.length <= maxTermsOnlySize) {
      for (const bizId of bizList) {
        businessIds.add(bizId);
        categoryBizIds.add(bizId);
      }
    }

    // Find the matched category info for reporting
    const matchedCat = matchedCats.find((m) => String(m.cat.id) === catId);
    if (matchedCat) {
      matches.push({
        categoryId: catId,
        matchType,
        slug: String(matchedCat.cat.slug || ''),
      });
    }
  }

  return { businessIds, categoryBizIds, matches };
}
