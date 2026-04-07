'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface SettingsFormProps {
  profile: AnyRow;
  userEmail: string;
}

export function SettingsForm({ profile, userEmail }: SettingsFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [headline, setHeadline] = useState(profile.headline || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData();
    formData.set('display_name', displayName);
    formData.set('username', username);
    formData.set('bio', bio);
    formData.set('headline', headline);

    const result = await updateProfile(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Saved successfully!');
      router.refresh();
    }
  };

  const inputClass = 'w-full h-10 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{success}</div>}

      {/* Basic Info */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-base">Basic Info</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={userEmail} disabled className={`${inputClass} bg-gray-50 text-text-muted`} />
          <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Display Name *</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <div className="flex items-center">
            <span className="text-sm text-text-muted mr-1">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              className={inputClass}
            />
          </div>
          <p className="text-xs text-text-muted mt-1">Only lowercase letters, numbers, and underscores</p>
        </div>
      </div>

      {/* Profile Details */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-base">About You</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Headline</label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g., Local food blogger"
            maxLength={100}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            rows={4}
            maxLength={500}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
          />
          <p className="text-xs text-text-muted mt-1">{bio.length}/500</p>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="btn btn-primary h-10 px-6 text-sm disabled:opacity-50">
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
