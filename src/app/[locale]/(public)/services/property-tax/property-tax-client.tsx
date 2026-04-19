'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PropertyResult {
  bbl: string;
  address: string;
  boro: string;
  owner: string;
  taxClass: string;
  buildingClass: string;
  stories: string;
  assessedTotal: number;
  marketValue: number;
  estimatedTax: number;
  year: string;
  county?: string;
  municipality?: string;
}

const REGIONS = [
  { group: 'NYC', options: [
    { value: 'queens', label: 'Queens' },
    { value: 'brooklyn', label: 'Brooklyn' },
    { value: 'manhattan', label: 'Manhattan' },
    { value: 'bronx', label: 'Bronx' },
    { value: 'staten island', label: 'Staten Island' },
  ]},
  { group: 'Long Island', options: [
    { value: 'Nassau', label: 'Nassau County' },
    { value: 'Suffolk', label: 'Suffolk County' },
  ]},
  { group: 'NYC Suburbs', options: [
    { value: 'Westchester', label: 'Westchester County' },
    { value: 'Rockland', label: 'Rockland County' },
    { value: 'Orange', label: 'Orange County' },
    { value: 'Dutchess', label: 'Dutchess County' },
    { value: 'Putnam', label: 'Putnam County' },
  ]},
  { group: 'Other NYS', options: [
    { value: 'Albany', label: 'Albany County' },
    { value: 'Erie', label: 'Erie County (Buffalo)' },
    { value: 'Monroe', label: 'Monroe County (Rochester)' },
    { value: 'Onondaga', label: 'Onondaga County (Syracuse)' },
    { value: 'Tompkins', label: 'Tompkins County (Ithaca)' },
    { value: 'Saratoga', label: 'Saratoga County' },
  ]},
];

const TAX_CLASS_LABELS: Record<string, string> = {
  '1': '1-3 Family Home', '2': 'Apartment Building', '2A': 'Small Apartment', '2B': 'Medium Apartment', '2C': 'Large Apartment',
  '3': 'Utility', '4': 'Commercial',
};

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString('en-US');
}

const HISTORY_KEY = 'baam-property-search-history';
const MAX_HISTORY = 8;

