'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createForumThread } from '@/app/[locale]/(public)/actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface ForumNewPostFormProps {
  boards: AnyRow[];
  isLoggedIn: boolean;
}

export function ForumNewPostForm({ boards, isLoggedIn }: ForumNewPostFormProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isLoggedIn) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-text-secondary mb-2">Please log in before posting</p>
        <p className="text-sm text-text-muted">Click the &quot;Sign In / Sign Up&quot; button in the top right</p>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setError('');
    setLoading(true);

    const result = await createForumThread(formData);

    if (result.error) {
      if (result.error === 'UNAUTHORIZED') {
        setError('Please log in first');
      } else {
        setError(result.error);
      }
      setLoading(false);
      return;
    }

    if (result.redirect) {
      router.push(`/en${result.redirect}`);
    } else {
      router.push('/en/forum');
    }
  };

  return (
    <form action={handleSubmit} className="card p-6 space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      {/* Board Selector */}
      <div>
        <label htmlFor="board-select" className="block text-sm font-medium mb-1">
          Select Board <span className="text-accent-red">*</span>
        </label>
        <select
          id="board-select"
          name="board_id"
          required
          className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-card"
        >
          <option value="">Choose a board</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.emoji || '📋'} {b.name_en || b.name || b.name_zh}
            </option>
          ))}
        </select>
      </div>

      {/* Title Input */}
      <div>
        <label htmlFor="post-title" className="block text-sm font-medium mb-1">
          Title <span className="text-accent-red">*</span>
        </label>
        <input
          id="post-title"
          name="title"
          type="text"
          placeholder="Enter your post title"
          maxLength={120}
          required
          className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
      </div>

      {/* Rich Text Area */}
      <div>
        <label htmlFor="post-body" className="block text-sm font-medium mb-1">
          Content <span className="text-accent-red">*</span>
        </label>
        <textarea
          id="post-body"
          name="body"
          placeholder={'Write what you want to share...\n\nMarkdown supported: **bold** *italic* [link](url) - list'}
          required
          className="w-full h-48 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
        />
        <p className="text-xs text-text-muted mt-1">Markdown supported</p>
      </div>

      {/* Tag Input */}
      <div>
        <label htmlFor="post-tags" className="block text-sm font-medium mb-1">Tags</label>
        <input
          id="post-tags"
          name="tags"
          type="text"
          placeholder="Enter tags, separated by commas (e.g.: housing, restaurants, recommendations)"
          className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
        <p className="text-xs text-text-muted mt-1">Up to 5 tags</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn btn-primary px-6 disabled:opacity-50">
          {loading ? 'Posting...' : 'Submit Post'}
        </button>
      </div>
    </form>
  );
}
