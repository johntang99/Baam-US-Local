import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { NewsletterForm } from '@/components/shared/newsletter-form';
import { getCurrentSite } from '@/lib/sites';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

// News vertical badges
const verticalBadge: Record<string, { label: string; cls: string }> = {
  news_alert: { label: 'Alert', cls: 'bg-red-100 text-red-700' },
  news_brief: { label: 'Policy', cls: 'bg-blue-100 text-blue-700' },
  news_explainer: { label: 'Explainer', cls: 'bg-purple-100 text-purple-700' },
  news_roundup: { label: 'Roundup', cls: 'bg-primary-100 text-primary-700' },
  news_community: { label: 'Community', cls: 'bg-green-100 text-green-700' },
};

// Guide type badges
const guideBadge: Record<string, { label: string; cls: string }> = {
  guide_howto: { label: 'How-To', cls: 'bg-blue-100 text-blue-700' },
  guide_checklist: { label: 'Checklist', cls: 'bg-green-100 text-green-700' },
  guide_bestof: { label: 'Best-of', cls: 'bg-yellow-100 text-yellow-700' },
  guide_comparison: { label: 'Compare', cls: 'bg-purple-100 text-purple-700' },
  guide_scenario: { label: 'Scenario', cls: 'bg-primary-100 text-primary-700' },
};

const guideGradients = [
  'from-blue-100 to-blue-200', 'from-green-100 to-green-200',
  'from-purple-100 to-purple-200', 'from-orange-100 to-orange-200',
];
const guideEmojis: Record<string, string> = {
  guide_howto: '📝', guide_checklist: '✅', guide_bestof: '🏆',
  guide_comparison: '⚖️', guide_scenario: '🎭',
};

