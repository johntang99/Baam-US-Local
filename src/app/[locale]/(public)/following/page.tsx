import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentSite } from '@/lib/sites';
import { redirect } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const metadata: Metadata = {
  title: 'Following · Baam',
  description: 'See the latest content from people you follow',
};

export default async function FollowingFeedPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect('/en?auth=required&redirect=/following');

  const supabase = await createClient();
  const site = await getCurrentSite();

  // Get IDs of profiles the user follows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: followsData } = await (supabase as any)
    .from('follows')
    .select('followed_profile_id')
    .eq('follower_user_id', user.id);

  const followedIds = (followsData || []).map((f: AnyRow) => f.followed_profile_id);

  // If not following anyone, show empty state
  if (followedIds.length === 0) {
    return (
      <main>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Following</h1>
          <div className="card p-12 text-center">
            <p className="text-4xl mb-4">👥</p>
            <h2 className="text-lg font-semibold mb-2">Not following anyone yet</h2>
            <p className="text-sm text-text-muted mb-6">Follow voices and creators to see their latest content here</p>
            <Link href="/voices" className="btn btn-primary h-10 px-6 text-sm inline-block">
              Discover Voices
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Fetch recent posts from followed profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: postsData } = await (supabase as any)
    .from('voice_posts')
    .select('*, profiles:author_id(display_name, username, avatar_url, is_verified)')
    .in('author_id', followedIds)
    .eq('site_id', site.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(20);

  const posts = (postsData || []) as AnyRow[];

  return (
    <main>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Following</h1>
          <Link href="/voices" className="text-sm text-primary hover:underline">Discover more voices</Link>
        </div>

        {posts.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-4">📝</p>
            <p className="text-text-secondary">No new content from people you follow yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const author = post.profiles || {};
              const timeAgo = formatTimeAgo(post.published_at);
              return (
                <div key={post.id} className="card p-5">
                  {/* Author info */}
                  <div className="flex items-center gap-3 mb-3">
                    <Link href={`/voices/${author.username || ''}`}>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                        {(author.display_name || '?')[0]}
                      </div>
                    </Link>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/voices/${author.username || ''}`} className="font-medium text-sm hover:text-primary">
                          {author.display_name || 'Anonymous'}
                        </Link>
                        {author.is_verified && <span className="text-blue-500 text-xs">✓</span>}
                      </div>
                      <p className="text-xs text-text-muted">{timeAgo}</p>
                    </div>
                  </div>

                  {/* Post content */}
                  <Link href={`/voices/${author.username || ''}/posts/${post.slug}`}>
                    {post.title && (
                      <h3 className="font-semibold text-base mb-2 hover:text-primary transition-colors">{post.title}</h3>
                    )}
                    <p className="text-sm text-text-secondary line-clamp-3 mb-3">
                      {post.excerpt || post.content?.slice(0, 200)}
                    </p>
                  </Link>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>❤️ {post.like_count || 0}</span>
                    <span>💬 {post.comment_count || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
