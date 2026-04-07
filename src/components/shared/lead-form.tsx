'use client';

import { useState } from 'react';
import { submitLead } from '@/app/[locale]/(public)/actions';

interface LeadFormProps {
  businessId?: string;
  sourceType?: string;
  sourceArticleId?: string;
  className?: string;
}

export function LeadForm({ businessId, sourceType = 'business_page', sourceArticleId, className = '' }: LeadFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (status === 'success') {
    return (
      <div className={`p-4 bg-green-50 border border-green-200 rounded-lg text-center ${className}`}>
        <p className="text-sm text-green-700 font-medium">{message}</p>
      </div>
    );
  }

  const handleSubmit = async (formData: FormData) => {
    setStatus('loading');
    if (businessId) formData.set('business_id', businessId);
    formData.set('source_type', sourceType);
    if (sourceArticleId) formData.set('source_article_id', sourceArticleId);

    const result = await submitLead(formData);

    if (result.error) {
      setStatus('error');
      setMessage(result.error);
    } else {
      setStatus('success');
      setMessage(result.message || 'Submitted successfully!');
    }
  };

  return (
    <form action={handleSubmit} className={`space-y-3 ${className}`}>
      {status === 'error' && (
        <p className="text-xs text-red-500">{message}</p>
      )}
      <div>
        <input
          type="text"
          name="name"
          placeholder="Your name"
          className="w-full h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
      </div>
      <div>
        <input
          type="tel"
          name="phone"
          placeholder="Phone number"
          className="w-full h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
      </div>
      <div>
        <input
          type="email"
          name="email"
          placeholder="Email (optional)"
          className="w-full h-9 px-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
      </div>
      <div>
        <textarea
          name="message"
          placeholder="Briefly describe your needs..."
          rows={3}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full btn btn-primary h-10 text-sm disabled:opacity-50"
      >
        {status === 'loading' ? 'Submitting...' : 'Free Consultation'}
      </button>
      <p className="text-xs text-text-muted text-center">The business will contact you as soon as possible</p>
    </form>
  );
}
