import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './lib/i18n/routing';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

const intlMiddleware = createMiddleware(routing);

// ─── Static domain → site slug map (fast, no DB) ─────────────────────

const DOMAIN_SITE_MAP: Record<string, { slug: string; locale: string }> = {
  // Production
  'baam-mt.com': { slug: 'mt-en', locale: 'en' },
  'www.baam-mt.com': { slug: 'mt-en', locale: 'en' },
  'middletown.baam.com': { slug: 'mt-en', locale: 'en' },
  'baam-us-local.vercel.app': { slug: 'mt-en', locale: 'en' },
  // Development
  'localhost': { slug: 'mt-en', locale: 'en' },
};

function normalizeHost(host: string): string {
  return host.split(':')[0].toLowerCase().replace(/^www\./, '').trim();
}

function resolveSite(host: string | null): { slug: string; locale: string } {
  if (!host) return { slug: 'mt-en', locale: 'en' };
  const hostname = normalizeHost(host);
  return DOMAIN_SITE_MAP[hostname] || { slug: 'mt-en', locale: 'en' };
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host');
  const site = resolveSite(host);

  // ─── Locale redirect based on site ────────────────────────────────
  // NY Chinese site: redirect /en/* to /zh/*
  if (site.locale === 'zh' && pathname.startsWith('/en')) {
    const zhPath = pathname.replace(/^\/en/, '/zh') || '/zh';
    return NextResponse.redirect(new URL(zhPath, request.url));
  }
  // OC English site (future): redirect /zh/* to /en/*
  if (site.locale === 'en' && pathname.startsWith('/zh')) {
    const enPath = pathname.replace(/^\/zh/, '/en') || '/en';
    return NextResponse.redirect(new URL(enPath, request.url));
  }

  // ─── Admin & API routes ──────────────────────────────────────────
  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
    const response = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });

    // Set site context header
    response.headers.set('x-baam-site', site.slug);

    // Refresh Supabase session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );
    await supabase.auth.getUser();
    return response;
  }

  // ─── Public routes (with i18n) ───────────────────────────────────

  // Apply i18n middleware
  const response = intlMiddleware(request);

  // Set site context header for downstream use
  response.headers.set('x-baam-site', site.slug);

  // Refresh Supabase session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next|api/webhooks|icon|favicon\\.ico|.*\\..*).*)',
  ],
};
