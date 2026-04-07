import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusBadge: Record<string, string> = {
  pending: 'badge-yellow',
  processing: 'badge-blue',
  completed: 'badge-green',
  failed: 'badge-red',
};

function formatCost(cost: number | null): string {
  if (cost == null) return '—';
  return `$${cost.toFixed(4)}`;
}

export default async function AdminAiJobsPage() {
  const supabase = createAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: pendingCount },
    { count: processingCount },
    { count: completedTodayCount },
    { count: failedCount },
  ] = await Promise.all([
    supabase.from('ai_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('ai_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
    supabase
      .from('ai_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', todayStart.toISOString()),
    supabase.from('ai_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  const { data: rawJobs } = await supabase
    .from('ai_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const jobs = (rawJobs || []) as AnyRow[];

  const stats = [
    { label: 'Pending', value: pendingCount || 0, color: 'text-accent-yellow' },
    { label: 'Processing', value: processingCount || 0, color: 'text-accent-blue' },
    { label: 'Completed Today', value: completedTodayCount || 0, color: 'text-accent-green' },
    { label: 'Failed', value: failedCount || 0, color: 'text-accent-red' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">AI Job Monitor</h1>
          <p className="text-sm text-text-muted">Admin / AI Jobs</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card p-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Job Type</th>
                  <th>Entity Type</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>Input Tokens</th>
                  <th>Output Tokens</th>
                  <th>Cost</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-text-muted py-8">No jobs</td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="font-medium">{job.job_type || '—'}</td>
                      <td className="text-text-secondary">{job.entity_type || '—'}</td>
                      <td>
                        <span className={`badge ${statusBadge[job.status] || 'badge-gray'}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="text-text-secondary text-sm">{job.model_name || '—'}</td>
                      <td>{job.input_tokens ?? '—'}</td>
                      <td>{job.output_tokens ?? '—'}</td>
                      <td className="text-text-secondary">{formatCost(job.cost_usd)}</td>
                      <td className="text-text-muted text-sm">
                        {job.created_at ? new Date(job.created_at).toLocaleDateString('en-US') : '—'}
                      </td>
                      <td>
                        {job.status === 'failed' ? (
                          <Link href={`/admin/ai-jobs/${job.id}/retry`} className="text-sm text-accent-red hover:underline">
                            Retry
                          </Link>
                        ) : (
                          <Link href={`/admin/ai-jobs/${job.id}`} className="text-sm text-primary hover:underline">
                            View
                          </Link>
                        )}
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
