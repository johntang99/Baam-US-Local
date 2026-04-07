'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitBusinessClaim } from './actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface ClaimFormProps {
  categories: AnyRow[];
}

export function ClaimForm({ categories }: ClaimFormProps) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (success) {
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-4">🎉</p>
        <h3 className="text-lg font-bold mb-2">Application Submitted!</h3>
        <p className="text-sm text-text-secondary mb-4">We will review your application within 1-3 business days and notify you by email.</p>
        <button onClick={() => router.push('/en/businesses')} className="btn btn-primary h-10 px-6 text-sm">
          Browse Business Directory
        </button>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setError('');
    setLoading(true);
    const result = await submitBusinessClaim(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error === 'UNAUTHORIZED' ? 'Please log in first' : result.error);
    } else {
      setSuccess(true);
    }
  };

  const inputClass = 'w-full h-11 px-4 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-card';

  return (
    <form action={handleSubmit} className="space-y-5">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1.5">Business Name *</label>
        <input name="display_name" type="text" placeholder="Enter business name" required className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Business Category *</label>
        <select name="category_id" required className={inputClass + ' cursor-pointer'}>
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name_zh || cat.name_en || cat.name}</option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Phone *</label>
          <input name="phone" type="tel" placeholder="(xxx) xxx-xxxx" required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input name="email" type="email" placeholder="your@email.com" className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Business Address</label>
        <input name="address" type="text" placeholder="e.g., 123 Main St, Middletown, NY 10940" className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Website</label>
        <input name="website" type="url" placeholder="https://..." className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Business Description</label>
        <textarea
          name="description"
          rows={3}
          placeholder="Briefly describe your business services..."
          className="w-full px-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-card resize-none"
        />
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary w-full h-12 text-base font-semibold disabled:opacity-50">
        {loading ? 'Submitting...' : 'Submit Listing'}
      </button>
    </form>
  );
}
