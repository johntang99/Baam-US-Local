import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import ArticleForm from '../../ArticleForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditArticlePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getAdminSiteContext(sp);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const siteScope = String(ctx.locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Build site params string for links
  const siteParamsObj = new URLSearchParams();
  if (sp.region) siteParamsObj.set('region', String(sp.region));
  if (sp.locale) siteParamsObj.set('locale', String(sp.locale));

  // Fetch the article
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single();

  if (!article) {
    return (
      <div className="p-12 text-center">
        <p className="text-lg font-medium">Article not found</p>
        <p className="text-sm text-text-muted mt-1">ID: {id}</p>
        <a href={`/admin/articles${siteParamsObj.toString() ? `?${siteParamsObj.toString()}` : ''}`} className="text-primary hover:underline text-sm mt-4 inline-block">
          Back to article list
        </a>
      </div>
    );
  }

  // Fetch categories for article type
  const { data: rawGuideCategories } = await supabase
    .from('categories_guide')
    .select('id, name_zh, name_en, slug, sort_order, site_scope')
    .eq('site_scope', siteScope)
    .order('sort_order', { ascending: true });
  const categories = (rawGuideCategories || []) as AnyRow[];

  // Fetch regions for this site
  const { data: rawRegions } = await supabase
    .from('regions')
    .select('id, name_zh, slug')
    .in('id', ctx.regionIds);
  const regions = (rawRegions || []) as AnyRow[];

  // Fetch businesses for linking
  const { data: rawBusinesses } = await supabase
    .from('businesses')
    .select('id, display_name, display_name_zh, slug')
    .eq('site_id', ctx.siteId)
    .eq('is_active', true)
    .order('display_name', { ascending: true });
  const businesses = (rawBusinesses || []) as AnyRow[];

  // Fetch existing linked businesses
  const { data: rawLinks } = await supabase
    .from('guide_business_links')
    .select('business_id')
    .eq('article_id', id);
  const linkedBusinessIds = ((rawLinks || []) as AnyRow[]).map((r: AnyRow) => r.business_id as string);

  return (
    <ArticleForm
      article={article}
      categories={categories}
      regions={regions}
      businesses={businesses}
      linkedBusinessIds={linkedBusinessIds}
      isNew={false}
      siteParams={siteParamsObj.toString()}
    />
  );
}