// Forum board badge colors
const boardBadge: Record<string, { cls: string }> = {
  'forum-general': { cls: 'bg-gray-100 text-gray-700' },
  'forum-food': { cls: 'bg-primary-100 text-primary-700' },
  'forum-food-en': { cls: 'bg-primary-100 text-primary-700' },
  'forum-housing': { cls: 'bg-blue-100 text-blue-700' },
  'forum-housing-en': { cls: 'bg-blue-100 text-blue-700' },
  'forum-health-en': { cls: 'bg-green-100 text-green-700' },
  'forum-schools': { cls: 'bg-purple-100 text-purple-700' },
  'forum-jobs-en': { cls: 'bg-yellow-100 text-yellow-700' },
  'forum-buy-sell': { cls: 'bg-cyan-100 text-cyan-700' },
  'forum-local-news': { cls: 'bg-red-100 text-red-700' },
  'forum-events-en': { cls: 'bg-primary-100 text-primary-700' },
  'forum-parents': { cls: 'bg-pink-100 text-pink-700' },
  'forum-recommendations': { cls: 'bg-yellow-100 text-yellow-700' },
  'forum-complaints': { cls: 'bg-red-100 text-red-700' },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(ms / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(ms / 86400000);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function HomePage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const site = await getCurrentSite();
  const regionIds = site.regionIds;

  // Region filter helper for articles, events, forum
  const withRegion = (query: ReturnType<typeof supabase.from>, col = 'region_id') => {
    if (regionIds.length > 0) return query.in(col, regionIds);
    return query;
  };

  const [
    { data: rNews }, { data: rGuides }, { data: rBiz },
    { data: rThreads }, { data: rEvents },
    { data: rBoardsEn },
  ] = await Promise.all([
    withRegion(supabase.from('articles').select('*').eq('site_id', site.id).in('content_vertical', ['news_alert','news_brief','news_explainer','news_roundup','news_community']).eq('editorial_status', 'published')).order('published_at', { ascending: false }).limit(3),
    withRegion(supabase.from('articles').select('*').eq('site_id', site.id).in('content_vertical', ['guide_howto','guide_checklist','guide_bestof','guide_comparison','guide_scenario']).eq('editorial_status', 'published')).order('view_count', { ascending: false }).limit(4),
    // Businesses: use site_id directly — simple and fast
    supabase.from('businesses').select('*').eq('site_id', site.id).eq('is_active', true).eq('status', 'active').not('avg_rating', 'is', null).order('is_featured', { ascending: false }).order('total_score', { ascending: false, nullsFirst: false }).limit(6),
    withRegion(supabase.from('forum_threads').select('*').eq('site_id', site.id).eq('status', 'published')).order('reply_count', { ascending: false }).limit(5),
    withRegion(supabase.from('events').select('*').eq('site_id', site.id).eq('status', 'published')).order('start_at', { ascending: true }).limit(4),
    supabase.from('categories_forum').select('id, slug, name_zh, name_en').eq('site_scope', 'en'),
  ]);

  const news = (rNews || []) as AnyRow[];
  const guides = (rGuides || []) as AnyRow[];

  const businesses = (rBiz || []) as AnyRow[];
  const threads = (rThreads || []) as AnyRow[];
  const events = (rEvents || []) as AnyRow[];
  let boards = (rBoardsEn || []) as AnyRow[];
  if (boards.length === 0) {
    const { data: rBoardsZh } = await supabase.from('categories_forum').select('id, slug, name_zh, name_en').eq('site_scope', 'zh');
    boards = (rBoardsZh || []) as AnyRow[];
  }

  const boardMap: Record<string, AnyRow> = {};
  boards.forEach(b => boardMap[b.id] = b);

  return (
    <main>
      {/* ==================== HERO ==================== */}
      <section className="bg-gradient-to-br from-primary via-blue-600 to-blue-800 text-white py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t('home.heroTitle')}</h1>
          <p className="text-blue-100 mb-8 text-lg">{t('home.heroSubtitle')}</p>
          <form action="/en/ask" className="relative max-w-2xl mx-auto">
            <input type="text" name="q" placeholder={t('home.searchPlaceholder')} className="w-full h-14 pl-5 pr-14 rounded-xl bg-white text-gray-900 text-base shadow-lg border-0 focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400" />
            <button type="submit" className="absolute right-2 top-2 w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-dark transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>
          </form>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {['Restaurants', 'Auto Repair', 'Dentist', 'Weekend Events', 'Home Services'].map(tag => (
              <Link key={tag} href={`/ask?q=${encodeURIComponent(tag)}`} className="px-4 py-1.5 bg-white/20 text-white text-sm rounded-full cursor-pointer hover:bg-white/30 transition">{tag}</Link>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-10 space-y-14">

        {/* ==================== LATEST NEWS ==================== */}
        {news.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">📰</span> {t('home.todayNews')}
              </h2>
              <Link href="/news" className="text-sm text-primary font-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {news.map((a) => {
                const badge = verticalBadge[a.content_vertical] || { label: 'News', cls: 'bg-gray-100 text-gray-600' };
                return (
                  <Link key={a.id} href={`/news/${a.slug}`} className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-primary/30 transition-all block">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                      <span className="text-xs text-gray-400">{timeAgo(a.published_at)}</span>
                    </div>
                    <h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">{a.title_en || a.title_zh}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{a.summary_en || a.ai_summary_zh || a.summary_zh}</p>
                    {a.source_name && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Source</span>
                        <span className="text-xs text-gray-400">{a.source_name}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== POPULAR GUIDES ==================== */}
        {guides.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">📚</span> {t('home.hotGuides')}
              </h2>
              <Link href="/guides" className="text-sm text-primary font-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {guides.map((g, i) => {
                const gBadge = guideBadge[g.content_vertical] || { label: 'Guide', cls: 'bg-gray-100 text-gray-600' };
                const gradient = guideGradients[i % guideGradients.length];
                const emoji = guideEmojis[g.content_vertical] || '📚';
                return (
                  <Link key={g.id} href={`/guides/${g.slug}`} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all block">
                    <div className={`h-40 bg-gradient-to-br ${gradient} flex items-center justify-center text-4xl`}>{emoji}</div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${gBadge.cls}`}>{gBadge.label}</span>
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">{g.title_en || g.title_zh}</h3>
                      <p className="text-xs text-gray-400">{Math.ceil((g.body_en?.length || g.body_zh?.length || 500) / 400)} min read</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== UPCOMING EVENTS ==================== */}
        {events.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">🎪</span> {t('home.weekendEvents')}
              </h2>
              <Link href="/events" className="text-sm text-primary font-medium hover:underline">{t('home.viewAll')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {events.map((e, i) => {
                const gradient = ['from-red-100 to-pink-200', 'from-blue-100 to-cyan-200', 'from-green-100 to-emerald-200', 'from-purple-100 to-violet-200'][i % 4];
                const emoji = ['🎆', '📚', '🎨', '🏃'][i % 4];
                const startDate = e.start_at ? new Date(e.start_at) : null;
                return (
                  <Link key={e.id} href={`/events/${e.slug}`} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all block">
                    <div className={`h-36 bg-gradient-to-br ${gradient} flex items-center justify-center text-3xl`}>{emoji}</div>
                    <div className="p-4">
                      {startDate && (
                        <p className="text-xs text-primary font-semibold mb-1">
                          {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' · '}
                          {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">{e.title_en || e.title_zh}</h3>
                      <p className="text-xs text-gray-400">{e.venue_name} · {e.is_free ? 'Free' : e.ticket_price || 'Paid'}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== FEATURED BUSINESSES ==================== */}
        {businesses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">🏪</span> {t('home.recommendedBusinesses')}
              </h2>
              <Link href="/businesses" className="text-sm text-primary font-medium hover:underline">{t('home.browseDirectory')} →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {businesses.map((biz) => (
                <Link key={biz.id} href={`/businesses/${biz.slug}`} className={`group bg-white rounded-xl border p-5 hover:shadow-lg transition-all block ${biz.is_featured ? 'border-2 border-primary relative' : 'border-gray-200 hover:border-primary/30'}`}>
                  {biz.is_featured && (
                    <span className="absolute top-3 right-0 bg-primary text-white text-xs font-semibold px-3 py-1 rounded-l-md shadow-sm">Featured</span>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex-shrink-0 flex items-center justify-center text-xl font-bold text-blue-700">
                      {(biz.display_name || biz.display_name_zh)?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{biz.display_name || biz.display_name_zh}</h3>
                        {biz.verification_status === 'verified' && (
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        )}
                      </div>
                      {biz.avg_rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-yellow-500 text-xs">{'★'.repeat(Math.round(Number(biz.avg_rating)))}</span>
                          <span className="text-xs text-gray-500">{Number(biz.avg_rating).toFixed(1)} ({biz.review_count} reviews)</span>
                        </div>
                      )}
                      {biz.ai_tags && (biz.ai_tags as string[]).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(biz.ai_tags as string[]).slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2 line-clamp-2">{biz.short_desc_en || biz.short_desc_zh || ''}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ==================== FORUM HOT THREADS ==================== */}
        {threads.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">💬</span> {t('home.forumHotThreads')}
              </h2>
              <Link href="/forum" className="text-sm text-primary font-medium hover:underline">{t('home.enterForum')} →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {threads.map((thread) => {
                const board = boardMap[thread.board_id];
                const bSlug = board?.slug || '';
                const bName = board?.name_en || board?.name_zh || bSlug;
                const bCls = boardBadge[bSlug]?.cls || 'bg-gray-100 text-gray-600';
                const isHot = (thread.reply_count || 0) >= 50;
                return (
                  <Link key={thread.id} href={`/forum/${bSlug}/${thread.slug}`} className="flex items-center gap-4 p-4 hover:bg-blue-50/50 transition block">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {bName && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bCls}`}>{bName}</span>}
                        {isHot && <span className="text-xs text-red-500 font-medium">🔥 Hot</span>}
                      </div>
                      <h3 className="text-sm font-medium truncate">{thread.title_en || thread.title}</h3>
                    </div>
                    <div className="text-center flex-shrink-0 min-w-[50px]">
                      <p className="text-sm font-bold text-primary">{thread.reply_count || 0}</p>
                      <p className="text-xs text-gray-400">replies</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== NEWSLETTER ==================== */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-8 sm:p-10 text-center">
          <h2 className="text-xl font-bold mb-2">📬 {t('home.newsletter.title')}</h2>
          <p className="text-sm text-gray-500 mb-6">{t('home.newsletter.subtitle')}</p>
          <NewsletterForm source="homepage" className="max-w-md mx-auto" />
          <p className="text-xs text-gray-400 mt-3">{t('home.newsletter.subscriberCount', { count: '500' })}</p>
        </section>

      </div>
    </main>
  );
}
