import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import { DiscoverTable } from './DiscoverTable';

export const metadata = { title: 'Discover · Admin · Baam' };

export default async function AdminDiscoverPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const [{ data: pending }, { data: all }] = await Promise.all([
    supabase
      .from('voice_posts')
      .select('id, slug, title, content, status, post_type, cover_images, cover_image_url, ai_spam_score, moderation_reason, created_at, profiles:author_id(display_name)')
      .eq('site_id', ctx.siteId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('voice_posts')
      .select('id, slug, title, content, status, post_type, cover_images, cover_image_url, ai_spam_score, moderation_reason, created_at, profiles:author_id(display_name)')
      .eq('site_id', ctx.siteId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discover</h1>
          <p className="text-sm text-gray-500 mt-1">Review user-submitted discover posts</p>
        </div>
      </div>
      <DiscoverTable pendingPosts={pending || []} allPosts={all || []} />
    </div>
  );
}
