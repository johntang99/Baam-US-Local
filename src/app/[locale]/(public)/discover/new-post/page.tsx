import { getCurrentUser } from '@/lib/auth';
import { getCurrentSite } from '@/lib/sites';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/lib/i18n/routing';
import { VoicePostForm } from './form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Post · Discover · Baam',
  description: 'Share your local tips, recommendations, and experiences',
};

interface Props {
  searchParams: Promise<{ business?: string }>;
}

export default async function DiscoverNewPostPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const site = await getCurrentSite();
  const sp = await searchParams;

  // If a business slug is provided, fetch it for pre-linking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prelinkedBusiness: Record<string, any> | null = null;
  if (sp.business) {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('businesses')
      .select('id, slug, display_name, display_name_zh, short_desc_zh, address_full')
      .eq('slug', sp.business)
      .eq('site_id', site.id)
      .eq('status', 'active')
      .single();
    prelinkedBusiness = data;
  }

  return (
    <main>
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/discover" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium hidden sm:inline">Back to Discover</span>
          </Link>
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />
          <h1 className="text-lg font-bold text-gray-900">Create Post</h1>
        </div>

        <VoicePostForm isLoggedIn={!!user} prelinkedBusiness={prelinkedBusiness} />
      </div>
    </main>
  );
}
