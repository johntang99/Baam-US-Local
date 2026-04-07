import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const categoryLabels: Record<string, string> = {
  housing_rent: 'Rentals', housing_buy: 'Real Estate', jobs: 'Jobs',
  secondhand: 'For Sale', services: 'Services', events: 'Events', general: 'Other',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('classifieds').select('title').eq('slug', slug).eq('site_id', site.id).single();
  return { title: data ? `${data.title} · Classifieds · Baam` : 'Not Found' };
}

export default async function ClassifiedDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('classifieds').select('*').eq('slug', slug).eq('site_id', site.id).single();

  const item = data as AnyRow | null;
  if (error || !item) notFound();

  const catLabel = categoryLabels[item.category] || 'Other';
  const postedDate = new Date(item.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const expiresDate = item.expires_at
    ? new Date(item.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;

  return (
    <main>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">&rsaquo;</span>
          <Link href="/classifieds" className="hover:text-primary">Classifieds</Link>
          <span className="mx-2">&rsaquo;</span>
          <span className="text-text-secondary">{catLabel}</span>
        </nav>

        <div className="card p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-gray">{catLabel}</span>
            {item.is_featured && <span className="badge badge-red">Pinned</span>}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-4">{item.title}</h1>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-text-muted mb-6 pb-6 border-b border-border">
            <span>Posted {postedDate}</span>
            {expiresDate && <span>Valid until {expiresDate}</span>}
            <span>{item.view_count || 0} views</span>
          </div>

          {/* Price */}
          {item.price_text && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <span className="text-sm text-text-muted">Price: </span>
              <span className="text-lg font-bold text-primary ml-1">{item.price_text}</span>
            </div>
          )}

          {/* Body */}
          {item.body && (
            <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap mb-8">
              {item.body}
            </div>
          )}

          {/* Contact Info */}
          <div className="bg-bg-page rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">Contact</h3>
            <div className="space-y-2 text-sm">
              {item.contact_name && <p><span className="text-text-muted">Name: </span>{item.contact_name}</p>}
              {item.contact_phone && (
                <p>
                  <span className="text-text-muted">Phone: </span>
                  <a href={`tel:${item.contact_phone}`} className="text-primary hover:underline">{item.contact_phone}</a>
                </p>
              )}
              {item.contact_email && (
                <p>
                  <span className="text-text-muted">Email: </span>
                  <a href={`mailto:${item.contact_email}`} className="text-primary hover:underline">{item.contact_email}</a>
                </p>
              )}
              {item.contact_wechat && <p><span className="text-text-muted">WeChat: </span>{item.contact_wechat}</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
