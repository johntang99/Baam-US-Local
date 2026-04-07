import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminDashboard({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  const supabase = createAdminClient();


  // Filtered counts for this site
  const [
    { count: articleCount },
    { count: businessCount },
    { count: threadCount },
    { count: leadCount },
    { count: eventCount },
    { count: voiceCount },
    { count: pendingJobCount },
  ] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .eq('site_id', ctx.siteId)
      .eq('editorial_status', 'published')
      .in('region_id', ctx.regionIds),
    supabase.from('businesses').select('*', { count: 'exact', head: true })
      .eq('site_id', ctx.siteId)
      .eq('is_active', true),
    supabase.from('forum_threads').select('*', { count: 'exact', head: true })
      .eq('site_id', ctx.siteId)
      .eq('status', 'published')
      .in('region_id', ctx.regionIds),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('site_id', ctx.siteId)
      .eq('status', 'new'),
    supabase.from('events').select('*', { count: 'exact', head: true })
      .eq('site_id', ctx.siteId)
      .eq('status', 'published')
      .in('region_id', ctx.regionIds),
    supabase.from('voice_posts').select('*', { count: 'exact', head: true })
      .eq('site_id', ctx.siteId)
      .eq('status', 'published')
      .in('region_id', ctx.regionIds),
    supabase.from('ai_jobs').select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  // Recent articles for this site
  const { data: rawArticles } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', ctx.siteId)
    .in('region_id', ctx.regionIds)
    .order('created_at', { ascending: false })
    .limit(5);
  const recentArticles = (rawArticles || []) as AnyRow[];

  // Recent leads
  const { data: rawLeads } = await supabase
    .from('leads')
    .select('*')
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .limit(5);
  const recentLeads = (rawLeads || []) as AnyRow[];

  const stats = [
    { label: 'Articles', value: articleCount || 0, icon: '📝', color: 'text-blue-600' },
    { label: 'Businesses', value: businessCount || 0, icon: '🏪', color: 'text-primary' },
    { label: 'Forum Threads', value: threadCount || 0, icon: '💬', color: 'text-purple-600' },
    { label: 'Events', value: eventCount || 0, icon: '📅', color: 'text-green-600' },
    { label: 'Voices', value: voiceCount || 0, icon: '🎙️', color: 'text-pink-600' },
    { label: 'Pending Leads', value: leadCount || 0, icon: '📥', color: 'text-red-600' },
  ];

  const currentSiteName = ctx.siteName;

  return (
    <div className="p-6 space-y-6">
      {/* Site indicator */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Current Site</p>
          <p className="text-lg font-bold">{currentSiteName}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Region: {ctx.regionIds.join(', ')}</span>
          <span>Language: {ctx.locale === 'zh' ? 'Chinese' : 'English'}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Articles */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Recent Articles ({currentSiteName})</h2>
          {recentArticles.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No articles for this site</p>
          ) : (
            <div className="space-y-3">
              {recentArticles.map((article) => (
                <div key={article.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{article.title_zh || article.title_en || 'Untitled'}</p>
                    <p className="text-xs text-gray-400">{article.content_vertical} · {article.editorial_status}</p>
                  </div>
                  <a href={`/admin/articles/${article.id}/edit?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="text-xs text-primary hover:underline ml-2">Edit</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Recent Leads</h2>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No leads</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{lead.contact_name || 'Anonymous'}</p>
                    <p className="text-xs text-gray-400">{lead.source_type} · {lead.ai_summary || lead.message?.slice(0, 50)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${lead.status === 'new' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {lead.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href={`/admin/articles/new?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark inline-flex items-center">+ New Article</a>
          <a href={`/admin/businesses?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 inline-flex items-center">Review Businesses</a>
          <a href={`/admin/forum?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 inline-flex items-center">Review Posts</a>
          <a href={`/admin/leads?region=${ctx.siteSlug}&locale=${ctx.locale}`} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 inline-flex items-center">Process Leads</a>
        </div>
      </div>
    </div>
  );
}
