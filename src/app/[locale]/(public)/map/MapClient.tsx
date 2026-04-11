'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { MapBusiness } from '@/components/map/types';
import BusinessCard from '@/components/map/BusinessCard';
import { fetchMapBusinesses, type MapSearchResult } from './actions';

// Leaflet must be loaded client-side only
const BaamMap = dynamic(() => import('@/components/map/BaamMap'), { ssr: false });

const CATEGORIES = [
  { slug: '', label: 'All', icon: '📍' },
  { slug: 'food-dining', label: 'Food', icon: '🍕' },
  { slug: 'medical-health', label: 'Medical', icon: '🏥' },
  { slug: 'legal', label: 'Legal', icon: '⚖️' },
  { slug: 'home-renovation', label: 'Home', icon: '🔧' },
  { slug: 'auto', label: 'Auto', icon: '🚗' },
  { slug: 'beauty-wellness', label: 'Beauty', icon: '💈' },
  { slug: 'shopping-retail', label: 'Shopping', icon: '🛍️' },
  { slug: 'education', label: 'Education', icon: '🎓' },
  { slug: 'finance-tax', label: 'Finance', icon: '💰' },
];

const SORT_OPTIONS = [
  { value: 'score', label: 'Best Match' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'reviews', label: 'Most Reviews' },
  { value: 'distance', label: 'Nearest' },
];

interface MapClientProps {
  initialBusinesses: MapBusiness[];
  initialCategory?: string;
}

