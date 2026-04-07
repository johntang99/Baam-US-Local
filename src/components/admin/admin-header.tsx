'use client';

import { usePathname } from 'next/navigation';
import { useAdminSite } from './AdminSiteContext';

const LOCALES = [
  { value: 'zh', label: 'Chinese' },
  { value: 'en', label: 'English' },
];

const pageTitles: Record<string, string> = {
  '/admin/articles/new': 'New Article',
  '/admin/articles': 'Content',
  '/admin/businesses/new': 'New Business',
  '/admin/businesses': 'Businesses',
  '/admin/forum': 'Forum',
  '/admin/voices': 'Voices',
  '/admin/events/new': 'New Event',
  '/admin/events': 'Events',
  '/admin/leads': 'Leads',
  '/admin/sites': 'Sites',
  '/admin/users': 'Users',
  '/admin/ai-jobs': 'AI Tasks',
  '/admin/sponsors': 'Ads',
  '/admin/settings': 'Settings',
  '/admin': 'Dashboard',
};

export function AdminHeader() {
  const pathname = usePathname();
  const { currentSite, sites, setSite, setLocale, loading } = useAdminSite();

  // Find best matching page title (longest prefix match)
  const pageTitle = Object.entries(pageTitles)
    .filter(([path]) => pathname.startsWith(path))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] || 'Admin';

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-xs text-gray-400">Admin / {pageTitle}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Site selector — from context, persists in localStorage */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 hidden sm:inline">Site</label>
            <select
              value={currentSite.slug}
              onChange={(e) => setSite(e.target.value)}
              disabled={loading}
              className="h-9 px-3 pr-8 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none cursor-pointer"
            >
              {sites.map(site => (
                <option key={site.slug} value={site.slug}>{site.name}</option>
              ))}
            </select>
          </div>

          {/* Locale selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 hidden sm:inline">Language</label>
            <select
              value={currentSite.locale}
              onChange={(e) => setLocale(e.target.value)}
              className="h-9 px-3 pr-8 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none cursor-pointer"
            >
              {LOCALES.map(loc => (
                <option key={loc.value} value={loc.value}>{loc.label}</option>
              ))}
            </select>
          </div>

          {/* Notification bell */}
          <button className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Visit site link */}
          <a href={`/${currentSite.locale}`} target="_blank" className="hidden sm:flex items-center gap-1 text-xs text-gray-500 hover:text-primary px-2 py-1 rounded hover:bg-gray-100">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            View Site
          </a>
        </div>
      </div>
    </div>
  );
}
