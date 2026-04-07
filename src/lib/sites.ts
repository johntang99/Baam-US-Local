import { createAdminClient } from '@/lib/supabase/admin';

// ─── Types ────────────────────────────────────────────────────────────

export interface SiteConfig {
  id: string;
  slug: string;
  name: string;
  nameZh: string;
  locale: string;
  domain: string;
  description: string;
  status: string;
  isDefault: boolean;
  regionIds: string[];
}

// ─── Static domain map (fast path, no DB query) ───────────────────────

const STATIC_DOMAIN_MAP: Record<string, string> = {
  // Production domains
  'baam-mt.com': 'mt-en',
  'www.baam-mt.com': 'mt-en',
  // Dev
  'localhost': 'mt-en',
};

// ─── Cache ────────────────────────────────────────────────────────────

let _sitesCache: { data: SiteConfig[]; expiresAt: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

// ─── Core Functions ───────────────────────────────────────────────────

function normalizeHost(host: string): string {
  return host.split(':')[0].toLowerCase().replace(/^www\./, '').trim();
}

/**
 * Get all sites from database.
 */
export async function getSites(): Promise<SiteConfig[]> {
  const now = Date.now();
  if (_sitesCache && _sitesCache.expiresAt > now) {
    return _sitesCache.data;
  }

  try {
    const supabase = createAdminClient();

    // Fetch sites with their region IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sites } = await (supabase as any)
      .from('sites')
      .select('*, site_regions(region_id)')
      .order('sort_order', { ascending: true });

    if (!sites || sites.length === 0) {
      return getDefaultSites();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: SiteConfig[] = sites.map((s: any) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      nameZh: s.name_zh || s.name,
      locale: s.locale,
      domain: s.domain,
      description: s.description || '',
      status: s.status,
      isDefault: s.is_default,
      regionIds: (s.site_regions || []).map((sr: { region_id: string }) => sr.region_id),
    }));

    _sitesCache = { data: result, expiresAt: now + CACHE_TTL };
    return result;
  } catch {
    return getDefaultSites();
  }
}

/**
 * Get a site by its slug.
 */
export async function getSiteBySlug(slug: string): Promise<SiteConfig | null> {
  const sites = await getSites();
  return sites.find(s => s.slug === slug) || null;
}

/**
 * Get a site by matching the incoming host/domain.
 */
export async function getSiteByHost(host: string | null): Promise<SiteConfig | null> {
  if (!host) return getDefaultSite();

  const hostname = normalizeHost(host);

  // Fast path: static map
  const staticSlug = STATIC_DOMAIN_MAP[hostname];
  if (staticSlug) {
    return getSiteBySlug(staticSlug);
  }

  // DB path: match against sites.domain
  const sites = await getSites();
  const match = sites.find(s => {
    if (!s.domain) return false;
    return normalizeHost(s.domain) === hostname;
  });

  if (match) return match;

  // Fallback: default site
  return getDefaultSite();
}

/**
 * Get the default site.
 */
export async function getDefaultSite(): Promise<SiteConfig | null> {
  const sites = await getSites();
  return sites.find(s => s.isDefault) || sites[0] || null;
}

/**
 * Get the current site from request headers.
 * Use in Server Components.
 */
export async function getCurrentSite(): Promise<SiteConfig> {
  const { headers } = await import('next/headers');
  const headerStore = await headers();

  // Check custom header set by middleware
  const siteSlug = headerStore.get('x-baam-site');
  if (siteSlug) {
    const site = await getSiteBySlug(siteSlug);
    if (site) return site;
  }

  // Fallback: resolve from host
  const host = headerStore.get('host');
  const site = await getSiteByHost(host);
  return site || (await getDefaultSite())!;
}

// ─── Fallback sites (when DB is unavailable) ──────────────────────────

function getDefaultSites(): SiteConfig[] {
  return [
    {
      id: 'default-mt-en',
      slug: 'mt-en',
      name: 'Baam Middletown',
      nameZh: 'Middletown英文站',
      locale: 'en',
      domain: 'baam-mt.com',
      description: 'Local portal for Middletown, NY and Orange County',
      status: 'active',
      isDefault: true,
      regionIds: [],
    },
  ];
}
