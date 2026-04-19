import { Link } from '@/lib/i18n/routing';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ locale: string; bbl: string }>;
  searchParams: Promise<{ county?: string; municipality?: string }>;
}

const BORO_NAMES: Record<string, string> = {
  '1': 'Manhattan', '2': 'Bronx', '3': 'Brooklyn', '4': 'Queens', '5': 'Staten Island',
};

const TAX_CLASS_LABELS: Record<string, string> = {
  '1': '1-3 Family Home', '2': 'Apartment Building', '2A': 'Small Apartment', '2B': 'Medium Apartment',
  '3': 'Utility', '4': 'Commercial',
};

const BUILDING_CLASS_LABELS: Record<string, string> = {
  'A': 'Single Family', 'B': 'Two Family', 'C': 'Co-op', 'D': 'Apartment Building',
  'E': 'Warehouse', 'F': 'Factory', 'G': 'Garage', 'H': 'Hotel',
  'K': 'Store', 'L': 'Loft', 'O': 'Office Building', 'R': 'Condo/Residential',
  'S': 'Mixed Use', 'W': 'Educational Facility',
};

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString('en-US');
}

async function fetchProperty(bbl: string, county?: string, municipality?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:6001';
  const params = new URLSearchParams({ bbl });
  if (county) params.set('county', county);
  if (municipality) params.set('municipality', municipality);
  const res = await fetch(`${baseUrl}/api/services/property-tax?${params}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { bbl } = await params;
  const { county, municipality } = await searchParams;
  const data = await fetchProperty(bbl, county, municipality);
  if (!data?.property) return { title: 'Not Found' };

  const p = data.property;
  const isNYS = data.source === 'nys';
  const location = isNYS ? `${p.municipality}, ${p.county} County` : p.boro;
  const taxInfo = p.estimatedTax ? `Est. annual tax ${formatMoney(p.estimatedTax)}` : `Market value ${formatMoney(p.marketValue)}`;
  return {
    title: `${p.address} Property Tax | ${location} · Baam`,
    description: `${p.address} (${location}) property info: assessed value ${formatMoney(p.assessedTotal)}, ${taxInfo}.`,
    openGraph: {
      title: `${p.address} — Property Tax Lookup`,
      description: `${location} · ${taxInfo}`,
      locale: 'en_US',
    },
  };
}

export default async function PropertyDetailPage({ params, searchParams }: Props) {
  const { bbl } = await params;
  const { county, municipality } = await searchParams;
  const data = await fetchProperty(bbl, county, municipality);
  if (!data?.property) notFound();

  const p = data.property;
  const isNYS = data.source === 'nys';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history: any[] = data.history || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sales: any[] = data.sales || [];

  const assessmentRatio = p.marketValue > 0 ? ((p.assessedTotal / p.marketValue) * 100).toFixed(1) : '0';
  const monthlyTax = p.estimatedTax ? Math.round(p.estimatedTax / 12) : 0;
  const bldgClassLabel = isNYS ? (p.propertyClassDesc || p.propertyClass || '') : (BUILDING_CLASS_LABELS[p.buildingClass?.[0]] || p.buildingClass);
  const location = isNYS ? `${p.municipality}, ${p.county} County, NY` : `${p.boro}, NY ${p.zipCode || ''}`;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">Tools</Link>
        <span className="mx-2">/</span>
        <Link href="/services/property-tax" className="hover:text-primary">Property Tax</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">{p.address}</span>
      </nav>

      {/* Property Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{p.address}</h1>
            <p className="text-sm text-gray-500 mb-2">{location}</p>
            <p className="text-xs text-gray-400">Owner: {p.ownerName || p.owner}</p>
            {isNYS && p.schoolDistrict && (
              <p className="text-xs text-gray-400">School District: {p.schoolDistrict}</p>
            )}
          </div>
          <span className="text-[10px] font-semibold px-3 py-1.5 rounded-full flex-shrink-0 self-start bg-purple-100 text-purple-700 max-w-[180px] text-right">
            {isNYS
              ? (p.propertyClassDesc || `Class ${p.propertyClass}`)
              : `Class ${p.taxClass} — ${TAX_CLASS_LABELS[p.taxClass] || p.taxClass}`
            }
          </span>
        </div>

        {/* Property Details */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
          {bldgClassLabel && <span>🏢 {bldgClassLabel}</span>}
          {p.yearBuilt && <span>Built {p.yearBuilt}</span>}
          {p.numFloors && <span>{p.numFloors} floors</span>}
          {p.unitsTotal && <span>{p.unitsTotal} units</span>}
          {p.lotArea && <span>Lot {p.lotArea.toLocaleString()} sqft</span>}
          {p.zoning && <span>{p.zoning}</span>}
          {p.frontage && <span>Frontage {p.frontage}ft</span>}
          {p.depth && <span>Depth {p.depth}ft</span>}
        </div>
      </div>

      {/* Assessment & Tax Cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Assessment */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-base">📊</span> Assessment
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Land Assessment</span>
              <span className="text-sm font-semibold text-gray-900">{formatMoney(p.assessedLand)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Assessed Value</span>
              <span className="text-sm font-bold text-gray-900">{formatMoney(p.assessedTotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Market Value</span>
              <span className="text-sm font-bold text-blue-600">{formatMoney(p.marketValue)}</span>
            </div>
            {p.exemptTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Exemption Amount</span>
                <span className="text-sm font-semibold text-green-600">-{formatMoney(p.exemptTotal)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>{isNYS ? 'Equalization Rate' : 'Assessment/Market Ratio'}</span>
                <span>{p.equalizationRate || assessmentRatio}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(parseFloat(p.equalizationRate || assessmentRatio), 100)}%` }} />
              </div>
              {isNYS && parseFloat(assessmentRatio) < 50 && (
                <p className="text-[10px] text-gray-400 mt-1.5">
                  In many NYS areas, assessed values are well below market values — this is normal. Assessed Value / Equalization Rate = Market Value.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tax */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-base">💰</span> {isNYS && p.estimatedTotalTax > 0 ? 'Annual Tax' : isNYS ? 'Taxable Value' : 'Tax'}
          </h3>
          <div className="space-y-3">
            {isNYS && p.estimatedTotalTax > 0 ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Estimated Annual Tax</span>
                  <span className="text-lg font-bold text-primary">{formatMoney(p.estimatedTotalTax)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2 mt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">County Tax <span className="text-gray-300">{p.taxRateInfo?.countyRate ? `${p.taxRateInfo.countyRate}/‰` : ''}</span></span>
                    <span className="text-sm text-gray-700">{formatMoney(p.countyTax)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Municipal Tax <span className="text-gray-300">{p.taxRateInfo?.municipalRate ? `${p.taxRateInfo.municipalRate}/‰` : ''}</span></span>
                    <span className="text-sm text-gray-700">{formatMoney(p.municipalTax)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">School Tax <span className="text-gray-300">{p.taxRateInfo?.schoolRate ? `${p.taxRateInfo.schoolRate.toFixed(2)}/‰` : ''}</span></span>
                    <span className="text-sm text-gray-700">{formatMoney(p.schoolTax)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                  <span className="text-sm text-gray-500">Approx. monthly</span>
                  <span className="text-sm font-semibold text-gray-900">{formatMoney(Math.round(p.estimatedTotalTax / 12))} / mo</span>
                </div>
                {p.taxRateInfo && (
                  <p className="text-[10px] text-gray-400 mt-2">
                    Rate source: FY{p.taxRateInfo.fiscalYear} · Based on {p.taxRateInfo.valueType === 'Full Value' ? 'market value' : 'assessed value'} · For reference only
                  </p>
                )}
              </>
            ) : p.estimatedTax > 0 ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Estimated Annual Tax</span>
                  <span className="text-lg font-bold text-primary">{formatMoney(p.estimatedTax)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Tax Rate (Class {p.taxClass})</span>
                  <span className="text-sm text-gray-700">{(p.taxRate * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Approx. monthly</span>
                  <span className="text-sm font-semibold text-gray-900">{formatMoney(monthlyTax)} / mo</span>
                </div>
              </>
            ) : (
              <>
                {p.countyTaxable > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">County Taxable Value</span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(p.countyTaxable)}</span>
                  </div>
                )}
                {p.schoolTaxable > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">School Taxable Value</span>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(p.schoolTaxable)}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">Tax rate data not available. Contact your local tax office for actual amounts.</p>
              </>
            )}
            <div className="pt-2 border-t border-gray-100">
              {!isNYS && (
                <a href="https://a836-citypay.nyc.gov/citypay/PropertyTax" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  View Official Tax Bill &rarr;
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exemptions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-base">🛡️</span> Tax Exemption Status
        </h3>
        {isNYS && p.exemptions?.length > 0 ? (
          <div className="space-y-2">
            {p.exemptions.map((ex: { code: string; countyAmt: number; schoolAmt: number }, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700">Exemption Code {ex.code}</span>
                <span className="text-xs text-green-600">
                  {ex.countyAmt > 0 ? `County ${formatMoney(ex.countyAmt)}` : ''}
                  {ex.countyAmt > 0 && ex.schoolAmt > 0 ? ' · ' : ''}
                  {ex.schoolAmt > 0 ? `School ${formatMoney(ex.schoolAmt)}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : isNYS ? (
          <p className="text-sm text-gray-400">No exemptions on record</p>
        ) : (
          <div className="space-y-2">
            {[
              { icon: '🏠', label: 'Basic STAR Exemption', applicable: p.exemptCode === '6800' && (p.taxClass === '1' || p.taxClass?.startsWith('2')) },
              { icon: '👴', label: 'Senior Citizen Exemption', applicable: p.exemptCode === '6810' },
              { icon: '🎖️', label: 'Veterans Exemption', applicable: p.exemptCode === '4110' || p.exemptCode === '4120' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700 flex items-center gap-2"><span>{item.icon}</span> {item.label}</span>
                <span className={cn('text-xs font-medium', item.applicable ? 'text-green-600' : 'text-gray-400')}>
                  {item.applicable ? '✓ Applied' : '✕ Not Applied'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assessment History */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-base">📈</span> Assessment History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-500 font-medium">Year</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Assessed Value</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Market Value</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{h.year}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">{formatMoney(h.assessedTotal)}</td>
                    <td className="py-2 text-right text-blue-600">{formatMoney(h.marketValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sale History */}
      {sales.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-base">🔄</span> Sales History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-500 font-medium">Sale Date</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Sale Price</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{s.date ? s.date.split('T')[0] : ''}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">{formatMoney(s.price)}</td>
                    <td className="py-2 text-right text-gray-500">{s.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead Gen CTAs */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Assessment too high?</h3>
          <p className="text-xs text-gray-600 mb-3">Homeowners save an average of <strong>$2,400</strong> per year — get a free consultation with a property tax attorney</p>
          <Link href="/businesses" className="inline-flex text-xs font-semibold text-primary hover:underline">Free Consultation &rarr;</Link>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Looking to buy in this area?</h3>
          <p className="text-xs text-gray-600 mb-3">Understand the tax costs — connect with a Baam-certified real estate agent</p>
          <Link href="/businesses" className="inline-flex text-xs font-semibold text-primary hover:underline">Contact an Agent &rarr;</Link>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6 space-y-2">
        {isNYS ? (
          <>
            <p>Data source: NYS Office of Real Property Tax Services via NY Open Data + NYS GIS. Assessment data from the <strong>{p.rollYear || p.year || 'latest'}</strong> assessment roll. Tax amounts are estimated based on published local tax rates, for reference only.</p>
            <p>
              For more property information, visit{' '}
              <a href="https://www.tax.ny.gov/research/property/assess/valuation/index.htm" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                NYS Tax Department Property Assessment
              </a>
              {' '}or contact your local assessment office.
            </p>
          </>
        ) : (
          <>
            <p>Data source: NYC Department of Finance + MapPLUTO via NYC Open Data. Assessment data from fiscal year <strong>{p.year || 'latest'}</strong>. Tax amounts are estimates based on current rates; refer to your official tax bill for accuracy.</p>
            <p>
              View the latest assessments and official tax bills at{' '}
              <a href="https://a836-acris.nyc.gov/bblsearch/bblsearch.asp" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                NYC ACRIS
              </a>
              {' '}or{' '}
              <a href="https://a836-citypay.nyc.gov/citypay/PropertyTax" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                NYC Finance ePay
              </a>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}
