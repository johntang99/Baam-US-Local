import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import VoicesTable from './VoicesTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const tabs = [
  { key: 'applications', label: 'Applications' },
  { key: 'creators', label: 'Creators' },
  { key: 'featured', label: 'Featured' },
];

export default async function AdminVoicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const activeTab = typeof params.tab === 'string' ? params.tab : 'creators';

  // Build base URL for filter links
  const baseParams = new URLSearchParams();
  if (params.region) baseParams.set('region', String(params.region));
  if (params.locale) baseParams.set('locale', String(params.locale));

  function tabUrl(tab: string) {
    const p = new URLSearchParams(baseParams);
    if (tab) p.set('tab', tab);
    return `/admin/voices?${p.toString()}`;
  }

  // Fetch application profiles (users who might want to become creators)
  const { data: rawApplications, count: applicationCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('profile_type', 'user')
    .in('region_id', ctx.regionIds)
    .order('created_at', { ascending: false })
    .limit(50);
  const applicationProfiles = (rawApplications || []) as AnyRow[];

  // Fetch all non-user profiles (creators, kols, etc.)
  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('*')
    .neq('profile_type', 'user')
    .in('region_id', ctx.regionIds)
    .order('follower_count', { ascending: false })
    .limit(50);
  const profiles = (rawProfiles || []) as AnyRow[];

  // Featured profiles
  const featuredProfiles = profiles.filter((p) => p.is_featured);

  return (
    <div>
      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-bg-page border border-border rounded-lg p-1">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tabUrl(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-bg-card text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {tab.label}
              {tab.key === 'applications' && (applicationCount ?? 0) > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {applicationCount}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Table content */}
        <VoicesTable
          tab={activeTab}
          profiles={profiles}
          applicationProfiles={applicationProfiles}
          featuredProfiles={featuredProfiles}
          siteParams={baseParams.toString()}
          applicationCount={applicationCount ?? 0}
        />
      </div>
    </div>
  );
}
