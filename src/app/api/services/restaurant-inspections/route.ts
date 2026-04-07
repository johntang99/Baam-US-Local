import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSiteByHost } from '@/lib/sites';

const SOCRATA_ENDPOINT = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 15;
}

// Detect if query contains Chinese characters
function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

interface RestaurantResult {
  camis: string;
  dba: string;
  dba_zh?: string;
  boro: string;
  building: string;
  street: string;
  zipcode: string;
  phone: string;
  cuisine: string;
  grade: string;
  score: number;
  inspection_date: string;
  latitude?: string;
  longitude?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const camis = searchParams.get('camis')?.trim();
  const boro = searchParams.get('boro')?.trim();
  const host = request.headers.get('host');
  const site = await getSiteByHost(host);

  if (!query && !camis) {
    return NextResponse.json({ error: 'q or camis parameter required' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
    if (appToken) headers['X-App-Token'] = appToken;

    // ─── Detail mode: fetch all records for one restaurant ───
    if (camis) {
      const res = await fetch(
        `${SOCRATA_ENDPOINT}?camis=${camis}&$order=inspection_date DESC&$limit=200`,
        { headers }
      );
      if (!res.ok) return NextResponse.json({ error: 'Failed to fetch' }, { status: 502 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = await res.json();
      if (raw.length === 0) return NextResponse.json({ restaurant: null, inspections: [] });

      const restaurant = {
        camis: raw[0].camis,
        dba: raw[0].dba,
        boro: raw[0].boro,
        building: raw[0].building,
        street: raw[0].street,
        zipcode: raw[0].zipcode,
        phone: raw[0].phone,
        cuisine: raw[0].cuisine_description,
        latitude: raw[0].latitude,
        longitude: raw[0].longitude,
      };

      const inspectionMap = new Map<string, {
        date: string; score: number; grade: string; type: string;
        violations: { code: string; description: string; critical: boolean }[];
      }>();

      for (const r of raw) {
        const key = r.inspection_date || '';
        if (!key || key === '1900-01-01T00:00:00.000') continue;
        if (!inspectionMap.has(key)) {
          inspectionMap.set(key, {
            date: key, score: parseInt(r.score || '0'),
            grade: r.grade || '', type: r.inspection_type || '', violations: [],
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
        .filter(i => i.date && i.date !== '1900-01-01T00:00:00.000')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const response = NextResponse.json({ restaurant, inspections });
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      return response;
    }

    // ─── Search mode ───
    let socrataQuery = query!;
    let baamNameMap = new Map<string, string>(); // english name (lowercase) → chinese name

    // If query has Chinese characters, search Baam DB first to find English names
    if (hasChinese(query!)) {
      const supabase = getSupabase();
      const { data: baamMatches } = await supabase
        .from('businesses')
        .select('display_name, display_name_zh')
        .or(`display_name_zh.ilike.%${query}%,display_name.ilike.%${query}%`)
        .eq('site_id', site?.id ?? '')
        .eq('status', 'active')
        .limit(20);

      if (baamMatches && baamMatches.length > 0) {
        // Build Chinese name lookup map
        for (const b of baamMatches) {
          if (b.display_name) {
            const zh = (b.display_name_zh || '').trim();
            if (zh) baamNameMap.set(b.display_name.toLowerCase(), zh);
          }
        }
        // Extract the most distinctive words from the English name for Socrata search
        // Socrata $q full-text works best with short, unique terms
        const englishName = (baamMatches[0].display_name || '');
        const noiseWords = new Set(['inc','llc','corp','the','of','and','at','in','on','store','shop','restaurant','nyc','ny','flushing','brooklyn','manhattan','queens','bronx','new','york','chinese','express']);
        const keyWords = englishName
          .replace(/\s*[-–—(（].+$/, '')
          .split(/[\s,]+/)
          .map((w: string) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
          .filter((w: string) => w.length > 2 && !noiseWords.has(w));
        // Use first 2-3 distinctive words
        socrataQuery = keyWords.slice(0, 3).join(' ') || englishName;
      }
    } else {
      // English search: also fetch Chinese names from Baam for enrichment
      const supabase = getSupabase();
      const { data: baamMatches } = await supabase
        .from('businesses')
        .select('display_name, display_name_zh')
        .ilike('display_name', `%${query}%`)
        .eq('site_id', site?.id ?? '')
        .not('display_name_zh', 'is', null)
        .eq('status', 'active')
        .limit(30);

      if (baamMatches) {
        for (const b of baamMatches) {
          if (b.display_name) {
            const zh = (b.display_name_zh || '').trim();
            if (zh) baamNameMap.set(b.display_name.toLowerCase(), zh);
          }
        }
      }
    }

    // Query Socrata — if Chinese query was translated, search both the translated query
    // and the original (Socrata $q can match pinyin-like DBA names)
    const fetchSocrata = async (q: string) => {
      const params = new URLSearchParams({
        $q: q,
        $limit: '50',
        $order: 'inspection_date DESC',
      });
      if (boro) params.set('boro', boro.toUpperCase());
      const r = await fetch(`${SOCRATA_ENDPOINT}?${params}`, { headers });
      return r.ok ? await r.json() : [];
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let raw: any[] = await fetchSocrata(socrataQuery);

    // If got few results, try alternative queries
    if (raw.length < 5) {
      const seen = new Set(raw.map((r: { camis: string }) => r.camis));
      const mergeResults = (extra: { camis: string }[]) => {
        for (const r of extra) {
          if (!seen.has(r.camis)) { raw.push(r); seen.add(r.camis); }
        }
      };

      // For Chinese queries, also try: original Chinese text, and first keyword only
      if (hasChinese(query!) && socrataQuery !== query!) {
        mergeResults(await fetchSocrata(query!));
      }
      // Try first keyword alone (handles "haidilao hotpot" → "haidilao")
      const firstWord = socrataQuery.split(/\s+/)[0];
      if (firstWord && firstWord !== socrataQuery && firstWord.length > 3) {
        mergeResults(await fetchSocrata(firstWord));
      }
    }

    // Deduplicate by camis + enrich with Chinese names
    const latestByCamis = new Map<string, RestaurantResult>();

    for (const r of raw) {
      if (!r.camis || !r.dba) continue;
      if (r.inspection_date === '1900-01-01T00:00:00.000') continue;
      if (!latestByCamis.has(r.camis)) {
        // Try to find Chinese name: exact match, then fuzzy word overlap
        const dbaLower = r.dba.toLowerCase();
        let dbaZh = baamNameMap.get(dbaLower) || '';
        if (!dbaZh) {
          const dbaWords = dbaLower.split(/\s+/).filter((w: string) => w.length > 2);
          for (const [eng, zh] of baamNameMap) {
            const engWords = eng.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
            // Match if 2+ significant words overlap
            const overlap = dbaWords.filter((w: string) => engWords.some((ew: string) => ew.includes(w) || w.includes(ew)));
            if (overlap.length >= 2) {
              dbaZh = zh;
              break;
            }
          }
        }

        latestByCamis.set(r.camis, {
          camis: r.camis,
          dba: r.dba,
          dba_zh: dbaZh || undefined,
          boro: r.boro || '',
          building: r.building || '',
          street: r.street || '',
          zipcode: r.zipcode || '',
          phone: r.phone || '',
          cuisine: r.cuisine_description || '',
          grade: r.grade || '',
          score: parseInt(r.score || '0'),
          inspection_date: r.inspection_date || '',
          latitude: r.latitude,
          longitude: r.longitude,
        });
      }
    }

    const restaurants = Array.from(latestByCamis.values());
    const response = NextResponse.json({ restaurants, total: restaurants.length });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
