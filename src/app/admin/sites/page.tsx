import { createAdminClient } from '@/lib/supabase/admin';
import { SiteCard } from './site-card';
import { AddRegionForm } from './add-region-form';
import { AddSiteForm } from './add-site-form';
import { RegionRow } from './region-row';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminSitesPage() {
  const supabase = createAdminClient();

  // Fetch sites with their regions
  const { data: rawSites } = await supabase
    .from('sites')
    .select('*')
    .order('sort_order');
  const sites = (rawSites || []) as AnyRow[];

  // Fetch site_regions with region details
  const { data: rawSiteRegions } = await supabase
    .from('site_regions')
    .select('site_id, region_id, is_primary');
  const siteRegions = (rawSiteRegions || []) as AnyRow[];

  // Fetch all regions
  const { data: rawRegions } = await supabase
    .from('regions')
    .select('*')
    .order('sort_order');
  const regions = (rawRegions || []) as AnyRow[];

  // Build region map
  const regionMap: Record<string, AnyRow> = {};
  regions.forEach(r => { regionMap[r.id] = r; });

  // Build site -> regions map
  const siteRegionMap: Record<string, AnyRow[]> = {};
  siteRegions.forEach(sr => {
    if (!siteRegionMap[sr.site_id]) siteRegionMap[sr.site_id] = [];
    const region = regionMap[sr.region_id];
    if (region) siteRegionMap[sr.site_id].push({ ...region, is_primary: sr.is_primary });
  });

  // Content counts per site
  const siteCounts: Record<string, { articles: number; businesses: number; threads: number }> = {};
  for (const site of sites) {
    const regionIds = (siteRegionMap[site.id] || []).map((r: AnyRow) => r.id);
    if (regionIds.length === 0) {
      siteCounts[site.id] = { articles: 0, businesses: 0, threads: 0 };
      continue;
    }
    const [a, b, t] = await Promise.all([
      supabase.from('articles').select('*', { count: 'exact', head: true }).eq('editorial_status', 'published').eq('site_id', site.id).in('region_id', regionIds),
      supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('site_id', site.id).eq('is_active', true),
      supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'published').in('region_id', regionIds),
    ]);
    siteCounts[site.id] = { articles: a.count || 0, businesses: b.count || 0, threads: t.count || 0 };
  }

  // Regions not yet assigned to any site (for "add to site" dropdown)
  const assignedRegionIds = new Set(siteRegions.map((sr: AnyRow) => sr.region_id));
  const unassignedRegions = regions.filter(r => !assignedRegionIds.has(r.id));

  return (
    <div className="p-6 space-y-8">
      {/* Sites */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Site Configuration</h2>
            <p className="text-sm text-gray-500">Manage sites, coverage regions, and language settings</p>
          </div>
          <AddSiteForm />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              siteRegions={siteRegionMap[site.id] || []}
              counts={siteCounts[site.id] || { articles: 0, businesses: 0, threads: 0 }}
              allRegions={regions}
            />
          ))}
        </div>
      </section>

      {/* Regions Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Region List</h2>
          <AddRegionForm parentRegions={regions} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Chinese Name</th>
                <th>English Name</th>
                <th>Type</th>
                <th>Parent Region</th>
                <th>Belongs to Site</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => {
                const parent = regions.find((r: AnyRow) => r.id === region.parent_id);
                const belongsToSites = siteRegions
                  .filter((sr: AnyRow) => sr.region_id === region.id)
                  .map((sr: AnyRow) => sites.find((s: AnyRow) => s.id === sr.site_id)?.name)
                  .filter(Boolean) as string[];

                return (
                  <RegionRow
                    key={region.id}
                    region={region}
                    parent={parent}
                    belongsToSites={belongsToSites}
                    allRegions={regions}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
