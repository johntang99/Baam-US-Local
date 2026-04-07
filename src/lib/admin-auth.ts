import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Admin emails - add more as needed
const ADMIN_EMAILS = [
  'admin@baamplatform.com',
  'john.tang2025@gmail.com',
];

// Admin usernames from profiles table
const ADMIN_USERNAMES = ['admin'];

/**
 * Check if the current user is an admin.
 * Redirects to login page if not authenticated or not admin.
 * Use this in admin layout or pages.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/zh?auth=required&redirect=/admin');
  }

  // Check by email
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    return user;
  }

  // Check by user_metadata role
  if (user.user_metadata?.role === 'admin') {
    return user;
  }

  // Check by username in profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single() as { data: Record<string, any> | null };

  if (profile?.username && ADMIN_USERNAMES.includes(profile.username)) {
    return user;
  }

  // Not admin - redirect to homepage
  redirect('/zh?error=unauthorized');
}
