'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Restaurant {
  camis: string;
  dba: string;
  dba_zh?: string;
  boro: string;
  building: string;
  street: string;
  zipcode: string;
  phone: string;
  cuisine: string;
  grade: string;
  score: number;
  inspection_date: string;
}

const GRADE_STYLES: Record<string, { bg: string; label: string }> = {
  'A': { bg: 'bg-green-500', label: 'Excellent' },
  'B': { bg: 'bg-yellow-500', label: 'Good' },
  'C': { bg: 'bg-orange-500', label: 'Needs Improvement' },
  'Z': { bg: 'bg-red-500', label: 'Pending' },
  'P': { bg: 'bg-gray-400', label: 'Pending' },
  'N': { bg: 'bg-gray-300', label: 'Not Rated' },
};

const BOROUGHS = ['', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const BORO_LABELS: Record<string, string> = {
  '': 'All Boroughs', 'Manhattan': 'Manhattan', 'Brooklyn': 'Brooklyn',
  'Queens': 'Queens', 'Bronx': 'Bronx', 'Staten Island': 'Staten Island',
};

const HISTORY_KEY = 'baam-restaurant-search-history';
const MAX_HISTORY = 8;

function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function addToHistory(q: string) {
  const history = getSearchHistory().filter(h => h !== q);
  history.unshift(q);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function formatDate(iso: string): string {
  if (!iso) return '';
  return iso.split('T')[0] || iso;
}

function formatPhone(phone: string): string {
  if (!phone || phone.length !== 10) return phone;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

export function InspectionsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Restore state from URL params (preserves state on back navigation)
  const initialQ = searchParams.get('q') || '';
  const initialBoro = searchParams.get('boro') || '';

  const [query, setQuery] = useState(initialQ);
  const [boro, setBoro] = useState(initialBoro);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Restaurant[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search history on mount
  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  // Auto-search if URL has query params (back navigation)
  useEffect(() => {
    if (initialQ) {
      doSearch(initialQ, initialBoro);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = useCallback(async (q: string, b: string) => {
    if (!q.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (b) params.set('boro', b);
      const res = await fetch(`/api/services/restaurant-inspections?${params}`);
      if (res.status === 429) { setError('Too many requests. Please try again later.'); return; }
      if (!res.ok) { setError('Search failed. Please try again later.'); return; }
      const data = await res.json();
      setResults(data.restaurants || []);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    // Save to URL (so back button preserves state)
    const params = new URLSearchParams();
    params.set('q', q);
    if (boro) params.set('boro', boro);
    router.replace(`?${params.toString()}`, { scroll: false });

    // Save to search history
    addToHistory(q);
    setHistory(getSearchHistory());
    setShowHistory(false);

    await doSearch(q, boro);
  }, [query, boro, router, doSearch]);

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    setShowHistory(false);
    // Trigger search immediately
    const params = new URLSearchParams({ q });
    if (boro) params.set('boro', boro);
    router.replace(`?${params.toString()}`, { scroll: false });
    doSearch(q, boro);
  };

  return (
    <div>
      {/* Search Form */}
      <div className="bg-green-50/50 border border-green-100 rounded-2xl p-5 sm:p-6 mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Search Restaurant Health Grades</h2>
        <form onSubmit={handleSearch}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (history.length > 0 && !query) setShowHistory(true); }}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder="Search restaurant name"
              className="w-full h-11 px-4 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
              required
            />

            {/* Search History Dropdown */}
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Recent Searches</div>
                {history.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => handleHistoryClick(h)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <select
              value={boro}
              onChange={(e) => setBoro(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary outline-none sm:w-44"
            >
              {BOROUGHS.map((b) => (
                <option key={b} value={b}>{BORO_LABELS[b]}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="h-10 px-6 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Searching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Search
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Results</h2>
            <span className="text-sm text-gray-400">{`${results.length} ${results.length === 1 ? 'restaurant' : 'restaurants'} found`}</span>
          </div>

          {results.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🍽️</div>
              <h3 className="text-base font-bold text-gray-700 mb-1">No Restaurants Found</h3>
              <p className="text-sm text-gray-500">Try different keywords or check the spelling.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r) => {
                const style = GRADE_STYLES[r.grade] || GRADE_STYLES['N'];
                const address = [r.building, r.street, r.boro, 'NY', r.zipcode].filter(Boolean).join(', ');
                return (
                  <a
                    key={r.camis}
                    href={`/zh/services/restaurant-inspections/${r.camis}`}
                    className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition group"
                  >
                    {/* Grade Badge */}
                    <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0', style.bg)}>
                      {r.grade || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary transition truncate">
                          {r.dba_zh ? `${r.dba_zh}` : r.dba}
                        </h3>
                        <span className="text-xs text-gray-400 flex-shrink-0">Score: {r.score}</span>
                      </div>
                      {r.dba_zh && (
                        <p className="text-xs text-gray-400 truncate mb-0.5">{r.dba}</p>
                      )}
                      <p className="text-xs text-gray-500 truncate mb-1">{address}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {r.cuisine && <span>{r.cuisine}</span>}
                        {r.phone && <span>{formatPhone(r.phone)}</span>}
                        {r.inspection_date && <span>{formatDate(r.inspection_date)}</span>}
                      </div>
                    </div>

                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