function getHistory(): { address: string; region: string }[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function addToHistory(address: string, region: string) {
  const h = getHistory().filter(i => !(i.address === address && i.region === region));
  h.unshift({ address, region });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
}

export function PropertyTaxClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialAddr = searchParams.get('address') || '';
  const initialRegion = searchParams.get('region') || searchParams.get('boro') || 'queens';

  const [address, setAddress] = useState(initialAddr);
  const [region, setRegion] = useState(initialRegion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<PropertyResult[] | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ address: string; region: string }[]>([]);

  useEffect(() => { setHistory(getHistory()); }, []);
  useEffect(() => { if (initialAddr) doSearch(initialAddr, initialRegion); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(async (addr: string, b: string) => {
    if (!addr.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    setSuggestion('');
    try {
      // Always send region when selected — even if address has city/state/zip,
      // the region helps route to the correct NYS county-based search
      const params = new URLSearchParams({ address: addr.trim() });
      if (b) params.set('region', b);
      const res = await fetch(`/api/services/property-tax?${params}`);
      if (res.status === 429) { setError('Too many requests. Please try again later.'); return; }
      if (!res.ok) { setError('Search failed. Please try again later.'); return; }
      const data = await res.json();
      setResults(data.properties || []);
      if (data.suggestion) setSuggestion(data.suggestion);
    } catch { setError('Network error. Please check your connection.'); }
    finally { setLoading(false); }
  }, []);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    const params = new URLSearchParams({ address: address.trim(), region });
    router.replace(`?${params.toString()}`, { scroll: false });
    addToHistory(address.trim(), region);
    setHistory(getHistory());
    setShowHistory(false);
    await doSearch(address.trim(), region);
  }, [address, region, router, doSearch]);

  const handleHistoryClick = (addr: string, r: string) => {
    setAddress(addr);
    setRegion(r);
    setShowHistory(false);
    router.replace(`?address=${encodeURIComponent(addr)}&region=${r}`, { scroll: false });
    doSearch(addr, r);
  };

  return (
    <div>
      {/* Search Form */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 sm:p-6 mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Property Tax Lookup</h2>
        <p className="text-xs text-gray-500 mb-4">Enter a property address to view assessment, taxes, and sales history. For areas outside NYC, add the city name for more accurate results (e.g., &ldquo;23 Main St, Middletown&rdquo;).</p>
        <form onSubmit={handleSearch}>
          <div className="relative">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onFocus={() => { if (history.length > 0 && !address) setShowHistory(true); }}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder="Enter address (e.g., 36-40 Main Street or 23 Rivervale Rd, Middletown)"
              className="w-full h-11 px-4 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
              required
            />
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Recent Searches</div>
                {history.map((h, i) => (
                  <button key={i} type="button" onMouseDown={() => handleHistoryClick(h.address, h.region)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {h.address} · {h.region}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary outline-none sm:w-64">
              {REGIONS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="submit" disabled={loading || !address.trim()}
              className="h-10 px-6 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Searching...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>Search</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{error}</div>}

      {/* Results */}
      {results !== null && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Results</h2>
            <span className="text-sm text-gray-400">{`${results.length} ${results.length === 1 ? 'property' : 'properties'} found`}</span>
          </div>

          {results.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🏠</div>
              <h3 className="text-base font-bold text-gray-700 mb-1">No Properties Found</h3>
              {suggestion ? (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-2">Did you mean:</p>
                  <button type="button" onClick={() => { setAddress(suggestion); doSearch(suggestion, region); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition font-medium text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {suggestion}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-2">Please check the address spelling and make sure to use the full street address (e.g., 123 Main Street).</p>
                  <p className="text-xs text-gray-400">Tip: Some properties may be registered under a different address format (e.g., combined address &ldquo;86-92&rdquo;) or under a different town name. Try entering just the street number without the city, or search a nearby address.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r, i) => {
                // All results link to detail page
                const qp = new URLSearchParams();
                if (r.county) qp.set('county', r.county);
                if (r.municipality) qp.set('municipality', r.municipality);
                const detailParams = qp.toString() ? `?${qp}` : '';
                const detailHref = r.bbl
                  ? `/en/services/property-tax/${encodeURIComponent(r.bbl)}${detailParams}`
                  : undefined;
                const Wrapper = detailHref ? 'a' : 'div';
                const wrapperProps = detailHref ? { href: detailHref } : {};
                return (
                  <Wrapper key={r.bbl || i} {...wrapperProps}
                    className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition group">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary transition">{r.address}</h3>
                        <p className="text-xs text-gray-500">{r.boro} {r.owner ? `· Owner: ${r.owner}` : ''}</p>
                        {r.year && <p className="text-[10px] text-gray-400 mt-0.5">{r.year}</p>}
                      </div>
                      <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full max-w-[140px] text-right',
                        r.taxClass === '1' ? 'bg-green-100 text-green-700' :
                        r.taxClass === '4' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      )}>
                        {TAX_CLASS_LABELS[r.taxClass]
                          ? `Class ${r.taxClass} — ${TAX_CLASS_LABELS[r.taxClass]}`
                          : r.taxClass?.length > 20 ? r.taxClass.slice(0, 25) + '...' : r.taxClass
                        }
                      </span>
                    </div>
                    <div className={cn('grid gap-4 text-center', r.estimatedTax > 0 ? 'grid-cols-3' : 'grid-cols-2')}>
                      <div>
                        <div className="text-base font-bold text-gray-900">{formatMoney(r.assessedTotal)}</div>
                        <div className="text-[11px] text-gray-500">Assessed Value</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-blue-600">{formatMoney(r.marketValue)}</div>
                        <div className="text-[11px] text-gray-500">Market Value</div>
                      </div>
                      {r.estimatedTax > 0 && (
                        <div>
                          <div className="text-base font-bold text-primary">{formatMoney(r.estimatedTax)}/yr</div>
                          <div className="text-[11px] text-gray-500">Estimated Tax</div>
                        </div>
                      )}
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
