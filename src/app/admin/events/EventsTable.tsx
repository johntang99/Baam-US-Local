'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { deleteEvent, toggleFeatured } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusBadge: Record<string, { cls: string; label: string }> = {
  published: { cls: 'badge badge-green', label: 'Published' },
  draft: { cls: 'badge badge-gray', label: 'Draft' },
  cancelled: { cls: 'badge badge-red', label: 'Cancelled' },
};

interface EventsTableProps {
  events: AnyRow[];
  siteParams: string;
}

export default function EventsTable({ events, siteParams }: EventsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    startTransition(async () => {
      await deleteEvent(id);
      router.refresh();
    });
  };

  const handleToggleFeatured = (id: string, featured: boolean) => {
    startTransition(async () => {
      await toggleFeatured(id, featured);
      router.refresh();
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Start Time</th>
            <th>Venue</th>
            <th>Status</th>
            <th>Featured</th>
            <th>Views</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center text-text-muted py-8">No events for this site</td>
            </tr>
          ) : (
            events.map((event) => {
              const sb = statusBadge[event.status] || { cls: 'badge badge-blue', label: event.status || '—' };
              return (
                <tr key={event.id}>
                  <td className="max-w-xs">
                    <p className="font-medium truncate">{event.title_en || event.title_zh || 'Untitled'}</p>
                  </td>
                  <td className="text-text-secondary text-sm">
                    {event.start_at
                      ? new Date(event.start_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="text-text-secondary">{event.venue_name || '—'}</td>
                  <td>
                    <span className={`${sb.cls} text-xs`}>{sb.label}</span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleFeatured(event.id, !event.is_featured)}
                      disabled={isPending}
                      className={`badge ${event.is_featured ? 'badge-purple' : 'badge-gray'} text-xs cursor-pointer hover:opacity-80 disabled:opacity-50`}
                    >
                      {event.is_featured ? 'Featured' : '—'}
                    </button>
                  </td>
                  <td className="text-text-muted">{event.view_count ?? 0}</td>
                  <td className="flex items-center gap-2">
                    <Link
                      href={`/admin/events/${event.id}/edit${siteParams ? `?${siteParams}` : ''}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
