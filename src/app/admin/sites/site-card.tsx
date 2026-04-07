'use client';

import { useState } from 'react';
import { addRegionToSite, removeRegionFromSite, updateSite, deleteSite, updateSiteStatus, setPrimaryRegion } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface SiteCardProps {
  site: AnyRow;
  siteRegions: AnyRow[];
  counts: { articles: number; businesses: number; threads: number };
  allRegions: AnyRow[];
}

export function SiteCard({ site, siteRegions, counts, allRegions }: SiteCardProps) {
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState('');

  const currentRegionIds = new Set(siteRegions.map(r => r.id));
  const availableRegions = allRegions.filter(r => !currentRegionIds.has(r.id));

  const handleAddRegion = async (regionId: string) => {
    setLoading(regionId);
    await addRegionToSite(site.id, regionId);
    setLoading('');
    setShowAddRegion(false);
  };

  const handleRemoveRegion = async (regionId: string) => {
    if (!confirm('Are you sure you want to remove this region from the site?')) return;
    setLoading(regionId);
    await removeRegionFromSite(site.id, regionId);
    setLoading('');
  };

  const handleSetPrimary = async (regionId: string) => {
    setLoading('primary-' + regionId);
    await setPrimaryRegion(site.id, regionId);
    setLoading('');
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete site "${site.name}"? This action cannot be undone.`)) return;
    await deleteSite(site.id);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading('saving');
    const formData = new FormData(e.currentTarget);
    await updateSite(site.id, formData);
    setLoading('');
    setEditing(false);
  };

  const handleStatusToggle = async () => {
    const next = site.status === 'active' ? 'disabled' : site.status === 'disabled' ? 'planned' : 'active';
    await updateSiteStatus(site.id, next);
  };

  // Edit mode
  if (editing) {
    return (
      <div className="bg-white border-2 border-primary rounded-xl p-6">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-base">Edit Site</h3>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Slug</label>
              <input name="slug" defaultValue={site.slug} className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Language</label>
              <select name="locale" defaultValue={site.locale} className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                <option value="zh">Chinese</option>
                <option value="en">English</option>
                <option value="bilingual">Bilingual</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Name *</label>
              <input name="name" defaultValue={site.name} required className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Chinese Name</label>
              <input name="name_zh" defaultValue={site.name_zh || ''} className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Domain</label>
            <input name="domain" defaultValue={site.domain || ''} className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Description</label>
            <textarea name="description" defaultValue={site.description || ''} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" onClick={handleDelete} className="text-sm text-red-600 hover:text-red-700 hover:underline">Delete Site</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="h-9 px-4 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={loading === 'saving'} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50">
                {loading === 'saving' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // View mode
  return (
    <div className={`bg-white border rounded-xl p-6 ${site.status === 'active' ? 'border-green-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base">{site.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${
                site.status === 'active' ? 'bg-green-100 text-green-700' :
                site.status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-500'
              }`}
              onClick={handleStatusToggle}
              title="Click to toggle status"
            >
              {site.status === 'active' ? 'Active' : site.status === 'planned' ? 'Planned' : 'Disabled'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{site.name_zh}</p>
        </div>
        <button onClick={() => setEditing(true)} className="text-sm text-primary hover:underline">Edit</button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-500">Domain</span>
          <span className="font-mono text-gray-700">{site.domain || '—'}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-500">Language</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            site.locale === 'zh' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}>{site.locale === 'zh' ? 'Chinese' : 'English'}</span>
        </div>

        {/* Regions */}
        <div className="py-2 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500">Coverage Regions</span>
            <button onClick={() => setShowAddRegion(!showAddRegion)} className="text-xs text-primary hover:underline">+ Add Region</button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {siteRegions.map(region => (
              <span key={region.id} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs group relative">
                {region.name_zh || region.name_en}
                {region.is_primary && <span className="text-primary text-[10px]">★</span>}
                <span className="hidden group-hover:flex items-center gap-0.5 ml-1">
                  {!region.is_primary && (
                    <button onClick={() => handleSetPrimary(region.id)} className="text-yellow-500 hover:text-yellow-600" title="Set as primary region">★</button>
                  )}
                  <button onClick={() => handleRemoveRegion(region.id)} className="text-gray-400 hover:text-red-500" title="Remove">×</button>
                </span>
              </span>
            ))}
            {siteRegions.length === 0 && <span className="text-xs text-gray-400">No regions</span>}
          </div>

          {showAddRegion && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Select a region to add:</p>
              {availableRegions.length === 0 ? (
                <p className="text-xs text-gray-400">All regions have been added</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableRegions.map(region => (
                    <button key={region.id} onClick={() => handleAddRegion(region.id)} disabled={loading === region.id}
                      className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white hover:border-primary transition disabled:opacity-50">
                      {loading === region.id ? '...' : `+ ${region.name_zh || region.name_en}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {site.description && (
          <div className="py-2">
            <span className="text-gray-500 text-xs">{site.description}</span>
          </div>
        )}
      </div>

      {site.status === 'active' && (
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center"><p className="text-lg font-bold">{counts.articles}</p><p className="text-xs text-gray-500">Articles</p></div>
          <div className="text-center"><p className="text-lg font-bold">{counts.businesses}</p><p className="text-xs text-gray-500">Businesses</p></div>
          <div className="text-center"><p className="text-lg font-bold">{counts.threads}</p><p className="text-xs text-gray-500">Threads</p></div>
        </div>
      )}
    </div>
  );
}
