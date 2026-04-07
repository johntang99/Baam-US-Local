import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getCurrentUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { FollowButton, LikeButton, CommentForm } from '@/components/shared/social-actions';
import { ImageCarousel } from '@/components/discover/image-carousel';
import { RelatedDiscoverPosts } from '@/components/discover/related-posts';
import { DiscoverCard } from '@/components/discover/discover-card';
import { PostActions } from '@/components/discover/post-actions';
import { LayoutToggle } from '@/components/discover/layout-toggle';
import { formatTimeAgo } from '@/lib/utils';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ layout?: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const supabase = await createClient();
  const site = await getCurrentSite();

  const { data: postData } = await supabase
    .from('voice_posts')
    .select('title, content, author_id')
    .eq('slug', decodedSlug)
    .eq('site_id', site.id)
    .eq('status', 'published')
    .single();

  const post = postData as AnyRow | null;
  if (!post) return { title: 'Not Found' };

  const { data: authorData } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', post.author_id)
    .single();

  const authorName = (authorData as AnyRow | null)?.display_name || '';

  return {
    title: `${post.title} · ${authorName} · Baam`,
    description: post.content?.slice(0, 160) || '',
    openGraph: {
      title: post.title || '',
      description: post.content?.slice(0, 160) || '',
    },
  };
}

