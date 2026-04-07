'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { bulkPublish, bulkArchive, deleteArticle, generateAISummary } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const verticalBadge: Record<string, { cls: string; label: string }> = {
  news_alert: { cls: 'badge badge-red', label: 'News Alert' },
  news_brief: { cls: 'badge badge-blue', label: 'News Brief' },
  news_explainer: { cls: 'badge badge-primary', label: 'News Explainer' },
  guide_howto: { cls: 'badge badge-purple', label: 'How-To Guide' },
  guide_checklist: { cls: 'badge badge-purple', label: 'Checklist Guide' },
  guide_comparison: { cls: 'badge badge-purple', label: 'Comparison Guide' },
};

const statusBadge: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'badge badge-gray', label: 'Draft' },
  ai_drafted: { cls: 'badge badge-blue', label: 'AI Draft' },
  human_reviewed: { cls: 'badge badge-yellow', label: 'Reviewed' },
  published: { cls: 'badge badge-green', label: 'Published' },
  archived: { cls: 'badge badge-red', label: 'Archived' },
};

interface ArticlesTableProps {
  articles: AnyRow[];
  regionNameMap: Record<string, string>;
  siteParams?: string;
}

export default function ArticlesTable({ articles, regionNameMap, siteParams = '' }: ArticlesTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggleAll = () => {
    if (selected.size === articles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(articles.map((a) => a.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkPublish = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await bulkPublish(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  };

  const handleBulkArchive = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await bulkArchive(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  };

  const handleBulkAISummary = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await Promise.all(Array.from(selected).map((id) => generateAISummary(id)));
      setSelected(new Set());
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    startTransition(async () => {
      await deleteArticle(id);
      router.refresh();
    });
  };

  return (
    <>
      {/* Bulk action bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-bg-page border border-border rounded-lg mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={articles.length > 0 && selected.size === articles.length}
            onChange={toggleAll}
            className="rounded border-gray-300"
          />
          Select All
        </label>
        <span className="text-sm text-text-muted">{selected.size} selected</span>
        <div className="flex-1" />
        <button
          onClick={handleBulkPublish}
          disabled={isPending || selected.size === 0}
          className="h-8 px-3 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          Bulk Publish
        </button>
        <button
          onClick={handleBulkArchive}
          disabled={isPending || selected.size === 0}
          className="h-8 px-3 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
        >
          Bulk Archive
        </button>
        <button
          onClick={handleBulkAISummary}
          disabled={isPending || selected.size === 0}
          className="h-8 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Regenerate Summary
        </button>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Region</th>
              <th>Author</th>
              <th>Published</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => {
              const vb = verticalBadge[a.content_vertical] || { cls: 'badge badge-gray', label: a.content_vertical || '—' };
              const sb = statusBadge[a.editorial_status] || { cls: 'badge badge-gray', label: a.editorial_status || '—' };
              return (
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="max-w-xs">
                    <p className="font-medium truncate">{a.title_en || a.title_zh || 'Untitled'}</p>
                  </td>
                  <td>
                    <span className={`${vb.cls} text-xs`}>{vb.label}</span>
                  </td>
                  <td>
                    <span className={`${sb.cls} text-xs`}>{sb.label}</span>
                  </td>
                  <td className="text-sm text-text-muted">
                    {a.region_id ? (regionNameMap[a.region_id] || '—') : '—'}
                  </td>
                  <td className="text-sm text-text-muted">—</td>
                  <td className="text-sm text-text-muted">
                    {a.published_at ? new Date(a.published_at).toLocaleDateString('en-US') : '—'}
                  </td>
                  <td className="flex items-center gap-2">
                    <Link
                      href={`/admin/articles/${a.id}/edit${siteParams ? `?${siteParams}` : ''}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
