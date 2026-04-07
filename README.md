# Baam Middletown (MT)

The English-language community platform for Middletown, NY and the surrounding Orange County area.

## Quick Start

```bash
# From monorepo root
npm run dev:english

# Or from this directory
npm run dev
```


lsof -ti:6001 | xargs kill -9
rm -rf .next
npm run dev

npm install
npm run build

git add .
git commit -m "Update: describe your changes"
git push




Runs on **http://localhost:6001**

## Overview

| Item | Value |
|------|-------|
| Package | `@baam/english` |
| Port | 6001 |
| Default locale | `en` (English) |
| Theme color | Blue (`#3B82F6`) |
| Favicon | Blue "MT" |
| Target region | Middletown, Orange County, NY |

## Key Features

- **News** — Local Middletown news and community updates
- **Guides** — Local living guides (services, schools, housing)
- **Forum** — Community discussion boards
- **Businesses** — Local business directory
- **Events** — Community events calendar
- **AI Assistant** — AI-powered local Q&A
- **Tools** — Practical local service tools

## Architecture

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (shared with Chinese site)
- **i18n**: `next-intl` with `[locale]` route segment (`/en/...`)
- **AI**: Claude API for search and content generation

## How It Relates to the Chinese Site

Both sites share the same Supabase database but are **fully independent codebases**:

| | Chinese (apps/web) | English (apps/english) |
|---|---|---|
| Port | 5001 | 6001 |
| Default locale | zh | en |
| Theme | Orange | Blue |
| Region | NYC / Flushing | Middletown, NY |
| Chinese script toggle | Yes (Simplified/Traditional) | No |
| Deployment | Separate Vercel project | Separate Vercel project |

Stopping, building, or modifying one site has **zero effect** on the other.

## Directory Structure

```
src/
  app/
    [locale]/(public)/     # Public pages (news, guides, businesses, etc.)
    admin/                 # Admin panel (no locale prefix)
    api/                   # API routes
  components/
    layout/                # Navbar, Footer (English branding)
    shared/                # Reusable components
  lib/
    supabase/              # Supabase client helpers
    ai/                    # Claude API wrapper
    i18n/                  # Locale config, routing
  types/                   # TypeScript types
public/
  locales/en/              # English translation strings
  locales/zh-CN/           # Chinese translations (for bilingual support)
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values. Key variables:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase admin access
- `ANTHROPIC_API_KEY` — Claude AI
- `NEXT_PUBLIC_DEFAULT_SITE=mt-en`
- `NEXT_PUBLIC_SITE_PLATFORM=english`
- `NEXT_PUBLIC_SITE_REGION=middletown-ny`
- `NEXT_PUBLIC_DEFAULT_LOCALE=en`

## Status

This site is in early development. Current state:

- [x] Scaffolded from Chinese site with English branding
- [x] English translations for all UI chrome (navbar, footer, homepage sections)
- [x] Blue theme color + "MT" favicon
- [x] Independent dev server on port 6001
- [ ] Region filtering (show only Middletown data)
- [ ] Seed Middletown businesses via Google Places
- [ ] Create Middletown-specific news/guides/events content
- [ ] Production deployment (separate Vercel project)

## Related

- [Baam Chinese (NYC)](../web/README.md) — Chinese-language sister site
- [Shared packages](../../packages/) — Shared types and utilities
- [Multi-site architecture](../../document/multi-site/) — Platform scaling docs
- [Database schema](../../document/Baam_Supabase_Schema.sql) — Full Supabase schema
