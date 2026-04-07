import { Link } from '@/lib/i18n/routing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const gradients = [
  'from-rose-200 via-pink-100 to-orange-100',
  'from-emerald-200 via-teal-100 to-cyan-50',
  'from-violet-200 via-purple-100 to-pink-50',
  'from-sky-200 via-blue-100 to-indigo-50',
  'from-amber-200 via-yellow-100 to-orange-100',
];

interface RelatedPostsProps {
  posts: AnyRow[];
  title?: string;
}

export function RelatedDiscoverPosts({ posts, title = 'Related Posts' }: RelatedPostsProps) {
  if (!posts.length) return null;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        {posts.map((post, i) => {
          const coverImage = post.cover_images?.[0] || post.cover_image_url;
          const authorName = post.profiles?.display_name || post.author_name || 'Anonymous';
          return (
            <Link
              key={post.id}
              href={`/discover/${post.slug || post.id}`}
              className="flex-shrink-0 w-40 group"
            >
              <div className="rounded-xl overflow-hidden bg-white border border-gray-200 hover:shadow-md transition-shadow">
                <div className="aspect-[3/4] overflow-hidden">
                  {coverImage ? (
                    <img src={coverImage} alt={post.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                      <span className="text-white/50 text-2xl font-bold">{post.title?.[0] || '📝'}</span>
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 mb-1.5 leading-snug">{post.title}</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 truncate">{authorName}</span>
                    <span className="text-[10px] text-gray-300 ml-auto">{post.like_count || 0}</span>
                    <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Compact version for embedding in business/guide detail pages
 */
export function DiscoverPostsSection({ posts, title = 'Community Posts' }: RelatedPostsProps) {
  if (!posts.length) return null;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>📝</span> {title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {posts.slice(0, 6).map((post, i) => {
          const coverImage = post.cover_images?.[0] || post.cover_image_url;
          const authorName = post.profiles?.display_name || 'Anonymous';
          return (
            <Link
              key={post.id}
              href={`/discover/${post.slug || post.id}`}
              className="group"
            >
              <div className="rounded-xl overflow-hidden bg-white border border-gray-200 hover:shadow-md transition-shadow">
                <div className="aspect-[4/3] overflow-hidden">
                  {coverImage ? (
                    <img src={coverImage} alt={post.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                      <span className="text-white/50 text-xl font-bold">{post.title?.[0] || '📝'}</span>
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 mb-1 leading-snug">{post.title}</h3>
                  <span className="text-[10px] text-gray-400">{authorName}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <Link href="/discover" className="block text-center text-sm text-primary font-medium mt-3 hover:underline">
        View More Posts &rarr;
      </Link>
    </section>
  );
}
