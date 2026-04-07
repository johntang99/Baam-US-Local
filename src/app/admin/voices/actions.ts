'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function approveVoice(profileId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('profiles')
    .update({ profile_type: 'creator' })
    .eq('id', profileId);

  revalidatePath('/admin/voices');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function rejectVoice(profileId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('profiles')
    .update({ profile_type: 'user' })
    .eq('id', profileId);

  revalidatePath('/admin/voices');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function verifyVoice(profileId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: true })
    .eq('id', profileId);

  revalidatePath('/admin/voices');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function unverifyVoice(profileId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: false })
    .eq('id', profileId);

  revalidatePath('/admin/voices');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function toggleFeatured(profileId: string, featured: boolean) {
  const supabase = db();

  const { error } = await supabase
    .from('profiles')
    .update({ is_featured: featured })
    .eq('id', profileId);

  revalidatePath('/admin/voices');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function updateProfileType(profileId: string, type: string) {
  const supabase = db();

  const { error } = await supabase
    .from('profiles')
    .update({ profile_type: type })
    .eq('id', profileId);

  revalidatePath('/admin/voices');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
