import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { DiscoverCard } from '@/components/discover/discover-card';
import { MasonryGrid } from '@/components/discover/masonry-grid';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('display_name, headline, avatar_url')
    .eq('username', username)
    .single();

  const profile = data as AnyRow | null;
  if (!profile) return { title: 'Not Found' };

  return {
    title: `${profile.display_name || username} · Baam`,
    description: profile.headline || '',
    openGraph: {
      title: profile.display_name || username,
      description: profile.headline || '',
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  };
}

const profileTypeLabels: Record<string, string> = {
  creator: 'Creator',
  expert: 'Expert',
  professional: 'Professional',
  community_leader: 'Community Leader',
  business_owner: 'Business Owner',
};

export default async function DiscoverVoiceProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const sp = await searchParams;
  const activeTab = sp.tab || 'all';
  const supabase = await createClient();
  const site = await getCurrentSite();

  // Fetch profile
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  const profile = data as AnyRow | null;
  if (error || !profile) notFound();

  // Fetch linked business
  const { data: rawLinks } = await supabase
    .from('profile_business_links')
    .select('*, businesses(*)')
    .eq('profile_id', profile.id)
    .limit(1);

  const businessLinks = (rawLinks || []) as AnyRow[];
  const linkedBusiness = businessLinks.length > 0 ? businessLinks[0].businesses as AnyRow | null : null;

  // Fetch posts with tab filtering
  let postsQuery = supabase
    .from('voice_posts')
    .select('*')
    .eq('author_id', profile.id)
    .eq('site_id', site.id)
    .eq('status', 'published');

  if (activeTab === 'notes') {
    postsQuery = postsQuery.in('post_type', ['note', 'short_post', 'blog', 'recommendation']);
  } else if (activeTab === 'videos') {
    postsQuery = postsQuery.eq('post_type', 'video');
  }

  const { data: rawPosts } = await postsQuery
    .order('published_at', { ascending: false })
    .limit(30);

  const posts = (rawPosts || []) as AnyRow[];

  // Count by type for tab badges
  const noteCount = posts.filter(p => ['note', 'short_post', 'blog', 'recommendation'].includes(p.post_type)).length;
  const videoCount = posts.filter(p => p.post_type === 'video').length;

  // Fetch recommended voices
  const { data: rawRecommended } = await supabase
    .from('profiles')
    .select('id, username, display_name, headline, is_verified, follower_count')
    .neq('id', profile.id)
    .neq('profile_type', 'user')
    .limit(5);

  const recommended = (rawRecommended || []) as AnyRow[];

  // Check if the viewer is the profile owner
  const currentUser = await (await import('@/lib/auth')).getCurrentUser().catch(() => null);
  const isOwner = currentUser?.id === profile.id;

  return (
    <main>
      {/* Cover Banner — mt-0 since navbar is sticky and doesn't overlap */}
      <div className="bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300 h-36 sm:h-44 relative">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23fff\' fill-opacity=\'0.3\'%3E%3Ccircle cx=\'1\' cy=\'1\' r=\'1\'/%3E%3C/g%3E%3C/svg%3E")' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Profile Identity */}
        <div className="-mt-14 mb-6">
          <div className="flex items-end gap-4">
            <div className="w-28 h-28 rounded-full bg-white border-4 border-white flex items-center justify-center text-4xl shadow-md">
              {profile.display_name?.[0] || '?'}
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {profile.display_name || profile.username}
                </h1>
                {profile.is_verified && (
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {profile.profile_type && profile.profile_type !== 'user' && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {profileTypeLabels[profile.profile_type] || profile.profile_type}
                  </span>
                )}
              </div>
              {profile.headline && (
                <p className="text-gray-500 text-sm mt-1">{profile.headline}</p>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-gray-500 text-sm mt-4 max-w-2xl">{profile.bio}</p>
          )}

          {/* Stats Row */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-lg font-bold">{posts.length}</p>
              <p className="text-xs text-gray-400">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{profile.follower_count || 0}</p>
              <p className="text-xs text-gray-400">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{profile.following_count || 0}</p>
              <p className="text-xs text-gray-400">Following</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{posts.reduce((sum: number, p: AnyRow) => sum + (p.like_count || 0), 0)}</p>
              <p className="text-xs text-gray-400">Likes</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-4">
            {isOwner ? (
              <>
                <Link href="/discover/new-post" className="btn btn-primary h-9 px-5 text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Create Post
                </Link>
                <Link href="/settings" className="h-9 px-4 border border-gray-300 rounded-lg flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Edit Profile
                </Link>
              </>
            ) : (
              <>
                <button className="btn btn-primary h-9 px-6 text-sm">Follow</button>
                <button className="h-9 w-9 border border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="lg:flex gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Linked Business Card */}
            {linkedBusiness && (
              <section className="mb-8">
                <h2 className="text-lg font-bold mb-3">Linked Business</h2>
                <Link href={`/businesses/${linkedBusiness.slug}`} className="card p-4 block">
                  <h3 className="font-semibold text-sm">{linkedBusiness.display_name}</h3>
                  {linkedBusiness.category && (
                    <span className="badge badge-gray text-xs mt-1">{linkedBusiness.category}</span>
                  )}
                </Link>
              </section>
            )}

            {/* Content Tabs + Masonry Grid */}
            <section className="mb-8">
              <div className="flex items-center gap-1 mb-5">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'notes', label: 'Posts' },
                  { key: 'videos', label: 'Videos' },
                ].map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.key === 'all' ? `/discover/voices/${username}` : `/discover/voices/${username}?tab=${tab.key}`}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                      activeTab === tab.key
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
              {posts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500">No content yet</p>
                </div>
              ) : (
                <MasonryGrid>
                  {posts.map((post, i) => (
                    <DiscoverCard key={post.id} post={post} author={profile} index={i} />
                  ))}
                </MasonryGrid>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">
            {/* Recommended Voices */}
            {recommended.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-sm mb-3">Recommended Creators</h3>
                <div className="space-y-3">
                  {recommended.map((v) => (
                    <Link key={v.id} href={`/discover/voices/${v.username}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm flex-shrink-0">
                        {v.display_name?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.display_name}</p>
                        <p className="text-xs text-gray-400 truncate">{v.headline}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Related Guides placeholder */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-sm mb-3">Related Guides</h3>
              <p className="text-xs text-gray-400">Coming Soon</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
