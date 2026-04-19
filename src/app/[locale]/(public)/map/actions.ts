'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';
import { findCategoryId, detectTownRegionId, expandKeywordsFromSearchTerms } from '@/lib/helper/data';
import type { MapBusiness } from '@/components/map/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const GENERIC_WORDS = new Set(['best','good','top','recommend','find','near','nearby','place','places','local','what','where','how','the','are','any','in','can','get','does','there','some','like','want','looking','need','restaurants','shops','stores','about','from','anyone','people','this','that','with','for']);

const TOWN_NAMES = new Set(['middletown','goshen','newburgh','monroe','warwick','chester','cornwall','wallkill','port jervis','pine bush']);

function extractKeywords(search: string): string[] {
  return search.toLowerCase().replace(/[?.!,'"]/g, '').split(/\s+/).filter(w => w.length > 2 && !GENERIC_WORDS.has(w));
}

function detectTown(search: string): string | null {
  const lower = search.toLowerCase();
  for (const town of TOWN_NAMES) {
    if (lower.includes(town)) return town;
  }
  return null;
}

function titleCase(s: string): string {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export interface MapSearchResult {
  businesses: MapBusiness[];
  matchedCategory: string | null;
}

export async function fetchMapBusinesses(opts?: {
  categorySlug?: string;
  search?: string;
  limit?: number;
}): Promise<MapSearchResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const site = await getCurrentSite();

  const fields = 'id, slug, display_name, short_desc_en, avg_rating, review_count, phone, website_url, address_full, latitude, longitude, ai_tags, total_score, is_featured';

  let query = supabase
    .from('businesses')
    .select(fields)
    .eq('is_active', true)
    .eq('site_id', site.id)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('total_score', { ascending: false, nullsFirst: false });

  let filteredByCategory = false;
  let matchedCategory: string | null = null;

  // Detect town from search (used in both category and text search paths)
  const town = opts?.search ? detectTown(opts.search) : null;
  const townRegionId = town ? detectTownRegionId(opts?.search || '') : null;

  // Category filter (from pill buttons)
  if (opts?.categorySlug) {
    let bizIds = await getCategoryBusinessIds(supabase, opts.categorySlug);
    // Apply town filter to category pill results too
    if (town && bizIds.length > 0) {
      bizIds = await filterByTown(supabase, site.id, bizIds, town, townRegionId);
    }
    if (bizIds.length > 0) {
      query = query.in('id', bizIds.slice(0, 200));
      filteredByCategory = true;
    } else {
      return { businesses: [], matchedCategory: null };
    }
  }

  // Search: use Helper's smart category + keyword expansion + town matching
  if (opts?.search && !filteredByCategory) {
    // Extract keywords (strip town names)
    const rawKeywords = extractKeywords(opts.search).filter(kw => !TOWN_NAMES.has(kw));

    if (rawKeywords.length > 0) {
      // 1. Try category matching (same algorithm as Helper)
      const category = await findCategoryId(supabase, site.id, rawKeywords, opts.search);

      if (category) {
        let bizIds = await getCategoryBusinessIdsById(supabase, category.id);

        // Apply town filter via region_id (reliable) with address_full fallback
        if (town && bizIds.length > 0) {
          const filtered = await filterByTown(supabase, site.id, bizIds, town, townRegionId);
          if (filtered.length > 0) {
            bizIds = filtered;
            matchedCategory = `${category.name} in ${titleCase(town)}`;
          }
        }

        if (bizIds.length > 0) {
          query = query.in('id', bizIds.slice(0, 200));
          filteredByCategory = true;
          if (!matchedCategory) matchedCategory = category.name;
        }
      }

      // 2. If no category match, try expanded keyword text search
      if (!filteredByCategory) {
        const expanded = await expandKeywordsFromSearchTerms(supabase, rawKeywords);
        const orClauses = expanded.map(kw =>
          `display_name.ilike.%${kw}%,short_desc_en.ilike.%${kw}%`
        ).join(',');
        query = query.or(orClauses);

        // Apply town filter for text search results
        if (town) {
          query = query.ilike('address_full', `%${titleCase(town)}%`);
          matchedCategory = `"${rawKeywords.join(' ')}" in ${titleCase(town)}`;
        }
      }
    } else if (town) {
      // Only a town name with no other keywords — show all businesses in that town
      query = query.ilike('address_full', `%${titleCase(town)}%`);
      matchedCategory = `in ${titleCase(town)}`;
    }
  }

  const limit = opts?.limit || 50;
  const { data } = await query.limit(limit);

  const businesses = ((data || []) as AnyRow[]).map((b) => ({
    id: b.id,
    slug: b.slug,
    display_name: b.display_name || '',
    short_desc_en: b.short_desc_en || '',
    avg_rating: b.avg_rating,
    review_count: b.review_count,
    phone: b.phone,
    website_url: b.website_url || null,
    address_full: b.address_full,
    latitude: Number(b.latitude),
    longitude: Number(b.longitude),
    ai_tags: b.ai_tags || [],
    total_score: b.total_score || 0,
    is_featured: !!b.is_featured,
  }));

  return { businesses, matchedCategory };
}

// ─── Helpers ──────────────────────────────────────────

/** Filter business IDs by town — uses region_id (reliable) with address_full fallback */
async function filterByTown(supabase: AnyRow, siteId: string, bizIds: string[], town: string, regionId: string | null): Promise<string[]> {
  // Try region_id first (most reliable — uses business_locations table)
  if (regionId) {
    const { data: townLocs } = await supabase
      .from('business_locations')
      .select('business_id')
      .eq('region_id', regionId)
      .limit(5000);
    const townBizIdSet = new Set((townLocs || []).map((l: AnyRow) => String(l.business_id)));
    const filtered = bizIds.filter(id => townBizIdSet.has(id));
    if (filtered.length > 0) return filtered;
  }

  // Fallback: address_full text match
  const townName = titleCase(town);
  const CHUNK = 200;
  const matched: string[] = [];
  for (let i = 0; i < bizIds.length; i += CHUNK) {
    const { data } = await supabase.from('businesses')
      .select('id').eq('is_active', true).eq('site_id', siteId)
      .in('id', bizIds.slice(i, i + CHUNK))
      .ilike('address_full', `%${townName}%`);
    if (data) matched.push(...data.map((b: AnyRow) => String(b.id)));
  }
  return matched;
}

async function getCategoryBusinessIds(supabase: AnyRow, categorySlug: string): Promise<string[]> {
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .eq('type', 'business')
    .eq('site_scope', 'en')
    .single();

  if (!cat) return [];
  return getCategoryBusinessIdsById(supabase, cat.id);
}

async function getCategoryBusinessIdsById(supabase: AnyRow, categoryId: string): Promise<string[]> {
  // Get child categories too
  const { data: children } = await supabase
    .from('categories')
    .select('id')
    .eq('parent_id', categoryId);
  const catIds = [categoryId, ...(children || []).map((c: AnyRow) => c.id)];

  const { data: bizLinks } = await supabase
    .from('business_categories')
    .select('business_id')
    .in('category_id', catIds)
    .limit(500);

  const ids = (bizLinks || []).map((l: AnyRow) => String(l.business_id));
  return Array.from(new Set(ids));
}
