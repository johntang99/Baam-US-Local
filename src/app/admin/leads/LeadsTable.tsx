'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { updateLeadStatus, deleteLead } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  if (phone.length <= 4) return '****';
  return phone.slice(0, -4) + '****';
}

function truncate(text: string | null, max = 50): string {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

const statusBadge: Record<string, { cls: string; label: string }> = {
  new: { cls: 'badge badge-red', label: 'New' },
  contacted: { cls: 'badge badge-blue', label: 'Contacted' },
  qualified: { cls: 'badge badge-purple', label: 'Qualified' },
  converted: { cls: 'badge badge-green', label: 'Converted' },
  closed: { cls: 'badge badge-gray', label: 'Closed' },
};

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

interface LeadsTableProps {
  leads: AnyRow[];
}

export default function LeadsTable({ leads }: LeadsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (id: string, status: string) => {
    startTransition(async () => {
      await updateLeadStatus(id, status);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    startTransition(async () => {
      await deleteLead(id);
      router.refresh();
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Phone</th>
              <th>Source</th>
              <th>Business</th>
              <th>AI Summary</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-text-muted py-8">No leads for this site</td>
              </tr>
            ) : (
              leads.map((lead) => {
                const sb = statusBadge[lead.status] || { cls: 'badge badge-gray', label: lead.status || '—' };
                return (
                  <tr key={lead.id}>
                    <td className="font-medium">{lead.contact_name || 'Anonymous'}</td>
                    <td className="text-text-secondary">{maskPhone(lead.contact_phone)}</td>
                    <td className="text-sm">{lead.source_type || '—'}</td>
                    <td className="text-sm text-text-muted">{lead.business_name || '—'}</td>
                    <td className="text-text-secondary text-sm max-w-[200px]">
                      <span className="truncate block">{truncate(lead.ai_summary)}</span>
                    </td>
                    <td>
                      <select
                        value={lead.status || 'new'}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        disabled={isPending}
                        className={`text-xs border border-border rounded px-1 py-0.5 bg-white disabled:opacity-50`}
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-text-muted text-sm">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-US') : '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(lead.id)}
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
    </div>
  );
}
