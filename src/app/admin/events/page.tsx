import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import EventsTable from './EventsTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const statusTabs = [
  { key: '', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default async function AdminEventsPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Resolve filters from searchParams
  const statusFilter = typeof params.status === 'string' ? params.status : '';

  // Page
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10));
  const pageSize = 50;

  // Build base URL for filter links
  const baseParams = new URLSearchParams();
  if (params.region) baseParams.set('region', String(params.region));
  if (params.locale) baseParams.set('locale', String(params.locale));

  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams(baseParams);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!('status' in overrides) && statusFilter) p.set('status', statusFilter);
    return `/admin/events?${p.toString()}`;
  }

  // Build query
  let query = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .in('region_id', ctx.regionIds)
    .order('start_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data: rawEvents, count } = await query;
  const events = (rawEvents || []) as AnyRow[];
  const totalCount = count ?? events.length;

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* New event button */}
        <div className="flex justify-end">
          <Link
            href={`/admin/events/new?${baseParams.toString()}`}
            className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 inline-flex items-center"
          >
            + Add Event
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-bg-page border border-border rounded-lg p-1">
            {statusTabs.map((tab) => (
              <Link
                key={tab.key}
                href={filterUrl({ status: tab.key, page: '' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-bg-card text-text shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Events table */}
        {events.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-text-muted">No events for this site</p>
            <p className="text-sm text-text-muted mt-1">Click the button above to create a new event</p>
          </div>
        ) : (
          <EventsTable events={events} siteParams={baseParams.toString()} />
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            Showing {from + 1}-{Math.min(from + events.length, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={filterUrl({ page: String(page - 1) })}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-bg-page"
              >
                Previous
              </Link>
            )}
            {from + pageSize < totalCount && (
              <Link
                href={filterUrl({ page: String(page + 1) })}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-bg-page"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
