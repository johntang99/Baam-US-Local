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

function initCategorySelection(
  categoryTree: CategoryTreeItem[],
  selectedCategoryIds: string[]
): { parentId: string; childId: string } {
  if (selectedCategoryIds.length === 0) return { parentId: '', childId: '' };

  // Check if the selected ID is a child category
  for (const { parent, children } of categoryTree) {
    for (const child of children) {
      if (selectedCategoryIds.includes(child.id)) {
        return { parentId: parent.id, childId: child.id };
      }
    }
    // Check if the selected ID is a parent category
    if (selectedCategoryIds.includes(parent.id)) {
      return { parentId: parent.id, childId: '' };
    }
  }

  return { parentId: '', childId: '' };
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

  // Right column
  const [status, setStatus] = useState(business?.status || 'active');
  const [verificationStatus, setVerificationStatus] = useState(business?.verification_status || 'unverified');
  const [currentPlan, setCurrentPlan] = useState(business?.current_plan || 'free');
  const [isFeatured, setIsFeatured] = useState(business?.is_featured || false);

  // Categories — sequential dropdowns
  const initCat = initCategorySelection(categoryTree, initialSelectedCategoryIds);
  const [selectedParentId, setSelectedParentId] = useState(initCat.parentId);
  const [selectedChildId, setSelectedChildId] = useState(initCat.childId);

  const parentCategories = categoryTree;
  const childCategories = categoryTree.find((c) => c.parent.id === selectedParentId)?.children || [];

  const handleParentChange = (parentId: string) => {
    setSelectedParentId(parentId);
    setSelectedChildId(''); // reset child when parent changes
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
    // Send category ids as JSON array — use child if selected, otherwise parent
    const categoryId = selectedChildId || selectedParentId;
    fd.set('category_ids', JSON.stringify(categoryId ? [categoryId] : []));
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

          {/* Categories — sequential dropdowns */}
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <label className="block text-sm font-medium">Category</label>
            <div>
              <label className="block text-xs text-text-muted mb-1">Main Category</label>
              <select
                value={selectedParentId}
                onChange={(e) => handleParentChange(e.target.value)}
                className={selectClass}
              >
                <option value="">Select a category</option>
                {parentCategories.map(({ parent }) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name_zh || parent.name_en || parent.slug}
                  </option>
                ))}
              </select>
            </div>
            {selectedParentId && childCategories.length > 0 && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Subcategory</label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select a subcategory</option>
                  {childCategories.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name_zh || child.name_en || child.slug}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
          {!isNew && business && (
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
          )}
        </div>
      </div>
    </div>
  );
}
