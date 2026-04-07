/**
 * Admin site context for SERVER components.
 *
 * Reads site selection from:
 * 1. URL searchParams (for backward compatibility)
 * 2. Cookie 'baam-admin-site' (set by client-side context)
 * 3. Default to first site in DB
 *
 * The client-side AdminSiteContext uses localStorage + sets a cookie
 * so server components can read the same selection.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export interface AdminSiteContext {
  siteId: string;
  siteSlug: string;
  siteName: string;
  locale: string;
  regionIds: string[];
}

export async function getAdminSiteContext(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<AdminSiteContext> {
  const supabase = createAdminClient();

  // Try to get site slug from: 1) URL params 2) cookie 3) default
  let siteSlug = '';

  // 1. URL params (backward compat)
  if (searchParams) {
    const param = typeof searchParams.region === 'string' ? searchParams.region : '';
    if (param) siteSlug = param;
  }

  // 2. Cookie (set by client AdminSiteContext)
  if (!siteSlug) {
    try {
      const cookieStore = await cookies();
      const cookieVal = cookieStore.get('baam-admin-site')?.value;
      if (cookieVal) {
        const parsed = JSON.parse(cookieVal);
        if (parsed.siteSlug) siteSlug = parsed.siteSlug;
      }
    } catch {}
  }

  // Find site in DB
  let site: AnyRow | null = null;
  if (siteSlug) {
    const { data } = await supabase.from('sites').select('*').eq('slug', siteSlug).single();
    site = data as AnyRow | null;
  }
  if (!site) {
    // Default to mt-en for the English platform
    const defaultSlug = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'mt-en';
    const { data } = await supabase.from('sites').select('*').eq('slug', defaultSlug).single();
    site = data as AnyRow | null;
  }
  if (!site) {
    const { data } = await supabase.from('sites').select('*').eq('is_default', true).single();
    site = data as AnyRow | null;
  }
  if (!site) {
    const { data } = await supabase.from('sites').select('*').order('created_at').limit(1).single();
    site = data as AnyRow | null;
  }

  if (!site) {
    return { siteId: '', siteSlug: 'mt-en', siteName: 'Baam Middletown', locale: 'en', regionIds: [] };
  }

  // Get region IDs for this site
  const { data: siteRegions } = await supabase
    .from('site_regions')
    .select('region_id')
    .eq('site_id', site.id);
  const regionIds = (siteRegions || []).map((sr: AnyRow) => sr.region_id);

  // Get locale from URL params or cookie or site default
  let locale = site.locale || 'zh';
  if (searchParams && typeof searchParams.locale === 'string') {
    locale = searchParams.locale;
  } else {
    try {
      const cookieStore = await cookies();
      const cookieVal = cookieStore.get('baam-admin-site')?.value;
      if (cookieVal) {
        const parsed = JSON.parse(cookieVal);
        if (parsed.locale) locale = parsed.locale;
      }
    } catch {}
  }

  return {
    siteId: site.id,
    siteSlug: site.slug,
    siteName: site.name,
    locale,
    regionIds,
  };
}
