import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentSite } from '@/lib/sites';
import { redirect } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const metadata: Metadata = {
  title: 'Business Dashboard · Baam',
};

export default async function BusinessDashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect('/zh?auth=required&redirect=/dashboard/business');
  const site = await getCurrentSite();

  const supabase = await createClient();

  // Find businesses claimed by this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bizData } = await (supabase as any)
    .from('businesses')
    .select('*')
    .eq('claimed_by_user_id', user.id)
    .eq('site_id', site.id)
    .order('created_at', { ascending: false });

  const businesses = (bizData || []) as AnyRow[];

  // If user has no businesses, show onboarding
  if (businesses.length === 0) {
    return (
      <main>
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6">🏪</div>
            <h1 className="text-2xl font-bold mb-3">Welcome to your Business Dashboard</h1>
            <p className="text-text-secondary mb-8">You haven&apos;t registered a business yet. Register to manage your business info, view leads, and respond to reviews.</p>
            <Link href="/businesses/claim" className="btn btn-primary h-11 px-8 text-sm inline-block">
              Register Free
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const biz = businesses[0]; // Show first business (most users have one)

  // Fetch stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewsResult, leadsResult] = await Promise.all([
    (supabase as any)
      .from('business_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', biz.id),
    (supabase as any)
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', biz.id)
      .eq('site_id', site.id)
      .eq('status', 'new'),
  ]);

  const reviewCount = reviewsResult.count || 0;
  const newLeadCount = leadsResult.count || 0;

  // Fetch recent leads
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentLeads } = await (supabase as any)
    .from('leads')
    .select('id, contact_name, contact_phone, message, status, created_at')
    .eq('business_id', biz.id)
    .eq('site_id', site.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const leads = (recentLeads || []) as AnyRow[];

  const statusColors: Record<string, string> = {
    active: 'badge-green',
    unclaimed: 'badge-gray',
    suspended: 'badge-red',
  };

  return (
    <main>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{biz.display_name_zh || biz.display_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge ${statusColors[biz.status] || 'badge-gray'} text-xs`}>
                {biz.status === 'active' ? 'Live' : biz.status === 'unclaimed' ? 'Pending Review' : biz.status}
              </span>
              {biz.is_verified && <span className="badge badge-blue text-xs">Verified</span>}
            </div>
          </div>
          <Link href={`/businesses/${biz.slug}`} className="btn btn-outline h-9 px-4 text-sm">
            View Page
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <div className="card p-5 text-center">
            <p className="text-2xl font-bold text-primary">{biz.view_count || 0}</p>
            <p className="text-xs text-text-muted mt-1">Total Views</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-2xl font-bold text-primary">{biz.lead_count || 0}</p>
            <p className="text-xs text-text-muted mt-1">Total Leads</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-2xl font-bold text-primary">{newLeadCount}</p>
            <p className="text-xs text-text-muted mt-1">New Leads</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-2xl font-bold text-primary">{reviewCount}</p>
            <p className="text-xs text-text-muted mt-1">Reviews</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Leads */}
          <div className="lg:col-span-2">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base">Recent Leads</h2>
                {newLeadCount > 0 && (
                  <span className="badge badge-red text-xs">{newLeadCount} new leads</span>
                )}
              </div>
              {leads.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">No leads yet. Leads come from the inquiry form on your business page.</p>
              ) : (
                <div className="space-y-3">
                  {leads.map((lead) => (
                    <div key={lead.id} className="p-3 bg-bg-page rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{lead.contact_name || 'Anonymous'}</span>
                        <span className={`text-xs ${lead.status === 'new' ? 'text-red-500 font-medium' : 'text-text-muted'}`}>
                          {lead.status === 'new' ? 'New' : lead.status === 'contacted' ? 'Contacted' : lead.status}
                        </span>
                      </div>
                      {lead.contact_phone && (
                        <p className="text-xs text-text-muted">
                          📞 <a href={`tel:${lead.contact_phone}`} className="text-primary">{lead.contact_phone}</a>
                        </p>
                      )}
                      {lead.message && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{lead.message}</p>
                      )}
                      <p className="text-xs text-text-muted mt-1">
                        {new Date(lead.created_at).toLocaleDateString('en-US')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-bold text-sm mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link href={`/businesses/${biz.slug}`} className="block p-3 bg-bg-page rounded-lg text-sm hover:bg-border-light transition-colors">
                  View Business Page
                </Link>
                <Link href="/admin/businesses" className="block p-3 bg-bg-page rounded-lg text-sm hover:bg-border-light transition-colors">
                  Edit Business Info
                </Link>
                <Link href="/admin/leads" className="block p-3 bg-bg-page rounded-lg text-sm hover:bg-border-light transition-colors">
                  Manage All Leads
                </Link>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-bold text-sm mb-3">Business Rating</h3>
              <div className="text-center py-2">
                <p className="text-3xl font-bold text-primary">{biz.avg_rating?.toFixed(1) || '—'}</p>
                <p className="text-yellow-500 text-sm mt-1">{'★'.repeat(Math.round(biz.avg_rating || 0))}{'☆'.repeat(5 - Math.round(biz.avg_rating || 0))}</p>
                <p className="text-xs text-text-muted mt-1">{biz.review_count || 0} reviews</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
