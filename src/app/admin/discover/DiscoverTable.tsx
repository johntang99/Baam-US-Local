'use client';

import { useState } from 'react';
import { approvePost, rejectPost, deletePost } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  pendingPosts: AnyRow[];
  allPosts: AnyRow[];
}

export function DiscoverTable({ pendingPosts, allPosts }: Props) {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: (id: string) => Promise<{ error: string | null }>, id: string) => {
    setLoading(id);
    const result = await action(id);
    if (result.error) alert(result.error);
    setLoading(null);
  };

  const posts = tab === 'pending' ? pendingPosts : allPosts;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'pending' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Review Queue {pendingPosts.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">{pendingPosts.length}</span>}
        </button>
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          All Posts ({allPosts.length})
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {tab === 'pending' ? 'No posts pending review' : 'No posts'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Post</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Author</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">AI Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((post) => {
                const isLoading = loading === post.id;
                const coverImg = post.cover_images?.[0] || post.cover_image_url;
                const statusColors: Record<string, string> = {
                  published: 'bg-green-100 text-green-700',
                  pending_review: 'bg-amber-100 text-amber-700',
                  rejected: 'bg-red-100 text-red-700',
                };
                return (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {coverImg ? (
                          <img src={coverImg} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 text-xs">📝</div>
                        )}
                        <div className="min-w-0">
                          <a href={`/en/discover/${post.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-primary truncate block max-w-[200px]">
                            {post.title || post.content?.slice(0, 30) || 'Untitled'}
                          </a>
                          {post.moderation_reason && (
                            <span className="text-xs text-red-500">{post.moderation_reason}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{post.profiles?.display_name || 'Anonymous'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[post.status] || 'bg-gray-100 text-gray-600'}`}>
                        {post.status === 'published' ? 'Published' : post.status === 'pending_review' ? 'Pending' : post.status === 'rejected' ? 'Rejected' : post.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {post.ai_spam_score != null && (
                        <span className={`text-xs font-mono ${post.ai_spam_score >= 0.6 ? 'text-red-600' : 'text-green-600'}`}>
                          {post.ai_spam_score.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {post.created_at ? new Date(post.created_at).toLocaleDateString('en-US') : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {post.status === 'pending_review' && (
                          <>
                            <button
                              onClick={() => handleAction(approvePost, post.id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction(rejectPost, post.id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {post.status === 'rejected' && (
                          <button
                            onClick={() => handleAction(approvePost, post.id)}
                            disabled={isLoading}
                            className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm('Are you sure you want to delete?')) handleAction(deletePost, post.id); }}
                          disabled={isLoading}
                          className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
