import { createAdminClient } from '@/lib/supabase/admin';
import { CategoryTree } from './CategoryTree';
import { ContentCategoryTable } from './ContentCategoryTable';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TABS = [
  { key: 'regions', label: 'Regions' },
  { key: 'business', label: 'Business Categories' },
  { key: 'guides', label: 'Guide Categories' },
  { key: 'news', label: 'News Categories' },
  { key: 'forum', label: 'Forum Categories' },
  { key: 'discover', label: 'Discover Categories' },
] as const;

function toSiteScopeRows(rows: AnyRow[], siteScope: 'zh' | 'en') {
  return rows
    .filter((row) => {
      const scope = String(row.site_scope || '').toLowerCase();
      return scope ? scope === siteScope : siteScope === 'zh';
    })
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

export default async function AdminSettingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const activeTabParam = typeof params.tab === 'string' ? params.tab : '';
  const activeTab = TABS.some((t) => t.key === activeTabParam) ? activeTabParam : 'regions';

  const supabase = createAdminClient();

  const [
    { data: rawRegions },
    { data: rawBusinessCategories },
    { data: rawGuideRows },
    { data: rawNewsRows },
    { data: rawForumRows },
    { data: rawDiscoverRows },
  ] = await Promise.all([
    supabase.from('regions').select('*').order('slug'),
    supabase.from('categories').select('*').eq('type', 'business').eq('site_scope', 'en').order('sort_order'),
    supabase.from('categories_guide').select('*').order('sort_order'),
    supabase.from('categories_news').select('*').order('sort_order'),
    supabase.from('categories_forum').select('*').order('sort_order'),
    supabase.from('categories_discover').select('*').order('sort_order'),
  ]);
  const regions = (rawRegions || []) as AnyRow[];
  const businessCategories = (rawBusinessCategories || []) as AnyRow[];
  const guideRows = (rawGuideRows || []) as AnyRow[];
  const newsRows = (rawNewsRows || []) as AnyRow[];
  const forumRows = (rawForumRows || []) as AnyRow[];
  const discoverRows = (rawDiscoverRows || []) as AnyRow[];

  const guideZhCategories = toSiteScopeRows(guideRows, 'zh');
  const guideEnCategories = toSiteScopeRows(guideRows, 'en');
  const newsZhCategories = toSiteScopeRows(newsRows, 'zh');
  const newsEnCategories = toSiteScopeRows(newsRows, 'en');
  const forumZhCategories = toSiteScopeRows(forumRows, 'zh');
  const forumEnCategories = toSiteScopeRows(forumRows, 'en');
  const discoverZhCategories = toSiteScopeRows(discoverRows, 'zh');
  const discoverEnCategories = toSiteScopeRows(discoverRows, 'en');

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-sm text-text-muted">Admin / Settings</p>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/admin/settings?tab=${tab.key}`}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-8">
        {activeTab === 'regions' && (
          <section>
          <h2 className="text-lg font-semibold mb-4">Region Management</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Slug</th>
                    <th>Chinese Name</th>
                    <th>English Name</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-text-muted py-8">No regions</td>
                    </tr>
                  ) : (
                    regions.map((region) => (
                      <tr key={region.id}>
                        <td className="font-medium font-mono text-sm">{region.slug}</td>
                        <td>{region.name_zh || '—'}</td>
                        <td className="text-text-secondary">{region.name_en || '—'}</td>
                        <td>{region.type || '—'}</td>
                        <td>
                          <span className={`badge ${region.is_active ? 'badge-green' : 'badge-gray'}`}>
                            {region.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </section>
        )}

        {activeTab === 'business' && (
          <section>
            <CategoryTree categories={businessCategories} />
          </section>
        )}

        {activeTab === 'guides' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Guide Categories</h2>
            <p className="text-sm text-text-muted">
              Separate categories for Chinese Site and English Site to avoid mixing content.
            </p>
            <ContentCategoryTable
              title="Chinese Site Guide Categories"
              tableName="categories_guide"
              siteScope="zh"
              categoryType="article"
              categories={guideZhCategories}
            />
            <ContentCategoryTable
              title="English Site Guide Categories"
              tableName="categories_guide"
              siteScope="en"
              categoryType="article"
              categories={guideEnCategories}
            />
          </section>
        )}

        {activeTab === 'news' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">News Categories</h2>
            <ContentCategoryTable
              title="Chinese Site News Categories"
              tableName="categories_news"
              siteScope="zh"
              categories={newsZhCategories}
            />
            <ContentCategoryTable
              title="English Site News Categories"
              tableName="categories_news"
              siteScope="en"
              categories={newsEnCategories}
            />
          </section>
        )}

        {activeTab === 'forum' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Forum Categories</h2>
            <ContentCategoryTable
              title="Chinese Site Forum Categories"
              tableName="categories_forum"
              siteScope="zh"
              categoryType="forum"
              categories={forumZhCategories}
            />
            <ContentCategoryTable
              title="English Site Forum Categories"
              tableName="categories_forum"
              siteScope="en"
              categoryType="forum"
              categories={forumEnCategories}
            />
          </section>
        )}

        {activeTab === 'discover' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Discover Categories</h2>
            <ContentCategoryTable
              title="Chinese Site Discover Categories"
              tableName="categories_discover"
              siteScope="zh"
              categories={discoverZhCategories}
            />
            <ContentCategoryTable
              title="English Site Discover Categories"
              tableName="categories_discover"
              siteScope="en"
              categories={discoverEnCategories}
            />
          </section>
        )}

      </div>
    </div>
  );
}
