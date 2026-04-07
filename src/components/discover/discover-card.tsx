import { Link } from '@/lib/i18n/routing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const gradients = [
  'from-rose-200 via-pink-100 to-orange-100',
  'from-blue-200 via-cyan-100 to-teal-100',
  'from-amber-200 via-yellow-100 to-orange-100',
  'from-emerald-200 via-teal-100 to-cyan-50',
  'from-violet-200 via-purple-100 to-pink-50',
  'from-indigo-200 via-blue-100 to-violet-50',
  'from-fuchsia-200 via-pink-100 to-rose-50',
  'from-lime-200 via-green-100 to-emerald-50',
  'from-sky-200 via-blue-100 to-indigo-50',
  'from-teal-200 via-emerald-100 to-green-50',
];

const avatarColors = [
  'bg-pink-100 text-pink-600',
  'bg-purple-100 text-purple-600',
  'bg-green-100 text-green-600',
  'bg-orange-100 text-orange-600',
  'bg-sky-100 text-sky-600',
  'bg-amber-100 text-amber-600',
  'bg-red-100 text-red-600',
  'bg-indigo-100 text-indigo-600',
  'bg-teal-100 text-teal-600',
  'bg-fuchsia-100 text-fuchsia-600',
];

interface DiscoverCardProps {
  post: AnyRow;
  author?: AnyRow;
  index?: number;
}

export function DiscoverCard({ post, author, index = 0 }: DiscoverCardProps) {
  const postType = post.post_type as string;
  const isVideo = postType === 'video';
  const coverImages = post.cover_images as string[] | null;
  const coverImage = coverImages?.[0] || post.cover_image_url || post.video_thumbnail_url;
  const hasImage = !!coverImage;
  const gradient = gradients[index % gradients.length];
  const avatarColor = avatarColors[index % avatarColors.length];

  const authorProfile = author || post.profiles || post.author;
  const authorName = authorProfile?.display_name || authorProfile?.username || 'Anonymous';
  const authorInitial = authorName[0] || '?';
  const likeCount = post.like_count || 0;

  const href = `/discover/${post.slug || post.id}`;

  return (
    <Link href={href} className="block break-inside-avoid mb-3 sm:mb-4">
      <div className="bg-white rounded-[14px] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
        {/* Cover */}
        <div className="relative">
          {hasImage ? (
            <img
              src={coverImage}
              alt={post.title || ''}
              className="w-full block"
              loading="lazy"
            />
          ) : (
            <div
              className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
              style={{ aspectRatio: '3/4' }}
            >
              <span className="text-white/50 text-5xl font-bold">
                {post.title?.[0] || '📝'}
              </span>
            </div>
          )}

          {/* Video overlay */}
          {isVideo && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
              </div>
              {post.video_duration_seconds && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] px-1.5 py-0.5 rounded flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                  {formatDuration(post.video_duration_seconds)}
                </div>
              )}
            </>
          )}

          {/* Multi-image badge */}
          {coverImages && coverImages.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
              </svg>
              {coverImages.length}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          {post.title && (
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2 leading-snug">
              {post.title}
            </h3>
          )}

          {/* Blog excerpt when no image */}
          {!hasImage && !isVideo && post.content && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2">
              {post.content.slice(0, 80)}
            </p>
          )}

          {/* Author + Likes */}
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full ${avatarColor} flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>
              {authorInitial}
            </div>
            <span className="text-xs text-gray-500 truncate flex-1">
              {authorName}
            </span>
            <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{formatCount(likeCount)}</span>
            {likeCount > 0 ? (
              <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
