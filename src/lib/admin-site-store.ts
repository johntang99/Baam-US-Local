'use client';

/**
 * Admin Site Store — persists selected site in localStorage
 *
 * This replaces URL params for site selection. The selected site
 * persists across ALL admin pages (site-scoped and system-scoped).
 * No more losing context when navigating to system pages.
 */

const STORAGE_KEY = 'baam-admin-site';

interface StoredSite {
  siteSlug: string;
  locale: string;
}

const DEFAULT_SITE: StoredSite = {
  siteSlug: 'ny-zh',
  locale: 'zh',
};

export function getStoredSite(): StoredSite {
  if (typeof window === 'undefined') return DEFAULT_SITE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_SITE;
}

export function setStoredSite(site: StoredSite): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(site));
  } catch {}
}
