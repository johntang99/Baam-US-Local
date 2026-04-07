import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminSponsorsPage() {
  const supabase = createAdminClient();

  const { data: rawSlots } = await supabase
    .from('sponsor_slots')
    .select('*, sponsor_bookings(count)')
    .order('created_at', { ascending: false });
  const slots = (rawSlots || []) as AnyRow[];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">Ad Management</h1>
          <p className="text-sm text-text-muted">Admin / Sponsors</p>
        </div>
      </div>

      <div className="p-6">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Ad Placement Name</th>
                  <th>Type</th>
                  <th>Page</th>
                  <th>Monthly Price</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {slots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-text-muted py-8">No ad placements</td>
                  </tr>
                ) : (
                  slots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="font-medium">{slot.slot_name || '—'}</td>
                      <td className="text-text-secondary">{slot.slot_type || '—'}</td>
                      <td className="text-text-secondary">{slot.page_type || '—'}</td>
                      <td>
                        {slot.monthly_price != null
                          ? `$${Number(slot.monthly_price).toFixed(2)}`
                          : '—'}
                      </td>
                      <td>
                        <span className={`badge ${slot.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {slot.is_active ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
