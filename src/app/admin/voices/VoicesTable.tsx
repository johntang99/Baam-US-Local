'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { approveVoice, rejectVoice, verifyVoice, unverifyVoice, toggleFeatured, updateProfileType } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const profileTypeBadge: Record<string, { cls: string; label: string }> = {
  user: { cls: 'badge badge-gray', label: 'User' },
  creator: { cls: 'badge badge-green', label: 'Creator' },
  kol: { cls: 'badge badge-purple', label: 'KOL' },
  expert: { cls: 'badge badge-blue', label: 'Expert' },
  influencer: { cls: 'badge badge-yellow', label: 'Influencer' },
};

const profileTypeOptions = [
  { value: 'user', label: 'User' },
  { value: 'creator', label: 'Creator' },
  { value: 'kol', label: 'KOL' },
  { value: 'expert', label: 'Expert' },
  { value: 'influencer', label: 'Influencer' },
];

interface VoicesTableProps {
  tab: string;
  profiles: AnyRow[];
  applicationProfiles: AnyRow[];
  featuredProfiles: AnyRow[];
  siteParams: string;
  applicationCount: number;
}

export default function VoicesTable({ tab, profiles, applicationProfiles, featuredProfiles, siteParams }: VoicesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleApprove = (id: string) => {
    startTransition(async () => {
      await approveVoice(id);
      router.refresh();
    });
  };

  const handleReject = (id: string) => {
    startTransition(async () => {
      await rejectVoice(id);
      router.refresh();
    });
  };

  const handleVerify = (id: string) => {
    startTransition(async () => {
      await verifyVoice(id);
      router.refresh();
    });
  };

  const handleUnverify = (id: string) => {
    startTransition(async () => {
      await unverifyVoice(id);
      router.refresh();
    });
  };

  const handleToggleFeatured = (id: string, featured: boolean) => {
    startTransition(async () => {
      await toggleFeatured(id, featured);
      router.refresh();
    });
  };

  const handleUpdateType = (id: string, type: string) => {
    startTransition(async () => {
      await updateProfileType(id, type);
      router.refresh();
    });
  };

  if (tab === 'applications') {
    return (
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-semibold">Pending Applications ({applicationProfiles.length})</h2>
        </div>
        {applicationProfiles.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-text-muted">No pending applications</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Current Type</th>
                <th>Region</th>
                <th>Registered At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applicationProfiles.map((profile) => (
                <tr key={profile.id}>
                  <td>
                    <span className="text-sm font-medium">{profile.display_name || 'Unnamed'}</span>
                  </td>
                  <td className="text-sm text-text-muted">@{profile.username || '—'}</td>
                  <td>
                    <span className={`${(profileTypeBadge[profile.profile_type] || profileTypeBadge.user).cls} text-xs`}>
                      {(profileTypeBadge[profile.profile_type] || profileTypeBadge.user).label}
                    </span>
                  </td>
                  <td className="text-sm text-text-muted">{profile.region_id ? profile.region_id.slice(0, 8) : '—'}</td>
                  <td className="text-sm text-text-muted">
                    {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US') : '—'}
                  </td>
                  <td className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(profile.id)}
                      disabled={isPending}
                      className="h-7 px-3 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(profile.id)}
                      disabled={isPending}
                      className="h-7 px-3 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (tab === 'featured') {
    return (
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-semibold">Featured Voices ({featuredProfiles.length})</h2>
        </div>
        {featuredProfiles.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-text-muted">No Featured Voices</p>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex flex-wrap gap-3">
              {featuredProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-2 bg-bg-page border border-border rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-medium">{profile.display_name || 'Unnamed'}</span>
                  <span className={`${(profileTypeBadge[profile.profile_type] || profileTypeBadge.user).cls} text-xs`}>
                    {(profileTypeBadge[profile.profile_type] || profileTypeBadge.user).label}
                  </span>
                  {profile.is_verified && (
                    <span className="badge badge-green text-xs">Verified</span>
                  )}
                  <button
                    onClick={() => handleToggleFeatured(profile.id, false)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:underline ml-1 disabled:opacity-50"
                  >
                    Unfeature
                  </button>
                  <Link
                    href={`/admin/voices?edit=${profile.id}${siteParams ? `&${siteParams}` : ''}`}
                    className="text-xs text-primary hover:underline ml-1"
                  >
                    Edit
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: creators list tab
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-semibold">All Voices ({profiles.length})</h2>
      </div>
      {profiles.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-text-muted">No voices for this site</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Username</th>
              <th>Verification</th>
              <th>Featured</th>
              <th>Followers</th>
              <th>Posts</th>
              <th>Region</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const pb = profileTypeBadge[profile.profile_type] || profileTypeBadge.user;
              return (
                <tr key={profile.id}>
                  <td>
                    <span className="text-sm font-medium">{profile.display_name || 'Unnamed'}</span>
                  </td>
                  <td>
                    <select
                      value={profile.profile_type}
                      onChange={(e) => handleUpdateType(profile.id, e.target.value)}
                      disabled={isPending}
                      className="text-xs border border-border rounded px-1 py-0.5 bg-white disabled:opacity-50"
                    >
                      {profileTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="text-sm text-text-muted">@{profile.username || '—'}</td>
                  <td>
                    <button
                      onClick={() => profile.is_verified ? handleUnverify(profile.id) : handleVerify(profile.id)}
                      disabled={isPending}
                      className={`badge ${profile.is_verified ? 'badge-green' : 'badge-gray'} text-xs cursor-pointer hover:opacity-80 disabled:opacity-50`}
                    >
                      {profile.is_verified ? 'Verified' : 'Unverified'}
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleFeatured(profile.id, !profile.is_featured)}
                      disabled={isPending}
                      className={`badge ${profile.is_featured ? 'badge-blue' : 'badge-gray'} text-xs cursor-pointer hover:opacity-80 disabled:opacity-50`}
                    >
                      {profile.is_featured ? 'Yes' : 'No'}
                    </button>
                  </td>
                  <td>
                    <span className="text-sm">{profile.follower_count ?? 0}</span>
                  </td>
                  <td>
                    <span className="text-sm">{profile.post_count ?? 0}</span>
                  </td>
                  <td className="text-sm text-text-muted">
                    {profile.region_id ? profile.region_id.slice(0, 8) : '—'}
                  </td>
                  <td className="flex items-center gap-2">
                    <Link
                      href={`/admin/voices?edit=${profile.id}${siteParams ? `&${siteParams}` : ''}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
