'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getStoredSite, setStoredSite } from '@/lib/admin-site-store';

// Also set a cookie so server components can read the selection
function setCookie(site: { siteSlug: string; locale: string }) {
  if (typeof document === 'undefined') return;
  document.cookie = `baam-admin-site=${JSON.stringify(site)};path=/admin;max-age=31536000;SameSite=Lax`;
}
import { createClient } from '@/lib/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface SiteInfo {
  slug: string;
  name: string;
  locale: string;
}

interface AdminSiteContextType {
  currentSite: SiteInfo;
  sites: SiteInfo[];
  setSite: (slug: string) => void;
  setLocale: (locale: string) => void;
  loading: boolean;
}

const AdminSiteCtx = createContext<AdminSiteContextType>({
  currentSite: { slug: 'ny-zh', name: 'New York Chinese', locale: 'zh' },
  sites: [],
  setSite: () => {},
  setLocale: () => {},
  loading: true,
});

export function AdminSiteProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [currentSite, setCurrentSite] = useState<SiteInfo>({
    slug: 'ny-zh', name: 'New York Chinese', locale: 'zh',
  });
  const [loading, setLoading] = useState(true);

  // Load sites from DB + restore selection from localStorage
  useEffect(() => {
    const supabase = createClient();
    supabase.from('sites').select('slug, name, name_zh, locale, status').order('sort_order').then(({ data }) => {
      const siteList: SiteInfo[] = ((data || []) as AnyRow[]).map(s => ({
        slug: s.slug,
        name: s.name,
        locale: s.locale,
      }));

      // Fallback if no sites in DB
      if (siteList.length === 0) {
        siteList.push(
          { slug: 'ny-zh', name: 'New York Chinese', locale: 'zh' },
          { slug: 'oc-en', name: 'Middletown OC English', locale: 'en' },
        );
      }

      setSites(siteList);

      // Restore from localStorage
      const stored = getStoredSite();
      const match = siteList.find(s => s.slug === stored.siteSlug);
      if (match) {
        setCurrentSite({ ...match, locale: stored.locale || match.locale });
        setCookie({ siteSlug: match.slug, locale: stored.locale || match.locale });
      } else {
        setCurrentSite(siteList[0]);
        setStoredSite({ siteSlug: siteList[0].slug, locale: siteList[0].locale });
        setCookie({ siteSlug: siteList[0].slug, locale: siteList[0].locale });
      }

      setLoading(false);
    });
  }, []);

  const setSite = useCallback((slug: string) => {
    const match = sites.find(s => s.slug === slug);
    if (match) {
      const newSite = { ...match };
      setCurrentSite(newSite);
      setStoredSite({ siteSlug: newSite.slug, locale: newSite.locale });
      setCookie({ siteSlug: newSite.slug, locale: newSite.locale });
    }
  }, [sites]);

  const setLocale = useCallback((locale: string) => {
    setCurrentSite(prev => {
      const updated = { ...prev, locale };
      setStoredSite({ siteSlug: updated.slug, locale });
      setCookie({ siteSlug: updated.slug, locale });
      return updated;
    });
  }, []);

  return (
    <AdminSiteCtx.Provider value={{ currentSite, sites, setSite, setLocale, loading }}>
      {children}
    </AdminSiteCtx.Provider>
  );
}

export function useAdminSite() {
  return useContext(AdminSiteCtx);
}