export default function MapClient({ initialBusinesses, initialCategory = '' }: MapClientProps) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchLabel, setSearchLabel] = useState<string | null>(null); // matched category name from search
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('score');
  const [loading, setLoading] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>(undefined);

  // Fetch businesses when filters change
  const loadBusinesses = useCallback(async (category: string, searchTerm: string) => {
    setLoading(true);
    try {
      const result = await fetchMapBusinesses({
        categorySlug: category || undefined,
        search: searchTerm || undefined,
        limit: 50,
      });
      setBusinesses(result.businesses);
      setSearchLabel(result.matchedCategory);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug);
    setSearch(''); // clear search when switching categories
    setSearchLabel(null);
    void loadBusinesses(slug, '');
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      void loadBusinesses(activeCategory, value);
    }, 400);
  };

  const handleSelectBusiness = useCallback((biz: MapBusiness | null) => {
    setSelectedId(biz?.id || null);
  }, []);

  // Haversine distance in miles
  const getDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Near Me handler — try high accuracy first, fall back to low accuracy
  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation) { alert('Geolocation is not supported by your browser'); return; }
    setLocatingUser(true);

    const onSuccess = (pos: GeolocationPosition) => {
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setSort('distance');
      setLocatingUser(false);
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === 1) {
        alert('Location access denied. Please enable location in your browser settings.');
        setLocatingUser(false);
      } else {
        // High accuracy failed (timeout/unavailable) — retry with low accuracy
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => {
            alert('Could not get your location. Please try again.');
            setLocatingUser(false);
          },
          { enableHighAccuracy: false, timeout: 30000, maximumAge: 300000 },
        );
      }
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  }, []);

  // Sort businesses — with distance option
  const sorted = [...businesses].map(b => ({
    ...b,
    _distance: userLocation ? getDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude) : null,
  })).sort((a, b) => {
    if (sort === 'distance' && a._distance !== null && b._distance !== null) return a._distance - b._distance;
    if (sort === 'rating') return (b.avg_rating || 0) - (a.avg_rating || 0);
    if (sort === 'reviews') return (b.review_count || 0) - (a.review_count || 0);
    return (b.total_score || 0) - (a.total_score || 0);
  });

  // Scroll to selected card in sidebar
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  useEffect(() => {
    if (selectedId) {
      cardRefs.current.get(selectedId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-bg-card flex-shrink-0">
        {/* Search + Near Me grouped together */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative w-56">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search businesses or ask Helper..."
              className="w-full h-9 pl-9 pr-3 text-sm border border-border rounded-lg bg-bg-page focus:border-primary focus:outline-none"
            />
            {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted animate-pulse">Loading...</span>}
          </div>

          {/* Near Me button */}
          <button
            onClick={handleNearMe}
            disabled={locatingUser}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
              userLocation
                ? 'border-blue-500 bg-blue-50 text-blue-600'
                : 'border-border text-text-muted hover:text-text-secondary hover:border-primary'
            } disabled:opacity-50`}
          >
            {locatingUser ? '⏳ Locating...' : userLocation ? '📍 Near Me ✓' : '📍 Near Me'}
          </button>
        </div>

        {/* Category pills — scroll on mobile */}
        <div className="flex gap-1.5 overflow-x-auto flex-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleCategoryChange(cat.slug)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                activeCategory === cat.slug
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-text-muted hover:text-text-secondary hover:border-border'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main: sidebar + map */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar — hidden on mobile, shown on md+ */}
        <div className="hidden md:flex flex-col w-[340px] border-r border-border bg-bg-card flex-shrink-0">
          {/* Results header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-light">
            <div>
              <span className="text-sm font-bold">
                {searchLabel || CATEGORIES.find(c => c.slug === activeCategory)?.label || 'All'}
              </span>
              <span className="text-xs text-text-muted ml-2">{sorted.length} results</span>
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 text-text-secondary focus:outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Business list */}
          <div className="flex-1 overflow-y-auto">
            {sorted.map((biz, i) => (
              <div key={biz.id} ref={(el) => { if (el) cardRefs.current.set(biz.id, el); }}>
                <BusinessCard
                  business={biz}
                  rank={i + 1}
                  isActive={biz.id === selectedId}
                  onClick={() => setSelectedId(biz.id)}
                />
              </div>
            ))}
            {sorted.length === 0 && !loading && (
              <div className="p-8 text-center text-text-muted text-sm">No businesses found</div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1">
          <BaamMap
            businesses={sorted}
            selectedId={selectedId}
            onSelectBusiness={handleSelectBusiness}
            userLocation={userLocation}
            height="100%"
            className="rounded-none"
          />
        </div>

        {/* Mobile bottom sheet */}
        <div className={`md:hidden absolute bottom-0 left-0 right-0 bg-bg-card rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-[1000] transition-all duration-300 ${
          mobileExpanded ? 'h-[60%]' : 'h-auto'
        }`}>
          {/* Drag handle */}
          <button
            type="button"
            onClick={() => setMobileExpanded(!mobileExpanded)}
            className="w-full flex justify-center py-2"
          >
            <div className="w-9 h-1 bg-border rounded-full" />
          </button>

          {mobileExpanded ? (
            // Expanded: vertical list
            <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: 'calc(100% - 32px)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">{sorted.length} results</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-xs border border-border rounded-md px-2 py-1">
                  {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              {sorted.map((biz, i) => (
                <div key={biz.id} className="mb-2">
                  <BusinessCard business={biz} rank={i + 1} isActive={biz.id === selectedId} onClick={() => { setSelectedId(biz.id); setMobileExpanded(false); }} compact />
                </div>
              ))}
            </div>
          ) : (
            // Collapsed: horizontal scroll
            <div className="px-4 pb-4">
              <div className="flex gap-2.5 overflow-x-auto pb-1 -webkit-overflow-scrolling-touch no-scrollbar">
                {sorted.slice(0, 10).map((biz, i) => (
                  <BusinessCard key={biz.id} business={biz} rank={i + 1} isActive={biz.id === selectedId} onClick={() => setSelectedId(biz.id)} compact />
                ))}
              </div>
              <p className="text-[11px] text-text-muted text-center mt-2">
                Swipe for more · <button type="button" onClick={() => setMobileExpanded(true)} className="text-primary font-semibold">View all {sorted.length}</button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
