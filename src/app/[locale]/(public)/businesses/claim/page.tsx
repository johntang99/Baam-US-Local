import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/lib/i18n/routing';
import { ClaimForm } from './form';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export const metadata: Metadata = {
  title: 'List Your Business · Baam',
  description: 'List your business on Baam for free. AI-optimized profile. Reach local customers.',
};

export default async function BusinessClaimPage() {
  const user = await getCurrentUser().catch(() => null);
  const supabase = await createClient();

  // Fetch parent business categories
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('id, slug, name_zh, name_en, name')
    .eq('type', 'business')
    .eq('site_scope', 'en')
    .is('parent_id', null)
    .order('sort_order', { ascending: true });

  const categories = (rawCategories || []) as AnyRow[];

  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-r from-primary to-orange-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">List on Baam for Free</h1>
          <p className="text-lg text-orange-100 mb-2">Help local customers discover your business</p>
          <p className="text-sm text-orange-200">AI-optimized business profile · Reach local customers · Get free leads</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="card p-5 text-center">
            <p className="text-3xl mb-2">🆓</p>
            <h3 className="font-semibold text-sm mb-1">Always Free</h3>
            <p className="text-xs text-text-muted">Basic business profile is completely free</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl mb-2">🤖</p>
            <h3 className="font-semibold text-sm mb-1">AI Optimized</h3>
            <p className="text-xs text-text-muted">AI auto-generates descriptions and FAQs</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl mb-2">📈</p>
            <h3 className="font-semibold text-sm mb-1">Reach Customers</h3>
            <p className="text-xs text-text-muted">Appear in search, guides, and forums</p>
          </div>
        </div>

        {/* Form */}
        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-6">{user ? 'Submit Your Listing' : 'Please Log In'}</h2>
          {!user ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-4">🔒</p>
              <p className="text-text-secondary mb-2">Please log in or sign up before listing your business</p>
              <p className="text-sm text-text-muted">Click the "Log In / Sign Up" button in the top right</p>
            </div>
          ) : (
            <ClaimForm categories={categories} />
          )}
        </div>

        <p className="text-xs text-text-muted text-center mt-4">
          By submitting, you agree to Baam's <Link href="/" className="text-primary">Terms of Service</Link> and <Link href="/" className="text-primary">Privacy Policy</Link>. We will review your listing within 1-3 business days.
        </p>
      </div>
    </main>
  );
}
