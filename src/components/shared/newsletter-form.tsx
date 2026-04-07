'use client';

import { useState } from 'react';
import { subscribeNewsletter } from '@/app/[locale]/(public)/actions';

interface NewsletterFormProps {
  source?: string;
  className?: string;
  compact?: boolean;
}

export function NewsletterForm({ source = 'footer', className = '', compact = false }: NewsletterFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (formData: FormData) => {
    setStatus('loading');
    formData.set('source', source);
    const result = await subscribeNewsletter(formData);

    if (result.error) {
      setStatus('error');
      setMessage(result.error);
    } else {
      setStatus('success');
      setMessage(result.message || 'Subscribed successfully!');
    }
  };

  if (status === 'success') {
    return (
      <div className={className}>
        <p className="text-sm text-green-600 font-medium">{message}</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className={className}>
      <div className={compact ? 'flex gap-2' : 'flex gap-2'}>
        <input
          type="email"
          name="email"
          placeholder="Enter your email"
          required
          className="flex-1 h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="btn btn-primary h-9 px-4 text-sm disabled:opacity-50"
        >
          {status === 'loading' ? '...' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && <p className="text-xs text-red-500 mt-1">{message}</p>}
    </form>
  );
}
