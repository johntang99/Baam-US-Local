import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const profiles = (rawProfiles || []) as AnyRow[];

  return (
    <div>
      {/* Header */}
      <div className="bg-bg-card border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">User Management</h1>
          <p className="text-sm text-text-muted">Admin / Users</p>
        </div>
      </div>

      <div className="p-6">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Username</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>Followers</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-text-muted py-8">No users</td>
                  </tr>
                ) : (
                  profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="font-medium">{profile.display_name || '—'}</td>
                      <td className="text-text-secondary">{profile.username || '—'}</td>
                      <td>
                        <span className="badge badge-blue">{profile.profile_type || 'user'}</span>
                      </td>
                      <td className="text-text-muted">{profile.region_id || '—'}</td>
                      <td>{profile.follower_count ?? 0}</td>
                      <td className="text-text-muted text-sm">
                        {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US') : '—'}
                      </td>
                      <td>
                        <Link href={`/admin/users/${profile.id}`} className="text-sm text-primary hover:underline">
                          View
                        </Link>
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
