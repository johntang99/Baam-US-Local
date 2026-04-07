import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsForm } from './form';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const metadata: Metadata = {
  title: 'Settings · Baam',
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/en?auth=required&redirect=/settings');

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const profile = data as AnyRow | null;
  if (!profile) redirect('/en');

  return (
    <main>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <SettingsForm profile={profile} userEmail={user.email} />
      </div>
    </main>
  );
}
