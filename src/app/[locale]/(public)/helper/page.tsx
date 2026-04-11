import { HelperChat } from './chat';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Helper · Baam',
  description: 'Your local AI assistant — find businesses, services, events, and answers to any community question.',
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function HelperPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialQuery = sp.q?.trim() || '';

  return (
    <main>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-orange-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🤖
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Helper</h1>
          <p className="text-text-secondary text-sm">
            Your local AI assistant — find businesses, services, events, and get answers to any community question.
          </p>
        </div>

        <HelperChat initialQuery={initialQuery} />
      </div>
    </main>
  );
}
