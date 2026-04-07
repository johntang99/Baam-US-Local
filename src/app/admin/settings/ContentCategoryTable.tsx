'use client';

import { useState } from 'react';
import { addCategoryBasic, deleteCategoryBasic, updateCategoryBasic } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface ContentCategoryTableProps {
  title: string;
  tableName: 'categories_guide' | 'categories_news' | 'categories_forum' | 'categories_discover';
  siteScope: 'zh' | 'en';
  categoryType?: 'article' | 'forum';
  categories: AnyRow[];
}

export function ContentCategoryTable({
  title,
  tableName,
  siteScope,
  categoryType = 'article',
  categories,
}: ContentCategoryTableProps) {
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    slug: '',
    name_en: '',
    name_zh: '',
    icon: '',
    sort_order: '0',
    is_active: true,
  });

  const openEdit = (cat: AnyRow) => {
    setError('');
    setEditing(cat);
    setIsCreating(false);
    setForm({
      slug: cat.slug || '',
      name_en: cat.name_en || '',
      name_zh: cat.name_zh || '',
      icon: cat.icon || '',
      sort_order: String(cat.sort_order ?? 0),
      is_active: Boolean(cat.is_active),
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setIsCreating(false);
    setError('');
  };

  const openCreate = () => {
    setError('');
    setEditing(null);
    setIsCreating(true);
    setForm({
      slug: '',
      name_en: '',
      name_zh: '',
      icon: '',
      sort_order: String(categories.length + 1),
      is_active: true,
    });
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing && !isCreating) return;
    setLoading(true);
    setError('');

    const fd = new FormData();
    fd.set('table_name', tableName);
    fd.set('site_scope', siteScope);
    fd.set('type', categoryType);
    fd.set('slug', form.slug);
    fd.set('name_en', form.name_en);
    fd.set('name_zh', form.name_zh);
    fd.set('icon', form.icon);
    fd.set('sort_order', form.sort_order);
    fd.set('is_active', String(form.is_active));

    const result = isCreating
      ? await addCategoryBasic(fd)
      : await updateCategoryBasic(String(editing?.id), fd);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeEdit();
  };

  const handleDelete = async (cat: AnyRow) => {
    if (!confirm(`Delete category "${cat.name_en || cat.slug}"?`)) return;
    const fd = new FormData();
    fd.set('table_name', tableName);
    const result = await deleteCategoryBasic(String(cat.id), fd);
    if (result.error) alert(result.error);
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 bg-bg-page border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={openCreate}
            className="h-8 px-3 border border-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50"
          >
            + Add New
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Icon</th>
              <th>Slug</th>
              <th>Chinese Name</th>
              <th>English Name</th>
              <th>Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-text-muted py-8">No categories yet</td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id}>
                  <td>{cat.icon || '—'}</td>
                  <td className="font-mono text-xs">{cat.slug}</td>
                  <td>{cat.name_zh || '—'}</td>
                  <td>{cat.name_en || '—'}</td>
                  <td>{cat.sort_order ?? 0}</td>
                  <td>
                    <span className={`badge ${cat.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(cat)} className="text-xs text-primary hover:underline">Edit</button>
                      <button onClick={() => void handleDelete(cat)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(editing || isCreating) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={closeEdit}>
          <div className="bg-white rounded-xl p-6 w-[520px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-bold mb-4">{isCreating ? 'Add Category' : 'Edit Category'}</h4>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Icon</label>
                  <input
                    value={form.icon}
                    onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Chinese Name</label>
                  <input
                    value={form.name_zh}
                    onChange={(e) => setForm((prev) => ({ ...prev, name_zh: e.target.value }))}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">English Name</label>
                  <input
                    value={form.name_en}
                    onChange={(e) => setForm((prev) => ({ ...prev, name_en: e.target.value }))}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm mt-7">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeEdit} className="h-9 px-4 border border-gray-300 text-sm rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg disabled:opacity-50">
                  {loading ? 'Saving...' : isCreating ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
