import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import BusinessForm from '../BusinessForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildCategoryTree(categories: AnyRow[]) {
  // Separate parents (no parent_id) and children (have parent_id)
  const parents = categories.filter((c) => !c.parent_id);
  const childrenMap = new Map<string, AnyRow[]>();

  for (const cat of categories) {
    if (cat.parent_id) {
      const list = childrenMap.get(cat.parent_id) || [];
      list.push(cat);
      childrenMap.set(cat.parent_id, list);
    }
  }

  return parents.map((parent) => ({
    parent,
    children: childrenMap.get(parent.id) || [],
  }));
}

export default async function NewBusinessPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Fetch categories for business type (including parent_id for tree)
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('id, name_zh, name_en, slug, type, parent_id')
    .eq('type', 'business')
    .eq('site_scope', 'en')
    .order('sort_order', { ascending: true });
  const categories = (rawCategories || []) as AnyRow[];
  const categoryTree = buildCategoryTree(categories);

  // Build site params string for links
  const siteParamsObj = new URLSearchParams();
  if (params.region) siteParamsObj.set('region', String(params.region));
  if (params.locale) siteParamsObj.set('locale', String(params.locale));

  return (
    <BusinessForm
      business={null}
      categories={categories}
      categoryTree={categoryTree}
      selectedCategoryIds={[]}
      isNew={true}
      siteParams={siteParamsObj.toString()}
    />
  );
}
