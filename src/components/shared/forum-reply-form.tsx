'use client';

import { useState, useRef } from 'react';
import { createForumReply } from '@/app/[locale]/(public)/actions';
import { useRouter } from 'next/navigation';

interface ForumReplyFormProps {
  threadId: string;
  isLoggedIn: boolean;
}

export function ForumReplyForm({ threadId, isLoggedIn }: ForumReplyFormProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!isLoggedIn) {
    return (
      <div className="bg-bg-card rounded-xl border border-border p-5 text-center">
        <p className="text-sm text-text-secondary">Log in to reply</p>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setError('');
    setSuccess(false);
    setLoading(true);
    formData.set('thread_id', threadId);

    const result = await createForumReply(formData);

    setLoading(false);

    if (result.error) {
      if (result.error === 'UNAUTHORIZED') {
        setError('Please log in first');
      } else {
        setError(result.error);
      }
      return;
    }

    setSuccess(true);
    formRef.current?.reset();
    router.refresh();
  };

  return (
    <form ref={formRef} action={handleSubmit} className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold mb-3">Post a Reply</h3>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {success && <p className="text-xs text-green-600 mb-2">Reply posted!</p>}
      <textarea
        name="body"
        placeholder="Write your reply..."
        required
        className="w-full h-24 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y mb-3"
      />
      <button type="submit" disabled={loading} className="btn btn-primary px-6 disabled:opacity-50">
        {loading ? 'Submitting...' : 'Submit Reply'}
      </button>
    </form>
  );
}
