import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Search · Baam',
    description: 'Search local businesses, news, guides, voices, events',
  };
}

const searchTabs = [
  { key: 'all', label: 'All' },
  { key: 'biz', label: 'Businesses' },
  { key: 'news', label: 'News' },
  { key: 'guides', label: 'Guides' },
  { key: 'forum', label: 'Forum' },
  { key: 'voices', label: 'Voices' },
  { key: 'events', label: 'Events' },
];

interface Props {
  searchParams: Promise<{ q?: string; tab?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = sp.q?.trim() || '';
  const activeTab = sp.tab || 'all';
  const supabase = await createClient();
  const site = await getCurrentSite();
  const t = await getTranslations();

  // Results containers
  let businesses: AnyRow[] = [];
  let news: AnyRow[] = [];
  let guides: AnyRow[] = [];
  let threads: AnyRow[] = [];
  let voices: AnyRow[] = [];
  let events: AnyRow[] = [];

  if (query) {
    const searchPattern = `%${query}%`;

    // Run queries in parallel based on active tab
    const shouldSearch = (tab: string) => activeTab === 'all' || activeTab === tab;

    const promises: PromiseLike<void>[] = [];

    if (shouldSearch('biz')) {
      promises.push(
        supabase
          .from('businesses')
          .select('*')
          .eq('site_id', site.id)
          .eq('status', 'active')
          .or(`display_name.ilike.${searchPattern},display_name_zh.ilike.${searchPattern},short_desc_zh.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
          .order('is_featured', { ascending: false })
          .limit(activeTab === 'all' ? 6 : 20)
          .then(({ data }) => { businesses = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('news')) {
      promises.push(
        supabase
          .from('articles')
          .select('*')
          .eq('site_id', site.id)
          .eq('editorial_status', 'published')
          .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
          .or(`title_zh.ilike.${searchPattern},title_en.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
          .order('published_at', { ascending: false })
          .limit(activeTab === 'all' ? 5 : 20)
          .then(({ data }) => { news = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('guides')) {
      promises.push(
        supabase
          .from('articles')
          .select('*')
          .eq('site_id', site.id)
          .eq('editorial_status', 'published')
          .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'])
          .or(`title_zh.ilike.${searchPattern},title_en.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
          .order('published_at', { ascending: false })
          .limit(activeTab === 'all' ? 5 : 20)
          .then(({ data }) => { guides = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('forum')) {
      promises.push(
        supabase
          .from('forum_threads')
          .select('*')
          .eq('site_id', site.id)
          .eq('status', 'published')
          .or(`title.ilike.${searchPattern},body.ilike.${searchPattern},ai_summary_zh.ilike.${searchPattern}`)
          .order('reply_count', { ascending: false })
          .limit(activeTab === 'all' ? 5 : 20)
          .then(({ data }) => { threads = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('voices')) {
      promises.push(
        supabase
          .from('profiles')
          .select('*')
          .neq('profile_type', 'user')
          .or(`display_name.ilike.${searchPattern},headline.ilike.${searchPattern},username.ilike.${searchPattern}`)
          .order('follower_count', { ascending: false })
          .limit(activeTab === 'all' ? 4 : 20)
          .then(({ data }) => { voices = (data || []) as AnyRow[]; })
      );
    }

    if (shouldSearch('events')) {
      promises.push(
        supabase
          .from('events')
          .select('*')
          .eq('site_id', site.id)
          .eq('status', 'published')
          .or(`title_zh.ilike.${searchPattern},title_en.ilike.${searchPattern},summary_zh.ilike.${searchPattern},venue_name.ilike.${searchPattern}`)
          .order('start_at', { ascending: true })
          .limit(activeTab === 'all' ? 4 : 20)
          .then(({ data }) => { events = (data || []) as AnyRow[]; })
      );
    }

    await Promise.all(promises);
  }

  const totalResults = businesses.length + news.length + guides.length + threads.length + voices.length + events.length;

  // Generate AI search summary (only when results exist, uses fast Haiku model)
  let aiSummary = '';
  if (query && totalResults > 0) {
    try {
      const { generateSearchSummary } = await import('@/lib/ai/claude');
      const resultTypes = [
        { type: 'Businesses', count: businesses.length },
        { type: 'News', count: news.length },
        { type: 'Guides', count: guides.length },
        { type: 'Forum Posts', count: threads.length },
        { type: 'Voices', count: voices.length },
        { type: 'Events', count: events.length },
      ].filter(r => r.count > 0);
      const result = await generateSearchSummary(query, resultTypes);
      aiSummary = result.data;
    } catch {
      // AI summary is optional, don't block search results
    }
  }

  const counts: Record<string, number> = {
    all: totalResults,
    biz: businesses.length,
    news: news.length,
    guides: guides.length,
    forum: threads.length,
    voices: voices.length,
    events: events.length,
  };

  return (
    <main>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4">Search</h1>
          <form className="max-w-2xl">
            <input type="hidden" name="tab" value={activeTab} />
            <div className="flex gap-2">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search businesses, news, guides, voices..."
                className="flex-1 h-11 px-4 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <button type="submit" className="btn btn-primary h-11 px-6 text-sm">Search</button>
            </div>
          </form>
        </div>

        {/* Tab Navigation — now functional links with counts */}
        {query && (
          <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
            {searchTabs.map((tab) => {
              const count = counts[tab.key] || 0;
              const href = tab.key === 'all' ? `/search?q=${encodeURIComponent(query)}` : `/search?q=${encodeURIComponent(query)}&tab=${tab.key}`;

              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-primary text-text-inverse'
                      : 'bg-border-light text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                  {query && count > 0 && <span className="ml-1 text-xs opacity-75">({count})</span>}
                </Link>
              );
            })}
          </div>
        )}

        {/* Results */}
        {!query ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-text-secondary">Enter keywords to start searching</p>
            <p className="text-text-muted text-sm mt-1">Search businesses, news, guides, voices, events</p>
            {/* Popular Searches */}
            <div className="mt-8 max-w-md mx-auto">
              <p className="text-sm text-text-muted mb-3">Popular Searches</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Family Doctor', 'Tax Filing', 'Lawyer', 'Home Repair', 'Movers', 'DMV', 'Childcare', 'Schools'].map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="px-3 py-1.5 text-sm bg-border-light text-text-secondary rounded-full hover:bg-primary/10 hover:text-primary transition"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : totalResults === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">😔</p>
            <p className="text-text-secondary">No results found for "{query}"</p>
            <p className="text-text-muted text-sm mt-1">Try different keywords or browse categories</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* AI Summary */}
            {/* AI Summary */}
            {aiSummary && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-r-lg px-5 py-4">
                <p className="text-xs font-semibold text-blue-600 mb-1">🤖 AI Search Summary</p>
                <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
              </div>
            )}

            {/* Business Results */}
            {businesses.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">🏪 Businesses ({businesses.length})</h2>
                  {activeTab === 'all' && businesses.length >= 6 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=biz`} className="text-sm text-primary hover:underline">View all →</Link>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {businesses.map((biz) => (
                    <Link key={biz.id} href={`/businesses/${biz.slug}`} className="card p-4 block">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">🏢</div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{biz.display_name || biz.name_zh}</h3>
                          {biz.category_name && <span className="text-xs text-text-muted">{biz.category_name}</span>}
                        </div>
                      </div>
                      {biz.avg_rating > 0 && (
                        <div className="flex items-center gap-1 text-xs mb-1">
                          <span className="text-yellow-500">{'★'.repeat(Math.round(biz.avg_rating))}</span>
                          <span className="text-text-muted">{biz.avg_rating?.toFixed(1)} ({biz.review_count || 0})</span>
                        </div>
                      )}
                      {biz.short_desc_zh && <p className="text-xs text-text-muted line-clamp-2">{biz.short_desc_zh}</p>}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* News Results */}
            {news.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">📰 News ({news.length})</h2>
                  {activeTab === 'all' && news.length >= 5 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=news`} className="text-sm text-primary hover:underline">View all →</Link>
                  )}
                </div>
                <div className="space-y-3">
                  {news.map((article) => (
                    <Link key={article.id} href={`/news/${article.slug}`} className="card p-4 block">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{article.title_zh || article.title_en}</h3>
                      {(article.ai_summary_zh || article.summary_zh) && (
                        <p className="text-xs text-text-secondary line-clamp-2">{article.ai_summary_zh || article.summary_zh}</p>
                      )}
                      <span className="text-xs text-text-muted mt-1 block">{article.source_name || ''}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Guide Results */}
            {guides.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">📚 Guides ({guides.length})</h2>
                  {activeTab === 'all' && guides.length >= 5 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=guides`} className="text-sm text-primary hover:underline">View all →</Link>
                  )}
                </div>
                <div className="space-y-3">
                  {guides.map((guide) => (
                    <Link key={guide.id} href={`/guides/${guide.slug}`} className="card p-4 block">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{guide.title_zh || guide.title_en}</h3>
                      {(guide.ai_summary_zh || guide.summary_zh) && (
                        <p className="text-xs text-text-secondary line-clamp-2">{guide.ai_summary_zh || guide.summary_zh}</p>
                      )}
                      {guide.audience_tags && Array.isArray(guide.audience_tags) && (
                        <div className="flex gap-1 mt-1">
                          {guide.audience_tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Forum Results */}
            {threads.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">💬 Forum ({threads.length})</h2>
                  {activeTab === 'all' && threads.length >= 5 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=forum`} className="text-sm text-primary hover:underline">View all →</Link>
                  )}
                </div>
                <div className="space-y-3">
                  {threads.map((thread) => (
                    <Link key={thread.id} href={`/forum/${thread.board_slug || 'general'}/${thread.slug}`} className="card p-4 block">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-1">{thread.title_zh || thread.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span>{thread.author_name || 'Anonymous'}</span>
                        <span>💬 {thread.reply_count || 0}</span>
                        <span>👀 {thread.view_count || 0}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Voices Results */}
            {voices.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">🎙️ Voices ({voices.length})</h2>
                  {activeTab === 'all' && voices.length >= 4 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=voices`} className="text-sm text-primary hover:underline">View all →</Link>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {voices.map((voice) => (
                    <Link key={voice.id} href={`/voices/${voice.username}`} className="card p-4 block">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                          {voice.display_name?.[0] || '?'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate">{voice.display_name || voice.username}</h3>
                          {voice.is_verified && <span className="text-xs text-blue-600">Verified</span>}
                        </div>
                      </div>
                      {voice.headline && <p className="text-xs text-text-secondary line-clamp-2">{voice.headline}</p>}
                      <span className="text-xs text-text-muted mt-1 block">{voice.follower_count || 0} followers</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Events Results */}
            {events.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">🎉 Events ({events.length})</h2>
                  {activeTab === 'all' && events.length >= 4 && (
                    <Link href={`/search?q=${encodeURIComponent(query)}&tab=events`} className="text-sm text-primary hover:underline">View all →</Link>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {events.map((event) => {
                    const startDate = event.start_at ? new Date(event.start_at) : null;
                    const dateStr = startDate ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                    return (
                      <Link key={event.id} href={`/events/${event.slug}`} className="card p-4 block">
                        <h3 className="font-semibold text-sm mb-1 line-clamp-2">{event.title_zh || event.title_en || event.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          {dateStr && <span>📅 {dateStr}</span>}
                          {event.venue_name && <span>📍 {event.venue_name}</span>}
                          {event.is_free && <span className="badge badge-green text-xs">Free</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
