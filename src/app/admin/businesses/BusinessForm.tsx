'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createBusiness, updateBusiness } from './actions';
import ImageUploader from './ImageUploader';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'suspended', label: 'Suspended' },
];

const verificationOptions = [
  { value: 'unverified', label: 'Unverified' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
];

const planOptions = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'content', label: 'Content' },
  { value: 'reputation', label: 'Reputation' },
  { value: 'lead', label: 'Lead' },
  { value: 'growth', label: 'Growth' },
];

interface CategoryTreeItem {
  parent: AnyRow;
  children: AnyRow[];
}

interface BusinessFormProps {
  business?: AnyRow | null;
  categories: AnyRow[];
  categoryTree: CategoryTreeItem[];
  selectedCategoryIds?: string[];
  existingImages?: string[];
  isNew: boolean;
  siteParams?: string;
}

const inputClass = 'w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
const textareaClass = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y';
const selectClass = 'w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white';

interface CategoryPair {
  parentId: string;
  childId: string;
}

function initCategoryPairs(
  categoryTree: CategoryTreeItem[],
  selectedCategoryIds: string[]
): CategoryPair[] {
  if (selectedCategoryIds.length === 0) return [{ parentId: '', childId: '' }];

  const pairs: CategoryPair[] = [];
  const usedIds = new Set<string>();

  for (const catId of selectedCategoryIds) {
    if (usedIds.has(catId)) continue;

    // Check if it's a child category
    let found = false;
    for (const { parent, children } of categoryTree) {
      for (const child of children) {
        if (child.id === catId) {
          pairs.push({ parentId: parent.id, childId: child.id });
          usedIds.add(catId);
          found = true;
          break;
        }
      }
      if (found) break;
      // Check if it's a parent category
      if (parent.id === catId) {
        pairs.push({ parentId: parent.id, childId: '' });
        usedIds.add(catId);
        break;
      }
    }
  }

  return pairs.length > 0 ? pairs : [{ parentId: '', childId: '' }];
}

