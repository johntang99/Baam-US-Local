import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { Pagination } from '@/components/shared/pagination';
import { getCurrentSite } from '@/lib/sites';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

// Subgroup definitions — display config for parents with subgroups
const SUBGROUP_CONFIG: Record<string, { slug: string; name: string; icon: string }[]> = {
  'food-dining': [
    { slug: 'restaurants', name: 'Restaurants', icon: '🍽️' },
    { slug: 'coffee-drinks', name: 'Coffee & Drinks', icon: '☕' },
    { slug: 'grocery-market', name: 'Grocery & Market', icon: '🛒' },
  ],
  'home-renovation': [
    { slug: 'emergency', name: 'Emergency', icon: '🚨' },
    { slug: 'renovation', name: 'Renovation', icon: '🏗️' },
    { slug: 'outdoor', name: 'Outdoor', icon: '🌿' },
    { slug: 'other', name: 'Other', icon: '📦' },
  ],
  'medical-health': [
    { slug: 'primary', name: 'Primary & Urgent', icon: '🩺' },
    { slug: 'dental-vision', name: 'Dental & Vision', icon: '🦷' },
    { slug: 'specialist', name: 'Specialists', icon: '🏥' },
    { slug: 'therapy', name: 'Therapy & Alt', icon: '🧠' },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Business Directory · Baam Middletown',
    description: 'Local business directory for Middletown, NY and Orange County — restaurants, medical, legal, home services, auto, shopping and more',
  };
}

interface Props {
  searchParams: Promise<{ page?: string; cat?: string; grp?: string; sub?: string; sort?: string }>;
}

