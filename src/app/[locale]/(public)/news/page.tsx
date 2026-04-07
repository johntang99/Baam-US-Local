import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { Pagination } from '@/components/shared/pagination';
import { NewsletterForm } from '@/components/shared/newsletter-form';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('news')} · Baam`,
    description: 'Local news, policy changes, community updates, and event announcements',
  };
}

const verticalConfig: Record<string, { label: string; className: string; key: string }> = {
  news_alert: { label: 'Alert', className: 'badge-red', key: 'alert' },
  news_brief: { label: 'Brief', className: 'badge-blue', key: 'brief' },
  news_explainer: { label: 'Explainer', className: 'badge-purple', key: 'explainer' },
  news_roundup: { label: 'Roundup', className: 'badge-primary', key: 'roundup' },
  news_community: { label: 'Community', className: 'badge-green', key: 'community' },
};

const filterTabs = [
  { key: 'all', label: 'All', verticals: ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'] },
  { key: 'alert', label: 'Alerts', verticals: ['news_alert'] },
  { key: 'brief', label: 'Briefs', verticals: ['news_brief'] },
  { key: 'explainer', label: 'Explainers', verticals: ['news_explainer'] },
  { key: 'roundup', label: 'Roundups', verticals: ['news_roundup'] },
  { key: 'community', label: 'Community', verticals: ['news_community'] },
];

interface Props {
  searchParams: Promise<{ page?: string; type?: string }>;
}

export default async function NewsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const activeType = sp.type || 'all';
  const activeTab = filterTabs.find(t => t.key === activeType) || filterTabs[0];

  const supabase = await createClient();
  const site = await getCurrentSite();
  const regionIds = site.regionIds;
  const t = await getTranslations();

  // Count total for pagination
  const countQuery = supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', site.id)
    .in('content_vertical', activeTab.verticals)
    .eq('editorial_status', 'published')
    .in('region_id', regionIds);
  const { count } = await countQuery;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Fetch page of articles
  const from = (currentPage - 1) * PAGE_SIZE;
  const { data: rawArticles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .in('content_vertical', activeTab.verticals)
    .eq('editorial_status', 'published')
    .in('region_id', regionIds)
    .order('published_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const articles = (rawArticles || []) as AnyRow[];

  // Fetch active alerts (always show)
  const { data: rawAlerts } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .eq('content_vertical', 'news_alert')
    .eq('editorial_status', 'published')
    .in('region_id', regionIds)
    .order('published_at', { ascending: false })
    .limit(3);

  const alerts = (rawAlerts || []) as AnyRow[];
  const hasAlerts = alerts.length > 0;

  // Build preserved search params for pagination links
  const preservedParams: Record<string, string> = {};
  if (activeType !== 'all') preservedParams.type = activeType;

  return (
    <main>
      {/* Alert Banner */}
      {hasAlerts && (
        <div className="alert-banner">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">
            <strong>Urgent Alert: </strong>
            {alerts[0].title_en || alerts[0].title_zh}
          </span>
          <Link href={`/news/${alerts[0].slug}`} className="text-white/90 underline hover:text-white ml-2 text-sm">
            View Details →
          </Link>
        </div>
      )}

      {/* Page Header */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span>📰</span> {t('nav.news')}
          </h1>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="lg:flex gap-8">
          <div className="flex-1">
            {/* Filter Tabs — now functional links */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {filterTabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.key === 'all' ? '/news' : `/news?type=${tab.key}`}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                    activeType === tab.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary shadow-sm'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            {/* News List */}
            {error ? (
              <p className="text-text-secondary py-8 text-center">Error loading news. Please try again later.</p>
            ) : articles.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-4">📰</p>
                <p className="text-text-secondary">No news articles yet</p>
                <p className="text-text-muted text-sm mt-1">News will appear here</p>
              </div>
            ) : (
              <div className="space-y-6">
                {articles.map((article) => {
                  const vertical = verticalConfig[article.content_vertical] || {
                    label: 'News',
                    className: 'badge-gray',
                  };
                  const summary = article.ai_summary_en || article.summary_en || article.ai_summary_zh || article.summary_zh;
                  const timeAgo = formatTimeAgo(article.published_at);

                  return (
                    <Link
                      key={article.id}
                      href={`/news/${article.slug}`}
                      className={`bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-primary/30 transition-all p-5 block cursor-pointer group ${
                        article.content_vertical === 'news_alert'
                          ? 'border-l-4 border-l-accent-red bg-accent-red-light/30'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`badge ${vertical.className} rounded-full`}>{vertical.label}</span>
                        <span className="text-xs text-text-muted">{timeAgo}</span>
                        {article.source_name && (
                          <span className="text-xs text-text-muted bg-gray-100 px-2 py-0.5 rounded-full">
                            {article.source_name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title_en || article.title_zh}
                      </h3>
                      {summary && (
                        <p className="text-sm text-text-secondary line-clamp-2">{summary}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath="/news"
              searchParams={preservedParams}
            />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-sm mb-3">📬 Subscribe to Local Weekly</h3>
              <p className="text-xs text-text-secondary mb-3">Weekly curated local news, guides, and events</p>
              <NewsletterForm source="news_sidebar" />
            </div>
          </aside>
        </div>
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
