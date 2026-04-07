'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function approveThread(threadId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('forum_threads')
    .update({ status: 'published' })
    .eq('id', threadId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/forum');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteThread(threadId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  // Delete replies first
  await supabase
    .from('forum_replies')
    .delete()
    .eq('thread_id', threadId)
    .eq('site_id', ctx.siteId);

  // Delete the thread
  const { error } = await supabase
    .from('forum_threads')
    .delete()
    .eq('id', threadId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/forum');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function pinThread(threadId: string, pinned: boolean) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('forum_threads')
    .update({ is_pinned: pinned })
    .eq('id', threadId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/forum');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function lockThread(threadId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('forum_threads')
    .update({ status: 'locked' })
    .eq('id', threadId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/forum');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function featureThread(threadId: string, featured: boolean) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('forum_threads')
    .update({ is_featured: featured })
    .eq('id', threadId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/forum');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteReply(replyId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('forum_replies')
    .delete()
    .eq('id', replyId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/forum');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
