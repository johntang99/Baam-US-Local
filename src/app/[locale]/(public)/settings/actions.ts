'use server';

import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const displayName = (formData.get('display_name') as string)?.trim();
  const username = (formData.get('username') as string)?.trim();
  const bio = (formData.get('bio') as string)?.trim();
  const headline = (formData.get('headline') as string)?.trim();

  if (!displayName) return { error: 'Please enter a display name' };

  if (username && (username.length < 3 || username.length > 30)) {
    return { error: 'Username must be 3-30 characters' };
  }

  const supabase = createAdminClient();

  // Check username uniqueness if changed
  if (username) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .single();

    if (existing) return { error: 'Username is already taken' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      display_name: displayName,
      username: username || null,
      bio: bio || null,
      headline: headline || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { error: 'Save failed: ' + error.message };

  revalidatePath('/settings');
  revalidatePath(`/profile/${username}`);
  return { error: null };
}