export default async function DiscoverPostDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { layout } = await searchParams;
  const isClassic = layout === 'classic';

  const supabase = await createClient();
  const site = await getCurrentSite();
  const currentUser = await getCurrentUser().catch(() => null);

  const decodedSlug = decodeURIComponent(slug);

  // Fetch post (include pending_review so authors can see their moderated posts)
  const { data: postData, error: postError } = await supabase
    .from('voice_posts')
    .select('*')
    .eq('slug', decodedSlug)
    .eq('site_id', site.id)
    .in('status', ['published', 'pending_review'])
    .single();

  const post = postData as AnyRow | null;
  if (postError || !post) notFound();

  // Fetch author profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', post.author_id)
    .single();

  const profile = (profileData || {}) as AnyRow;
  const username = profile.username || '';

  // Fetch comments with author profiles
  const { data: rawComments } = await supabase
    .from('voice_post_comments')
    .select('*, profiles:author_id(display_name, username, avatar_url)')
    .eq('post_id', post.id)
    .eq('site_id', site.id)
    .order('created_at', { ascending: true });

  const comments = (rawComments || []) as AnyRow[];

  // Fetch linked businesses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLinkedBiz } = await (supabase as any)
    .from('discover_post_businesses')
    .select('*, businesses(*)')
    .eq('post_id', post.id)
    .order('sort_order', { ascending: true });

  const linkedBusinesses = (rawLinkedBiz || []) as AnyRow[];

  // Fetch more posts from same author
  const { data: rawMorePosts } = await supabase
    .from('voice_posts')
    .select('*')
    .eq('author_id', post.author_id)
    .eq('site_id', site.id)
    .eq('status', 'published')
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(4);

  const morePosts = (rawMorePosts || []) as AnyRow[];

  // Fetch related posts by matching topic_tags
  let relatedPosts: AnyRow[] = [];
  const postTags = post.topic_tags as string[] | null;
  if (postTags && postTags.length > 0) {
    const { data: rawRelated } = await supabase
      .from('voice_posts')
      .select('*, profiles!voice_posts_author_id_fkey(display_name)')
      .eq('site_id', site.id)
      .eq('status', 'published')
      .neq('id', post.id)
      .neq('author_id', post.author_id)
      .overlaps('topic_tags', postTags)
      .order('like_count', { ascending: false })
      .limit(6);
    relatedPosts = (rawRelated || []) as AnyRow[];
  }

  // Fetch related guides (new layout only, but fetch always for toggle)
  let relatedGuides: AnyRow[] = [];
  if (postTags && postTags.length > 0) {
    const { data: rawGuides } = await supabase
      .from('articles')
      .select('id, slug, title_zh, cover_image_url, view_count, category')
      .eq('site_id', site.id)
      .eq('status', 'published')
      .eq('article_type', 'guide')
      .overlaps('tags', postTags)
      .order('view_count', { ascending: false })
      .limit(4);
    relatedGuides = (rawGuides || []) as AnyRow[];
  }

  const coverImages = (post.cover_images as string[] | null) || (post.cover_image_url ? [post.cover_image_url] : []);
  const isVideo = post.post_type === 'video';

  const isPendingReview = post.status === 'pending_review';

  const authorName = profile.display_name || username || 'Anonymous';
  const avatarGradients = ['from-pink-200 to-rose-300', 'from-blue-200 to-indigo-300', 'from-green-200 to-emerald-300', 'from-amber-200 to-orange-300'];
  const avatarTextColors = ['text-rose-600', 'text-indigo-600', 'text-emerald-600', 'text-orange-600'];

  /* ================================================================
   *  CLASSIC LAYOUT — single-column centered (original design)
   * ================================================================ */
  if (isClassic) {
    return (
      <main>
        <LayoutToggle />
        <div className="max-w-4xl mx-auto px-4 py-6">
          {isPendingReview && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              This post is under review and will appear on Discover once approved.
            </div>
          )}
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-400 mb-4">
            <Link href="/discover" className="hover:text-primary">Discover</Link>
            <span className="mx-2">›</span>
            {username && (
              <>
                <Link href={`/discover/voices/${username}`} className="hover:text-primary">
                  {profile.display_name || username}
                </Link>
                <span className="mx-2">›</span>
              </>
            )}
            <span className="text-gray-600">{post.title}</span>
          </nav>

          {/* Author Card */}
          <div className="flex items-center gap-3 mb-6">
            {username ? (
              <Link href={`/discover/voices/${username}`}>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                  {profile.display_name?.[0] || '?'}
                </div>
              </Link>
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">?</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {username ? (
                  <Link href={`/discover/voices/${username}`} className="font-semibold text-sm hover:text-primary">
                    {profile.display_name || username}
                  </Link>
                ) : (
                  <span className="font-semibold text-sm">Anonymous</span>
                )}
                {profile.is_verified && (
                  <span className="badge badge-blue text-xs">Verified</span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {formatTimeAgo(post.published_at)} · {post.view_count || 0} views
              </p>
            </div>
            {currentUser?.id === post.author_id ? (
              <PostActions postId={post.id} postSlug={post.slug} />
            ) : profile.id ? (
              <FollowButton profileId={profile.id} isFollowing={false} isLoggedIn={!!currentUser} className="h-8 px-4 text-xs rounded-lg" />
            ) : null}
          </div>

          {/* Image Carousel / Video Player */}
          {isVideo && post.video_url ? (
            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
              <video
                src={post.video_url}
                poster={post.video_thumbnail_url || undefined}
                controls
                className="w-full h-full object-contain"
              />
            </div>
          ) : coverImages.length > 0 ? (
            <div className="rounded-xl overflow-hidden mb-6 bg-gray-50">
              <div className="relative max-h-[600px]">
                <ImageCarousel images={coverImages} title={post.title} />
              </div>
            </div>
          ) : null}

          {/* Post Header */}
          <header className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              {post.post_type && (
                <span className="badge badge-purple text-xs">{post.post_type}</span>
              )}
              {post.location_text && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  {post.location_text}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{post.title}</h1>
          </header>

          {/* Post Body */}
          {(post.body || post.content) && (
            <div className="mb-8 text-[15px] text-gray-800 leading-[1.8] whitespace-pre-wrap break-words">
              {post.body || post.content}
            </div>
          )}

          {/* Tags */}
          {post.topic_tags && post.topic_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {post.topic_tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/discover?topic=${encodeURIComponent(tag)}`}
                  className="text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full hover:bg-orange-100"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-4 py-4 border-t border-b border-gray-200 mb-8">
            <LikeButton postId={post.id} isLiked={false} likeCount={post.like_count || 0} isLoggedIn={!!currentUser} />
            <span className="text-sm text-gray-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
              {post.save_count || 0} saves
            </span>
            <span className="text-sm text-gray-400">💬 {comments.length} comments</span>
          </div>

          {/* Linked Businesses */}
          {linkedBusinesses.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-3">Related Businesses</h2>
              <div className="space-y-3">
                {linkedBusinesses.map((link) => {
                  const biz = link.businesses as AnyRow;
                  if (!biz) return null;
                  return (
                    <Link key={link.id} href={`/businesses/${biz.slug}`} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center text-xl">
                        {biz.display_name_zh?.[0] || biz.display_name?.[0] || '🏪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{biz.display_name_zh || biz.display_name}</h3>
                        {biz.short_desc_zh && <p className="text-xs text-gray-400 truncate">{biz.short_desc_zh}</p>}
                      </div>
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Comments */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">Comments ({comments.length})</h2>
            {comments.length > 0 && (
              <div className="space-y-4 mb-4">
                {comments.map((comment) => {
                  const commentAuthor = comment.profiles?.display_name || 'Anonymous';
                  return (
                    <div key={comment.id} className="card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs flex-shrink-0">
                          {commentAuthor[0]}
                        </div>
                        <span className="text-sm font-medium">{commentAuthor}</span>
                        {comment.created_at && (
                          <span className="text-xs text-gray-400">
                            {formatTimeAgo(comment.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 pl-9">{comment.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <CommentForm postId={post.id} isLoggedIn={!!currentUser} />
          </section>

          {/* Related Posts */}
          <RelatedDiscoverPosts posts={relatedPosts} title="Related Posts" />

          {/* More from Author */}
          {morePosts.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-4">More from {profile.display_name || username || 'Author'}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {morePosts.map((p, i) => (
                  <DiscoverCard key={p.id} post={p} author={profile} index={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }

  /* ================================================================
   *  NEW LAYOUT — 2-column xiaohongshu style (media left | content right)
   * ================================================================ */
  const INITIAL_COMMENTS = 5;
  const hasMoreComments = comments.length > INITIAL_COMMENTS;

  return (
    <main className="bg-white min-h-screen">
      <LayoutToggle />

      <div className="max-w-7xl mx-auto lg:flex lg:min-h-[calc(100vh-64px)]">

        {/* ===== LEFT: Media Column (sticky on desktop) ===== */}
        <div className="relative lg:w-[55%] lg:flex-shrink-0 lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:overflow-hidden bg-black flex items-center justify-center">
          {isVideo && post.video_url ? (
            <video
              src={post.video_url}
              poster={post.video_thumbnail_url || undefined}
              controls
              className="w-full h-full object-contain"
            />
          ) : coverImages.length > 0 ? (
            <ImageCarousel images={coverImages} title={post.title} />
          ) : (
            <div className="w-full aspect-[4/3] lg:aspect-auto lg:h-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
              <span className="text-6xl text-gray-300">{post.title?.[0] || '📝'}</span>
            </div>
          )}
          {/* Back button overlay */}
          <Link href="/discover" className="absolute top-4 left-4 w-9 h-9 bg-black/30 text-white rounded-full flex items-center justify-center hover:bg-black/50 backdrop-blur-sm z-10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
        </div>

        {/* ===== RIGHT: Content Column (scrollable on desktop) ===== */}
        <div className="lg:w-[45%] lg:overflow-y-auto lg:h-[calc(100vh-64px)]">
          <div className="px-5 sm:px-6 py-5">

            {isPendingReview && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                This post is under review and will appear on Discover once approved.
              </div>
            )}

            {/* Author Card */}
            <div className="flex items-center gap-3 mb-5">
              <Link href={username ? `/discover/voices/${username}` : '#'} className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradients[0]} flex items-center justify-center text-sm font-bold ${avatarTextColors[0]} flex-shrink-0`}>
                  {authorName[0]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[15px] text-gray-900">{authorName}</span>
                    {profile.is_verified && (
                      <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {post.published_at ? formatTimeAgo(post.published_at) : ''}
                    {post.location_text && ` · ${post.location_text}`}
                  </span>
                </div>
              </Link>
              {currentUser?.id === post.author_id ? (
                <PostActions postId={post.id} postSlug={post.slug} />
              ) : profile.id ? (
                <button className="px-5 py-2 text-sm font-semibold text-white bg-red-500 rounded-full hover:bg-red-600 transition flex-shrink-0">+ Follow</button>
              ) : null}
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-gray-900 mb-4 leading-snug">{post.title}</h1>

            {/* Body */}
            {(post.body || post.content) && (
              <div className="text-[14px] text-gray-700 leading-[1.9] whitespace-pre-wrap break-words mb-5">
                {post.body || post.content}
              </div>
            )}

            {/* Tags */}
            {post.topic_tags && post.topic_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {post.topic_tags.map((tag: string) => (
                  <Link key={tag} href={`/discover/tag/${encodeURIComponent(tag)}`}
                    className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-[13px] text-gray-600 hover:bg-orange-50 hover:text-primary transition">
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            <div className="border-b border-gray-100 mb-5" />

            {/* Action Bar */}
            <div className="flex items-center justify-around py-2 mb-6 border-b border-gray-100">
              <LikeButton postId={post.id} isLiked={false} likeCount={post.like_count || 0} isLoggedIn={!!currentUser} />
              <button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-gray-50 transition">
                <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                <span className="text-xs text-gray-500">{post.save_count || 0}</span>
              </button>
              <button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-gray-50 transition">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                <span className="text-xs text-gray-500">Share</span>
              </button>
              <button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-gray-50 transition">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                <span className="text-xs text-gray-500">{comments.length}</span>
              </button>
            </div>

            {/* Related Businesses */}
            {linkedBusinesses.length > 0 && (
              <section className="mb-6 pb-5 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  Related Businesses
                </h3>
                <div className="space-y-2">
                  {linkedBusinesses.map((link) => {
                    const biz = link.businesses as AnyRow;
                    if (!biz) return null;
                    return (
                      <Link key={link.id} href={`/businesses/${biz.slug}`} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:border-orange-200 hover:shadow-sm transition group">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-xl flex-shrink-0">
                          {biz.display_name_zh?.[0] || biz.display_name?.[0] || '🏪'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 group-hover:text-primary transition">{biz.display_name_zh || biz.display_name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {biz.avg_rating && (
                              <div className="flex items-center gap-0.5">
                                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                <span className="text-xs text-gray-600 font-medium">{biz.avg_rating}</span>
                              </div>
                            )}
                            {biz.address_full && <span className="text-xs text-gray-400 truncate">· {biz.address_full}</span>}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Related Guides */}
            {relatedGuides.length > 0 && (
              <section className="mb-6 pb-5 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Related Guides
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedGuides.map((guide) => (
                    <Link key={guide.id} href={`/guides/${guide.slug}`} className="flex gap-3 p-3 bg-gray-50 rounded-xl hover:bg-orange-50 transition group">
                      {guide.cover_image_url ? (
                        <img src={guide.cover_image_url} alt={guide.title_zh || ''} className="w-20 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-16 rounded-lg bg-gradient-to-br from-amber-200 to-orange-100 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-primary transition">{guide.title_zh}</p>
                        <p className="text-xs text-gray-400 mt-1">{guide.category || 'Living Guide'} · {(guide.view_count || 0).toLocaleString()} reads</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Ask AI */}
            <section className="mb-6 pb-5 border-b border-gray-100">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-900">Want to know more? Ask AI</p>
                  <p className="text-xs text-blue-700/70">e.g. "Best pizza in Middletown"</p>
                </div>
                <Link href="/ask" className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition flex-shrink-0">
                  Ask AI
                </Link>
              </div>
            </section>

            {/* Comments */}
            <section className="mb-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">Comments ({comments.length})</h3>
              <CommentForm postId={post.id} isLoggedIn={!!currentUser} />
              {comments.length > 0 && (
                <div className="space-y-5 mt-5">
                  {comments.slice(0, INITIAL_COMMENTS).map((comment, ci) => {
                    const commentAuthor = comment.profiles?.display_name || 'Anonymous';
                    const isPostAuthor = comment.author_id === post.author_id;
                    const grad = avatarGradients[(ci + 1) % avatarGradients.length];
                    const textCol = avatarTextColors[(ci + 1) % avatarTextColors.length];
                    return (
                      <div key={comment.id} className="flex gap-3">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-[10px] font-bold ${textCol} flex-shrink-0`}>
                          {commentAuthor[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">{commentAuthor}</span>
                            {isPostAuthor && (
                              <span className="text-[10px] text-primary bg-orange-50 px-1.5 py-0.5 rounded">Author</span>
                            )}
                            {comment.created_at && (
                              <span className="text-[11px] text-gray-400">{formatTimeAgo(comment.created_at)}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                              Like
                            </button>
                            <button className="text-xs text-gray-400 hover:text-gray-600 transition">Reply</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {hasMoreComments && (
                <button className="w-full mt-5 py-3 text-sm text-gray-500 hover:text-primary font-medium transition">
                  View all {comments.length} comments
                  <svg className="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              )}
            </section>

            {/* More from Author */}
            {morePosts.length > 0 && (
              <section className="mb-6 pb-5 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-3">More from {authorName}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {morePosts.slice(0, 3).map((p, i) => {
                    const img = p.cover_images?.[0] || p.cover_image_url;
                    return (
                      <Link key={p.id} href={`/discover/${p.slug || p.id}`} className="group">
                        <div className="aspect-square rounded-lg overflow-hidden">
                          {img ? (
                            <img src={img} alt={p.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${avatarGradients[(i + 2) % avatarGradients.length]} flex items-center justify-center`}>
                              <span className="text-white/50 text-lg font-bold">{p.title?.[0] || '📝'}</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Related Posts */}
            <RelatedDiscoverPosts posts={relatedPosts} title="Related Posts" />
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2.5 z-40 flex items-center gap-3">
        <div className="flex-1 flex items-center">
          <input type="text" placeholder="Write a comment..." className="w-full h-9 pl-4 pr-3 bg-gray-100 rounded-full text-sm text-gray-600 outline-none" readOnly />
        </div>
        <LikeButton postId={post.id} isLiked={false} likeCount={post.like_count || 0} isLoggedIn={!!currentUser} />
        <button className="text-gray-500">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
        </button>
        <button className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        </button>
        <button className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </button>
      </div>
    </main>
  );
}
