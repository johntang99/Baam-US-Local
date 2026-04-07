import { NextResponse } from 'next/server';

// NYC DOF Open Parking and Camera Violations (Socrata)
const SOCRATA_ENDPOINT = 'https://data.cityofnewyork.us/resource/nc67-uf89.json';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const plate = searchParams.get('plate')?.trim().toUpperCase();
  const state = searchParams.get('state')?.trim().toUpperCase();

  if (!plate || !state) {
    return NextResponse.json({ error: 'plate and state are required' }, { status: 400 });
  }

  if (!/^[A-Z0-9]{1,10}$/.test(plate)) {
    return NextResponse.json({ error: 'Invalid plate format' }, { status: 400 });
  }

  if (!/^[A-Z]{2}$/.test(state)) {
    return NextResponse.json({ error: 'Invalid state code' }, { status: 400 });
  }

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  try {
    const query = `$where=plate='${plate}' AND state='${state}'&$order=issue_date DESC&$limit=100`;
    const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (appToken) {
      headers['X-App-Token'] = appToken;
    }

    const res = await fetch(`${SOCRATA_ENDPOINT}?${query}`, { headers });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from NYC Open Data' }, { status: 502 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await res.json();

    const violations = raw.map((r) => ({
      summons_number: r.summons_number || '',
      issue_date: r.issue_date || '',
      violation: r.violation || '',
      fine_amount: parseFloat(r.fine_amount || '0'),
      penalty_amount: parseFloat(r.penalty_amount || '0'),
      interest_amount: parseFloat(r.interest_amount || '0'),
      reduction_amount: parseFloat(r.reduction_amount || '0'),
      payment_amount: parseFloat(r.payment_amount || '0'),
      amount_due: parseFloat(r.amount_due || '0'),
      precinct: r.precinct || '',
      county: r.county || '',
      issuing_agency: r.issuing_agency || '',
      summons_image: r.summons_image || null,
    }));

    // Sort by date descending (issue_date is MM/DD/YYYY string — parse to compare)
    violations.sort((a, b) => {
      const parseDate = (d: string) => {
        const parts = d.split('/');
        if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1])).getTime();
        return 0;
      };
      return parseDate(b.issue_date) - parseDate(a.issue_date);
    });

    const summary = violations.reduce(
      (acc, v) => {
        acc.totalFines += v.fine_amount + v.penalty_amount + v.interest_amount;
        acc.totalReduction += v.reduction_amount;
        acc.totalPaid += v.payment_amount;
        acc.totalDue += v.amount_due;
        if (v.amount_due > 0) acc.openCount++;
        else acc.paidCount++;
        return acc;
      },
      { totalFines: 0, totalReduction: 0, totalPaid: 0, totalDue: 0, openCount: 0, paidCount: 0 }
    );

    const response = NextResponse.json({
      plate,
      state,
      total: violations.length,
      violations,
      summary: {
        totalFines: Math.round(summary.totalFines * 100) / 100,
        totalReduction: Math.round(summary.totalReduction * 100) / 100,
        totalPaid: Math.round(summary.totalPaid * 100) / 100,
        totalDue: Math.round(summary.totalDue * 100) / 100,
        openCount: summary.openCount,
        paidCount: summary.paidCount,
      },
    });

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
