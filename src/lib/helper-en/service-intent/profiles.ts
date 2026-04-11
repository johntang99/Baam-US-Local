/**
 * English service intent profiles.
 */

import type { ServiceIntentProfile } from '@/lib/helper-core';

export function detectEnglishServiceIntent(query: string, keywords: string[]): ServiceIntentProfile | null {
  const merged = `${query} ${keywords.join(' ')}`.toLowerCase();

  if (/(dentist|dental|orthodont|oral surgery)/i.test(merged)) {
    return {
      key: 'dental',
      entityRegex: /(dentist|dental|orthodont|oral|tooth|teeth)/i,
      fallbackOr: 'display_name.ilike.%dentist%,display_name.ilike.%dental%,short_desc.ilike.%dental%,ai_summary.ilike.%dental%',
    };
  }

  if (/(lawyer|attorney|law firm|legal)/i.test(merged)) {
    return {
      key: 'lawyer',
      entityRegex: /(lawyer|attorney|law firm|legal|immigration)/i,
      fallbackOr: 'display_name.ilike.%lawyer%,display_name.ilike.%attorney%,display_name.ilike.%law%,short_desc.ilike.%legal%',
      countOr: 'display_name.ilike.%lawyer%,display_name.ilike.%attorney%,display_name.ilike.%law%',
    };
  }

  if (/(accountant|cpa|tax prep|tax service|bookkeep)/i.test(merged)) {
    return {
      key: 'tax',
      entityRegex: /(accountant|cpa|tax|bookkeep)/i,
      fallbackOr: 'display_name.ilike.%cpa%,display_name.ilike.%tax%,display_name.ilike.%accounting%,short_desc.ilike.%tax%',
      countOr: 'display_name.ilike.%cpa%,display_name.ilike.%tax%,display_name.ilike.%accounting%',
    };
  }

  if (/(plumber|plumbing|leak|drain|pipe)/i.test(merged)) {
    return {
      key: 'plumber',
      entityRegex: /(plumber|plumbing|pipe|drain|leak)/i,
      fallbackOr: 'display_name.ilike.%plumb%,short_desc.ilike.%plumb%,ai_summary.ilike.%plumb%',
    };
  }

  if (/(electrician|electrical|wiring)/i.test(merged)) {
    return {
      key: 'electrician',
      entityRegex: /(electrician|electrical|wiring)/i,
      fallbackOr: 'display_name.ilike.%electric%,short_desc.ilike.%electric%',
    };
  }

  if (/(auto mechanic|car repair|auto shop|oil change|brake)/i.test(merged)) {
    return {
      key: 'mechanic',
      entityRegex: /(mechanic|auto|car repair|oil change|brake)/i,
      fallbackOr: 'display_name.ilike.%auto%,display_name.ilike.%mechanic%,display_name.ilike.%car%,short_desc.ilike.%auto%',
    };
  }

  return null;
}

export function extractEnglishServiceConstraints(query: string): string[] {
  const constraints: string[] = [];
  if (/spanish|español/i.test(query)) constraints.push('Spanish-speaking');
  if (/weekend|saturday|sunday/i.test(query)) constraints.push('weekend hours');
  if (/insurance|accept.*insurance/i.test(query)) constraints.push('accepts insurance');
  if (/emergency|urgent|asap/i.test(query)) constraints.push('emergency');
  if (/affordable|cheap|budget|low cost/i.test(query)) constraints.push('affordable');
  if (/evening|after hours|late/i.test(query)) constraints.push('evening hours');
  return constraints;
}
