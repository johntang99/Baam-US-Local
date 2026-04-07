import { createClient } from '@/lib/supabase/server';

/**
 * Get the current authenticated user from the server side.
 * Returns user and profile, or null if not authenticated.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, profile_type, region_id')
    .eq('id', user.id)
    .single() as { data: Record<string, any> | null };

  return {
    id: user.id,
    email: user.email!,
    displayName: profile?.display_name || user.user_metadata?.full_name || user.email!.split('@')[0],
    avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || null,
    username: profile?.username || null,
    profileType: profile?.profile_type || 'user',
    regionId: profile?.region_id || null,
  };
}

/**
 * Require authentication — returns user or throws redirect.
 * Use in server components/actions that need auth.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}
