'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDiscoverPost } from '@/app/[locale]/(public)/actions';

interface PostActionsProps {
  postId: string;
  postSlug: string;
}

export function PostActions({ postId, postSlug }: PostActionsProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.set('post_id', postId);
    const result = await deleteDiscoverPost(formData);

    if (result.error) {
      alert(result.error);
      setLoading(false);
      setConfirming(false);
      return;
    }

    router.push('/en/discover');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirming(false); }} />
          <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
            {!confirming ? (
              <>
                <button
                  onClick={() => { setConfirming(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  Delete Post
                </button>
              </>
            ) : (
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 mb-2">Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {loading ? '...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
