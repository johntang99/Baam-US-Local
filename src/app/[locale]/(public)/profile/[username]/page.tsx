import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; username: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('profiles')
    .select('display_name')
    .eq('username', username)
    .single();

  return {
    title: data ? `${data.display_name} · Baam` : 'Not Found',
  };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();
  const currentUser = await getCurrentUser().catch(() => null);

  // Fetch profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData, error } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  const profile = profileData as AnyRow | null;
  if (error || !profile) notFound();

  const isOwnProfile = currentUser?.id === profile.id;

  // Fetch user's forum threads
  const { data: threads } = await supabase
    .from('forum_threads')
    .select('id, slug, title, reply_count, created_at')
    .eq('author_id', profile.id)
    .eq('site_id', site.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch user's voice posts
  const { data: posts } = await supabase
    .from('voice_posts')
    .select('id, slug, title, like_count, comment_count, published_at')
    .eq('author_id', profile.id)
    .eq('site_id', site.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(5);

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long',
  });

  const profileTypeLabels: Record<string, string> = {
    user: 'Community Member',
    creator: 'Content Creator',
    expert: 'Verified Expert',
    professional: 'Professional',
    community_leader: 'Community Leader',
    business_owner: 'Business Owner',
  };

  return (
    <main>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="card p-6 sm:p-8 mb-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl sm:text-4xl flex-shrink-0">
              {profile.display_name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{profile.display_name}</h1>
                {profile.is_verified && <span className="badge badge-blue text-xs">Verified</span>}
              </div>
              <p className="text-sm text-text-muted mb-2">@{profile.username}</p>
              <p className="text-sm text-text-secondary mb-3">
                {profileTypeLabels[profile.profile_type] || 'Community Member'} · Joined {memberSince}
              </p>
              {profile.bio && (
                <p className="text-sm text-text-primary leading-relaxed mb-4">{profile.bio}</p>
              )}
              <div className="flex items-center gap-6 text-sm">
                <span><strong>{profile.follower_count || 0}</strong> <span className="text-text-muted">followers</span></span>
                <span><strong>{profile.following_count || 0}</strong> <span className="text-text-muted">following</span></span>
                <span><strong>{profile.post_count || 0}</strong> <span className="text-text-muted">posts</span></span>
              </div>
            </div>
            {isOwnProfile && (
              <Link href="/settings" className="btn btn-outline h-9 px-4 text-sm flex-shrink-0">
                Edit Profile
              </Link>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Voice Posts */}
            {posts && posts.length > 0 && (
              <section className="card p-5">
                <h2 className="font-bold text-base mb-4">Posts</h2>
                <div className="space-y-3">
                  {(posts as AnyRow[]).map((post) => (
                    <Link
                      key={post.id}
                      href={`/voices/${username}/posts/${post.slug}`}
                      className="block p-3 rounded-lg hover:bg-bg-page transition-colors"
                    >
                      <h3 className="font-medium text-sm line-clamp-1">{post.title || 'Untitled'}</h3>
                      <div className="flex gap-3 text-xs text-text-muted mt-1">
                        <span>❤️ {post.like_count || 0}</span>
                        <span>💬 {post.comment_count || 0}</span>
                        {post.published_at && (
                          <span>{new Date(post.published_at).toLocaleDateString('en-US')}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Forum Threads */}
            {threads && threads.length > 0 && (
              <section className="card p-5">
                <h2 className="font-bold text-base mb-4">Forum Threads</h2>
                <div className="space-y-3">
                  {(threads as AnyRow[]).map((thread) => (
                    <div key={thread.id} className="p-3 rounded-lg hover:bg-bg-page transition-colors">
                      <h3 className="font-medium text-sm line-clamp-1">{thread.title}</h3>
                      <div className="flex gap-3 text-xs text-text-muted mt-1">
                        <span>💬 {thread.reply_count || 0} replies</span>
                        <span>{new Date(thread.created_at).toLocaleDateString('en-US')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {(!posts || posts.length === 0) && (!threads || threads.length === 0) && (
              <div className="card p-8 text-center">
                <p className="text-text-muted">No content published yet</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {profile.interest_tags && Array.isArray(profile.interest_tags) && profile.interest_tags.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-sm mb-3">Interests</h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interest_tags.map((tag: string) => (
                    <span key={tag} className="badge badge-gray text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
