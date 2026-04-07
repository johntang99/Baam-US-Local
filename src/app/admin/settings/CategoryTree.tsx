'use client';

import { useState } from 'react';
import { addCategory, updateCategory, deleteCategory } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface CategoryTreeProps {
  categories: AnyRow[];
}

interface CategoryFormData {
  slug: string;
  name_en: string;
  name_zh: string;
  icon: string;
  parent_id: string;
  sort_order: string;
  search_terms: string[];
}

const emptyForm: CategoryFormData = { slug: '', name_en: '', name_zh: '', icon: '', parent_id: '', sort_order: '0', search_terms: [] };

export function CategoryTree({ categories }: CategoryTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Build tree: parents are categories with no parent_id
  const parents = categories.filter(c => !c.parent_id);
  const childrenOf = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openAddModal = (parentId?: string) => {
    setEditingId(null);
    setFormData({ ...emptyForm, parent_id: parentId || '' });
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (cat: AnyRow) => {
    setEditingId(cat.id);
    setFormData({
      slug: cat.slug || '',
      name_en: cat.name_en || '',
      name_zh: cat.name_zh || '',
      icon: cat.icon || '',
      parent_id: cat.parent_id || '',
      sort_order: String(cat.sort_order ?? 0),
      search_terms: Array.isArray(cat.search_terms) ? cat.search_terms : [],
    });
    setError('');
    setModalOpen(true);
  };

  const handleDelete = async (cat: AnyRow) => {
    const children = childrenOf(cat.id);
    const msg = children.length > 0
      ? `Are you sure you want to delete category "${cat.name_zh || cat.name_en}" and its ${children.length} subcategories?`
      : `Are you sure you want to delete category "${cat.name_zh || cat.name_en}"?`;
    if (!confirm(msg)) return;
    const result = await deleteCategory(cat.id);
    if (result.error) alert(result.error);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData();
    fd.set('slug', formData.slug);
    fd.set('name_en', formData.name_en);
    fd.set('name_zh', formData.name_zh);
    fd.set('icon', formData.icon);
    fd.set('parent_id', formData.parent_id);
    fd.set('sort_order', formData.sort_order);
    fd.set('search_terms', JSON.stringify(formData.search_terms));

    const result = editingId
      ? await updateCategory(editingId, fd)
      : await addCategory(fd);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setModalOpen(false);
      setLoading(false);
    }
  };

  const updateField = (field: keyof CategoryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Business Category Management</h2>
        <button onClick={() => openAddModal()} className="h-9 px-4 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">
          + Add Category
        </button>
      </div>

      <div className="card overflow-hidden">
        {parents.length === 0 ? (
          <div className="p-6 text-center text-text-muted">No business categories</div>
        ) : (
          <div className="divide-y divide-border">
            {parents.map(parent => {
              const children = childrenOf(parent.id);
              const isExpanded = expanded[parent.id] ?? true;
              return (
                <div key={parent.id}>
                  {/* Parent row */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-bg-page/50">
                    <button
                      onClick={() => toggleExpand(parent.id)}
                      className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary rounded"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <span className="text-xl" title="Icon">{parent.icon || '📁'}</span>
                    <span className="font-medium">{parent.name_zh || '—'}</span>
                    <span className="text-text-secondary text-sm">{parent.name_en || '—'}</span>
                    <span className="font-mono text-xs text-text-muted bg-bg-page px-2 py-0.5 rounded">{parent.slug}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={() => openAddModal(parent.id)} className="text-xs text-primary hover:underline">Add Subcategory</button>
                      <button onClick={() => openEditModal(parent)} className="text-xs text-primary hover:underline">Edit</button>
                      <button onClick={() => handleDelete(parent)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </div>
                  </div>

                  {/* Children */}
                  {isExpanded && children.length > 0 && (
                    <div className="bg-bg-page/30">
                      {children.map(child => (
                        <div key={child.id} className="flex items-center gap-3 px-4 py-2.5 pl-14 hover:bg-bg-page/50 border-t border-border/50">
                          <span className="text-lg">{child.icon || '📄'}</span>
                          <span className="text-sm font-medium">{child.name_zh || '—'}</span>
                          <span className="text-text-secondary text-xs">{child.name_en || '—'}</span>
                          <span className="font-mono text-xs text-text-muted bg-bg-page px-2 py-0.5 rounded">{child.slug}</span>
                          <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => openEditModal(child)} className="text-xs text-primary hover:underline">Edit</button>
                            <button onClick={() => handleDelete(child)} className="text-xs text-red-600 hover:underline">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for Add/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-[520px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Category' : 'Add Category'}</h3>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input
                    value={formData.slug}
                    onChange={e => updateField('slug', e.target.value)}
                    required
                    placeholder="e.g. restaurant"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji)</label>
                  <input
                    value={formData.icon}
                    onChange={e => updateField('icon', e.target.value)}
                    placeholder="e.g. 🍜"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">English Name *</label>
                  <input
                    value={formData.name_en}
                    onChange={e => updateField('name_en', e.target.value)}
                    required
                    placeholder="e.g. Restaurant"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chinese Name</label>
                  <input
                    value={formData.name_zh}
                    onChange={e => updateField('name_zh', e.target.value)}
                    placeholder="e.g. Restaurant"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
                  <select
                    value={formData.parent_id}
                    onChange={e => updateField('parent_id', e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">None (Top Level)</option>
                    {parents.filter(p => p.id !== editingId).map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.name_zh || p.name_en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={e => updateField('sort_order', e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Search Terms — tag input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Terms <span className="text-xs text-gray-400 font-normal">(for AI search matching, the more the better)</span>
                </label>
                <div className="min-h-[80px] p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-primary">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.search_terms.map((term, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary pl-2 pr-1 py-1 rounded-md">
                        {term}
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            search_terms: prev.search_terms.filter((_, idx) => idx !== i),
                          }))}
                          className="hover:bg-primary/20 rounded p-0.5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Type a keyword and press Enter to add (e.g. dentist, dental, teeth cleaning)"
                    className="w-full text-sm outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const input = e.currentTarget;
                        // Support comma-separated batch input
                        const newTerms = input.value.split(/[,，、\s]+/).map(t => t.trim()).filter(t => t.length >= 1);
                        if (newTerms.length > 0) {
                          setFormData(prev => ({
                            ...prev,
                            search_terms: [...new Set([...prev.search_terms, ...newTerms])],
                          }));
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Press Enter to add. Supports comma-separated batch input.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="h-9 px-4 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50">
                  {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
