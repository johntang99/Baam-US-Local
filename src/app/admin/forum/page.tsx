import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import { PendingQueue, ThreadsTable } from './ForumTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const mainTabs = [
  { key: 'pending', label: 'Review Queue' },
  { key: 'all', label: 'All Posts' },
  { key: 'boards', label: 'Board Management' },
];

export default async function AdminForumPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const siteScope = String(ctx.locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Resolve tab
  const tab = typeof params.tab === 'string' ? params.tab : 'pending';

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
    if (!('tab' in overrides) && tab !== 'pending') p.set('tab', tab);
    return `/admin/forum?${p.toString()}`;
  }

  // Fetch pending count for badge
  const { count: pendingCount } = await supabase
    .from('forum_threads')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', ctx.siteId)
    .in('region_id', ctx.regionIds)
    .or('status.eq.pending,ai_spam_score.gt.0.7');

  // Fetch board/category names for display
  const { data: rawBoards } = await supabase
    .from('categories_forum')
    .select('id, name_zh, name_en, slug, description, site_scope')
    .eq('site_scope', siteScope)
    .order('sort_order', { ascending: true });
  const boards = (rawBoards || []) as AnyRow[];
  const boardNameMap: Record<string, string> = {};
  boards.forEach((b: AnyRow) => {
    boardNameMap[b.id] = b.name_en || b.name_zh || b.slug;
  });

  // Fetch data based on tab
  let pendingThreads: AnyRow[] = [];
  let allThreads: AnyRow[] = [];
  let totalCount = 0;

  if (tab === 'pending') {
    const { data: rawPending } = await supabase
      .from('forum_threads')
      .select('*')
      .eq('site_id', ctx.siteId)
      .in('region_id', ctx.regionIds)
      .or('status.eq.pending,ai_spam_score.gt.0.7')
      .order('created_at', { ascending: false })
      .limit(50);
    pendingThreads = (rawPending || []) as AnyRow[];
  } else if (tab === 'all') {
    const from = (page - 1) * pageSize;

    const { data: rawAll, count } = await supabase
      .from('forum_threads')
      .select('*', { count: 'exact' })
      .eq('site_id', ctx.siteId)
      .in('region_id', ctx.regionIds)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    allThreads = (rawAll || []) as AnyRow[];
    totalCount = count ?? allThreads.length;
  }
  // For 'boards' tab, we use the boards array fetched above

  // Get post counts per board for boards tab
  let boardPostCounts: Record<string, number> = {};
  if (tab === 'boards' && boards.length > 0) {
    // Get counts by querying threads grouped by board_id
    for (const board of boards) {
      const { count } = await supabase
        .from('forum_threads')
        .select('*', { count: 'exact', head: true })
        .eq('board_id', board.id)
        .eq('site_id', ctx.siteId)
        .in('region_id', ctx.regionIds);
      boardPostCounts[board.id] = count ?? 0;
    }
  }

  const from = (page - 1) * pageSize;

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-bg-page border border-border rounded-lg p-1">
          {mainTabs.map((t) => (
            <Link
              key={t.key}
              href={filterUrl({ tab: t.key === 'pending' ? '' : t.key, page: '' })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-bg-card text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {t.label}
              {t.key === 'pending' && (pendingCount || 0) > 0 && (
                <span className="ml-1 badge badge-red text-xs">{pendingCount}</span>
              )}
            </Link>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'pending' && (
          <PendingQueue threads={pendingThreads} />
        )}

        {tab === 'all' && (
          <>
            {allThreads.length === 0 ? (
              <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
                <p className="text-text-muted">No posts for this site</p>
              </div>
            ) : (
              <ThreadsTable threads={allThreads} boardNameMap={boardNameMap} />
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm text-text-muted">
              <span>
                Showing {from + 1}-{Math.min(from + allThreads.length, totalCount)} of {totalCount}
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
          </>
        )}

        {tab === 'boards' && (
          <div className="space-y-4">
            {boards.length === 0 ? (
              <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
                <p className="text-text-muted">No forum boards</p>
                <p className="text-sm text-text-muted mt-1">Add boards in Settings → Forum Categories</p>
              </div>
            ) : (
              <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Board Name</th>
                      <th>Description</th>
                      <th>Post Count</th>
                      <th>Slug</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boards.map((board) => (
                      <tr key={board.id}>
                        <td className="text-sm font-medium">{board.name_en || board.name_zh || board.slug}</td>
                        <td className="text-sm text-text-muted max-w-xs truncate">{board.description || '--'}</td>
                        <td className="text-sm">{boardPostCounts[board.id] ?? 0}</td>
                        <td className="text-xs text-text-muted">{board.slug || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
