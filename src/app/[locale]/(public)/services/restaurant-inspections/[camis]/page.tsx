import { Link } from '@/lib/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSite } from '@/lib/sites';
import { createClient as createDirectClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseForMeta(): any {
  return createDirectClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface Props {
  params: Promise<{ locale: string; camis: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const SOCRATA_URL = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';

const GRADE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  'A': { bg: 'bg-green-500', text: 'text-green-600', label: 'Excellent' },
  'B': { bg: 'bg-yellow-500', text: 'text-yellow-600', label: 'Good' },
  'C': { bg: 'bg-orange-500', text: 'text-orange-600', label: 'Needs Improvement' },
  'Z': { bg: 'bg-red-500', text: 'text-red-600', label: 'Pending' },
  'P': { bg: 'bg-gray-400', text: 'text-gray-500', label: 'Pending' },
};

interface Inspection {
  date: string;
  score: number;
  grade: string;
  type: string;
  violations: { code: string; description: string; critical: boolean }[];
}

async function fetchRestaurantData(camis: string) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
  if (appToken) headers['X-App-Token'] = appToken;

  const res = await fetch(`${SOCRATA_URL}?camis=${camis}&$order=inspection_date DESC&$limit=200`, {
    headers,
    next: { revalidate: 86400 }, // Cache for 24 hours
  });

  if (!res.ok) return null;
  const raw: AnyRow[] = await res.json();
  if (raw.length === 0) return null;

  const restaurant = {
    camis: raw[0].camis,
    dba: raw[0].dba || '',
    boro: raw[0].boro || '',
    building: raw[0].building || '',
    street: raw[0].street || '',
    zipcode: raw[0].zipcode || '',
    phone: raw[0].phone || '',
    cuisine: raw[0].cuisine_description || '',
    latitude: raw[0].latitude,
    longitude: raw[0].longitude,
  };

  // Group inspections
  const inspectionMap = new Map<string, Inspection>();
  for (const r of raw) {
    const key = r.inspection_date || '';
    if (!key || key === '1900-01-01T00:00:00.000') continue;
    if (!inspectionMap.has(key)) {
      inspectionMap.set(key, {
        date: key,
        score: parseInt(r.score || '0'),
        grade: r.grade || '',
        type: r.inspection_type || '',
        violations: [],
      });
    }
    if (r.violation_code && r.violation_description) {
      inspectionMap.get(key)!.violations.push({
        code: r.violation_code,
        description: r.violation_description,
        critical: r.critical_flag === 'Critical',
      });
    }
  }

  const inspections = Array.from(inspectionMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { restaurant, inspections };
}

function formatDate(iso: string): string {
  return iso ? iso.split('T')[0] : '';
}

function formatPhone(phone: string): string {
  if (!phone || phone.length !== 10) return phone;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { camis } = await params;
  const data = await fetchRestaurantData(camis);
  const site = await getCurrentSite();
  if (!data) return { title: 'Not Found' };

  const { restaurant, inspections } = data;
  const latest = inspections[0];
  const address = [restaurant.building, restaurant.street, restaurant.boro].filter(Boolean).join(', ');

  // Try to get Chinese name for metadata
  let zhName = '';
  try {
    const supabase = getSupabaseForMeta();
    const words = restaurant.dba.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2).slice(0, 3).join('%');
    const { data: biz } = await supabase
      .from('businesses')
      .select('display_name_zh')
      .eq('site_id', site.id)
      .ilike('display_name', `%${words}%`)
      .not('display_name_zh', 'is', null)
      .eq('status', 'active')
      .limit(1);
    zhName = biz?.[0]?.display_name_zh?.trim() || '';
  } catch { /* ignore */ }

  const displayName = zhName ? `${zhName} ${restaurant.dba}` : restaurant.dba;

  return {
    title: `${displayName} Health Grade${latest?.grade ? ` ${latest.grade}` : ''} | Health Inspection · Baam`,
    description: `${displayName} (${address}) NYC health inspection grade${latest ? `: ${latest.grade} (${latest.score} points)` : ''}. View full inspection history and violations.`,
    openGraph: {
      title: `${restaurant.dba} — Health Grade`,
      description: `${restaurant.cuisine} · ${address}`,
      locale: 'en_US',
    },
  };
}

export default async function RestaurantDetailPage({ params }: Props) {
  const { camis } = await params;
  const data = await fetchRestaurantData(camis);
  const site = await getCurrentSite();
  if (!data) notFound();

  const { restaurant, inspections } = data;
  const latest = inspections[0];
  const address = [restaurant.building, restaurant.street, restaurant.boro, 'NY', restaurant.zipcode].filter(Boolean).join(', ');
  const gradeStyle = GRADE_STYLES[latest?.grade] || GRADE_STYLES['P'];

  // Stats
  const totalInspections = inspections.length;
  const criticalCount = inspections.reduce((sum, i) => sum + i.violations.filter(v => v.critical).length, 0);
  const nonCriticalCount = inspections.reduce((sum, i) => sum + i.violations.filter(v => !v.critical).length, 0);

  // Try to find matching Baam business
  let baamBusiness: AnyRow | null = null;
  try {
    const supabase = await createClient();
    const dbaWords = restaurant.dba.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2).slice(0, 3).join('%');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bizData } = await (supabase as any)
      .from('businesses')
      .select('slug, display_name, display_name_zh, avg_rating, review_count, address_full')
      .or(`display_name.ilike.%${dbaWords}%,display_name_zh.ilike.%${dbaWords}%`)
      .eq('site_id', site.id)
      .eq('status', 'active')
      .limit(3);
    // Pick best match — prefer one with Chinese name
    if (bizData && bizData.length > 0) {
      baamBusiness = bizData.find((b: AnyRow) => b.display_name_zh?.trim()) || bizData[0];
    }
  } catch {
    // Ignore — business cross-link is optional
  }

  const chineseName = baamBusiness?.display_name_zh?.trim() || '';

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">Tools</Link>
        <span className="mx-2">/</span>
        <Link href="/services/restaurant-inspections" className="hover:text-primary">Restaurant Health Grades</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{restaurant.dba}</span>
      </nav>

      {/* Restaurant Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Grade Badge */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={cn('w-24 h-24 rounded-2xl flex items-center justify-center text-white text-4xl font-bold', gradeStyle.bg)}>
              {latest?.grade || '?'}
            </div>
            <div className={cn('text-sm font-semibold mt-2', gradeStyle.text)}>
              Score: {latest?.score ?? '?'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {latest ? formatDate(latest.date) : ''}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
              {chineseName || restaurant.dba}
            </h1>
            {chineseName && (
              <p className="text-sm text-gray-500 mb-2">{restaurant.dba}</p>
            )}
            <p className="text-sm text-gray-500 mb-1">{address}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-gray-500">
              {restaurant.cuisine && <span className="text-primary font-medium">{restaurant.cuisine}</span>}
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`} className="hover:text-primary">{formatPhone(restaurant.phone)}</a>
              )}
            </div>
            {restaurant.latitude && (
              <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                <a href={`https://maps.google.com/?q=${restaurant.latitude},${restaurant.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  Directions
                </a>
                {restaurant.phone && (
                  <a href={`tel:${restaurant.phone}`} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    Call
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-gray-900">{totalInspections}</div>
          <div className="text-xs text-gray-500">Total Inspections</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className={cn('text-xl font-bold', gradeStyle.text)}>{latest?.score ?? '?'} ({latest?.grade || '?'})</div>
          <div className="text-xs text-gray-500">Latest Grade</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className={cn('text-xl font-bold', criticalCount > 0 ? 'text-red-600' : 'text-green-600')}>{criticalCount}</div>
          <div className="text-xs text-gray-500">Critical</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className={cn('text-xl font-bold', nonCriticalCount > 0 ? 'text-yellow-600' : 'text-green-600')}>{nonCriticalCount}</div>
          <div className="text-xs text-gray-500">Non-Critical</div>
        </div>
      </div>

      {/* Inspection Timeline */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-5">Inspection History</h2>
        <div className="space-y-4">
          {inspections.map((inspection, i) => {
            const iStyle = GRADE_STYLES[inspection.grade] || GRADE_STYLES['P'];
            return (
              <div key={i} className="relative pl-8 border-l-2 border-gray-100 pb-4 last:pb-0">
                {/* Timeline dot */}
                <div className={cn('absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white', iStyle.bg)} />

                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold text-gray-900">{formatDate(inspection.date)}</span>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full text-white', iStyle.bg)}>
                    {inspection.grade || '?'} ({inspection.score} pts)
                  </span>
                  <span className="text-xs text-gray-400">{inspection.type}</span>
                </div>

                {inspection.violations.length === 0 ? (
                  <div className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    No Violations
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {inspection.violations.map((v, vi) => (
                      <div key={vi} className="flex items-start gap-2 text-sm">
                        <span className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5',
                          v.critical ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        )}>
                          {v.critical ? 'Critical' : 'General'}
                        </span>
                        <span className="text-gray-600">{v.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Baam Business Cross-link */}
      {baamBusiness && (
        <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-3">View this restaurant on Baam</h2>
          <Link href={`/businesses/${baamBusiness.slug}`} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:border-primary/30 hover:shadow-sm transition group">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
              {(baamBusiness.display_name_zh || baamBusiness.display_name)?.[0] || '🍽️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 group-hover:text-primary transition">
                  {baamBusiness.display_name_zh || baamBusiness.display_name}
                </span>
                <span className="text-[10px] text-primary bg-orange-50 px-1.5 py-0.5 rounded">Baam Verified</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                {baamBusiness.avg_rating && <span>★ {baamBusiness.avg_rating}</span>}
                {baamBusiness.address_full && <span className="truncate">{baamBusiness.address_full}</span>}
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        </section>
      )}

      {/* Write Post CTA */}
      <section className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Been to this restaurant? Share your experience</p>
          <p className="text-xs text-gray-500 mt-0.5">Write a review to help others in the community</p>
        </div>
        <Link
          href={baamBusiness ? `/discover/new-post?business=${baamBusiness.slug}` : '/discover/new-post'}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition flex-shrink-0"
        >
          Write Review
        </Link>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>Data source: NYC Department of Health and Mental Hygiene (DOHMH). Grading: A (0-13 points), B (14-27 points), C (28+ points). Lower scores are better.</p>
      </div>

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Restaurant',
            name: restaurant.dba,
            address: {
              '@type': 'PostalAddress',
              streetAddress: `${restaurant.building} ${restaurant.street}`,
              addressLocality: restaurant.boro,
              addressRegion: 'NY',
              postalCode: restaurant.zipcode,
              addressCountry: 'US',
            },
            telephone: restaurant.phone ? formatPhone(restaurant.phone) : undefined,
            servesCuisine: restaurant.cuisine,
            ...(restaurant.latitude && {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
              },
            }),
          }),
        }}
      />
    </main>
  );
}
