'use client';

import { useState } from 'react';
import { toggleFollow, toggleLike, createVoiceComment } from '@/app/[locale]/(public)/actions';
import { useRouter } from 'next/navigation';

// ─── Follow Button ────────────────────────────────────────────────────

interface FollowButtonProps {
  profileId: string;
  isFollowing: boolean;
  isLoggedIn: boolean;
  className?: string;
}

export function FollowButton({ profileId, isFollowing: initial, isLoggedIn, className = '' }: FollowButtonProps) {
  const [following, setFollowing] = useState(initial);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    const formData = new FormData();
    formData.set('profile_id', profileId);
    const result = await toggleFollow(formData);
    if (result.success) {
      setFollowing(result.following ?? !following);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !isLoggedIn}
      className={`text-sm font-medium transition-colors disabled:opacity-50 ${
        following
          ? 'bg-border-light text-text-secondary hover:bg-red-50 hover:text-red-500'
          : 'bg-primary text-white hover:bg-primary-dark'
      } ${className}`}
    >
      {loading ? '...' : following ? 'Following' : '+ Follow'}
    </button>
  );
}

// ─── Like Button ──────────────────────────────────────────────────────

interface LikeButtonProps {
  postId: string;
  isLiked: boolean;
  likeCount: number;
  isLoggedIn: boolean;
}

export function LikeButton({ postId, isLiked: initial, likeCount: initialCount, isLoggedIn }: LikeButtonProps) {
  const [liked, setLiked] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    const formData = new FormData();
    formData.set('post_id', postId);
    const result = await toggleLike(formData);
    if (result.success) {
      const newLiked = result.liked ?? !liked;
      setLiked(newLiked);
      setCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !isLoggedIn}
      className={`flex items-center gap-1 text-sm transition-colors disabled:opacity-50 ${
        liked ? 'text-red-500' : 'text-text-muted hover:text-red-500'
      }`}
    >
      {liked ? '❤️' : '🤍'} {count}
    </button>
  );
}

// ─── Comment Form ─────────────────────────────────────────────────────

interface CommentFormProps {
  postId: string;
  isLoggedIn: boolean;
}

export function CommentForm({ postId, isLoggedIn }: CommentFormProps) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isLoggedIn) {
    return <p className="text-sm text-text-muted text-center py-3">Log in to comment</p>;
  }

  const handleSubmit = async (formData: FormData) => {
    setError('');
    setSuccess(false);
    setLoading(true);
    formData.set('post_id', postId);

    const result = await createVoiceComment(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error === 'UNAUTHORIZED' ? 'Please log in first' : result.error);
      return;
    }

    setSuccess(true);
    router.refresh();
  };

  return (
    <form action={handleSubmit} className="mt-4">
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {success && <p className="text-xs text-green-600 mb-2">Comment posted!</p>}
      <div className="flex gap-2">
        <input
          type="text"
          name="content"
          placeholder="Write a comment..."
          required
          className="flex-1 h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
        <button type="submit" disabled={loading} className="btn btn-primary h-9 px-4 text-sm disabled:opacity-50">
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </form>
  );
}
