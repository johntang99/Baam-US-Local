import { createClient } from '@/lib/supabase/server';
import { Link } from '@/lib/i18n/routing';
import { DiscoverCard } from '@/components/discover/discover-card';
import { MasonryGrid } from '@/components/discover/masonry-grid';
import { DiscoverTabs } from '@/components/discover/discover-tabs';
import { TrendingTopics, TrendingSidebar, WeeklyPicks } from '@/components/discover/trending-topics';
import { Pagination } from '@/components/shared/pagination';
import type { Metadata } from 'next';
import { getCurrentSite } from '@/lib/sites';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

const creatorGradients = [
  'from-pink-200 to-rose-300',
  'from-blue-200 to-indigo-300',
  'from-amber-200 to-orange-300',
  'from-emerald-200 to-teal-300',
  'from-violet-200 to-purple-300',
];

const creatorTextColors = [
  'text-rose-600',
  'text-indigo-600',
  'text-orange-600',
  'text-teal-600',
  'text-purple-600',
];

export const metadata: Metadata = {
  title: 'Discover · Baam',
  description: 'Discover local people, content, places, services and trends worth knowing about',
};

interface Props {
  searchParams: Promise<{ tab?: string; page?: string; topic?: string }>;
}

export default async function DiscoverPage({ searchParams }: Props) {
  const sp = await searchParams;
  const activeTab = sp.tab || 'recommend';
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const topicFilter = sp.topic || null;

  const supabase = await createClient();
  const site = await getCurrentSite();

  // Fetch trending topics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawTopics } = await (supabase as any)
    .from('discover_topics')
    .select('*')
    .eq('is_trending', true)
    .order('sort_order', { ascending: true });

  const topics = (rawTopics || []) as AnyRow[];

  // Build posts query
  let postsQuery = supabase
    .from('voice_posts')
    .select('*, profiles!voice_posts_author_id_fkey(id, username, display_name, avatar_url, is_verified, profile_type)', { count: 'exact' })
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('site_id', site.id);

  // Tab filters
  if (activeTab === 'notes') {
    postsQuery = postsQuery.in('post_type', ['note', 'short_post', 'blog', 'recommendation', 'guide_post']);
  } else if (activeTab === 'videos') {
    postsQuery = postsQuery.eq('post_type', 'video');
  }

  // Topic filter
  if (topicFilter) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: topicData } = await (supabase as any)
      .from('discover_topics')
      .select('id')
      .eq('slug', topicFilter)
      .single();

    const topic = topicData as AnyRow | null;
    if (topic) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: postIds } = await (supabase as any)
        .from('discover_post_topics')
        .select('post_id')
        .eq('topic_id', topic.id);

      const ids = ((postIds || []) as AnyRow[]).map((r) => r.post_id);
      if (ids.length > 0) {
        postsQuery = postsQuery.in('id', ids);
      } else {
        postsQuery = postsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
  }

  // Sort
  postsQuery = postsQuery.order('published_at', { ascending: false });

  // Pagination
  const from = (currentPage - 1) * PAGE_SIZE;
  const { data: rawPosts, count } = await postsQuery.range(from, from + PAGE_SIZE - 1);
  const posts = (rawPosts || []) as AnyRow[];
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Fetch featured creators for sidebar
  const { data: rawCreators } = await supabase
    .from('profiles')
    .select('id, username, display_name, headline, avatar_url, is_verified, follower_count, profile_type')
    .eq('is_featured', true)
    .neq('profile_type', 'user')
    .order('follower_count', { ascending: false })
    .limit(3);

  const creators = (rawCreators || []) as AnyRow[];

  // Fetch weekly picks (top liked posts)
  const { data: rawPicks } = await supabase
    .from('voice_posts')
    .select('id, slug, title, cover_images, cover_image_url, like_count, save_count')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('site_id', site.id)
    .order('like_count', { ascending: false })
    .limit(3);

  const weeklyPicks = (rawPicks || []) as AnyRow[];

  // Active topic for header display
  const activeTopic = topicFilter ? topics.find((t) => t.slug === topicFilter) : null;

  // Preserved params for pagination
  const preservedParams: Record<string, string> = {};
  if (activeTab !== 'recommend') preservedParams.tab = activeTab;
  if (topicFilter) preservedParams.topic = topicFilter;

  const gridPosts = posts;

  return (
    <main className="bg-gray-50 min-h-screen">
      {/* ===== Sticky Search + Trending Bar ===== */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="relative max-w-xl mb-3">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Link href="/ask" className="flex items-center w-full h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-400 hover:bg-white hover:border-gray-300 transition">
              Search posts, videos, topics...
            </Link>
          </div>
          <TrendingTopics topics={topics} />
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="py-2">
            <DiscoverTabs />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Active Topic Banner */}
        {activeTopic && (
          <div className="mb-6 p-4 bg-orange-50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{activeTopic.icon_emoji}</span>
              <div>
                <h2 className="font-semibold text-sm">{activeTopic.name_zh}</h2>
                <p className="text-xs text-gray-500">{activeTopic.post_count || 0} posts</p>
              </div>
            </div>
            <Link href="/discover" className="text-xs text-gray-500 hover:text-primary">
              Clear filters ×
            </Link>
          </div>
        )}

        <div className="lg:flex lg:gap-8">
          {/* ===== Main Feed ===== */}
          <div className="flex-1 min-w-0">
            {posts.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-4xl mb-4">📝</p>
                <p className="text-gray-500">No content yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to post something!</p>
                <Link href="/discover/new-post" className="inline-block mt-4 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
                  Create Post
                </Link>
              </div>
            ) : (
              <>
                {/* Masonry Grid — 3 columns, natural image heights */}
                <MasonryGrid>
                  {gridPosts.map((post, i) => (
                    <DiscoverCard
                      key={post.id}
                      post={post}
                      author={post.profiles}
                      index={i}
                    />
                  ))}
                </MasonryGrid>

                {/* Load More / Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  basePath="/discover"
                  searchParams={preservedParams}
                />
              </>
            )}
          </div>

          {/* ===== Sidebar (Desktop) ===== */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6">
            {/* Trending Topics */}
            <TrendingSidebar topics={topics} />

            {/* Recommended Creators */}
            {creators.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-[14px] p-5">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Featured Creators
                </h3>
                <div className="space-y-4">
                  {creators.map((c, i) => (
                    <Link key={c.id} href={`/discover/voices/${c.username}`} className="flex items-center gap-3 group">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${creatorGradients[i % creatorGradients.length]} flex items-center justify-center text-sm font-bold ${creatorTextColors[i % creatorTextColors.length]} flex-shrink-0`}>
                        {c.display_name?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition">{c.display_name}</p>
                        <p className="text-xs text-gray-400">{c.headline || `${formatFollowers(c.follower_count || 0)} followers`}</p>
                      </div>
                      <button className="px-3 py-1 text-xs font-medium text-primary border border-primary rounded-full hover:bg-primary hover:text-white transition flex-shrink-0">
                        Follow
                      </button>
                    </Link>
                  ))}
                </div>
                <Link href="/discover/voices" className="block text-center text-sm text-primary font-medium mt-4 hover:underline">
                  View More Creators &rarr;
                </Link>
              </div>
            )}

            {/* Weekly Picks */}
            <WeeklyPicks posts={weeklyPicks} />
          </aside>
        </div>
      </div>

      {/* ===== FAB: Create Post ===== */}
      <Link
        href="/discover/new-post"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 z-40 text-white"
        style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
        title="Create Post"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </Link>
    </main>
  );
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function formatFollowers(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}
