import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { Pagination } from '@/components/shared/pagination';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 18; // 3 columns × 6 rows

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('events')} · Baam`,
    description: 'Local events, community gatherings, workshops and more in Middletown',
  };
}

const dateTabs = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All' },
];

interface Props {
  searchParams: Promise<{ page?: string; period?: string; price?: string }>;
}

export default async function EventsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const period = sp.period || 'all';
  const priceFilter = sp.price || '';

  const supabase = await createClient();
  const site = await getCurrentSite();
  const regionIds = site.regionIds;
  const t = await getTranslations();

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Build base query conditions
  let countQuery = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('site_id', site.id)
    .in('region_id', regionIds);

  if (period === 'week') {
    countQuery = countQuery.gte('start_at', now.toISOString()).lte('start_at', weekEnd.toISOString());
  } else if (period === 'month') {
    countQuery = countQuery.gte('start_at', now.toISOString()).lte('start_at', monthEnd.toISOString());
  }

  if (priceFilter === 'free') countQuery = countQuery.eq('is_free', true);
  if (priceFilter === 'paid') countQuery = countQuery.eq('is_free', false);

  const { count } = await countQuery;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const from = (currentPage - 1) * PAGE_SIZE;
  let dataQuery = supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .eq('site_id', site.id)
    .in('region_id', regionIds);

  if (period === 'week') {
    dataQuery = dataQuery.gte('start_at', now.toISOString()).lte('start_at', weekEnd.toISOString());
  } else if (period === 'month') {
    dataQuery = dataQuery.gte('start_at', now.toISOString()).lte('start_at', monthEnd.toISOString());
  }

  if (priceFilter === 'free') dataQuery = dataQuery.eq('is_free', true);
  if (priceFilter === 'paid') dataQuery = dataQuery.eq('is_free', false);

  const { data: rawEvents, error } = await dataQuery
    .order('start_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const events = (rawEvents || []) as AnyRow[];

  const preservedParams: Record<string, string> = {};
  if (period !== 'all') preservedParams.period = period;
  if (priceFilter) preservedParams.price = priceFilter;

  return (
    <main>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Local Events</h1>
          <p className="text-sm text-text-secondary mt-2">
            Community gatherings, workshops and more in Middletown
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {dateTabs.map((tab) => {
              const params = new URLSearchParams();
              if (tab.key !== 'all') params.set('period', tab.key);
              if (priceFilter) params.set('price', priceFilter);
              const href = params.toString() ? `/events?${params}` : '/events';

              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                    period === tab.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50 shadow-sm'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <div className="flex gap-1 ml-auto">
            {[
              { key: '', label: 'All' },
              { key: 'free', label: 'Free' },
              { key: 'paid', label: 'Paid' },
            ].map((opt) => {
              const params = new URLSearchParams();
              if (period !== 'all') params.set('period', period);
              if (opt.key) params.set('price', opt.key);
              const href = params.toString() ? `/events?${params}` : '/events';

              return (
                <Link
                  key={opt.key}
                  href={href}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                    priceFilter === opt.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50 shadow-sm'
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Events Grid */}
        {error ? (
          <p className="text-text-secondary py-8 text-center">Error loading events. Please try again later.</p>
        ) : events.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">🎉</p>
            <p className="text-text-secondary">No events yet</p>
            <p className="text-text-muted text-sm mt-1">Events will appear here</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const startDate = event.start_at ? new Date(event.start_at) : null;
              const month = startDate ? startDate.toLocaleDateString('en-US', { month: 'short' }) : '';
              const day = startDate ? startDate.getDate() : '';
              const timeStr = startDate ? startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
              const isFree = event.is_free || event.price === 0;

              return (
                <Link key={event.id} href={`/events/${event.slug}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all block">
                  <div className="h-32 bg-gradient-to-br from-blue-100 via-indigo-50 to-primary/5 relative">
                    <div className="absolute top-3 left-3 bg-white rounded-lg shadow-sm px-2.5 py-1.5 text-center">
                      <p className="text-xs text-text-muted leading-tight uppercase">{month}</p>
                      <p className="text-lg text-primary font-semibold leading-tight">{day}</p>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isFree ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                        {isFree ? 'Free' : 'Paid'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2">{event.title_en || event.title || event.title_zh}</h3>
                    <div className="space-y-1 text-xs text-text-muted">
                      {timeStr && <p>{timeStr}</p>}
                      {(event.venue_name || event.venue) && <p>{event.venue_name || event.venue}</p>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/events"
          searchParams={preservedParams}
        />
      </div>
    </main>
  );
}
