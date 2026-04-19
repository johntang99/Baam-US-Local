/**
 * Property Tax Engine — shared between web (Chinese) and english apps.
 *
 * CANONICAL SOURCE: apps/web/src/lib/property-tax-engine.ts
 * Synced to:        apps/english/src/lib/property-tax-engine.ts
 *
 * Run `npm run sync:property-tax` from the monorepo root to sync.
 * Do NOT edit the copy in apps/english — changes will be overwritten.
 */

import { NextResponse } from 'next/server';

// ─── Locale Messages ────────────────────────────────────────────────────
export interface PropertyTaxMessages {
  notFound: string;
}

const MESSAGES: Record<string, PropertyTaxMessages> = {
  zh: {
    notFound: '未找到该地址的房产信息。请检查地址拼写或尝试选择具体的区域/郡。',
  },
  en: {
    notFound: 'No property found for this address. Please check the spelling or try selecting a specific borough/county.',
  },
};

export function getMessages(locale: string): PropertyTaxMessages {
  return MESSAGES[locale] || MESSAGES.en;
}

// ─── External Data Source URLs ──────────────────────────────────────────

// NYC: FY2023-2027 Tentative/Final Assessment Roll (updated Jan 2026)
const NYC_ASSESSMENT_URL = 'https://data.cityofnewyork.us/resource/8y4t-faws.json';
// NYC Fallback: older assessment data (2014-2019)
const NYC_ASSESSMENT_OLD_URL = 'https://data.cityofnewyork.us/resource/yjxr-fw8i.json';
const NYC_PLUTO_URL = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';
const NYC_ACRIS_URL = 'https://data.cityofnewyork.us/resource/7isb-wh4c.json';

// NYS: Statewide Property Assessment Roll (2025 data, covers all 62 counties)
const NYS_ASSESSMENT_URL = 'https://data.ny.gov/resource/7vem-aaz7.json';
// NYS: Tax Rates & Levy Data by Municipality (rates per $1,000)
const NYS_TAX_RATES_URL = 'https://data.ny.gov/resource/iq85-sdzs.json';

// NYS GIS Services (free, no API key needed)
const NYS_GEOCODER_URL = 'https://gisservices.its.ny.gov/arcgis/rest/services/Locators/Street_and_Address_Composite/GeocodeServer/findAddressCandidates';
const NYS_PARCEL_URL = 'https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1/query';

// ─── Geocoder ───────────────────────────────────────────────────────────

