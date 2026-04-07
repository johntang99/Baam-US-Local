import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import ArticlesTable from './ArticlesTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const statusTabs = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'ai_drafted', label: 'AI Draft' },
  { key: 'human_reviewed', label: 'Reviewed' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
];

const typeOptions = [
  { key: '', label: 'All Types' },
  { key: 'news', label: 'News' },
  { key: 'guide', label: 'Guide' },
];

export default async function AdminArticlesPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Resolve filters from searchParams
  const statusFilter = typeof params.status === 'string' ? params.status : '';
  const typeFilter = typeof params.type === 'string' ? params.type : '';
  const regionFilter = typeof params.filter_region === 'string' ? params.filter_region : '';
  const categoryFilter = typeof params.cat === 'string' ? params.cat : '';

  // Page
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10));
  const pageSize = 50;

  // Fetch region names + guide categories in parallel
  const [{ data: regRows }, { data: rawGuideCategories }] = await Promise.all([
    supabase
      .from('regions')
      .select('id, name_en, name_zh, slug')
      .in('id', ctx.regionIds),
    supabase
      .from('categories_guide')
      .select('id, slug, name_en, name_zh, sort_order')
      .eq('site_scope', 'en')
      .order('sort_order', { ascending: true }),
  ]);
  const regionNameMap: Record<string, string> = {};
  (regRows || []).forEach((r: AnyRow) => {
    regionNameMap[r.id] = r.name_en || r.name_zh || r.slug;
  });
  const guideCategories = (rawGuideCategories || []) as AnyRow[];

  // Build query — filter by site_id only (not region_id, which is optional)
  let query = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('editorial_status', statusFilter);
  }

  if (typeFilter === 'news') {
    query = query.in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community']);
  } else if (typeFilter === 'guide') {
    query = query.in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_scenario', 'guide_resource', 'guide_seasonal', 'guide_neighborhood']);
  }

  if (regionFilter) {
    query = query.eq('region_id', regionFilter);
  }
  if (typeFilter === 'guide' && categoryFilter) {
    query = query.eq('category_id', categoryFilter);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data: rawArticles, count } = await query;
  const articles = (rawArticles || []) as AnyRow[];
  const totalCount = count ?? articles.length;

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
    // Preserve existing filters not being overridden
    if (!('status' in overrides) && statusFilter) p.set('status', statusFilter);
    if (!('type' in overrides) && typeFilter) p.set('type', typeFilter);
    if (!('filter_region' in overrides) && regionFilter) p.set('filter_region', regionFilter);
    if (!('cat' in overrides) && categoryFilter) p.set('cat', categoryFilter);
    return `/admin/articles?${p.toString()}`;
  }

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* New article button */}
        <div className="flex justify-end">
          <Link
            href={`/admin/articles/new?${baseParams.toString()}`}
            className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 inline-flex items-center"
          >
            + New Article
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

          {/* Type dropdown */}
          <div className="flex items-center gap-2">
            {typeOptions.map((opt) => (
              <Link
                key={opt.key}
                href={filterUrl({ type: opt.key, page: '' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  typeFilter === opt.key
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-text-muted hover:text-text'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* Region dropdown */}
          {Object.keys(regionNameMap).length > 1 && (
            <div className="flex items-center gap-1">
              <Link
                href={filterUrl({ filter_region: '', page: '' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  !regionFilter
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-text-muted hover:text-text'
                }`}
              >
                All Regions
              </Link>
              {Object.entries(regionNameMap).map(([id, name]) => (
                <Link
                  key={id}
                  href={filterUrl({ filter_region: id, page: '' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    regionFilter === id
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  {name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Guide category submenu — shown when Guide type is selected */}
        {typeFilter === 'guide' && guideCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Link
              href={filterUrl({ cat: '', page: '' })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                !categoryFilter
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              All Categories
            </Link>
            {guideCategories.map((cat) => (
              <Link
                key={cat.id}
                href={filterUrl({ cat: String(cat.id), page: '' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  categoryFilter === String(cat.id)
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-text-muted hover:text-text'
                }`}
              >
                {cat.name_en || cat.name_zh || cat.slug}
              </Link>
            ))}
          </div>
        )}

        {/* Articles table (client component for bulk actions) */}
        {articles.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-4xl mb-4">&#128221;</p>
            <p className="text-text-muted">No articles for this site</p>
            <p className="text-sm text-text-muted mt-1">Switch site or create a new article</p>
          </div>
        ) : (
          <ArticlesTable articles={articles} regionNameMap={regionNameMap} siteParams={baseParams.toString()} />
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            Showing {from + 1}-{Math.min(from + articles.length, totalCount)} of {totalCount}
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