export default async function BusinessListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const activeCat = sp.cat || '';
  const activeGrp = sp.grp || '';
  const activeSub = sp.sub || '';
  const sortBy = sp.sort || 'recommended';

  const supabase = await createClient();
  const t = await getTranslations();
  const site = await getCurrentSite();

  // Fetch all business categories
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('*')
    .eq('type', 'business')
    .eq('site_scope', 'en')
    .order('sort_order', { ascending: true });

  const allCategories = (rawCategories || []) as AnyRow[];
  const parentCategories = allCategories.filter(c => !c.parent_id);
  const activeParent = parentCategories.find(c => c.slug === activeCat);

  // All children of active parent
  const allChildren = activeParent
    ? allCategories.filter(c => c.parent_id === activeParent.id)
    : [];

  // Check if this parent has subgroups
  const subgroups = activeCat ? (SUBGROUP_CONFIG[activeCat] || []) : [];
  const hasSubgroups = subgroups.length > 0;

  // Filter children by subgroup if selected
  const visibleChildren = hasSubgroups && activeGrp
    ? allChildren.filter(c => c.subgroup === activeGrp)
    : allChildren;

  // Determine which category IDs to filter businesses by
  const filterSlug = activeSub || '';
  let filterCatIds: string[] | null = null;

  if (activeSub) {
    // Specific subcategory selected
    const matchedCat = allCategories.find(c => c.slug === activeSub);
    if (matchedCat) filterCatIds = [matchedCat.id];
  } else if (activeGrp && hasSubgroups) {
    // Subgroup selected — filter to all categories in that subgroup
    const grpCats = allChildren.filter(c => c.subgroup === activeGrp);
    if (grpCats.length > 0) filterCatIds = grpCats.map(c => c.id);
  } else if (activeCat) {
    // Parent selected — filter to all its children
    const matchedParent = allCategories.find(c => c.slug === activeCat && !c.parent_id);
    if (matchedParent) {
      filterCatIds = [matchedParent.id, ...allChildren.map(c => c.id)];
    }
  }

  // ─── Business query ────────────────────────────────────────────
  let count = 0;
  let businesses: AnyRow[] = [];
  const pageFrom = (currentPage - 1) * PAGE_SIZE;

  if (filterCatIds && filterCatIds.length > 0) {
    // Step 1: Get ALL matching business IDs (deduplicated)
    const allBizIds: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: bcBatch } = await supabase
        .from('business_categories')
        .select('business_id')
        .in('category_id', filterCatIds)
        .range(offset, offset + 999);
      if (!bcBatch || bcBatch.length === 0) break;
      allBizIds.push(...bcBatch.map((bc: AnyRow) => bc.business_id));
      if (bcBatch.length < 1000) break;
    }
    const uniqueBizIds = [...new Set(allBizIds)];

    if (uniqueBizIds.length > 0) {
      // Step 2: Fetch minimal fields for sorting (in chunks)
      const CHUNK_SIZE = 200;
      const allBizSorted: AnyRow[] = [];
      for (let i = 0; i < uniqueBizIds.length; i += CHUNK_SIZE) {
        const chunk = uniqueBizIds.slice(i, i + CHUNK_SIZE);
        const { data: chunkData } = await supabase
          .from('businesses')
          .select('id, is_featured, total_score, updated_at')
          .eq('is_active', true)
          .eq('status', 'active')
          .eq('site_id', site.id)
          .in('id', chunk);
        if (chunkData) allBizSorted.push(...chunkData);
      }
      count = allBizSorted.length;

      // Step 3: Sort
      allBizSorted.sort((a, b) => {
        if (sortBy === 'rating') return (b.total_score || 0) - (a.total_score || 0);
        if (sortBy === 'recent') return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
        if (a.is_featured !== b.is_featured) return b.is_featured ? 1 : -1;
        return (b.total_score || 0) - (a.total_score || 0);
      });

      // Step 4: Get page slice
      const pageIds = allBizSorted.slice(pageFrom, pageFrom + PAGE_SIZE).map(b => b.id);

      if (pageIds.length > 0) {
        const { data: rawBiz } = await supabase
          .from('businesses')
          .select('*, business_categories(categories(name_en, slug))')
          .eq('site_id', site.id)
          .in('id', pageIds);

        const idOrder = new Map(pageIds.map((id, idx) => [id, idx]));
        businesses = ((rawBiz || []) as AnyRow[]).sort((a, b) =>
          (idOrder.get(a.id) || 0) - (idOrder.get(b.id) || 0)
        );
      }
    }
  } else {
    // No filter — all businesses
    let query = supabase
      .from('businesses')
      .select('*, business_categories(categories(name_en, slug))', { count: 'exact' })
      .eq('site_id', site.id)
      .eq('is_active', true)
      .eq('status', 'active');

    if (sortBy === 'recent') query = query.order('updated_at', { ascending: false });
    else query = query.order('is_featured', { ascending: false }).order('total_score', { ascending: false, nullsFirst: false });

    const { data: rawBiz, count: totalCount } = await query.range(pageFrom, pageFrom + PAGE_SIZE - 1);
    count = totalCount || 0;
    businesses = (rawBiz || []) as AnyRow[];
  }

  const totalPages = Math.ceil(count / PAGE_SIZE);

  // Build preserved params for pagination links
  const preservedParams: Record<string, string> = {};
  if (activeCat) preservedParams.cat = activeCat;
  if (activeGrp) preservedParams.grp = activeGrp;
  if (activeSub) preservedParams.sub = activeSub;
  if (sortBy !== 'recommended') preservedParams.sort = sortBy;

  // Build breadcrumb text
  const breadcrumb = [
    activeParent?.name_en,
    activeGrp ? subgroups.find(g => g.slug === activeGrp)?.name : null,
    activeSub ? allCategories.find(c => c.slug === activeSub)?.name_en : null,
  ].filter(Boolean).join(' > ');

  const sortOptions = [
    { key: 'recommended', label: 'Recommended' },
    { key: 'rating', label: 'Highest Rated' },
    { key: 'recent', label: 'Recently Updated' },
  ];

  return (
    <main>
      {/* Page Header */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Business Directory</h1>
          <p className="text-sm text-gray-500 mt-2">
            Discover {count.toLocaleString()} local businesses in Middletown &amp; Orange County, NY
          </p>
        </div>
      </section>

      {/* ─── Navigation Tiers ─────────────────────────────────── */}
      <section className="bg-bg-card border-b border-border sticky top-16 z-40">

        {/* Tier 1: Parent Categories */}
        <div className="max-w-7xl mx-auto px-4 pt-4 pb-0">
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
            <Link
              href="/businesses"
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                !activeCat ? 'bg-primary text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary shadow-sm'
              }`}
            >
              All
            </Link>
            {parentCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/businesses?cat=${cat.slug}`}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${
                  activeCat === cat.slug ? 'bg-primary text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary shadow-sm'
                }`}
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.name_en}
              </Link>
            ))}
          </div>
        </div>

        {/* Tier 2: Subgroups (only for parents with subgroups) */}
        {hasSubgroups && activeParent && (
          <div className="border-t border-border bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
            <div className="max-w-7xl mx-auto px-4 py-2.5">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
                <Link
                  href={`/businesses?cat=${activeCat}`}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    !activeGrp && !activeSub ? 'bg-primary text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary shadow-sm'
                  }`}
                >
                  All {activeParent.name_en}
                </Link>
                {subgroups.map((grp) => (
                  <Link
                    key={grp.slug}
                    href={`/businesses?cat=${activeCat}&grp=${grp.slug}`}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                      activeGrp === grp.slug ? 'bg-primary text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary shadow-sm'
                    }`}
                  >
                    <span className="mr-1">{grp.icon}</span>
                    {grp.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tier 3: Leaf categories (subcategories within selected subgroup or all children) */}
        {visibleChildren.length > 0 && activeParent && (
          <div className="border-t border-border/50 bg-bg-page/50">
            <div className="max-w-7xl mx-auto px-4 py-2">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
                <Link
                  href={activeGrp ? `/businesses?cat=${activeCat}&grp=${activeGrp}` : `/businesses?cat=${activeCat}`}
                  className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    !activeSub ? 'bg-primary/15 text-primary border border-primary/30' : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                  }`}
                >
                  All
                </Link>
                {visibleChildren.map((sub) => (
                  <Link
                    key={sub.id}
                    href={activeGrp
                      ? `/businesses?cat=${activeCat}&grp=${activeGrp}&sub=${sub.slug}`
                      : `/businesses?cat=${activeCat}&sub=${sub.slug}`
                    }
                    className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                      activeSub === sub.slug ? 'bg-primary/15 text-primary border border-primary/30' : 'text-text-secondary hover:text-primary hover:bg-primary/5'
                    }`}
                  >
                    {sub.icon && <span className="mr-0.5">{sub.icon}</span>}
                    {sub.name_en}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sort row */}
        <div className="max-w-7xl mx-auto px-4 py-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {count.toLocaleString()} businesses
              {breadcrumb ? ` · ${activeParent?.icon || ''} ${breadcrumb}` : ''}
            </span>
            <div className="flex gap-1">
              {sortOptions.map((opt) => {
                const params = new URLSearchParams({
                  ...(activeCat ? { cat: activeCat } : {}),
                  ...(activeGrp ? { grp: activeGrp } : {}),
                  ...(activeSub ? { sub: activeSub } : {}),
                  ...(opt.key !== 'recommended' ? { sort: opt.key } : {}),
                });
                const qs = params.toString();
                return (
                  <Link
                    key={opt.key}
                    href={qs ? `/businesses?${qs}` : '/businesses'}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                      sortBy === opt.key ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-400 hover:text-primary'
                    }`}
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Results ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {businesses.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-5xl mb-6">🏪</p>
            <p className="text-gray-600 text-lg font-medium">No businesses found</p>
            <p className="text-gray-400 text-sm mt-2">Try a different category or check back later</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {businesses.map((biz) => (
              <BusinessCard key={biz.id} biz={biz} featured={biz.is_featured} />
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/businesses"
          searchParams={preservedParams}
        />
      </div>

      {/* Business CTA */}
      <section className="bg-gradient-to-br from-primary via-blue-600 to-blue-800 text-white rounded-2xl mx-4 sm:mx-auto max-w-7xl my-8">
        <div className="px-6 sm:px-10 py-10 sm:py-14 text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-3">Own a business? List it on Baam for free</h2>
          <p className="text-blue-100 text-sm sm:text-base mb-8">Create your business profile · AI-optimized listing · Reach local customers</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/businesses/claim" className="w-full sm:w-auto px-8 py-3 bg-white text-primary font-bold text-sm rounded-lg hover:bg-blue-50 transition shadow-2xl inline-block text-center">
              List Your Business
            </Link>
            <Link href="/businesses/claim" className="w-full sm:w-auto px-8 py-3 border-2 border-white/50 text-white font-medium text-sm rounded-lg hover:bg-white/10 transition inline-block text-center">
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function BusinessCard({ biz, featured = false }: { biz: AnyRow; featured?: boolean }) {
  const aiTags = (biz.ai_tags || []).filter((t: string) => t !== 'GBP已认领') as string[];
  const name = biz.display_name || biz.display_name_zh || '';
  const cats = Array.isArray(biz.business_categories)
    ? biz.business_categories.map((bc: AnyRow) => bc.categories?.name_en).filter(Boolean)
    : [];
  const primaryCat = cats[0] || 'Business';
  const address = biz.address_full || (biz.city ? `${biz.city}, ${biz.state || 'NY'}` : '');

  const cardContent = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <h3 className={`${featured ? 'font-bold text-base' : 'font-semibold text-sm'} truncate group-hover:text-primary transition-colors`}>{name}</h3>
        {biz.verification_status === 'verified' && (
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div className="flex items-center flex-wrap gap-2 text-sm mb-2">
        <span className="badge badge-gray text-xs">{primaryCat}</span>
        {biz.avg_rating ? (
          <div className="flex items-center gap-1">
            <span className="text-yellow-500 text-xs leading-none">{'★'.repeat(Math.round(Number(biz.avg_rating)))}</span>
            <span className="text-xs text-gray-700 font-semibold">{Number(biz.avg_rating).toFixed(1)}</span>
            <span className="text-xs text-gray-400">({biz.review_count || 0} reviews)</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">No reviews yet</span>
        )}
      </div>
      <div className="flex items-center flex-wrap gap-2 mb-2">
        {biz.website_url && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>
            Website
          </span>
        )}
        {aiTags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
        ))}
      </div>
      <div className="space-y-1 text-xs text-gray-400">
        {address && <p className="truncate">📍 {address}</p>}
        {biz.phone && <p>📞 {biz.phone}</p>}
      </div>
    </>
  );

  if (featured) {
    return (
      <Link href={`/businesses/${biz.slug}`} className="group block relative overflow-hidden bg-white rounded-xl border-2 border-primary shadow-md hover:shadow-lg transition-all">
        <div className="absolute top-0 left-0 bg-gradient-to-r from-primary to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-br-lg">Featured</div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-bold flex-shrink-0 flex items-center justify-center text-2xl">{name[0] || '🏢'}</div>
            <div className="flex-1 min-w-0">{cardContent}</div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/businesses/${biz.slug}`} className="group block bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-primary/30 transition-all">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-bold flex-shrink-0 flex items-center justify-center text-lg">{name[0] || '🏢'}</div>
          <div className="flex-1 min-w-0">{cardContent}</div>
        </div>
      </div>
    </Link>
  );
}
