import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('forum')} · Baam`,
    description: 'Middletown community forum — share experiences, ask for help, discuss local topics',
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ForumHomePage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();
  const regionIds = site.regionIds;
  const t = await getTranslations();
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Fetch forum boards
  const { data: rawScopedBoards } = await supabase
    .from('categories_forum')
    .select('*')
    .eq('site_scope', siteScope)
    .order('sort_order', { ascending: true });
  let boards = (rawScopedBoards || []) as AnyRow[];
  if (boards.length === 0 && siteScope === 'en') {
    const { data: rawZhBoards } = await supabase
      .from('categories_forum')
      .select('*')
      .eq('site_scope', 'zh')
      .order('sort_order', { ascending: true });
    boards = (rawZhBoards || []) as AnyRow[];
  }

  // Fetch hot threads: weighted by replies and views
  const { data: rawHotThreads } = await supabase
    .from('forum_threads')
    .select('*')
    .eq('status', 'published')
    .eq('site_id', site.id)
    .in('region_id', regionIds)
    .order('reply_count', { ascending: false })
    .limit(10);

  const hotThreads = (rawHotThreads || []) as AnyRow[];

  return (
    <main>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span>💬</span> Community Forum
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            Share experiences, help each other, discuss local life in Middletown
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Board Card Grid */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-4">Boards</h2>
          {boards.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-4">💬</p>
              <p className="text-text-secondary">No boards yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/forum/${board.slug}`}
                  className="bg-white rounded-xl border border-gray-200 p-5 block cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">{board.emoji || '📋'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1">{board.name_en || board.name || board.name_zh}</h3>
                      {board.description && (
                        <p className="text-xs text-text-secondary line-clamp-2">{board.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-text-muted">Posts today --</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Hot Threads */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🔥</span> Trending Discussions
          </h2>
          {hotThreads.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-text-secondary">No trending posts yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {hotThreads.map((thread) => {
                const timeAgo = formatTimeAgo(thread.created_at);
                const isPinned = thread.is_pinned;
                const isHot = (thread.reply_count || 0) >= 5;
                return (
                  <Link
                    key={thread.id}
                    href={`/forum/${thread.board_slug || 'general'}/${thread.slug}`}
                    className="bg-white border-b border-gray-100 hover:bg-blue-50/50 transition p-4 block cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {isPinned && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pinned</span>
                      )}
                      {isHot && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Hot</span>
                      )}
                      {thread.board_name && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{thread.board_name}</span>
                      )}
                      <span className="text-xs text-text-muted">{timeAgo}</span>
                    </div>
                    <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                      {thread.title || thread.title_zh}
                    </h3>
                    {(thread.ai_summary_en || thread.ai_summary_zh) && (
                      <div className="ai-summary-card mt-2 mb-2">
                        <p className="text-xs text-text-secondary line-clamp-2">{thread.ai_summary_en || thread.ai_summary_zh}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="text-primary font-bold">💬 {thread.reply_count || 0}</span>
                      <span>👀 {thread.view_count || 0}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
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