export default function BusinessForm({
  business,
  categories,
  categoryTree,
  selectedCategoryIds: initialSelectedCategoryIds = [],
  existingImages = [],
  isNew,
  siteParams = '',
}: BusinessFormProps) {
  const siteQuery = siteParams ? `?${siteParams}` : '';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state — basic info
  const [displayNameZh, setDisplayNameZh] = useState(business?.display_name_zh || '');
  const [displayName, setDisplayName] = useState(business?.display_name || '');
  const [shortDescZh, setShortDescZh] = useState(business?.short_desc_zh || '');
  const [fullDescZh, setFullDescZh] = useState(business?.full_desc_zh || '');

  // Address / NAP
  const [addressFull, setAddressFull] = useState(business?.address_full || '');
  const [city, setCity] = useState(business?.city || '');
  const [state, setState] = useState(business?.state || 'NY');
  const [zipCode, setZipCode] = useState(business?.zip_code || '');

  // Contact
  const [phone, setPhone] = useState(business?.phone || '');
  const [email, setEmail] = useState(business?.email || '');
  const [websiteUrl, setWebsiteUrl] = useState(business?.website_url || '');

  // Social media
  const [facebookUrl, setFacebookUrl] = useState(business?.facebook_url || '');
  const [instagramUrl, setInstagramUrl] = useState(business?.instagram_url || '');
  const [tiktokUrl, setTiktokUrl] = useState(business?.tiktok_url || '');
  const [youtubeUrl, setYoutubeUrl] = useState(business?.youtube_url || '');
  const [twitterUrl, setTwitterUrl] = useState(business?.twitter_url || '');

  // Media
  const [videoUrl, setVideoUrl] = useState(business?.video_url || '');

  // Scores
  const [pScore, setPScore] = useState<number>(business?.p_score ? Number(business.p_score) : 0);

  // Right column
  const [status, setStatus] = useState(business?.status || 'active');
  const [verificationStatus, setVerificationStatus] = useState(business?.verification_status || 'unverified');
  const [currentPlan, setCurrentPlan] = useState(business?.current_plan || 'free');
  const [isFeatured, setIsFeatured] = useState(business?.is_featured || false);

  // Compute total_score preview (same formula as DB: 6×Rating + 3×[log(Reviews+2)×2] + 1×P_score)
  const avgRating = business?.avg_rating ? Number(business.avg_rating) : 0;
  const reviewCount = business?.review_count ? Number(business.review_count) : 0;
  const computedTotalScore = 6 * avgRating + 3 * (Math.log10(Math.max(reviewCount + 1, 1) + 1) * 2) + 1 * pScore;

  // Categories — multiple category pairs
  const [categoryPairs, setCategoryPairs] = useState<CategoryPair[]>(
    initCategoryPairs(categoryTree, initialSelectedCategoryIds)
  );

  const parentCategories = categoryTree;

  const getChildCategories = (parentId: string) =>
    categoryTree.find((c) => c.parent.id === parentId)?.children || [];

  const updatePair = (index: number, field: 'parentId' | 'childId', value: string) => {
    setCategoryPairs(prev => {
      const updated = [...prev];
      if (field === 'parentId') {
        updated[index] = { parentId: value, childId: '' }; // reset child when parent changes
      } else {
        updated[index] = { ...updated[index], childId: value };
      }
      return updated;
    });
  };

  const addCategoryPair = () => {
    setCategoryPairs(prev => [...prev, { parentId: '', childId: '' }]);
  };

  const removeCategoryPair = (index: number) => {
    setCategoryPairs(prev => {
      if (prev.length <= 1) return [{ parentId: '', childId: '' }]; // always keep at least one
      return prev.filter((_, i) => i !== index);
    });
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.set('display_name', displayName);
    fd.set('display_name_zh', displayNameZh);
    fd.set('short_desc_zh', shortDescZh);
    fd.set('full_desc_zh', fullDescZh);
    fd.set('address_full', addressFull);
    fd.set('city', city);
    fd.set('state', state);
    fd.set('zip_code', zipCode);
    fd.set('phone', phone);
    fd.set('email', email);
    fd.set('website_url', websiteUrl);
    fd.set('facebook_url', facebookUrl);
    fd.set('instagram_url', instagramUrl);
    fd.set('tiktok_url', tiktokUrl);
    fd.set('youtube_url', youtubeUrl);
    fd.set('twitter_url', twitterUrl);
    fd.set('video_url', videoUrl);
    fd.set('status', status);
    fd.set('verification_status', verificationStatus);
    fd.set('current_plan', currentPlan);
    fd.set('is_featured', isFeatured ? 'true' : 'false');
    fd.set('p_score', String(pScore));
    // Send all category ids as JSON array — for each pair, use child if selected, otherwise parent
    const categoryIds = categoryPairs
      .map(pair => pair.childId || pair.parentId)
      .filter(Boolean);
    fd.set('category_ids', JSON.stringify([...new Set(categoryIds)])); // deduplicate
    return fd;
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const fd = buildFormData();
      if (isNew) {
        const result = await createBusiness(fd);
        if (result.error) {
          setError(result.error);
        } else if (result.id) {
          router.push(`/admin/businesses/${result.id}/edit${siteQuery}`);
        }
      } else {
        const result = await updateBusiness(business!.id, fd);
        if (result.error) {
          setError(result.error);
        } else {
          router.refresh();
        }
      }
    });
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
              <a href={`/admin/businesses${siteQuery}`} className="hover:underline">Business Management</a>
              {' > '}
              {isNew ? 'New' : 'Edit'}
            </p>
            <h1 className="text-xl font-bold">{isNew ? 'New Business' : 'Edit Business'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/admin/businesses${siteQuery}`}
              className="h-9 px-4 text-sm font-medium rounded-lg border border-border bg-bg-card hover:bg-bg-page inline-flex items-center"
            >
              Cancel
            </a>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="p-6 flex gap-6">
        {/* Left column 70% */}
        <div className="flex-1 min-w-0 space-y-6" style={{ flex: '7' }}>
          {/* Display Name ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Business Name (Chinese)</label>
            <input
              type="text"
              value={displayNameZh}
              onChange={(e) => setDisplayNameZh(e.target.value)}
              placeholder="Enter business name in Chinese"
              className={inputClass}
            />
          </div>

          {/* Display Name EN */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Business Name (English)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter business name in English"
              className={inputClass}
            />
          </div>

          {/* Short Description ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Short Description (Chinese)</label>
            <textarea
              value={shortDescZh}
              onChange={(e) => setShortDescZh(e.target.value)}
              placeholder="Enter a short business description"
              rows={3}
              className={textareaClass}
            />
          </div>

          {/* Full Description ZH */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Full Description (Chinese)</label>
            <textarea
              value={fullDescZh}
              onChange={(e) => setFullDescZh(e.target.value)}
              placeholder="Enter full business description, Markdown supported"
              rows={8}
              className={textareaClass}
            />
            <p className="text-xs text-text-muted mt-1">Supports Markdown: **bold**, - lists, ## headings, etc.</p>
          </div>

          {/* NAP Info */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">NAP Information</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">Address</label>
              <input
                type="text"
                value={addressFull}
                onChange={(e) => setAddressFull(e.target.value)}
                placeholder="Full address, e.g. 123 Main St, Suite 100"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. New York"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="NY"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Zip Code</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="10001"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">Contact Information</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 123-4567"
                  className={inputClass}
                />
                <p className="text-xs text-text-muted mt-0.5">Format: tel:+15551234567</p>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. info@business.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Website</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">Social Media</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Facebook</label>
                <input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Instagram</label>
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/yourpage"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">TikTok</label>
                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="https://tiktok.com/@yourpage"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">YouTube</label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@yourchannel"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Twitter / X</label>
                <input
                  type="url"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  placeholder="https://x.com/yourhandle"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Media */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">Media</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">Video URL</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="YouTube or other video URL"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Business Images</label>
              <ImageUploader
                businessSlug={business?.slug || 'temp-' + Date.now()}
                existingImages={existingImages}
              />
            </div>
          </div>

          {/* AI Description Placeholder */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium">AI Generated Description</label>
              <button
                type="button"
                disabled
                className="h-8 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Generate
              </button>
            </div>
            <p className="text-sm text-text-muted">Save business info first, then use AI to generate description</p>
          </div>
        </div>

        {/* Right column 30% */}
        <div className="space-y-6" style={{ flex: '3' }}>
          {/* Status */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectClass}
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Verification Status */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Verification Status</label>
            <select
              value={verificationStatus}
              onChange={(e) => setVerificationStatus(e.target.value)}
              className={selectClass}
            >
              {verificationOptions.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Plan */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-medium mb-2">Plan</label>
            <select
              value={currentPlan}
              onChange={(e) => setCurrentPlan(e.target.value)}
              className={selectClass}
            >
              {planOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Categories — multiple category pairs */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">Categories</label>
              <span className="text-xs text-text-muted">{categoryPairs.filter(p => p.parentId).length} assigned</span>
            </div>

            {categoryPairs.map((pair, index) => {
              const children = getChildCategories(pair.parentId);
              return (
                <div key={index} className="relative border border-border/60 rounded-lg p-3 space-y-2 bg-bg-page/50">
                  {categoryPairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCategoryPair(index)}
                      className="absolute top-2 right-2 text-text-muted hover:text-red-500 text-xs font-medium transition-colors"
                      title="Remove this category"
                    >
                      ✕
                    </button>
                  )}
                  <div>
                    <label className="block text-xs text-text-muted mb-1">
                      Main Category {categoryPairs.length > 1 ? `#${index + 1}` : ''}
                    </label>
                    <select
                      value={pair.parentId}
                      onChange={(e) => updatePair(index, 'parentId', e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select a category</option>
                      {parentCategories.map(({ parent }) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name_en || parent.name_zh || parent.slug}
                        </option>
                      ))}
                    </select>
                  </div>
                  {pair.parentId && children.length > 0 && (
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Subcategory</label>
                      <select
                        value={pair.childId}
                        onChange={(e) => updatePair(index, 'childId', e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select a subcategory</option>
                        {children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name_en || child.name_zh || child.slug}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addCategoryPair}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add another category
            </button>
          </div>

          {/* Is Featured */}
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm font-medium">Featured</span>
            </label>
          </div>

          {/* Business Stats (edit mode only) */}
          {!isNew && business && (<>
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
              <label className="block text-sm font-medium">Business Stats</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-page rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{business.avg_rating ? Number(business.avg_rating).toFixed(1) : '--'}</p>
                  <p className="text-xs text-text-muted">Avg Rating</p>
                </div>
                <div className="bg-bg-page rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{business.review_count ?? 0}</p>
                  <p className="text-xs text-text-muted">Reviews</p>
                </div>
                <div className="bg-bg-page rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{business.lead_count ?? 0}</p>
                  <p className="text-xs text-text-muted">Leads</p>
                </div>
                <div className="bg-bg-page rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{isFeatured ? 'Yes' : 'No'}</p>
                  <p className="text-xs text-text-muted">Featured</p>
                </div>
              </div>
            </div>

            {/* Platform Score & Total Score */}
            <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
              <label className="block text-sm font-medium">Ranking Score</label>

              {/* P-Score input */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Platform Score (editor-adjustable)</label>
                <input
                  type="number"
                  step="0.1"
                  min="-10"
                  max="50"
                  value={pScore}
                  onChange={(e) => setPScore(Number(e.target.value) || 0)}
                  className="w-full h-10 px-3 text-sm border border-border rounded-lg bg-bg-page focus:border-primary focus:outline-none"
                />
                <p className="text-xs text-text-muted mt-1">Positive = boost ranking, Negative = demote. Default 0.</p>
              </div>

              {/* Total Score display */}
              <div className="bg-bg-page rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-primary">{computedTotalScore.toFixed(1)}</p>
                <p className="text-xs text-text-muted mt-1">Total Score</p>
                <p className="text-[11px] text-text-muted mt-2">= 6×Rating + 3×log(Reviews)×2 + P-Score</p>
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
