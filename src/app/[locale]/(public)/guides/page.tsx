import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';
import { NewsletterForm } from '@/components/shared/newsletter-form';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return {
    title: `${t('guides')} · Baam`,
    description: 'Essential practical guides, AI-curated, editor-reviewed, continuously updated',
  };
}

// Badge color mapping for guide content verticals
const verticalConfig: Record<string, { label: string; className: string }> = {
  guide_howto: { label: 'How-To', className: 'badge-blue' },
  guide_checklist: { label: 'Checklist', className: 'badge-green' },
  guide_bestof: { label: 'Best-of', className: 'badge-green' },
  guide_comparison: { label: 'Comparison', className: 'badge-purple' },
  guide_neighborhood: { label: 'Neighborhood', className: 'badge-primary' },
  guide_seasonal: { label: 'Seasonal', className: 'badge-red' },
  guide_resource: { label: 'Resource', className: 'badge-blue' },
  guide_scenario: { label: 'Scenario', className: 'badge-purple' },
};

// Gradient color palettes for cover placeholders
const coverGradients = [
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-blue-400 via-indigo-500 to-purple-600',
  'from-orange-400 via-red-500 to-pink-600',
  'from-green-400 via-emerald-500 to-teal-600',
  'from-purple-400 via-violet-500 to-indigo-600',
  'from-amber-400 via-orange-500 to-red-500',
  'from-cyan-400 via-blue-500 to-indigo-600',
  'from-pink-400 via-rose-500 to-red-600',
];

const coverEmojis = ['📋', '🏥', '💼', '🏠', '🚗', '🏫', '🍜', '⚖️', '🌏', '👨‍👩‍👧', '📊', '🔑'];

function getGradient(index: number) {
  return coverGradients[index % coverGradients.length];
}

function getEmoji(title: string, index: number) {
  // Simple hash from title to pick a consistent emoji
  const hash = title ? title.charCodeAt(0) % coverEmojis.length : index % coverEmojis.length;
  return coverEmojis[hash];
}

const GUIDE_VERTICALS = [
  'guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison',
  'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario',
];

