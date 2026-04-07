'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface BusinessSearchInputProps {
  selectedBusinesses: AnyRow[];
  onChange: (businesses: AnyRow[]) => void;
  maxBusinesses?: number;
}

export function BusinessSearchInput({ selectedBusinesses, onChange, maxBusinesses = 5 }: BusinessSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnyRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/discover/search-businesses?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const businesses = data.businesses || [];
      // Filter out already selected
      const selectedIds = new Set(selectedBusinesses.map(b => b.id));
      setResults(businesses.filter((b: AnyRow) => !selectedIds.has(b.id)));
      setShowResults(true);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, [selectedBusinesses]);

  const handleInput = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(value), 300);
  };

  const addBusiness = (biz: AnyRow) => {
    if (selectedBusinesses.length >= maxBusinesses) return;
    onChange([...selectedBusinesses, biz]);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const removeBusiness = (id: string) => {
    onChange(selectedBusinesses.filter(b => b.id !== id));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <label className="text-sm font-semibold text-gray-900 mb-1 block">Link a Business</label>
      <p className="text-xs text-gray-400 mb-3">Link businesses mentioned in your post so readers can find them easily</p>

      {/* Search Input */}
      <div className="relative mb-4" ref={wrapperRef}>
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowResults(true); }}
          placeholder="Search business name..."
          className="w-full h-10 pl-10 pr-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
        />

        {/* Search Results Dropdown */}
        {showResults && (results.length > 0 || searching) && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white z-20">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs text-gray-400">
                {searching ? 'Searching...' : `${results.length} results`}
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
              {results.map((biz) => (
                <button
                  key={biz.id}
                  type="button"
                  onClick={() => addBusiness(biz)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-sm flex-shrink-0">
                    {(biz.display_name_zh || biz.display_name)?.[0] || '🏪'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 block truncate">
                      {biz.display_name_zh || biz.display_name}
                    </span>
                    {biz.address_full && (
                      <p className="text-xs text-gray-400 truncate">{biz.address_full}</p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Linked Businesses */}
      {selectedBusinesses.length > 0 && (
        <div className="space-y-2">
          {selectedBusinesses.map((biz) => (
            <div
              key={biz.id}
              className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-orange-50 hover:border-orange-200 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-lg flex-shrink-0">
                {(biz.display_name_zh || biz.display_name)?.[0] || '🏪'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-900">
                  {biz.display_name_zh || biz.display_name}
                </span>
                {biz.address_full && (
                  <p className="text-xs text-gray-400">{biz.address_full}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeBusiness(biz.id)}
                className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
