'use client';

import { useState } from 'react';
import { addRegion } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export function AddRegionForm({ parentRegions }: { parentRegions: AnyRow[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await addRegion(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setOpen(false);
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">+ Add Region</button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-[480px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Add New Region</h3>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input name="slug" required placeholder="e.g. wallkill-ny" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select name="type" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="city">City</option>
                    <option value="neighborhood">Neighborhood</option>
                    <option value="borough">Borough</option>
                    <option value="county">County</option>
                    <option value="state">State</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">English Name *</label>
                  <input name="name_en" required placeholder="e.g. Wallkill, NY" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chinese Name</label>
                  <input name="name_zh" placeholder="e.g. Wallkill" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Region</label>
                <select name="parent_id" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                  <option value="">None (Top Level)</option>
                  {parentRegions.map(r => (
                    <option key={r.id} value={r.id}>{r.name_zh || r.name_en} ({r.type})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 px-4 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50">
                  {loading ? 'Adding...' : 'Add Region'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
