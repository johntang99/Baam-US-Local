'use client';

import { useState } from 'react';
import { updateRegion, deleteRegion, toggleRegionActive } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface RegionRowProps {
  region: AnyRow;
  parent: AnyRow | undefined;
  belongsToSites: string[];
  allRegions: AnyRow[];
}

export function RegionRow({ region, parent, belongsToSites, allRegions }: RegionRowProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateRegion(region.id, formData);
    if (result.error) { alert(result.error); }
    setLoading(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the region "${region.name_zh || region.name_en}"? Associated content will not be deleted, but will lose its region association.`)) return;
    const result = await deleteRegion(region.id);
    if (result.error) alert(result.error);
  };

  const handleToggleActive = async () => {
    await toggleRegionActive(region.id, !region.is_active);
  };

  const typeClasses: Record<string, string> = {
    city: 'bg-blue-100 text-blue-700',
    county: 'bg-purple-100 text-purple-700',
    state: 'bg-green-100 text-green-700',
    neighborhood: 'bg-yellow-100 text-yellow-700',
    borough: 'bg-orange-100 text-orange-700',
  };

  if (editing) {
    return (
      <tr className="bg-primary-50">
        <td colSpan={7} className="p-4">
          <form onSubmit={handleEdit} className="space-y-3">
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-500">Slug</label>
                <input name="slug" defaultValue={region.slug} className="w-full h-8 px-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Chinese Name</label>
                <input name="name_zh" defaultValue={region.name_zh || ''} className="w-full h-8 px-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-500">English Name *</label>
                <input name="name_en" defaultValue={region.name_en} required className="w-full h-8 px-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <select name="type" defaultValue={region.type} className="w-full h-8 px-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option value="city">City</option>
                  <option value="neighborhood">Neighborhood</option>
                  <option value="borough">Borough</option>
                  <option value="county">County</option>
                  <option value="state">State</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Parent</label>
                <select name="parent_id" defaultValue={region.parent_id || ''} className="w-full h-8 px-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option value="">None</option>
                  {allRegions.filter(r => r.id !== region.id).map(r => (
                    <option key={r.id} value={r.id}>{r.name_zh || r.name_en}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={handleDelete} className="text-xs text-red-600 hover:underline">Delete Region</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(false)} className="h-7 px-3 border border-gray-300 text-xs rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="h-7 px-3 bg-primary text-white text-xs rounded hover:bg-primary-dark disabled:opacity-50">
                  {loading ? '...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="font-mono text-xs">{region.slug}</td>
      <td>{region.name_zh || '—'}</td>
      <td>{region.name_en}</td>
      <td><span className={`text-xs px-2 py-0.5 rounded-full ${typeClasses[region.type] || 'bg-gray-100 text-gray-600'}`}>{region.type}</span></td>
      <td className="text-sm text-gray-500">{parent?.name_zh || parent?.name_en || '—'}</td>
      <td>
        <div className="flex gap-1 flex-wrap">
          {belongsToSites.length > 0 ? belongsToSites.map((name, i) => (
            <span key={i} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{name}</span>
          )) : <span className="text-xs text-gray-400">Unassigned</span>}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${region.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
            onClick={handleToggleActive}
            title="Click to toggle"
          >
            {region.is_active ? 'Enabled' : 'Disabled'}
          </span>
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">Edit</button>
        </div>
      </td>
    </tr>
  );
}
