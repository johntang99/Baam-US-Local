'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { deleteBusiness, toggleFeatured, approveClaim, rejectClaim } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const statusBadgeMap: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge badge-green', label: 'Active' },
  inactive: { cls: 'badge badge-gray', label: 'Inactive' },
  suspended: { cls: 'badge badge-red', label: 'Suspended' },
  claimed: { cls: 'badge badge-blue', label: 'Claimed' },
};

const verificationBadgeMap: Record<string, { cls: string; label: string }> = {
  verified: { cls: 'badge badge-green', label: 'Verified' },
  pending: { cls: 'badge badge-yellow', label: 'Pending' },
  rejected: { cls: 'badge badge-red', label: 'Rejected' },
  unverified: { cls: 'badge badge-gray', label: 'Unverified' },
};

const planBadgeMap: Record<string, { cls: string; label: string }> = {
  free: { cls: 'badge badge-gray', label: 'Free' },
  basic: { cls: 'badge badge-blue', label: 'Basic' },
  premium: { cls: 'badge badge-purple', label: 'Premium' },
  enterprise: { cls: 'badge badge-yellow', label: 'Enterprise' },
};

interface BusinessesTableProps {
  businesses: AnyRow[];
  siteParams?: string;
  categoryMap?: Record<string, string>;
}

export default function BusinessesTable({ businesses, siteParams = '', categoryMap = {} }: BusinessesTableProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this business?')) return;
    startTransition(async () => {
      await deleteBusiness(id);
      router.refresh();
    });
  };

  const handleToggleFeatured = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleFeatured(id, !current);
      router.refresh();
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Business Name</th>
            <th>Category</th>
            <th>Status</th>
            <th>Verification</th>
            <th>Plan</th>
            <th>Rating</th>
            <th>Reviews</th>
            <th>P-Score</th>
            <th>Total</th>
            <th>Featured</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((biz) => {
            const sb = statusBadgeMap[biz.status] || { cls: 'badge badge-gray', label: biz.status || '--' };
            const vb = verificationBadgeMap[biz.verification_status] || { cls: 'badge badge-gray', label: biz.verification_status || '--' };
            const pb = planBadgeMap[biz.current_plan] || { cls: 'badge badge-gray', label: biz.current_plan || '--' };
            return (
              <tr key={biz.id}>
                <td className="max-w-xs">
                  <p className="font-medium truncate">{biz.display_name || biz.display_name_zh || 'Unnamed'}</p>
                  {biz.display_name_zh && biz.display_name && (
                    <p className="text-xs text-text-secondary truncate">{biz.display_name_zh}</p>
                  )}
                </td>
                <td className="text-xs text-text-secondary">
                  {categoryMap[biz.id] || <span className="text-text-muted">--</span>}
                </td>
                <td>
                  <span className={`${sb.cls} text-xs`}>{sb.label}</span>
                </td>
                <td>
                  <span className={`${vb.cls} text-xs`}>{vb.label}</span>
                </td>
                <td>
                  <span className={`${pb.cls} text-xs`}>{pb.label}</span>
                </td>
                <td className="text-sm">
                  {biz.avg_rating ? Number(biz.avg_rating).toFixed(1) : '--'}
                </td>
                <td className="text-sm">{biz.review_count ?? 0}</td>
                <td className="text-sm">{biz.p_score ? Number(biz.p_score).toFixed(1) : '0'}</td>
                <td className="text-sm font-medium">{biz.total_score ? Number(biz.total_score).toFixed(1) : '--'}</td>
                <td>
                  <button
                    onClick={() => handleToggleFeatured(biz.id, !!biz.is_featured)}
                    disabled={isPending}
                    className={`text-xs px-2 py-1 rounded ${biz.is_featured ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'} hover:opacity-80 disabled:opacity-50`}
                  >
                    {biz.is_featured ? 'Featured' : 'Feature'}
                  </button>
                </td>
                <td className="flex items-center gap-2">
                  <Link
                    href={`/admin/businesses/${biz.id}/edit${siteParams ? `?${siteParams}` : ''}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(biz.id)}
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

interface ClaimsTableProps {
  claims: AnyRow[];
}

export function ClaimsTable({ claims }: ClaimsTableProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleApprove = (claimId: string) => {
    startTransition(async () => {
      await approveClaim(claimId);
      router.refresh();
    });
  };

  const handleReject = (claimId: string) => {
    if (!confirm('Are you sure you want to reject this claim request?')) return;
    startTransition(async () => {
      await rejectClaim(claimId);
      router.refresh();
    });
  };

  if (claims.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
        <p className="text-text-muted">No pending claim requests</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Business</th>
            <th>Applicant</th>
            <th>Applied At</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id}>
              <td className="text-sm font-medium">{claim.business_id?.slice(0, 8) || '--'}</td>
              <td className="text-sm text-text-muted">{claim.user_id?.slice(0, 8) || '--'}</td>
              <td className="text-sm text-text-muted">
                {claim.created_at ? new Date(claim.created_at).toLocaleDateString('en-US') : '--'}
              </td>
              <td>
                <span className={`badge ${claim.status === 'pending' ? 'badge-yellow' : claim.status === 'approved' ? 'badge-green' : 'badge-red'} text-xs`}>
                  {claim.status}
                </span>
              </td>
              <td className="flex items-center gap-2">
                {claim.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(claim.id)}
                      disabled={isPending}
                      className="h-7 px-3 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(claim.id)}
                      disabled={isPending}
                      className="h-7 px-3 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
