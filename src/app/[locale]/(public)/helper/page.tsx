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
      {/* Header — full width */}
      <div className="text-center pt-8 pb-4 px-4">
        <div className="w-14 h-14 bg-gradient-to-br from-primary to-orange-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">
          👩‍💼
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Helper</h1>
        <p className="text-text-secondary text-sm">
          Your local AI assistant — find businesses, services, events, and get answers to any community question.
        </p>
      </div>

      {/* Chat — full width container, chat component handles its own widths */}
      <div className="px-4 pb-8">
        <HelperChat initialQuery={initialQuery} />
      </div>
    </main>
  );
}
