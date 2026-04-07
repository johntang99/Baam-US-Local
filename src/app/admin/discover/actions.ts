'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function approvePost(postId: string) {
  const ctx = await getAdminSiteContext();
  const { error } = await db()
    .from('voice_posts')
    .update({ status: 'published' })
    .eq('id', postId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/discover');
  revalidatePath('/discover');
  return { error: error?.message || null };
}

export async function rejectPost(postId: string) {
  const ctx = await getAdminSiteContext();
  const { error } = await db()
    .from('voice_posts')
    .update({ status: 'rejected' })
    .eq('id', postId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/discover');
  revalidatePath('/discover');
  return { error: error?.message || null };
}

export async function deletePost(postId: string) {
  const ctx = await getAdminSiteContext();
  // Delete linked data first
  await db().from('discover_post_businesses').delete().eq('post_id', postId);
  await db().from('discover_post_topics').delete().eq('post_id', postId);
  await db().from('voice_post_comments').delete().eq('post_id', postId).eq('site_id', ctx.siteId);

  const { error } = await db()
    .from('voice_posts')
    .delete()
    .eq('id', postId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/discover');
  revalidatePath('/discover');
  return { error: error?.message || null };
}