export default async function GuidesListPage() {
  const supabase = await createClient();
  const site = await getCurrentSite();
  const regionIds = site.regionIds;
  const t = await getTranslations();

  // Fetch published guide articles, newest first
  const { data: rawArticles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .in('content_vertical', GUIDE_VERTICALS)
    .eq('editorial_status', 'published')
    .in('region_id', regionIds)
    .order('published_at', { ascending: false })
    .limit(50);

  const articles = (rawArticles || []) as AnyRow[];

  // Fetch categories for tab bar
  const { data: rawScopedCategories } = await supabase
    .from('categories_guide')
    .select('*')
    .eq('site_scope', 'en')
    .order('sort_order', { ascending: true });
  const categories = ((rawScopedCategories || []).map((cat: AnyRow) => ({
    ...cat,
    name: cat.name || cat.name_en,
    emoji: cat.emoji || cat.icon,
  }))) as AnyRow[];

  // Featured guide = latest published guide
  const featuredGuide = articles[0] || null;
  const recentGuides = articles.slice(1, 5);

  // Group articles by category for per-category sections (show 3 categories)
  const categoryGroups: { category: AnyRow; guides: AnyRow[] }[] = [];
  for (const cat of categories) {
    if (categoryGroups.length >= 3) break;
    const catGuides = articles.filter(
      (a) => a.category_id === cat.id || a.primary_category_id === cat.id
    );
    if (catGuides.length > 0) {
      categoryGroups.push({ category: cat, guides: catGuides.slice(0, 4) });
    }
  }

  // If we don't have enough category-grouped content, show all articles in chunks
  if (categoryGroups.length === 0 && articles.length > 5) {
    const remaining = articles.slice(5);
    for (let i = 0; i < Math.min(3, Math.ceil(remaining.length / 4)); i++) {
      categoryGroups.push({
        category: { name_en: ['Popular Guides', 'Practical Tips', 'Editor Picks'][i], icon: ['🔥', '📚', '⭐'][i] },
        guides: remaining.slice(i * 4, i * 4 + 4),
      });
    }
  }

  return (
    <main>
      {/* Page Header */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {t('nav.guides', { defaultValue: 'Guides' })}
          </h1>
          <p className="text-sm text-text-secondary">Essential practical guides, AI-curated, editor-reviewed, continuously updated</p>
        </div>
      </section>

      {/* Category Tab Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-3" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            <Link
              href="/guides"
              className="flex-shrink-0 px-4 py-2 text-sm font-medium bg-primary text-white shadow-sm rounded-full"
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/guides?cat=${cat.slug}`}
                className="flex-shrink-0 px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary shadow-sm rounded-full transition-all"
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.name_en || cat.name || cat.name_zh}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="lg:flex lg:gap-8">

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Error / Empty State */}
            {error ? (
              <p className="text-text-secondary py-8 text-center">Error loading guides. Please try again later.</p>
            ) : articles.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-4">📚</p>
                <p className="text-text-secondary">No guides yet</p>
                <p className="text-text-muted text-sm mt-1">Guides will appear here</p>
              </div>
            ) : (
              <>
                {/* Featured Hero Section */}
                <section>
                  <div className="grid lg:grid-cols-5 gap-6">
                    {/* Large Featured Card */}
                    {featuredGuide && (
                      <Link
                        href={`/guides/${featuredGuide.slug}`}
                        className="lg:col-span-3 bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group overflow-hidden block"
                      >
                        <div className={`relative h-56 sm:h-72 ${featuredGuide.cover_image_url ? '' : `bg-gradient-to-br ${getGradient(0)}`} flex items-end`}>
                          {featuredGuide.cover_image_url && (
                            <img
                              src={featuredGuide.cover_image_url}
                              alt={featuredGuide.title_en || featuredGuide.title_zh || 'Guide cover'}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                              loading="lazy"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                          <div className="relative p-5 sm:p-6 w-full">
                            <div className="flex items-center gap-2 mb-2">
                              {verticalConfig[featuredGuide.content_vertical] && (
                                <span className="px-2.5 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                                  {verticalConfig[featuredGuide.content_vertical].label}
                                </span>
                              )}
                              {featuredGuide.audience_tags && Array.isArray(featuredGuide.audience_tags) && featuredGuide.audience_tags.slice(0, 2).map((tag: string) => (
                                <span key={tag} className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full backdrop-blur-sm">
                                  {tag}
                                </span>
                              ))}
                              <span className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full backdrop-blur-sm">Editor Pick</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight group-hover:underline decoration-2 underline-offset-4">
                              {featuredGuide.title_en || featuredGuide.title_zh}
                            </h2>
                          </div>
                        </div>
                        <div className="p-5">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {featuredGuide.audience_tags && Array.isArray(featuredGuide.audience_tags) && featuredGuide.audience_tags.map((tag: string) => (
                              <span key={tag} className="text-xs bg-accent-green-light text-green-700 px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                            {featuredGuide.read_time_minutes && (
                              <>
                                <span className="text-xs text-text-muted">·</span>
                                <span className="text-xs text-text-muted">{featuredGuide.read_time_minutes} min read</span>
                              </>
                            )}
                          </div>
                          {(featuredGuide.ai_summary_en || featuredGuide.summary_en || featuredGuide.ai_summary_zh || featuredGuide.summary_zh) && (
                            <div className="ai-summary-card">
                              <p className="text-xs text-secondary-dark leading-relaxed line-clamp-2">
                                {featuredGuide.ai_summary_en || featuredGuide.summary_en || featuredGuide.ai_summary_zh || featuredGuide.summary_zh}
                              </p>
                            </div>
                          )}
                        </div>
                      </Link>
                    )}

                    {/* Recent Guides Column */}
                    <div className="lg:col-span-2 space-y-6">
                      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">Recently Published</h3>
                      {recentGuides.map((guide, idx) => {
                        const vertical = verticalConfig[guide.content_vertical] || { label: 'Guide', className: 'badge-gray' };
                        const timeAgo = formatTimeAgo(guide.published_at);
                        return (
                          <Link key={guide.id} href={`/guides/${guide.slug}`} className="bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-primary/30 transition-all p-4 flex gap-4 cursor-pointer group block">
                            {guide.cover_image_url ? (
                              <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                                <img
                                  src={guide.cover_image_url}
                                  alt={guide.title_en || guide.title_zh || 'Guide cover'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className={`w-20 h-20 flex-shrink-0 rounded-lg bg-gradient-to-br ${getGradient(idx + 1)} flex items-center justify-center text-2xl`}>
                                {getEmoji(guide.title_en || guide.title_zh || '', idx)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`badge ${vertical.className} text-xs rounded-full`}>{vertical.label}</span>
                                <span className="text-xs text-text-muted">{timeAgo}</span>
                              </div>
                              <h4 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                                {guide.title_en || guide.title_zh}
                              </h4>
                              <p className="text-xs text-text-muted mt-1">
                                {guide.audience_tags && Array.isArray(guide.audience_tags) ? guide.audience_tags.join(' · ') : ''}
                                {guide.read_time_minutes ? ` · ${guide.read_time_minutes} min read` : ''}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Per-Category Sections */}
                {categoryGroups.map((group, groupIdx) => (
                  <section key={group.category.id || groupIdx}>
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        {group.category.icon && <span className="text-2xl">{group.category.icon}</span>}
                        {group.category.name_en || group.category.name || group.category.name_zh}
                      </h2>
                      <span className="text-sm text-primary font-medium hover:underline cursor-pointer">View All →</span>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {group.guides.map((guide, idx) => {
                        const vertical = verticalConfig[guide.content_vertical] || { label: 'Guide', className: 'badge-gray' };
                        return (
                          <Link key={guide.id} href={`/guides/${guide.slug}`} className="bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group block">
                            {guide.cover_image_url ? (
                              <div className="h-40 overflow-hidden">
                                <img
                                  src={guide.cover_image_url}
                                  alt={guide.title_en || guide.title_zh || 'Guide cover'}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className={`h-40 bg-gradient-to-br ${getGradient(groupIdx * 4 + idx + 3)} flex items-center justify-center text-4xl`}>
                                {getEmoji(guide.title_en || guide.title_zh || '', groupIdx * 4 + idx)}
                              </div>
                            )}
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`badge ${vertical.className} rounded-full`}>{vertical.label}</span>
                              </div>
                              <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                                {guide.title_en || guide.title_zh}
                              </h3>
                              {guide.audience_tags && Array.isArray(guide.audience_tags) && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {guide.audience_tags.slice(0, 2).map((tag: string) => (
                                    <span key={tag} className="text-xs bg-accent-green-light text-green-700 px-2 py-0.5 rounded-full">{tag}</span>
                                  ))}
                                </div>
                              )}
                              {guide.read_time_minutes && (
                                <p className="text-xs text-text-muted mt-2">{guide.read_time_minutes} min read</p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}

                {/* Newsletter CTA */}
                <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                  <h2 className="text-xl font-bold mb-2">Subscribe to the Local Weekly</h2>
                  <p className="text-sm text-text-secondary mb-5">One email per week with curated local news, practical guides, event picks, and community highlights</p>
                  <NewsletterForm source="guides_cta" className="max-w-md mx-auto" />
                </section>
              </>
            )}
          </div>

          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-36 space-y-6">

              {/* Hot Search Terms */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  Trending Searches
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['Family Doctor', 'Tax Filing', 'Driver License', 'School Districts', 'Health Insurance', 'Renting Guide', 'Moving Checklist', 'Home Buying'].map((term) => (
                    <span
                      key={term}
                      className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-border-light rounded-full hover:bg-primary-50 hover:text-primary transition cursor-pointer"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>

              {/* Featured Business Card */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-text-primary">Featured Business</h3>
                  <span className="text-xs text-text-muted">Sponsored</span>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-200 to-green-300 flex-shrink-0 flex items-center justify-center text-lg">💼</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">Middletown Tax Services</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-yellow-500 text-xs">★★★★★</span>
                      <span className="text-xs text-text-muted">4.7 (94 reviews)</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs bg-accent-blue-light text-secondary-dark px-2 py-0.5 rounded-full">Local Business</span>
                  <span className="text-xs bg-accent-red-light text-accent-red px-2 py-0.5 rounded-full">Tax Season Hot</span>
                  <span className="text-xs bg-accent-green-light text-green-700 px-2 py-0.5 rounded-full">Free Consultation</span>
                </div>
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-primary-700"><strong>Tax Season Special:</strong> 20% off for new clients. Personal tax filing starting at $88.</p>
                </div>
                <p className="text-xs text-text-muted mb-3">136-40 39th Ave, Flushing, NY 11354</p>
                <Link href="/businesses" className="block text-center btn btn-primary py-2.5 text-sm">Learn More</Link>
              </div>

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
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
