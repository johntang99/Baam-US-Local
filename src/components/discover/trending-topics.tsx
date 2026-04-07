import { Link } from '@/lib/i18n/routing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface TrendingTopicsProps {
  topics: AnyRow[];
}

export function TrendingTopics({ topics }: TrendingTopicsProps) {
  if (!topics.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
      {topics.map((topic) => (
        <Link
          key={topic.id}
          href={`/discover?topic=${topic.slug}`}
          className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors ${
            topic.is_featured
              ? 'bg-orange-50 text-orange-600 border border-orange-200'
              : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
          }`}
        >
          {topic.is_featured && (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" />
            </svg>
          )}
          {topic.icon_emoji && <span>{topic.icon_emoji}</span>}
          {topic.name_zh}
        </Link>
      ))}
    </div>
  );
}

interface TrendingSidebarProps {
  topics: AnyRow[];
}

export function TrendingSidebar({ topics }: TrendingSidebarProps) {
  if (!topics.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-[14px] p-5">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
          <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" />
        </svg>
        Trending Topics
      </h3>
      <div className="space-y-3">
        {topics.slice(0, 5).map((topic, i) => (
          <Link
            key={topic.id}
            href={`/discover?topic=${topic.slug}`}
            className="flex items-center gap-3 group"
          >
            <span className={`w-6 h-6 text-xs font-bold rounded-md flex items-center justify-center ${
              i < 3 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 group-hover:text-primary transition truncate">
                #{topic.name_zh}
              </p>
              <p className="text-xs text-gray-400">{formatViews(topic.post_count || 0)} views</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

interface WeeklyPicksProps {
  posts: AnyRow[];
}

export function WeeklyPicks({ posts }: WeeklyPicksProps) {
  if (!posts.length) return null;

  const gradients = [
    'from-emerald-200 to-teal-100',
    'from-sky-200 to-blue-100',
    'from-violet-200 to-purple-100',
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-[14px] p-5">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        This Week's Picks
      </h3>
      <div className="space-y-3">
        {posts.slice(0, 3).map((post, i) => {
          const coverImage = post.cover_images?.[0] || post.cover_image_url;
          return (
            <Link
              key={post.id}
              href={`/discover/${post.slug || post.id}`}
              className="flex gap-3 group"
            >
              <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden">
                {coverImage ? (
                  <img src={coverImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradients[i % gradients.length]}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-primary transition">
                  {post.title}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatViews(post.like_count || 0)} likes · {formatViews(post.save_count || 0)} saves
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function formatViews(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
