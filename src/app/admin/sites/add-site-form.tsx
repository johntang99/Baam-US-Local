'use client';

import { useState } from 'react';
import { addSite } from './actions';

export function AddSiteForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await addSite(formData);
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
      <button onClick={() => setOpen(true)} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark">+ Add Site</button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-[480px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Add New Site</h3>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input name="slug" required placeholder="e.g. nj-zh" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language *</label>
                  <select name="locale" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="zh">Chinese</option>
                    <option value="en">English</option>
                    <option value="bilingual">Bilingual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input name="name" required placeholder="e.g. New Jersey Chinese" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chinese Name</label>
                  <input name="name_zh" placeholder="e.g. NJ Chinese Site" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                <input name="domain" placeholder="e.g. nj.baam.us" className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" rows={2} placeholder="Site description..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 px-4 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
