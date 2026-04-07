import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { DiscoverCard } from '@/components/discover/discover-card';
import { MasonryGrid } from '@/components/discover/masonry-grid';
import { Pagination } from '@/components/shared/pagination';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('discover_topics')
    .select('name_zh, name_en, description')
    .eq('slug', decodedSlug)
    .single();

  const topic = data as AnyRow | null;
  if (!topic) return { title: 'Topic · Baam' };

  return {
    title: `#${topic.name_zh} · Discover · Baam`,
    description: topic.description || `Browse community posts about ${topic.name_zh}`,
  };
}

export default async function TopicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));

  const supabase = await createClient();
  const site = await getCurrentSite();

  // Fetch topic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: topicData, error: topicError } = await (supabase as any)
    .from('discover_topics')
    .select('*')
    .eq('slug', decodedSlug)
    .single();

  const topic = topicData as AnyRow | null;
  if (topicError || !topic) notFound();

  // Fetch posts linked to this topic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: postTopicLinks } = await (supabase as any)
    .from('discover_post_topics')
    .select('post_id')
    .eq('topic_id', topic.id);

  const linkedPostIds = ((postTopicLinks || []) as AnyRow[]).map(r => r.post_id);

  // Also fetch posts with matching topic_tags (by name)
  let posts: AnyRow[] = [];
  let totalPages = 1;
  const from = (currentPage - 1) * PAGE_SIZE;

  const { data: rawPosts, count } = await supabase
    .from('voice_posts')
    .select('*, profiles!voice_posts_author_id_fkey(id, username, display_name, avatar_url, is_verified)', { count: 'exact' })
    .eq('site_id', site.id)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .or(
      linkedPostIds.length > 0
        ? `id.in.(${linkedPostIds.join(',')}),topic_tags.cs.{${topic.name_zh}}`
        : `topic_tags.cs.{${topic.name_zh}}`
    )
    .order('published_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  posts = (rawPosts || []) as AnyRow[];
  totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Fetch related topics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawRelatedTopics } = await (supabase as any)
    .from('discover_topics')
    .select('*')
    .neq('id', topic.id)
    .eq('is_trending', true)
    .order('sort_order', { ascending: true })
    .limit(8);

  const relatedTopics = (rawRelatedTopics || []) as AnyRow[];

  return (
    <main className="bg-gray-50 min-h-screen">
      {/* Topic Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <nav className="text-sm text-gray-400 mb-4">
            <Link href="/discover" className="hover:text-primary">Discover</Link>
            <span className="mx-2">›</span>
            <span className="text-gray-600">Topic</span>
          </nav>

          <div className="flex items-center gap-4">
            {topic.icon_emoji && (
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-3xl">
                {topic.icon_emoji}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">#{topic.name_zh}</h1>
              {topic.name_en && (
                <p className="text-sm text-gray-400 mt-0.5">{topic.name_en}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>{topic.post_count || count || 0} posts</span>
                {topic.follower_count > 0 && (
                  <span>{topic.follower_count} followers</span>
                )}
              </div>
            </div>
          </div>

          {topic.description && (
            <p className="text-sm text-gray-500 mt-4 max-w-2xl">{topic.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Related Topics */}
        {relatedTopics.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
            {relatedTopics.map((t) => (
              <Link
                key={t.id}
                href={`/discover/tag/${t.slug}`}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-gray-100 text-gray-600 rounded-full text-[13px] whitespace-nowrap hover:bg-orange-50 hover:text-orange-600 transition"
              >
                {t.icon_emoji && <span>{t.icon_emoji}</span>}
                {t.name_zh}
              </Link>
            ))}
          </div>
        )}

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-4">{topic.icon_emoji || '📝'}</p>
            <p className="text-gray-500">No posts about #{topic.name_zh} yet</p>
            <p className="text-sm text-gray-400 mt-1">Be the first to post!</p>
            <Link href="/discover/new-post" className="inline-block mt-4 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
              Create Post
            </Link>
          </div>
        ) : (
          <>
            <MasonryGrid>
              {posts.map((post, i) => (
                <DiscoverCard key={post.id} post={post} author={post.profiles} index={i} />
              ))}
            </MasonryGrid>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath={`/discover/tag/${decodedSlug}`}
              searchParams={{}}
            />
          </>
        )}
      </div>
    </main>
  );
}