// Geocode address → coordinates → parcel PRINT_KEY
async function geocodeToParcel(address: string, city: string, state: string, zip: string): Promise<{
  printKey: string; swis: string; parcelAddr: string; municipality: string; county: string;
  assessedTotal: number; marketValue: number; landValue: number; propClass: string; schoolName: string;
} | null> {
  try {
    // Step 1: Geocode address to coordinates
    const geoParams = new URLSearchParams({
      Street: address, City: city, State: state, ZIP: zip,
      f: 'json', maxLocations: '1', outSR: '4326',
    });
    const geoRes = await fetch(`${NYS_GEOCODER_URL}?${geoParams}`);
    if (!geoRes.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geoData: any = await geoRes.json();
    const candidate = geoData.candidates?.[0];
    if (!candidate || candidate.score < 80) return null;

    const lon = candidate.location.x;
    const lat = candidate.location.y;

    // Step 2: Query parcel layer with coordinates
    const parcelParams = new URLSearchParams({
      geometry: `${lon},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'PARCEL_ADDR,PRINT_KEY,SWIS,MUNI_NAME,COUNTY_NAME,TOTAL_AV,FULL_MARKET_VAL,LAND_AV,PROP_CLASS,SCHOOL_NAME,LOC_ST_NBR,LOC_STREET',
      f: 'json',
      returnGeometry: 'false',
    });
    const parcelRes = await fetch(`${NYS_PARCEL_URL}?${parcelParams}`);
    if (!parcelRes.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parcelData: any = await parcelRes.json();
    const feature = parcelData.features?.[0];
    if (!feature) return null;

    const a = feature.attributes;
    return {
      printKey: a.PRINT_KEY || '',
      swis: a.SWIS || '',
      parcelAddr: a.PARCEL_ADDR || '',
      municipality: a.MUNI_NAME || '',
      county: a.COUNTY_NAME || '',
      assessedTotal: a.TOTAL_AV || 0,
      marketValue: a.FULL_MARKET_VAL || 0,
      landValue: a.LAND_AV || 0,
      propClass: a.PROP_CLASS || '',
      schoolName: a.SCHOOL_NAME || '',
    };
  } catch {
    return null;
  }
}

// ─── Constants ──────────────────────────────────────────────────────────

// NYS Counties with significant Chinese communities
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NYS_COUNTIES = [
  'Nassau', 'Suffolk', 'Westchester', 'Rockland', 'Orange',
  'Dutchess', 'Putnam', 'Albany', 'Erie', 'Monroe',
  'Onondaga', 'Saratoga', 'Schenectady', 'Tompkins', 'Ulster',
];

const NYC_BOROUGHS = ['manhattan', 'bronx', 'brooklyn', 'queens', 'staten island'];

// Normalize NYC street address: FIFTH → 5, THIRD → 3, etc.
function normalizeAddress(addr: string): string {
  const ordinals: Record<string, string> = {
    'FIRST': '1', 'SECOND': '2', 'THIRD': '3', 'FOURTH': '4', 'FIFTH': '5',
    'SIXTH': '6', 'SEVENTH': '7', 'EIGHTH': '8', 'NINTH': '9', 'TENTH': '10',
    '1ST': '1', '2ND': '2', '3RD': '3', '4TH': '4', '5TH': '5',
    '6TH': '6', '7TH': '7', '8TH': '8', '9TH': '9', '10TH': '10',
    '11TH': '11', '12TH': '12', '13TH': '13',
  };
  let normalized = addr.toUpperCase();
  for (const [word, num] of Object.entries(ordinals)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
  }
  // Expand county/state road abbreviations — NYS data uses "County Rte 22", "State Rte 17", etc.
  // CR-22, CR 22 → COUNTY RTE 22
  normalized = normalized.replace(/\bCR[-\s]?(\d+)\b/g, 'COUNTY RTE $1');
  // SR-17, SR 17 → STATE RTE 17
  normalized = normalized.replace(/\bSR[-\s]?(\d+)\b/g, 'STATE RTE $1');
  // US-6, US 6 → US RTE 6
  normalized = normalized.replace(/\bUS[-\s]?(\d+)\b/g, 'US RTE $1');
  // RT, RTE, ROUTE → RTE (normalize to match NYS data)
  normalized = normalized.replace(/\bROUTE\s+(\d)/g, 'RTE $1');
  normalized = normalized.replace(/\bRT\.?\s+(\d)/g, 'RTE $1');
  return normalized;
}

const BORO_MAP: Record<string, string> = {
  'manhattan': '1', 'bronx': '2', 'brooklyn': '3', 'queens': '4', 'staten island': '5',
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
};

const BORO_NAMES: Record<string, string> = {
  '1': 'Manhattan', '2': 'Bronx', '3': 'Brooklyn', '4': 'Queens', '5': 'Staten Island',
};

// NYC property tax rates FY2025/26
const TAX_RATES: Record<string, number> = {
  '1': 0.20309, '2': 0.12267, '2A': 0.12267, '2B': 0.12267, '2C': 0.12267,
  '3': 0.12826, '4': 0.10646,
};

// ─── Rate Limiter ───────────────────────────────────────────────────────

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

// ─── Main Handler ───────────────────────────────────────────────────────

export async function handlePropertyTaxRequest(request: Request, locale: string) {
  const msg = getMessages(locale);
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim().toUpperCase();
  const region = searchParams.get('region')?.trim().toLowerCase() || searchParams.get('boro')?.trim().toLowerCase();
  const bbl = searchParams.get('bbl')?.trim();

  // If address has city/state/zip but no region selected, use geocoder to auto-detect
  if (!bbl && address && !region) {
    return handleFullAddressLookup(address, request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown', msg);
  }

  if (!bbl && (!address || !region)) {
    return NextResponse.json({ error: 'address+region or bbl required' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
  if (appToken) headers['X-App-Token'] = appToken;

  // Determine if this is an NYC or NYS query
  const isNYSParcel = bbl && /[.\-]/.test(bbl);
  const isNYC = !isNYSParcel && (bbl || (region && NYC_BOROUGHS.includes(region)));

  // ─── NYS Detail by parcel ID ───
  if (isNYSParcel && bbl) {
    const county = searchParams.get('county')?.trim() || '';
    const municipality = searchParams.get('municipality')?.trim() || '';
    return handleNYSDetail(bbl, county, municipality, headers);
  }

  // ─── NYS Statewide Search (non-NYC) ───
  if (!isNYC && !bbl) {
    return handleNYSQuery(address!, region!, headers);
  }

  try {
    // ─── Lookup by BBL (detail page) ───
    if (bbl) {
      const boroCode = bbl.charAt(0);
      const block = bbl.substring(1, 6);
      const lot = bbl.substring(6, 10);

      const [assessRes, plutoRes] = await Promise.all([
        fetch(`${NYC_ASSESSMENT_URL}?boro=${boroCode}&block=${parseInt(block)}&lot=${parseInt(lot)}&$order=year DESC&$limit=5`, { headers }),
        fetch(`${NYC_PLUTO_URL}?bbl=${bbl}&$limit=1`, { headers }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let assessments: any[] = assessRes.ok ? await assessRes.json() : [];

      if (assessments.length === 0) {
        const oldRes = await fetch(
          `${NYC_ASSESSMENT_OLD_URL}?boro=${boroCode}&block=${parseInt(block)}&lot=${parseInt(lot)}&$order=year DESC&$limit=5`,
          { headers }
        );
        if (oldRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oldData: any[] = await oldRes.json();
          assessments = oldData.map(a => ({
            ...a,
            curmkttot: a.fullval, curacttot: a.avtot, curactland: a.avland,
            curtaxclass: a.taxclass, curextot: a.extot, excd1: a.excd1,
            housenum_lo: '', street_name: a.staddr, zip_code: '', bldg_class: a.bldgcl,
            bld_story: a.stories, units: '', land_area: '', yrbuilt: '',
          }));
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plutoData: any[] = plutoRes.ok ? await plutoRes.json() : [];
      const pluto = plutoData[0] || null;
      const latest = assessments[0];

      if (!latest) {
        return NextResponse.json({ property: null });
      }

      const taxClass = latest.curtaxclass || latest.taxclass || '1';
      const assessedTotal = parseFloat(latest.curacttot || latest.avtot || '0');
      const assessedLand = parseFloat(latest.curactland || latest.avland || '0');
      const marketValue = parseFloat(latest.curmkttot || latest.fullval || '0');
      const exemptTotal = parseFloat(latest.curactextot || latest.extot || '0');
      const rate = TAX_RATES[taxClass] || TAX_RATES['1'];
      const estimatedTax = Math.round(assessedTotal * rate);

      const lo = latest.housenum_lo || '';
      const hi = latest.housenum_hi || '';
      const houseNumStr = lo && hi && lo !== hi ? `${lo}-${hi}` : lo || hi || '';
      const addressStr = latest.staddr || (houseNumStr
        ? `${houseNumStr} ${latest.street_name || ''}`
        : latest.street_name || '');

      const property = {
        bbl,
        address: addressStr.trim(),
        boro: BORO_NAMES[boroCode] || '',
        boroCode,
        block: latest.block,
        lot: latest.lot,
        owner: latest.owner || '',
        taxClass,
        buildingClass: latest.bldg_class || latest.bldgcl || '',
        stories: latest.bld_story || latest.stories || '',
        assessedLand,
        assessedTotal,
        marketValue,
        exemptTotal,
        exemptCode: latest.excd1 || '',
        estimatedTax,
        taxRate: rate,
        year: latest.year ? `FY${latest.year}` : (latest.year || ''),
        zipCode: latest.zip_code || '',
        yearBuilt: latest.yrbuilt || pluto?.yearbuilt || null,
        numFloors: latest.bld_story ? Math.round(parseFloat(latest.bld_story)) : (pluto?.numfloors ? Math.round(parseFloat(pluto.numfloors)) : null),
        unitsRes: pluto?.unitsres || null,
        unitsTotal: latest.units || pluto?.unitstotal || null,
        lotArea: latest.land_area ? parseFloat(latest.land_area) : (pluto?.lotarea ? parseFloat(pluto.lotarea) : null),
        buildingArea: pluto?.bldgarea ? parseFloat(pluto.bldgarea) : null,
        zoning: latest.zoning || pluto?.zonedist1 || null,
        landUse: pluto?.landuse || null,
        ownerName: pluto?.ownername || latest.owner || '',
      };

      const historyMap = new Map<string, { year: string; assessedTotal: number; marketValue: number; taxClass: string }>();
      for (const a of assessments) {
        const yr = a.year ? `FY${a.year}` : a.year;
        if (!historyMap.has(yr)) {
          historyMap.set(yr, {
            year: yr,
            assessedTotal: parseFloat(a.curacttot || a.avtot || '0'),
            marketValue: parseFloat(a.curmkttot || a.fullval || '0'),
            taxClass: a.curtaxclass || a.taxclass,
          });
        }
      }
      const history = Array.from(historyMap.values());

      let sales: { date: string; price: number; type: string }[] = [];
      try {
        const acrisRes = await fetch(
          `${NYC_ACRIS_URL}?$where=borough='${boroCode}' AND block='${parseInt(block)}' AND lot='${parseInt(lot)}' AND doc_type='DEED'&$order=doc_date DESC&$limit=5`,
          { headers }
        );
        if (acrisRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const acrisData: any[] = await acrisRes.json();
          sales = acrisData
            .filter((a) => a.doc_amount && parseFloat(a.doc_amount) > 0)
            .map((a) => ({
              date: a.doc_date || '',
              price: parseFloat(a.doc_amount || '0'),
              type: a.doc_type || 'DEED',
            }));
        }
      } catch { /* ACRIS is optional */ }

      const response = NextResponse.json({ property, history, sales });
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
      return response;
    }

    // ─── Search by address ───
    const boroCode = BORO_MAP[region!] || '4';
    const normalizedAddr = normalizeAddress(address!);
    const addrMatch = normalizedAddr.match(/^(\d[\d-]*)\s+(.+)$/);
    const houseNumFull = addrMatch ? addrMatch[1] : '';
    const streetName = addrMatch ? addrMatch[2] : normalizedAddr;
    const cleanStreet = streetName.replace(/,.*$/, '').trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let raw: any[] = [];

    const tryNewDataset = async (hn: string, st: string) => {
      const p = new URLSearchParams({ housenum_lo: hn, street_name: st, boro: boroCode, $order: 'year DESC', $limit: '20' });
      const r = await fetch(`${NYC_ASSESSMENT_URL}?${p}`, { headers });
      return r.ok ? await r.json() : [];
    };

    raw = await tryNewDataset(houseNumFull, cleanStreet);
    if (raw.length === 0 && houseNumFull.includes('-')) {
      raw = await tryNewDataset(houseNumFull.split('-')[0], cleanStreet);
    }

    if (raw.length === 0) {
      const staddr = `${houseNumFull} ${cleanStreet}`;
      const oldRes = await fetch(
        `${NYC_ASSESSMENT_OLD_URL}?staddr=${encodeURIComponent(staddr)}&boro=${boroCode}&$order=year DESC&$limit=20`,
        { headers }
      );
      if (oldRes.ok) {
        const oldRaw = await oldRes.json();
        raw = oldRaw.map((r: Record<string, string>) => ({
          ...r,
          curmkttot: r.fullval, curacttot: r.avtot, curtaxclass: r.taxclass,
          bldg_class: r.bldgcl, bld_story: r.stories,
          housenum_lo: '', street_name: r.staddr,
        }));
      }
    }

    const byBBL = new Map<string, Record<string, string>>();
    for (const r of raw) {
      const bblKey = `${r.boro}${String(r.block).padStart(5, '0')}${String(r.lot).padStart(4, '0')}`;
      if (!byBBL.has(bblKey)) {
        const rlo = r.housenum_lo || '';
        const rhi = r.housenum_hi || '';
        const rhn = rlo && rhi && rlo !== rhi ? `${rlo}-${rhi}` : rlo || rhi || '';
        const addr = r.staddr || (rhn ? `${rhn} ${r.street_name || ''}` : r.street_name || '');
        byBBL.set(bblKey, { ...r, bbl: bblKey, _address: addr.trim() });
      }
    }

    const properties = Array.from(byBBL.values()).map((r) => {
      const tc = r.curtaxclass || r.taxclass || '1';
      const assessed = parseFloat(r.curacttot || r.avtot || '0');
      return {
        bbl: r.bbl,
        address: r._address || r.staddr || '',
        boro: BORO_NAMES[r.boro] || '',
        owner: r.owner || '',
        taxClass: tc,
        buildingClass: r.bldg_class || r.bldgcl || '',
        stories: r.bld_story || r.stories || '',
        assessedTotal: assessed,
        marketValue: parseFloat(r.curmkttot || r.fullval || '0'),
        estimatedTax: Math.round(assessed * (TAX_RATES[tc] || TAX_RATES['1'])),
        year: r.year ? `FY${r.year}` : (r.year || ''),
      };
    });

    const response = NextResponse.json({ properties, total: properties.length });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── NYS Statewide Property Search ─────────────────────────────────────

// Build NYS property results from assessment roll records
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildNYSProperties(raw: any[]) {
  // Deduplicate by print_key_code (NYS parcel ID), keep latest year
  const byParcel = new Map<string, Record<string, string>>();
  for (const r of raw) {
    const key = r.print_key_code || `${r.parcel_address_number}-${r.parcel_address_street}`;
    if (!byParcel.has(key)) {
      byParcel.set(key, r);
    }
  }

  return Array.from(byParcel.values()).map((r) => {
    const addr = [r.parcel_address_number, r.parcel_address_street, r.parcel_address_suff].filter(Boolean).join(' ');
    const assessed = parseFloat(r.assessment_total || '0');
    const market = parseFloat(r.full_market_value || '0');
    const ownerName = [r.primary_owner_first_name, r.primary_owner_last_name].filter(Boolean).join(' ');

    return {
      bbl: r.print_key_code || '',
      address: addr.trim(),
      boro: `${r.municipality_name || ''}, ${r.county_name || ''} County`,
      owner: ownerName,
      taxClass: r.property_class_description || r.property_class || '',
      buildingClass: r.property_class || '',
      stories: '',
      assessedTotal: assessed,
      marketValue: market,
      estimatedTax: 0,
      year: r.roll_year || '',
      municipality: r.municipality_name || '',
      county: r.county_name || '',
      schoolDistrict: r.school_district_name || '',
      countyTaxable: parseFloat(r.county_taxable_value || '0'),
      schoolTaxable: parseFloat(r.school_taxable || '0'),
      source: 'nys',
    };
  });
}

async function handleNYSQuery(address: string, county: string, fetchHeaders: Record<string, string>) {
  const normalizedAddr = normalizeAddress(address);
  const addrMatch = normalizedAddr.match(/^(\d[\d-]*)\s+(.+)$/);
  const houseNum = addrMatch ? addrMatch[1] : '';
  const streetRaw = addrMatch ? addrMatch[2] : normalizedAddr;

  // Extract municipality if user typed "90 North St, Middletown"
  let municipality = '';
  const commaParts = streetRaw.split(',').map((s: string) => s.trim());
  if (commaParts.length >= 2) {
    const cityPart = commaParts[1];
    if (cityPart.length > 2 && !/^\d{5}/.test(cityPart) && !/^[A-Z]{2}$/.test(cityPart)) {
      municipality = cityPart.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }
  const streetName = commaParts[0].trim();
  const countyName = county.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  // Extract zip code if present (e.g., "SHORE BLVD, SLATE HILL, NY 10973, USA")
  let zip = '';
  for (const part of commaParts) {
    const zipMatch = part.match(/\b(\d{5})\b/);
    if (zipMatch) { zip = zipMatch[1]; break; }
  }

  try {
    // ── Strategy 1: Geocoder-first (handles all address formats) ──
    // The NYS GIS geocoder understands CR-22, County Rte, Route, Rt., hamlet names,
    // misspellings, etc. Use it as the primary lookup, then get assessment data by
    // the geocoder's PRINT_KEY + municipality (which is always correct).
    const fullAddress = `${houseNum} ${streetName}`;
    const parcel = await geocodeToParcel(fullAddress, municipality || '', 'NY', zip);

    if (parcel?.printKey) {
      // Validate house number matches to prevent wrong-location geocoding
      const parcelAddrUpper = (parcel.parcelAddr || '').toUpperCase();
      const parcelHasHouseNum = parcelAddrUpper.startsWith(houseNum);

      if (parcelHasHouseNum) {
        // Query assessment roll by print_key + municipality (unique combination)
        const pkParams = new URLSearchParams({
          print_key_code: parcel.printKey,
          county_name: parcel.county || countyName,
          municipality_name: parcel.municipality,
          $order: 'roll_year DESC',
          $limit: '5',
        });
        const pkRes = await fetch(`${NYS_ASSESSMENT_URL}?${pkParams}`, { headers: fetchHeaders });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pkRaw: any[] = pkRes.ok ? await pkRes.json() : [];

        if (pkRaw.length > 0) {
          const properties = buildNYSProperties(pkRaw);
          // If the user's input differs from the official address, include a suggestion
          const officialAddr = properties[0]?.address || '';
          const inputStreetUpper = streetName.toUpperCase();
          const officialUpper = officialAddr.toUpperCase().replace(/^\d+\s*/, ''); // strip house num
          const suggestion = (officialUpper && !inputStreetUpper.includes(officialUpper.split(' ')[0]))
            ? officialAddr : undefined;

          const response = NextResponse.json({
            properties, total: properties.length, source: 'nys',
            ...(suggestion ? { suggestion: `${houseNum} ${officialUpper}, ${parcel.municipality}` } : {}),
          });
          response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
          return response;
        }
      }
    }

    // ── Strategy 2: Text-based search (fallback when geocoder fails/unavailable) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let raw: any[] = [];

    // Split street into name + suffix for NYS dataset matching
    const streetParts = streetName.split(/\s+/);
    const suffixes: Record<string, string> = {
      'STREET': 'St', 'ST': 'St', 'AVENUE': 'Ave', 'AVE': 'Ave',
      'BOULEVARD': 'Blvd', 'BLVD': 'Blvd', 'ROAD': 'Rd', 'RD': 'Rd',
      'DRIVE': 'Dr', 'DR': 'Dr', 'LANE': 'La', 'LA': 'La', 'LN': 'La',
      'PLACE': 'Pl', 'PL': 'Pl', 'COURT': 'Ct', 'CT': 'Ct',
      'TERRACE': 'Ter', 'TER': 'Ter', 'CIRCLE': 'Cir', 'WAY': 'Way',
    };

    let searchStreet = streetParts.join(' ');
    let searchSuff = '';
    if (streetParts.length >= 2) {
      const lastWord = streetParts[streetParts.length - 1];
      if (suffixes[lastWord]) {
        searchSuff = suffixes[lastWord];
        searchStreet = streetParts.slice(0, -1).join(' ');
      }
    }

    const streetUpper = searchStreet.toUpperCase();

    // Try exact street match (with and without municipality)
    const muniFilter = municipality ? ` AND municipality_name='${municipality}'` : '';
    const whereClause = searchSuff
      ? `county_name='${countyName}' AND parcel_address_number='${houseNum}' AND (upper(parcel_address_street)='${streetUpper}' OR upper(parcel_address_street)='${streetUpper} ${searchSuff.toUpperCase()}')${muniFilter}`
      : `county_name='${countyName}' AND parcel_address_number='${houseNum}' AND upper(parcel_address_street) like '${streetUpper}%'${muniFilter}`;

    const params = new URLSearchParams({ $where: whereClause, $order: 'roll_year DESC', $limit: '20' });
    const res = await fetch(`${NYS_ASSESSMENT_URL}?${params}`, { headers: fetchHeaders });
    raw = res.ok ? await res.json() : [];

    // Retry without municipality filter (hamlet names differ from municipality names)
    if (raw.length === 0 && municipality) {
      const retryWhere = searchSuff
        ? `county_name='${countyName}' AND parcel_address_number='${houseNum}' AND (upper(parcel_address_street)='${streetUpper}' OR upper(parcel_address_street)='${streetUpper} ${searchSuff.toUpperCase()}')`
        : `county_name='${countyName}' AND parcel_address_number='${houseNum}' AND upper(parcel_address_street) like '${streetUpper}%'`;
      const retryParams = new URLSearchParams({ $where: retryWhere, $order: 'roll_year DESC', $limit: '20' });
      const res2 = await fetch(`${NYS_ASSESSMENT_URL}?${retryParams}`, { headers: fetchHeaders });
      raw = res2.ok ? await res2.json() : [];
    }

    if (raw.length > 0) {
      const properties = buildNYSProperties(raw);
      const response = NextResponse.json({ properties, total: properties.length, source: 'nys' });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    // ── Nothing found — return suggestion from geocoder if available ──
    if (parcel?.parcelAddr) {
      const response = NextResponse.json({
        properties: [], total: 0, source: 'nys',
        suggestion: `${parcel.parcelAddr}, ${parcel.municipality}`,
      });
      return response;
    }

    const response = NextResponse.json({ properties: [], total: 0, source: 'nys' });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── NYS Detail by Parcel ID ────────────────────────────────────────────

async function fetchNYSTaxRates(swisCode: string, fetchHeaders: Record<string, string>) {
  try {
    const res = await fetch(
      `${NYS_TAX_RATES_URL}?swis_code=${swisCode}&$order=fiscal_year_ending DESC&$limit=1`,
      { headers: fetchHeaders }
    );
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();
    if (data.length === 0) return null;
    const r = data[0];
    return {
      fiscalYear: r.fiscal_year_ending || '',
      rollYear: r.roll_year || '',
      valueType: r.type_of_value_on_whichtax_rates_are_applied || '',
      countyRate: parseFloat(r.county_tax_rate_outside_village_per_1000_assessed_value || '0'),
      countyRateVillage: parseFloat(r.county_tax_rate_inside_village_per_1000_assessed_value || '0'),
      municipalRate: parseFloat(r.municipal_tax_rate_outside_village_per_1000_assessed_value || '0'),
      municipalRateVillage: parseFloat(r.municipal_tax_rate_inside_village_per_1000_assessed_value || '0'),
      schoolRate: parseFloat(r.school_district_tax_rate_per_1000_assessed_value || '0'),
      countyLevy: parseFloat(r.county_tax_levy || '0'),
      municipalLevy: parseFloat(r.municipality_tax_levy || '0'),
      schoolLevy: parseFloat(r.school_district_tax_levy || '0'),
    };
  } catch {
    return null;
  }
}

async function handleNYSDetail(parcelId: string, county: string, municipality: string, fetchHeaders: Record<string, string>) {
  try {
    const params = new URLSearchParams({
      print_key_code: parcelId,
      $order: 'roll_year DESC',
      $limit: '10',
    });
    if (county) params.set('county_name', county);
    if (municipality) params.set('municipality_name', municipality);

    const res = await fetch(`${NYS_ASSESSMENT_URL}?${params}`, { headers: fetchHeaders });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = res.ok ? await res.json() : [];

    if (raw.length === 0) {
      return NextResponse.json({ property: null, source: 'nys' });
    }

    const latest = raw[0];
    const addr = [latest.parcel_address_number, latest.parcel_address_street, latest.parcel_address_suff].filter(Boolean).join(' ');
    const ownerParts = [
      latest.primary_owner_first_name, latest.primary_owner_mi, latest.primary_owner_last_name
    ].filter(Boolean);
    const ownerName = ownerParts.join(' ') || '';

    const exemptions: { code: string; countyAmt: number; schoolAmt: number }[] = [];
    for (let i = 1; i <= 10; i++) {
      const code = latest[`exemption_code_${i}`];
      if (code) {
        exemptions.push({
          code,
          countyAmt: parseFloat(latest[`exemption_amount_county_${i}`] || '0'),
          schoolAmt: parseFloat(latest[`exemption_amount_school_${i}`] || '0'),
        });
      }
    }

    const swisCode = latest.swis_code || '';
    const taxRates = swisCode ? await fetchNYSTaxRates(swisCode, fetchHeaders) : null;

    const assessedTotal = parseFloat(latest.assessment_total || '0');
    const marketValue = parseFloat(latest.full_market_value || '0');
    const countyTaxable = parseFloat(latest.county_taxable_value || '0');
    const schoolTaxable = parseFloat(latest.school_taxable || '0');
    const townTaxable = parseFloat(latest.town_taxable_value || '0');

    let countyTax = 0, municipalTax = 0, schoolTax = 0;
    if (taxRates) {
      const isFullValue = taxRates.valueType?.toLowerCase().includes('full');
      const taxBase = isFullValue ? marketValue : assessedTotal;
      countyTax = Math.round(taxBase * taxRates.countyRate / 1000);
      municipalTax = Math.round(taxBase * taxRates.municipalRate / 1000);
      schoolTax = Math.round(taxBase * taxRates.schoolRate / 1000);
    }
    const totalEstimatedTax = countyTax + municipalTax + schoolTax;

    const equalizationRate = marketValue > 0 ? (assessedTotal / marketValue * 100) : 0;

    const property = {
      parcelId,
      address: addr.trim(),
      municipality: latest.municipality_name || '',
      county: latest.county_name || '',
      schoolDistrict: latest.school_district_name || '',
      owner: ownerName,
      mailingAddress: [
        latest.mailing_address_number, latest.mailing_address_street, latest.mailing_address_suff
      ].filter(Boolean).join(' '),
      mailingCity: latest.mailing_address_city || '',
      mailingState: latest.mailing_address_state || '',
      mailingZip: latest.mailing_address_zip || '',
      propertyClass: latest.property_class || '',
      propertyClassDesc: latest.property_class_description || '',
      taxClass: latest.tax_class || '',
      rollYear: latest.roll_year || '',
      assessedLand: parseFloat(latest.assessment_land || '0'),
      assessedTotal,
      marketValue,
      equalizationRate: Math.round(equalizationRate * 10) / 10,
      countyTaxable,
      townTaxable,
      schoolTaxable,
      countyTax,
      municipalTax,
      schoolTax,
      estimatedTotalTax: totalEstimatedTax,
      taxRateInfo: taxRates ? {
        fiscalYear: taxRates.fiscalYear,
        valueType: taxRates.valueType,
        countyRate: taxRates.countyRate,
        municipalRate: taxRates.municipalRate,
        schoolRate: taxRates.schoolRate,
      } : null,
      frontage: latest.front || '',
      depth: latest.depth || '',
      exemptions,
      source: 'nys' as const,
    };

    const historyMap = new Map<string, { year: string; assessedTotal: number; marketValue: number }>();
    for (const r of raw) {
      const yr = r.roll_year || '';
      if (!historyMap.has(yr)) {
        historyMap.set(yr, {
          year: yr,
          assessedTotal: parseFloat(r.assessment_total || '0'),
          marketValue: parseFloat(r.full_market_value || '0'),
        });
      }
    }
    const history = Array.from(historyMap.values());

    const response = NextResponse.json({ property, history, sales: [], source: 'nys' });
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Full Address Lookup (no county required) ───────────────────────────

async function handleFullAddressLookup(address: string, ip: string, msg: PropertyTaxMessages) {
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const fetchHeaders: Record<string, string> = { Accept: 'application/json' };
  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
  if (appToken) fetchHeaders['X-App-Token'] = appToken;

  try {
    const parts = address.split(',').map((s: string) => s.trim());
    const streetAddress = parts[0] || '';
    const city = parts[1] || '';
    const stateZipPart = parts[2] || '';
    const stateMatch = stateZipPart.match(/([A-Z]{2})/);
    const zipMatch = stateZipPart.match(/(\d{5})/);
    const state = stateMatch ? stateMatch[1] : 'NY';
    const zip = zipMatch ? zipMatch[1] : '';

    // Check if this is an NYC address
    const nycNeighborhoodMap: Record<string, string> = {
      'MANHATTAN': 'manhattan', 'NEW YORK': 'manhattan', 'CHINATOWN': 'manhattan',
      'BROOKLYN': 'brooklyn', 'SUNSET PARK': 'brooklyn', 'BENSONHURST': 'brooklyn',
      'QUEENS': 'queens', 'FLUSHING': 'queens', 'ASTORIA': 'queens', 'JAMAICA': 'queens',
      'BAYSIDE': 'queens', 'ELMHURST': 'queens', 'FOREST HILLS': 'queens', 'CORONA': 'queens',
      'BRONX': 'bronx',
      'STATEN ISLAND': 'staten island',
    };
    const cityUpper = city.toUpperCase();
    let nycBoro: string | null = null;
    for (const [key, val] of Object.entries(nycNeighborhoodMap)) {
      if (cityUpper.includes(key)) { nycBoro = val; break; }
    }
    if (!nycBoro && zip) {
      const zipNum = parseInt(zip);
      if (zipNum >= 10001 && zipNum <= 10282) nycBoro = 'manhattan';
      else if (zipNum >= 10301 && zipNum <= 10314) nycBoro = 'staten island';
      else if (zipNum >= 10451 && zipNum <= 10475) nycBoro = 'bronx';
      else if (zipNum >= 11201 && zipNum <= 11256) nycBoro = 'brooklyn';
      else if (zipNum >= 11101 && zipNum <= 11697) nycBoro = 'queens';
    }

    if (nycBoro) {
      const boroCode = BORO_MAP[nycBoro] || '4';
      const normalizedAddr = normalizeAddress(streetAddress);
      const addrMatch = normalizedAddr.match(/^(\d[\d-]*)\s+(.+)$/);
      const houseNumFull = addrMatch ? addrMatch[1] : '';
      const cleanStreet = (addrMatch ? addrMatch[2] : normalizedAddr).replace(/,.*$/, '').trim();

      const tryNYC = async (hn: string, st: string) => {
        const p = new URLSearchParams({ housenum_lo: hn, street_name: st, boro: boroCode, $order: 'year DESC', $limit: '20' });
        const r = await fetch(`${NYC_ASSESSMENT_URL}?${p}`, { headers: fetchHeaders });
        return r.ok ? await r.json() : [];
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let raw: any[] = await tryNYC(houseNumFull, cleanStreet);
      if (raw.length === 0 && houseNumFull.includes('-')) {
        raw = await tryNYC(houseNumFull.split('-')[0], cleanStreet);
      }

      if (raw.length > 0) {
        const r = raw[0];
        const tc = r.curtaxclass || r.taxclass || '1';
        const assessed = parseFloat(r.curacttot || r.avtot || '0');
        const lo = r.housenum_lo || '';
        const hi = r.housenum_hi || '';
        const hn = lo && hi && lo !== hi ? `${lo}-${hi}` : lo || hi || '';
        const addrStr = r.staddr || (hn ? `${hn} ${r.street_name || ''}` : r.street_name || '');

        const properties = [{
          bbl: `${r.boro}${String(r.block).padStart(5, '0')}${String(r.lot).padStart(4, '0')}`,
          address: addrStr.trim(),
          boro: BORO_NAMES[r.boro] || '',
          owner: r.owner || '',
          taxClass: tc,
          buildingClass: r.bldg_class || r.bldgcl || '',
          stories: r.bld_story || r.stories || '',
          assessedTotal: assessed,
          marketValue: parseFloat(r.curmkttot || r.fullval || '0'),
          estimatedTax: Math.round(assessed * (TAX_RATES[tc] || TAX_RATES['1'])),
          year: r.year ? `FY${r.year}` : (r.year || ''),
        }];
        return NextResponse.json({ properties, total: 1 });
      }
    }

    // Use NYS GIS Geocoder for all addresses (NYC and NYS)
    const parcel = await geocodeToParcel(streetAddress, city, state, zip);

    if (!parcel) {
      return NextResponse.json({ properties: [], total: 0, message: msg.notFound });
    }

    // Validate that the geocoded parcel matches the searched address
    const normalizedSearch = normalizeAddress(streetAddress);
    const searchMatch = normalizedSearch.match(/^(\d[\d-]*)\s+(.+)$/);
    if (searchMatch) {
      const searchNum = searchMatch[1];
      const searchFirstWord = searchMatch[2].split(/\s+/)[0]?.toUpperCase() || '';
      const parcelAddrUpper = (parcel.parcelAddr || '').toUpperCase();
      const parcelMatchesNum = parcelAddrUpper.startsWith(searchNum) || parcelAddrUpper.includes(` ${searchNum} `);
      const parcelMatchesStreet = searchFirstWord && parcelAddrUpper.includes(searchFirstWord);
      if (!parcelMatchesNum || !parcelMatchesStreet) {
        return NextResponse.json({ properties: [], total: 0, message: msg.notFound });
      }
    }

    const printKey = parcel.printKey;
    const county = parcel.county;

    const nysParams = new URLSearchParams({
      print_key_code: printKey,
      county_name: county,
      $order: 'roll_year DESC',
      $limit: '5',
    });
    const nysRes = await fetch(`${NYS_ASSESSMENT_URL}?${nysParams}`, { headers: fetchHeaders });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nysData: any[] = nysRes.ok ? await nysRes.json() : [];

    if (nysData.length > 0) {
      const r = nysData[0];
      const addr = [r.parcel_address_number, r.parcel_address_street, r.parcel_address_suff].filter(Boolean).join(' ');
      const assessed = parseFloat(r.assessment_total || '0');
      const market = parseFloat(r.full_market_value || '0');
      const ownerName = [r.primary_owner_first_name, r.primary_owner_last_name].filter(Boolean).join(' ');

      const properties = [{
        bbl: printKey,
        address: addr.trim() || parcel.parcelAddr,
        boro: `${parcel.municipality}, ${county} County`,
        owner: ownerName,
        taxClass: r.property_class_description || r.property_class || '',
        buildingClass: r.property_class || '',
        stories: '',
        assessedTotal: assessed,
        marketValue: market,
        estimatedTax: 0,
        year: r.roll_year || '',
        municipality: parcel.municipality,
        county: county,
        source: 'nys',
      }];

      return NextResponse.json({ properties, total: 1, source: 'nys' });
    }

    // Fallback: return GIS parcel data directly
    const properties = [{
      bbl: printKey,
      address: parcel.parcelAddr,
      boro: `${parcel.municipality}, ${county} County`,
      owner: '',
      taxClass: parcel.propClass,
      buildingClass: parcel.propClass,
      stories: '',
      assessedTotal: parcel.assessedTotal,
      marketValue: parcel.marketValue,
      estimatedTax: 0,
      year: '',
      municipality: parcel.municipality,
      county: county,
      source: 'nys',
    }];

    return NextResponse.json({ properties, total: 1, source: 'nys' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
