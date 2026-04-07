'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createArticle, updateArticle, publishArticle, generateAISummary, generateAIFAQ } from './actions';
import { AIContentGenerator } from './AIContentGenerator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImagePickerModal } from '@/components/admin/ImagePickerModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const contentVerticals = [
  { value: 'news_alert', label: 'News Alert' },
  { value: 'news_brief', label: 'News Brief' },
  { value: 'news_explainer', label: 'News Explainer' },
  { value: 'guide_howto', label: 'How-To Guide' },
  { value: 'guide_checklist', label: 'Checklist Guide' },
  { value: 'guide_comparison', label: 'Comparison Guide' },
];

const editorialStatuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'ai_drafted', label: 'AI Draft' },
  { value: 'human_reviewed', label: 'Reviewed' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const sourceTypes = [
  { value: 'official_gov', label: 'Government Official' },
  { value: 'media', label: 'Media' },
  { value: 'community_org', label: 'Community Organization' },
  { value: 'original', label: 'Original' },
  { value: 'ai_assisted', label: 'AI Assisted' },
  { value: 'business_website', label: 'Business Website' },
  { value: 'business_post', label: 'Business Post' },
];

const audienceOptions = [
  { value: 'new_immigrant', label: 'New Immigrants' },
  { value: 'family', label: 'Families' },
  { value: 'business', label: 'Businesses' },
  { value: 'senior', label: 'Seniors' },
  { value: 'student', label: 'Students' },
  { value: 'all', label: 'Everyone' },
];

const toolbarButtons = ['H2', 'H3', 'B', 'I', 'List', 'Img', 'Link', 'Code'];

interface ArticleFormProps {
  article?: AnyRow | null;
  categories: AnyRow[];
  regions: AnyRow[];
  businesses?: AnyRow[];
  linkedBusinessIds?: string[];
  isNew: boolean;
  siteParams?: string;
}

export default function ArticleForm({ article, categories, regions, businesses = [], linkedBusinessIds = [], isNew, siteParams = '' }: ArticleFormProps) {
  const siteQuery = siteParams ? `?${siteParams}` : '';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [titleZh, setTitleZh] = useState(article?.title_zh || '');
  const [titleEn, setTitleEn] = useState(article?.title_en || '');
  const [contentVertical, setContentVertical] = useState(article?.content_vertical || 'news_alert');
  const [bodyZh, setBodyZh] = useState(article?.body_zh || '');
  const [bodyEn, setBodyEn] = useState(article?.body_en || '');
  const [editorialStatus, setEditorialStatus] = useState(article?.editorial_status || 'draft');
  const [categoryId, setCategoryId] = useState(article?.category_id || '');
  const [regionId, setRegionId] = useState(article?.region_id || '');
  const [sourceType, setSourceType] = useState(article?.source_type || '');
  const [sourceName, setSourceName] = useState(article?.source_name || '');
  const [sourceUrl, setSourceUrl] = useState(article?.source_url || '');
  const [seoTitleZh, setSeoTitleZh] = useState(article?.seo_title_zh || '');
  const [seoDescZh, setSeoDescZh] = useState(article?.seo_desc_zh || '');
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(article?.audience_types || []);
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>(linkedBusinessIds);
  const [bizSearchTerm, setBizSearchTerm] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState(article?.cover_image_url || '');
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [aiSummaryZh, setAiSummaryZh] = useState(article?.ai_summary_zh || '');
  const [aiSummaryEn, setAiSummaryEn] = useState(article?.ai_summary_en || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiFaq, setAiFaq] = useState<{ q: string; a: string }[]>((article?.ai_faq as { q: string; a: string }[]) || []);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState('');
  const [previewLang, setPreviewLang] = useState<'zh' | 'en' | null>(null);

  const buildFormData = () => {
    const fd = new FormData();
    fd.set('title_zh', titleZh);
    fd.set('title_en', titleEn);
    fd.set('content_vertical', contentVertical);
    fd.set('body_zh', bodyZh);
    fd.set('body_en', bodyEn);
    fd.set('editorial_status', editorialStatus);
    fd.set('category_id', categoryId);
    fd.set('region_id', regionId);
    fd.set('source_type', sourceType);
    fd.set('source_name', sourceName);
    fd.set('source_url', sourceUrl);
    fd.set('seo_title_zh', seoTitleZh);
    fd.set('seo_desc_zh', seoDescZh);
    fd.set('audience_types', JSON.stringify(selectedAudiences));
    fd.set('linked_business_ids', JSON.stringify(selectedBusinessIds));
    fd.set('cover_image_url', coverImageUrl);
    return fd;
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const fd = buildFormData();
      if (isNew) {
        const result = await createArticle(fd);
        if (result.error) {
          setError(result.error);
        } else if (result.id) {
          router.push(`/admin/articles/${result.id}/edit${siteQuery}`);
        }
      } else {
        const result = await updateArticle(article!.id, fd);
        if (result.error) {
          setError(result.error);
        } else {
          router.refresh();
        }
      }
    });
  };

  const handlePublish = () => {
    startTransition(async () => {
      setError(null);
      const fd = buildFormData();
      fd.set('editorial_status', 'published');

      if (isNew) {
        const created = await createArticle(fd);
        if (created.error || !created.id) {
          setError(created.error || 'Failed to publish');
          return;
        }
        const published = await publishArticle(created.id);
        if (published.error) {
          setError(published.error);
          return;
        }
        router.push(`/admin/articles/${created.id}/edit${siteQuery}`);
        return;
      }

      const updated = await updateArticle(article!.id, fd);
      if (updated.error) {
        setError(updated.error);
        return;
      }
      const published = await publishArticle(article!.id);
      if (published.error) {
        setError(published.error);
        return;
      }
      router.refresh();
    });
  };

  const handleGenerateAISummary = async () => {
    if (!article?.id) return;
    setAiLoading(true);
    setAiError('');
    try {
      const result = await generateAISummary(article.id);
      if (result.error) {
        setAiError(result.error);
      } else {
        // Re-fetch the updated article to get new summaries
        router.refresh();
        // Optimistic: fetch directly since router.refresh won't update useState
        const res = await fetch(`/api/admin/article-summary?id=${article.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ai_summary_zh) setAiSummaryZh(data.ai_summary_zh);
          if (data.ai_summary_en) setAiSummaryEn(data.ai_summary_en);
        }
      }
    } catch (err) {
      setAiError('AI generation failed, please try again later');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateFAQ = async () => {
    if (!article?.id) return;
    setFaqLoading(true);
    setFaqError('');
    try {
      const result = await generateAIFAQ(article.id);
      if (result.error) {
        setFaqError(result.error);
      } else if (result.faq) {
        setAiFaq(result.faq);
        router.refresh();
      }
    } catch {
      setFaqError('FAQ generation failed, please try again later');
    } finally {
      setFaqLoading(false);
    }
  };

  const toggleAudience = (value: string) => {
    setSelectedAudiences((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAIGenerated = (data: any) => {
    console.log('[AI Generated]', JSON.stringify(data).slice(0, 500));
    if (!data || typeof data !== 'object') {
      console.error('[AI] Invalid data received:', data);
      return;
    }
    if (data.title_zh) setTitleZh(data.title_zh);
    if (data.title_en) setTitleEn(data.title_en);
    if (data.body_zh) setBodyZh(data.body_zh);
    if (data.body_en) setBodyEn(data.body_en);
    setAiSummaryZh(data.ai_summary_zh || '');
    setAiSummaryEn(data.ai_summary_en || '');
    setAiFaq(data.ai_faq || []);
    setSeoTitleZh(data.seo_title_zh || '');
    setSeoDescZh(data.seo_desc_zh || '');
    // Set status to ai_drafted
    setEditorialStatus('ai_drafted');
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted mb-1">
              <a href={`/admin${siteQuery}`} className="hover:underline">Admin</a>
              {' > '}
              <a href={`/admin/articles${siteQuery}`} className="hover:underline">Content Management</a>
              {' > '}
              {isNew ? 'New' : 'Edit'}
            </p>
            <h1 className="text-xl font-bold">{isNew ? 'New Article' : 'Edit Article'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium rounded-lg border border-border bg-bg-card hover:bg-bg-page disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={handlePublish}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Publish
            </button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>

      {/* AI Content Generator */}
      <div className="px-6 pt-6">
        <AIContentGenerator onGenerated={handleAIGenerated} />
      </div>

      {/* Two-column layout */}
      <div className="p-6 flex gap-6">
        {/* Left column 70% */}
        <div className="flex-1 min-w-0 space-y-6" style={{ flex: '7' }}>
          {/* Title ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Title (Chinese)</label>
            <input
              type="text"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              placeholder="Enter article title in Chinese"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Title EN */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Title (English)</label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Enter article title in English"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Content Vertical */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Content Type</label>
            <select
              value={contentVertical}
              onChange={(e) => setContentVertical(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {contentVerticals.map((cv) => (
                <option key={cv.value} value={cv.value}>{cv.label}</option>
              ))}
            </select>
          </div>

          {/* Body ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Body (Chinese)</label>
              {bodyZh && <button type="button" onClick={() => setPreviewLang('zh')} className="text-xs text-blue-600 hover:underline">Preview</button>}
            </div>
            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-border">
              {toolbarButtons.map((btn) => (
                <button
                  key={btn}
                  type="button"
                  className="px-2 py-1 text-xs font-mono text-text-muted border border-border rounded hover:bg-bg-page"
                >
                  {btn}
                </button>
              ))}
            </div>
            <textarea
              value={bodyZh}
              onChange={(e) => setBodyZh(e.target.value)}
              placeholder="Enter article body content (Markdown supported)"
              rows={12}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
          </div>

          {/* Body EN */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Body (English)</label>
              {bodyEn && <button type="button" onClick={() => setPreviewLang('en')} className="text-xs text-blue-600 hover:underline">Preview</button>}
            </div>
            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-border">
              {toolbarButtons.map((btn) => (
                <button
                  key={btn}
                  type="button"
                  className="px-2 py-1 text-xs font-mono text-text-muted border border-border rounded hover:bg-bg-page"
                >
                  {btn}
                </button>
              ))}
            </div>
            <textarea
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              placeholder="Enter article body content (Markdown supported)"
              rows={12}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
          </div>

          {/* AI Summary */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium">AI Summary</label>
              <button
                type="button"
                onClick={handleGenerateAISummary}
                disabled={isPending || isNew || aiLoading}
                className="h-8 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {aiLoading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Generate Summary
                  </>
                )}
              </button>
            </div>
            {aiError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{aiError}</div>
            )}
            {(aiSummaryZh || aiSummaryEn) ? (
              <div className="space-y-3">
                {aiSummaryZh && (
                  <div className="bg-bg-page border border-border rounded-lg p-3">
                    <p className="text-xs text-text-muted mb-1 font-medium">Chinese Summary</p>
                    <p className="text-sm">{aiSummaryZh}</p>
                  </div>
                )}
                {aiSummaryEn && (
                  <div className="bg-bg-page border border-border rounded-lg p-3">
                    <p className="text-xs text-text-muted mb-1 font-medium">English Summary</p>
                    <p className="text-sm">{aiSummaryEn}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">{isNew ? 'Save as draft first, then you can regenerate the summary' : 'Click "AI Generate Summary" button'}</p>
            )}
          </div>

          {/* AI FAQ */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium">AI FAQ</label>
              <button
                type="button"
                onClick={handleGenerateFAQ}
                disabled={isPending || isNew || faqLoading}
                className="h-8 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {faqLoading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate FAQ
                  </>
                )}
              </button>
            </div>
            {faqError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{faqError}</div>
            )}
            {aiFaq.length > 0 ? (
              <div className="space-y-2">
                {aiFaq.map((item, i) => (
                  <div key={i} className="bg-bg-page border border-border rounded-lg p-3">
                    <p className="text-sm font-medium">Q: {item.q}</p>
                    <p className="text-sm text-text-muted mt-1">A: {item.a}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">{isNew ? 'Save as draft first, then you can generate FAQ' : 'Click "Generate FAQ" to create frequently asked questions'}</p>
            )}
          </div>
        </div>

        {/* Right column 30% */}
        <div className="space-y-6" style={{ flex: '3' }}>
          {/* Editorial Status */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Editorial Status</label>
            <select
              value={editorialStatus}
              onChange={(e) => setEditorialStatus(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {editorialStatuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name_zh || c.name_en || c.slug}</option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Region</label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="">Select region</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name_zh || r.slug}</option>
              ))}
            </select>
          </div>

          {/* Source Info */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">Source Information</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">Source Type</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">Select source type</option>
                {sourceTypes.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Source Name</label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g.: New York Times"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Source URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Cover Image */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Cover Image</label>
            {coverImageUrl ? (
              <div className="relative group rounded-lg overflow-hidden mb-2">
                <img src={coverImageUrl} alt="Cover" className="w-full aspect-[16/9] object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setCoverPickerOpen(true)}
                    className="bg-white text-gray-800 text-xs px-3 py-1.5 rounded shadow"
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl('')}
                    className="bg-red-600 text-white text-xs px-3 py-1.5 rounded shadow"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCoverPickerOpen(true)}
                className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <p className="text-sm text-text-secondary">Click to select cover image</p>
                <p className="text-xs text-text-muted mt-1">Recommended size 1200x630</p>
              </button>
            )}
            {/* Also allow pasting URL directly */}
            <input
              type="text"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="Or paste image URL directly"
              className="w-full h-8 px-3 mt-2 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <ImagePickerModal
              open={coverPickerOpen}
              folder="articles/covers"
              onClose={() => setCoverPickerOpen(false)}
              onSelect={(url) => { setCoverImageUrl(url); setCoverPickerOpen(false); }}
            />
          </div>

          {/* Audience Types */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-3">Audience Type</label>
            <div className="space-y-2">
              {audienceOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAudiences.includes(opt.value)}
                    onChange={() => toggleAudience(opt.value)}
                    className="rounded border-gray-300"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Linked Businesses */}
          {businesses.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
              <label className="block text-sm font-medium">Linked Businesses</label>
              <p className="text-xs text-text-muted">Select businesses related to this article. The article will appear on the business detail page.</p>
              <input
                type="text"
                value={bizSearchTerm}
                onChange={(e) => setBizSearchTerm(e.target.value)}
                placeholder="Search business name..."
                className="w-full h-9 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {/* Selected businesses */}
              {selectedBusinessIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedBusinessIds.map((bizId) => {
                    const biz = businesses.find((b) => b.id === bizId);
                    return (
                      <span key={bizId} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary pl-2 pr-1 py-1 rounded-md">
                        {biz?.display_name_zh || biz?.display_name || bizId.slice(0, 8)}
                        <button
                          type="button"
                          onClick={() => setSelectedBusinessIds(prev => prev.filter(id => id !== bizId))}
                          className="hover:bg-primary/20 rounded p-0.5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Business search results */}
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {businesses
                  .filter((b) => !selectedBusinessIds.includes(b.id))
                  .filter((b) => {
                    if (!bizSearchTerm) return false; // only show when searching
                    const term = bizSearchTerm.toLowerCase();
                    return (b.display_name || '').toLowerCase().includes(term)
                      || (b.display_name_zh || '').toLowerCase().includes(term);
                  })
                  .slice(0, 10)
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => { setSelectedBusinessIds(prev => [...prev, b.id]); setBizSearchTerm(''); }}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-bg-page truncate"
                    >
                      {b.display_name_zh || b.display_name}
                      {b.display_name_zh && b.display_name && (
                        <span className="text-text-muted ml-1">{b.display_name}</span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* SEO */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">SEO Settings</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">SEO Title (Chinese)</label>
              <input
                type="text"
                value={seoTitleZh}
                onChange={(e) => setSeoTitleZh(e.target.value)}
                placeholder="SEO title, leave empty to use article title"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">SEO Description (Chinese)</label>
              <input
                type="text"
                value={seoDescZh}
                onChange={(e) => setSeoDescZh(e.target.value)}
                placeholder="SEO description, leave empty to use AI summary"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewLang && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setPreviewLang(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-[90%] max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-lg">Article Preview</h3>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewLang('zh')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${previewLang === 'zh' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >Chinese</button>
                  <button
                    type="button"
                    onClick={() => setPreviewLang('en')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${previewLang === 'en' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >English</button>
                </div>
              </div>
              <button onClick={() => setPreviewLang(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">&times;</button>
            </div>

            {/* Modal Body */}
            <div className="overflow-auto flex-1">
              <div className="max-w-2xl mx-auto px-8 py-10">
                {/* Title */}
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-4 text-gray-900">
                  {previewLang === 'zh' ? titleZh : titleEn}
                </h1>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-6 pb-6 border-b border-gray-100">
                  <span>Baam Editorial</span>
                  <span>·</span>
                  <span>{new Date().toLocaleDateString('en-US')}</span>
                  {aiSummaryZh && <span>·</span>}
                  {aiSummaryZh && <span className="text-blue-500">AI Assisted</span>}
                </div>

                {/* AI Summary */}
                {(previewLang === 'zh' ? aiSummaryZh : aiSummaryEn) && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-r-lg px-5 py-4 mb-8">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">AI Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{previewLang === 'zh' ? aiSummaryZh : aiSummaryEn}</p>
                  </div>
                )}

                {/* Article Body */}
                <div className="
                  text-base leading-[1.8] text-gray-800
                  [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-10 [&_h1]:mb-4 [&_h1]:text-gray-900
                  [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-gray-900 [&_h2]:border-b [&_h2]:border-gray-100 [&_h2]:pb-2
                  [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-gray-900
                  [&_p]:mb-5 [&_p]:leading-[1.8]
                  [&_ul]:mb-5 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:space-y-2
                  [&_ol]:mb-5 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2
                  [&_li]:leading-[1.7]
                  [&_strong]:font-semibold [&_strong]:text-gray-900
                  [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2
                  [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:my-6
                  [&_hr]:my-8 [&_hr]:border-gray-200
                  [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-red-600
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {previewLang === 'zh' ? bodyZh : bodyEn}
                  </ReactMarkdown>
                </div>

                {/* FAQ */}
                {aiFaq.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-5">Frequently Asked Questions</h3>
                    <div className="space-y-3">
                      {aiFaq.map((item, i) => (
                        <details key={i} className="group border border-gray-200 rounded-xl overflow-hidden">
                          <summary className="px-5 py-4 text-sm font-medium cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <span>{item.q}</span>
                            <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                            {item.a}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
