import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import ArticleForm from '../ArticleForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewArticlePage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const siteScope = String(ctx.locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

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

  // Build site params string for links
  const siteParamsObj = new URLSearchParams();
  if (params.region) siteParamsObj.set('region', String(params.region));
  if (params.locale) siteParamsObj.set('locale', String(params.locale));

  // Fetch businesses for linking
  const { data: rawBusinesses } = await supabase
    .from('businesses')
    .select('id, display_name, display_name_zh, slug')
    .eq('site_id', ctx.siteId)
    .eq('is_active', true)
    .order('display_name', { ascending: true });
  const businesses = (rawBusinesses || []) as AnyRow[];

  return (
    <ArticleForm
      article={null}
      categories={categories}
      regions={regions}
      businesses={businesses}
      isNew={true}
      siteParams={siteParamsObj.toString()}
    />
  );
}
