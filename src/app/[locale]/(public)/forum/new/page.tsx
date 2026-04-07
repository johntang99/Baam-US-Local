import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { Link } from '@/lib/i18n/routing';
import { ForumNewPostForm } from './form';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'New Post · Community Forum · Baam',
    description: 'Create a new post on the Baam community forum',
  };
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ForumNewPostPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  const siteScope = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';

  // Fetch all forum boards for the selector
  const { data: rawScopedBoards } = await supabase
    .from('categories_forum')
    .select('id, slug, name_zh, name_en, icon, site_scope')
    .eq('site_scope', siteScope)
    .order('sort_order', { ascending: true });
  let boardRows = (rawScopedBoards || []) as AnyRow[];
  if (boardRows.length === 0 && siteScope === 'en') {
    const { data: rawZhBoards } = await supabase
      .from('categories_forum')
      .select('id, slug, name_zh, name_en, icon, site_scope')
      .eq('site_scope', 'zh')
      .order('sort_order', { ascending: true });
    boardRows = (rawZhBoards || []) as AnyRow[];
  }

  const boards = (boardRows.map((board: AnyRow) => ({
    ...board,
    name: board.name || board.name_en,
    emoji: board.emoji || board.icon,
  }))) as AnyRow[];

  return (
    <main>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/forum" className="hover:text-primary">Forum</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-text-secondary">New Post</span>
        </nav>

        <h1 className="text-2xl font-bold mb-6">New Post</h1>

        <ForumNewPostForm boards={boards} isLoggedIn={!!user} />
      </div>
    </main>
  );
}
