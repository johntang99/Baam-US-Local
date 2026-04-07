import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { LeadForm } from '@/components/shared/lead-form';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();
  const { data } = await supabase
    .from('articles')
    .select('title_zh, title_en, ai_summary_zh, summary_zh, cover_image_url')
    .eq('site_id', site.id)
    .eq('slug', slug)
    .single();

  const article = data as AnyRow | null;
  if (!article) return { title: 'Not Found' };

  return {
    title: `${article.title_en || article.title_zh} · Baam`,
    description: article.ai_summary_en || article.summary_en || article.ai_summary_zh || article.summary_zh || '',
    openGraph: {
      title: article.title_en || article.title_zh || '',
      description: article.ai_summary_en || article.summary_en || article.ai_summary_zh || article.summary_zh || '',
      images: article.cover_image_url ? [article.cover_image_url] : [],
    },
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

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();

  // Fetch guide article
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('site_id', site.id)
    .eq('slug', slug)
    .eq('editorial_status', 'published')
    .single();

  const article = data as AnyRow | null;
  if (error || !article) notFound();

  const vertical = verticalConfig[article.content_vertical] || { label: 'Guide', className: 'badge-gray' };
  const title = article.title_en || article.title_zh;
  const body = article.body_en || article.body_zh;
  const summary = article.ai_summary_en || article.summary_en || article.ai_summary_zh || article.summary_zh;
  const faq = article.ai_faq as Array<{ q: string; a: string }> | null;
  const audienceTags = (article.audience_tags || []) as string[];

  // Fetch linked businesses via guide_business_links join table
  const { data: rawLinks } = await supabase
    .from('guide_business_links')
    .select('*, businesses(*)')
    .eq('article_id', article.id);

  const businessLinks = (rawLinks || []) as AnyRow[];

  // Fetch related news articles (same category, limit 3)
  const { data: rawRelated } = await supabase
    .from('articles')
    .select('id, slug, title_zh, title_en, content_vertical, published_at')
    .eq('site_id', site.id)
    .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
    .eq('editorial_status', 'published')
    .neq('id', article.id)
    .order('published_at', { ascending: false })
    .limit(3);

  const relatedNews = (rawRelated || []) as AnyRow[];

  // Fetch related discover posts (matching audience_tags or topic_tags)
  let discoverPosts: AnyRow[] = [];
  if (audienceTags.length > 0) {
    const { data: rawDiscover } = await supabase
      .from('voice_posts')
      .select('id, slug, title, cover_images, cover_image_url, like_count, profiles!voice_posts_author_id_fkey(display_name)')
      .eq('site_id', site.id)
      .eq('status', 'published')
      .overlaps('topic_tags', audienceTags)
      .order('like_count', { ascending: false })
      .limit(6);
    discoverPosts = (rawDiscover || []) as AnyRow[];
  }

  // Check if this is medical/legal content that needs update timestamp
  const isSensitiveContent = article.content_vertical === 'guide_howto' && (
    (article.title_zh && (article.title_zh.includes('\u533B') || article.title_zh.includes('\u6CD5\u5F8B') || article.title_zh.includes('\u4FDD\u9669') || article.title_zh.includes('\u767D\u5361'))) ||
    (article.title_en && (article.title_en.toLowerCase().includes('medical') || article.title_en.toLowerCase().includes('legal') || article.title_en.toLowerCase().includes('insurance')))
  );

  return (
    <main>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="lg:flex gap-8">

          {/* Main Content */}
          <article className="flex-1 max-w-[var(--content-max)]">

            {/* Breadcrumb */}
            <nav className="text-sm text-text-muted mb-4">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">›</span>
              <Link href="/guides" className="hover:text-primary">Guides</Link>
              <span className="mx-2">›</span>
              <span className="text-text-secondary">{title}</span>
            </nav>

            {/* Header */}
            <header className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`badge ${vertical.className}`}>{vertical.label}</span>
                {audienceTags.map((tag) => (
                  <span key={tag} className="text-xs text-text-muted bg-border-light px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">{title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                {article.published_at && (
                  <time>{new Date(article.published_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}</time>
                )}
                {article.read_time_minutes && (
                  <span>{article.read_time_minutes} min read</span>
                )}
                {article.region_id && (
                  <span className="bg-border-light px-2 py-0.5 rounded">Middletown</span>
                )}
                <span>{article.view_count || 0} views</span>
              </div>
            </header>

            {/* Cover Image */}
            {article.cover_image_url && (
              <div className="mb-6 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img
                  src={article.cover_image_url}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Source Attribution (for business_website articles) */}
            {(article.source_type === 'business_website' || article.source_type === 'business_post') && (article.source_name || article.source_url) && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-800">
                    Source: {article.source_name || 'Business Contribution'}
                  </p>
                  {article.source_url && (
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate block"
                    >
                      View Original →{' '}
                      {article.source_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Medical/Legal Content Update Notice */}
            {isSensitiveContent && article.last_reviewed_at && (
              <div className="flex items-center gap-2 p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg mb-6">
                <span className="text-lg">⚠️</span>
                <p className="text-xs text-text-secondary">
                  This article contains medical/legal information, last reviewed on{' '}
                  <strong>{new Date(article.last_reviewed_at).toLocaleDateString('en-US')}</strong>.
                  Please note that policies may have changed. Consult a professional for current advice.
                </p>
              </div>
            )}

            {/* AI Summary */}
            {summary && (
              <div className="ai-summary-card mb-6">
                <p className="text-sm text-secondary-dark leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Article Body */}
            {body && (
              <div className="prose prose-sm max-w-none mb-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-text-primary [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_table]:w-full [&_table]:border-collapse [&_th]:bg-bg-page [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            )}

            {/* FAQ Section */}
            {faq && faq.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>❓</span> FAQ
                </h2>
                <div className="space-y-3">
                  {faq.map((item, idx) => (
                    <details
                      key={idx}
                      className="bg-bg-card border border-border rounded-lg group"
                    >
                      <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-text-primary hover:text-primary transition list-none flex items-center justify-between">
                        <span>{item.q}</span>
                        <svg className="w-4 h-4 text-text-muted flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed border-t border-border pt-3">
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Business Recommendations */}
            {businessLinks.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>🏪</span> Recommended Businesses
                </h2>
                <div className="space-y-4">
                  {businessLinks.map((link) => {
                    const biz = link.businesses as AnyRow | null;
                    if (!biz) return null;
                    return (
                      <div key={link.id} className="biz-inline-card">
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex-shrink-0 flex items-center justify-center text-2xl">
                          🏪
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm truncate">{biz.display_name_zh || biz.display_name || biz.name_zh || biz.name}</h4>
                            {biz.is_verified && (
                              <svg className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          {biz.avg_rating && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-yellow-500 text-xs">{'★'.repeat(Math.round(biz.avg_rating))}</span>
                              <span className="text-xs text-text-muted">{biz.avg_rating} ({biz.review_count || 0} reviews)</span>
                            </div>
                          )}
                          {biz.tags && Array.isArray(biz.tags) && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {biz.tags.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="text-xs bg-border-light text-text-secondary px-1.5 py-0.5 rounded">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Link
                            href={`/businesses/${biz.slug || biz.id}`}
                            className="btn btn-primary h-9 px-4 text-xs"
                          >
                            Contact
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Lead Capture Form */}
            <section className="lead-capture mb-8">
              <h2 className="text-lg font-bold mb-2">Need Professional Help?</h2>
              <p className="text-sm text-text-secondary mb-4">
                Leave your info and we will match you with the best local service providers. Free consultation.
              </p>
              <LeadForm sourceType="guide" sourceArticleId={article.id} />
            </section>

            {/* Share */}
            <div className="flex items-center gap-3 py-4 border-t border-border">
              <span className="text-sm text-text-secondary">Share:</span>
              <button className="btn btn-outline h-8 px-3 text-xs">Twitter</button>
              <button className="btn btn-outline h-8 px-3 text-xs">Facebook</button>
              <button className="btn btn-outline h-8 px-3 text-xs">Copy Link</button>
            </div>

            {/* Related News */}
            {relatedNews.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>📰</span> Related News
                </h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedNews.map((news) => (
                    <Link key={news.id} href={`/news/${news.slug}`} className="card p-4 block">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="badge badge-gray text-xs">News</span>
                        {news.published_at && (
                          <span className="text-xs text-text-muted">
                            {new Date(news.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-sm line-clamp-2">{news.title_en || news.title_zh}</h3>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Related Discover Posts */}
            {discoverPosts.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>📝</span> Related Posts
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {discoverPosts.map((post, i) => {
                    const coverImage = post.cover_images?.[0] || post.cover_image_url;
                    const authorName = post.profiles?.display_name || 'Anonymous';
                    const gradients = ['from-rose-200 to-pink-100', 'from-emerald-200 to-teal-100', 'from-violet-200 to-purple-100', 'from-sky-200 to-blue-100'];
                    return (
                      <Link key={post.id} href={`/discover/${post.slug || post.id}`} className="group">
                        <div className="rounded-xl overflow-hidden bg-white border border-gray-200 hover:shadow-md transition-shadow">
                          <div className="aspect-[4/3] overflow-hidden">
                            {coverImage ? (
                              <img src={coverImage} alt={post.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                                <span className="text-white/50 text-xl font-bold">{post.title?.[0] || '📝'}</span>
                              </div>
                            )}
                          </div>
                          <div className="p-2.5">
                            <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 mb-1 leading-snug">{post.title}</h3>
                            <span className="text-[10px] text-gray-400">{authorName}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </article>

          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6 mt-8 lg:mt-0">

            {/* Sticky TOC (placeholder) */}
            <div className="sticky top-24 space-y-6">
              <div className="bg-bg-card rounded-xl border border-border p-5">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h6" />
                  </svg>
                  Contents
                </h3>
                <nav className="space-y-2">
                  {/* Placeholder TOC items generated from heading patterns */}
                  {body ? extractHeadings(body).map((heading, idx) => (
                    <a
                      key={idx}
                      href={`#section-${idx}`}
                      className={`block text-sm hover:text-primary transition ${
                        heading.level === 2 ? 'text-text-primary font-medium' : 'text-text-muted pl-3'
                      }`}
                    >
                      {heading.text}
                    </a>
                  )) : (
                    <p className="text-xs text-text-muted">No table of contents</p>
                  )}
                </nav>
              </div>

              {/* Newsletter Subscribe */}
              <div className="bg-bg-card rounded-xl border border-border p-5">
                <h3 className="font-semibold text-sm mb-3">Subscribe to Local Weekly</h3>
                <p className="text-xs text-text-secondary mb-3">Weekly curated local news, guides, and events</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                  <button className="btn btn-primary h-9 px-4 text-sm">Subscribe</button>
                </div>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}

/** Extract h2/h3 headings from markdown text for TOC */
function extractHeadings(markdown: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[*_`#]/g, '').trim(),
      });
    }
  }
  return headings.slice(0, 10); // Limit to 10 headings
}
