import { AskChat } from './chat';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Assistant · Baam',
  description: 'Ask me any local question — find doctors, housing, taxes, food, events. AI helps you find answers fast.',
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function AskPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialQuery = sp.q?.trim() || '';

  return (
    <main>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-orange-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🤖
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">AI Assistant</h1>
          <p className="text-text-secondary text-sm">
            Ask me any local question — find doctors, housing, taxes, restaurants, events
          </p>
        </div>

        {/* Chat Interface */}
        <AskChat initialQuery={initialQuery} />
      </div>
    </main>
  );
}
