'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { approveThread, deleteThread, pinThread, lockThread, featureThread } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusBadgeMap: Record<string, { cls: string; label: string }> = {
  published: { cls: 'badge badge-green', label: 'Published' },
  pending: { cls: 'badge badge-yellow', label: 'Pending' },
  removed: { cls: 'badge badge-red', label: 'Removed' },
  locked: { cls: 'badge badge-gray', label: 'Locked' },
};

interface PendingQueueProps {
  threads: AnyRow[];
}

export function PendingQueue({ threads }: PendingQueueProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleApprove = (threadId: string) => {
    startTransition(async () => {
      await approveThread(threadId);
      router.refresh();
    });
  };

  const handleDelete = (threadId: string) => {
    if (!confirm('Are you sure you want to delete this thread? All replies will also be deleted.')) return;
    startTransition(async () => {
      await deleteThread(threadId);
      router.refresh();
    });
  };

  if (threads.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
        <p className="text-text-muted">No threads pending review</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="space-y-3">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="flex items-center justify-between py-3 border-b border-border last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{thread.title || 'Untitled'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-text-muted">Author: {thread.author_id?.slice(0, 8) || '--'}</span>
                {thread.ai_spam_score != null && (
                  <span
                    className={`badge ${thread.ai_spam_score > 0.7 ? 'badge-red' : 'badge-gray'} text-xs`}
                  >
                    Spam: {(thread.ai_spam_score * 100).toFixed(0)}%
                  </span>
                )}
                <span className={`${statusBadgeMap[thread.status]?.cls || 'badge badge-gray'} text-xs`}>
                  {statusBadgeMap[thread.status]?.label || thread.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => handleApprove(thread.id)}
                disabled={isPending}
                className="h-7 px-3 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleDelete(thread.id)}
                disabled={isPending}
                className="h-7 px-3 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ThreadsTableProps {
  threads: AnyRow[];
  boardNameMap: Record<string, string>;
}

export function ThreadsTable({ threads, boardNameMap }: ThreadsTableProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = (threadId: string) => {
    if (!confirm('Are you sure you want to delete this thread? All replies will also be deleted.')) return;
    startTransition(async () => {
      await deleteThread(threadId);
      router.refresh();
    });
  };

  const handleTogglePin = (threadId: string, currentPinned: boolean) => {
    startTransition(async () => {
      await pinThread(threadId, !currentPinned);
      router.refresh();
    });
  };

  const handleLock = (threadId: string) => {
    startTransition(async () => {
      await lockThread(threadId);
      router.refresh();
    });
  };

  const handleToggleFeatured = (threadId: string, currentFeatured: boolean) => {
    startTransition(async () => {
      await featureThread(threadId, !currentFeatured);
      router.refresh();
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Board</th>
            <th>Author</th>
            <th>Status</th>
            <th>Replies</th>
            <th>Views</th>
            <th>Pinned</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {threads.map((thread) => {
            const sb = statusBadgeMap[thread.status] || { cls: 'badge badge-gray', label: thread.status || '--' };
            return (
              <tr key={thread.id}>
                <td className="max-w-[240px]">
                  <p className="truncate text-sm font-medium">{thread.title || 'Untitled'}</p>
                </td>
                <td className="text-sm text-text-muted">
                  {thread.board_id ? (boardNameMap[thread.board_id] || thread.board_id?.slice(0, 8)) : '--'}
                </td>
                <td className="text-sm text-text-muted">
                  {thread.author_id?.slice(0, 8) || '--'}
                </td>
                <td>
                  <span className={`${sb.cls} text-xs`}>{sb.label}</span>
                </td>
                <td className="text-sm">{thread.reply_count ?? 0}</td>
                <td className="text-sm">{thread.view_count ?? 0}</td>
                <td>
                  <button
                    onClick={() => handleTogglePin(thread.id, !!thread.is_pinned)}
                    disabled={isPending}
                    className={`text-xs px-2 py-1 rounded ${thread.is_pinned ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'} hover:opacity-80 disabled:opacity-50`}
                  >
                    {thread.is_pinned ? 'Pinned' : 'Pin'}
                  </button>
                </td>
                <td className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleFeatured(thread.id, !!thread.is_featured)}
                    disabled={isPending}
                    className={`text-xs ${thread.is_featured ? 'text-yellow-600' : 'text-text-muted'} hover:underline disabled:opacity-50`}
                  >
                    {thread.is_featured ? 'Unfeature' : 'Feature'}
                  </button>
                  {thread.status !== 'locked' && (
                    <button
                      onClick={() => handleLock(thread.id)}
                      disabled={isPending}
                      className="text-xs text-text-muted hover:underline disabled:opacity-50"
                    >
                      Lock
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(thread.id)}
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
  );
}
