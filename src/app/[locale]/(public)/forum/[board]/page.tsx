import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { Pagination } from '@/components/shared/pagination';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; board: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board, locale } = await params;
  const supabase = await createClient();
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
  const { data: scopedData } = await supabase
    .from('categories_forum')
    .select('name_zh, name_en, description, slug')
    .eq('slug', board)
    .eq('site_scope', siteScope)
    .single();
  let boardData = scopedData as AnyRow | null;
  if (!boardData && siteScope === 'en') {
    const { data: zhData } = await supabase
      .from('categories_forum')
      .select('name_zh, name_en, description, slug')
      .eq('slug', board)
      .eq('site_scope', 'zh')
      .single();
    boardData = zhData as AnyRow | null;
  }
  if (!boardData) return { title: 'Not Found' };

  return {
    title: `${boardData.name_en || boardData.name || boardData.name_zh} · Community Forum · Baam`,
    description: boardData.description || '',
  };
}

export default async function ForumBoardPage({ params, searchParams }: Props) {
  const { board, locale } = await params;
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const sortBy = sp.sort || 'latest_reply';
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  const supabase = await createClient();
  const site = await getCurrentSite();
  const regionIds = site.regionIds;

  // Fetch board info
  const { data: rawScopedBoard } = await supabase
    .from('categories_forum')
    .select('*')
    .eq('slug', board)
    .eq('site_scope', siteScope)
    .single();
  let boardData = rawScopedBoard as AnyRow | null;
  if (!boardData && siteScope === 'en') {
    const { data: rawZhBoard } = await supabase
      .from('categories_forum')
      .select('*')
      .eq('slug', board)
      .eq('site_scope', 'zh')
      .single();
    boardData = rawZhBoard as AnyRow | null;
  }
  if (!boardData) notFound();

  // Count total threads
  const { count } = await supabase
    .from('forum_threads')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardData.id)
    .eq('status', 'published')
    .eq('site_id', site.id)
    .in('region_id', regionIds);

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Build query with sort
  const from = (currentPage - 1) * PAGE_SIZE;
  let dataQuery = supabase
    .from('forum_threads')
    .select('*')
    .eq('board_id', boardData.id)
    .eq('status', 'published')
    .eq('site_id', site.id)
    .in('region_id', regionIds)
    .order('is_pinned', { ascending: false });

  if (sortBy === 'newest') {
    dataQuery = dataQuery.order('created_at', { ascending: false });
  } else if (sortBy === 'hot') {
    dataQuery = dataQuery.order('reply_count', { ascending: false });
  } else {
    dataQuery = dataQuery.order('last_replied_at', { ascending: false });
  }

  const { data: rawThreads } = await dataQuery.range(from, from + PAGE_SIZE - 1);
  const threads = (rawThreads || []) as AnyRow[];

  const preservedParams: Record<string, string> = {};
  if (sortBy !== 'latest_reply') preservedParams.sort = sortBy;

  const sortOptions = [
    { key: 'latest_reply', label: 'Latest Reply' },
    { key: 'newest', label: 'Newest' },
    { key: 'hot', label: 'Hot' },
  ];

  return (
    <main>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/forum" className="hover:text-primary">Forum</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-text-secondary">{boardData.name_en || boardData.name || boardData.name_zh}</span>
        </nav>

        <div className="lg:flex gap-8">
          <div className="flex-1">
            {/* Board Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>{boardData.emoji || boardData.icon || '📋'}</span>
                {boardData.name_en || boardData.name || boardData.name_zh}
              </h1>
              {boardData.description && (
                <p className="text-sm text-text-secondary mt-1">{boardData.description}</p>
              )}
            </div>

            {/* Sort Buttons — now functional */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
              {sortOptions.map((opt) => (
                <Link
                  key={opt.key}
                  href={opt.key === 'latest_reply' ? `/forum/${board}` : `/forum/${board}?sort=${opt.key}`}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                    sortBy === opt.key
                      ? 'bg-primary text-text-inverse'
                      : 'bg-border-light text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>

            {/* Thread List */}
            {threads.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-4">💬</p>
                <p className="text-text-secondary">No posts in this board yet</p>
                <p className="text-text-muted text-sm mt-1">Be the first to post!</p>
                <Link href="/forum/new" className="btn btn-primary mt-4 inline-block">New Post</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {threads.map((thread) => {
                  const timeAgo = formatTimeAgo(thread.last_replied_at || thread.created_at);
                  return (
                    <Link
                      key={thread.id}
                      href={`/forum/${board}/${thread.slug}`}
                      className="card p-4 block cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {thread.is_pinned && (
                              <span className="badge badge-red text-xs">Pinned</span>
                            )}
                            <h3 className="font-semibold text-sm line-clamp-1">
                              {thread.title || thread.title_zh}
                            </h3>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-text-muted">
                            <span>{thread.author_name || 'Anonymous'}</span>
                            <span>{timeAgo}</span>
                            <span className="flex items-center gap-1">💬 {thread.reply_count || 0}</span>
                            <span className="flex items-center gap-1">👀 {thread.view_count || 0}</span>
                            {(thread.ai_summary_en || thread.ai_summary_zh) && (
                              <span className="text-primary" title="AI summary available">🤖</span>
                            )}
                          </div>
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
              basePath={`/forum/${board}`}
              searchParams={preservedParams}
            />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">
            <div className="bg-bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-sm mb-3">📜 Board Rules</h3>
              <ul className="text-xs text-text-secondary space-y-2">
                <li>1. Follow community guidelines and be respectful</li>
                <li>2. No advertising or spam</li>
                <li>3. Respect others&apos; privacy, no personal attacks</li>
                <li>4. Post in the appropriate board</li>
              </ul>
            </div>
            <div className="bg-bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-sm mb-3">🏪 Related Businesses</h3>
              <p className="text-xs text-text-muted">Business recommendations will appear here</p>
            </div>
          </aside>
        </div>
      </div>

      {/* Floating New Post Button */}
      <Link
        href="/forum/new"
        className="fab fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow text-2xl z-50"
        style={{ backgroundColor: 'var(--color-accent-orange, #f97316)' }}
      >
        ✏️
      </Link>
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
