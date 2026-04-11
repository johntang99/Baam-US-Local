'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';
import { findCategoryId, detectTownRegionId } from '@/lib/helper/data';
import type { MapBusiness } from '@/components/map/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

// Town names are NOT generic for map — we need them for location filtering
const GENERIC_WORDS = new Set(['best','good','top','recommend','find','near','nearby','place','places','local','what','where','how','the','are','any','in','can','get','does','there','some','like','want','looking','need','restaurants','shops','stores','about','from','anyone','people','this','that','with','for']);

// Town names → region IDs for location filtering
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

export interface MapSearchResult {
  businesses: MapBusiness[];
  matchedCategory: string | null; // category name that was matched from search
}

export async function fetchMapBusinesses(opts?: {
  categorySlug?: string;
  search?: string;
  limit?: number;
}): Promise<MapSearchResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const site = await getCurrentSite();

  const fields = 'id, slug, display_name, short_desc_en, avg_rating, review_count, phone, address_full, latitude, longitude, ai_tags, total_score, is_featured';

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

  // Category filter (from pill buttons)
  if (opts?.categorySlug) {
    const bizIds = await getCategoryBusinessIds(supabase, opts.categorySlug);
    if (bizIds.length > 0) {
      query = query.in('id', bizIds.slice(0, 100));
      filteredByCategory = true;
    } else {
      return { businesses: [], matchedCategory: null };
    }
  }

  // Search: use Helper's smart category + town matching
  if (opts?.search && !filteredByCategory) {
    // Detect town name for location filtering
    const town = detectTown(opts.search);
    const townRegionId = town ? detectTownRegionId(opts.search) : null;

    // Extract keywords (strip town names so they don't confuse category matching)
    const allKeywords = extractKeywords(opts.search);
    const keywords = allKeywords.filter(kw => !TOWN_NAMES.has(kw));

    if (keywords.length > 0) {
      // Try category matching first (same algorithm as Helper)
      const category = await findCategoryId(supabase, site.id, keywords, opts.search);

      if (category) {
        // Found a category match — filter by category
        let bizIds = await getCategoryBusinessIdsById(supabase, category.id);

        // If town is specified, pre-filter IDs by town address BEFORE slicing
        // This prevents the 100-ID slice from missing town-specific results
        if (town && bizIds.length > 100) {
          const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
          const { data: townBiz } = await supabase.from('businesses')
            .select('id').eq('is_active', true).eq('site_id', site.id)
            .in('id', bizIds.slice(0, 500))
            .ilike('address_full', `%${capitalize(town)}%`);
          if (townBiz && townBiz.length > 0) {
            bizIds = townBiz.map((b: AnyRow) => String(b.id));
            matchedCategory = `${category.name} in ${capitalize(town)}`;
          }
        }

        if (bizIds.length > 0) {
          query = query.in('id', bizIds.slice(0, 100));
          filteredByCategory = true;
          if (!matchedCategory) matchedCategory = category.name;
        }
      }

      // If no category match, try text search on name + description
      if (!filteredByCategory) {
        const orClauses = keywords.map(kw =>
          `display_name.ilike.%${kw}%,short_desc_en.ilike.%${kw}%`
        ).join(',');
        query = query.or(orClauses);
      }
    }

    // Apply town filter for non-category searches (text search fallback)
    if (town && !filteredByCategory) {
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      query = query.ilike('address_full', `%${capitalize(town)}%`);
      matchedCategory = matchedCategory ? `${matchedCategory} in ${capitalize(town)}` : `in ${capitalize(town)}`;
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

async function getCategoryBusinessIdsById(supabase: AnyRow, categoryId: string): Promise<string[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
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
