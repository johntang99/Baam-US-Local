import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { Link } from '@/lib/i18n/routing';
import { Pagination } from '@/components/shared/pagination';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: 'Classifieds · Baam',
  description: 'Middletown community classifieds — rentals, jobs, for sale, services',
};

const categoryTabs = [
  { key: '', label: 'All' },
  { key: 'housing_rent', label: 'Rentals' },
  { key: 'housing_buy', label: 'Real Estate' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'secondhand', label: 'For Sale' },
  { key: 'services', label: 'Services' },
  { key: 'events', label: 'Events' },
  { key: 'general', label: 'Other' },
];

const categoryLabels: Record<string, string> = {
  housing_rent: 'Rentals', housing_buy: 'Real Estate', jobs: 'Jobs',
  secondhand: 'For Sale', services: 'Services', events: 'Events', general: 'Other',
};

interface Props {
  searchParams: Promise<{ page?: string; cat?: string }>;
}

export default async function ClassifiedsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const activeCat = sp.cat || '';

  const supabase = await createClient();
  const site = await getCurrentSite();

  // Count
  let countQuery = (supabase as any)
    .from('classifieds')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('site_id', site.id);
  if (activeCat) countQuery = countQuery.eq('category', activeCat);

  const { count } = await countQuery;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Fetch
  const from = (currentPage - 1) * PAGE_SIZE;
  let dataQuery = (supabase as any)
    .from('classifieds')
    .select('*')
    .eq('status', 'active')
    .eq('site_id', site.id);
  if (activeCat) dataQuery = dataQuery.eq('category', activeCat);

  const { data: rawItems } = await dataQuery
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const items = (rawItems || []) as AnyRow[];

  const preservedParams: Record<string, string> = {};
  if (activeCat) preservedParams.cat = activeCat;

  return (
    <main>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Classifieds</h1>
          <Link href="/classifieds/new" className="btn btn-primary h-9 px-4 text-sm">Post Ad</Link>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
          {categoryTabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key ? `/classifieds?cat=${tab.key}` : '/classifieds'}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                activeCat === tab.key
                  ? 'bg-primary text-text-inverse'
                  : 'bg-border-light text-text-secondary hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* List */}
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-text-secondary">No classifieds yet</p>
            <p className="text-text-muted text-sm mt-1">Be the first to post</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const timeAgo = formatTimeAgo(item.created_at);
              const catLabel = categoryLabels[item.category] || 'Other';
              return (
                <Link key={item.id} href={`/classifieds/${item.slug}`} className="card p-4 block">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {item.is_featured && <span className="badge badge-red text-xs">Pinned</span>}
                        <span className="badge badge-gray text-xs">{catLabel}</span>
                        <span className="text-xs text-text-muted">{timeAgo}</span>
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-1 mb-1">{item.title}</h3>
                      {item.body && (
                        <p className="text-xs text-text-secondary line-clamp-2">{item.body}</p>
                      )}
                    </div>
                    {item.price_text && (
                      <span className="text-sm font-bold text-primary flex-shrink-0">{item.price_text}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/classifieds"
          searchParams={preservedParams}
        />
      </div>
    </main>
  );
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
