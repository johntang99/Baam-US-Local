import { Suspense } from 'react';
import { Link } from '@/lib/i18n/routing';
import { PropertyTaxClient } from './property-tax-client';
import { ServiceFAQ } from '@/components/services/service-faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NY Property Tax Lookup · Baam',
  description: 'Free lookup for any New York State property assessment, property tax, and sales history. Covers all five NYC boroughs, Long Island, Westchester, and statewide.',
  keywords: ['NY property tax lookup', 'property assessment', 'STAR exemption', 'Long Island property tax', 'Westchester property tax'],
  openGraph: {
    title: 'NY Property Tax Lookup',
    description: 'Free lookup for NYC property assessments, taxes, and sales history',
    locale: 'en_US',
  },
};

const FAQ_ITEMS = [
  {
    question: 'What is the property tax rate in New York?',
    answer: 'NYC property tax rates vary by tax class: Class 1 (1-3 family homes) is about 20.3%, Class 2 (apartment buildings) about 12.3%, Class 4 (commercial properties) about 10.6%. Rates are adjusted annually by the City Council. Note: rates are based on assessed value, not market value.',
  },
  {
    question: 'How do I check my property\'s assessed value?',
    answer: 'Enter your property address and borough/region in the lookup tool above to see the latest assessed value. Assessed values are published annually in January by the NYC Department of Finance (DOF). You can also view your full tax bill on the NYC Finance official website.',
  },
  {
    question: 'How do I appeal a high property assessment?',
    answer: 'You can file an appeal with the Tax Commission. Deadlines: March 1 for Class 1, March 15 for Class 2-4. You will need market value evidence (such as recent comparable sales or an independent appraisal). About 40% of appeals result in a reduction, saving an average of $1,000-$5,000 per year.',
  },
  {
    question: 'How do I apply for a STAR exemption?',
    answer: 'STAR (School Tax Relief) is available to owner-occupied homes. Basic STAR has no income limit. Enhanced STAR is for homeowners 65+ with annual income under $107,300. New applications are submitted through the NYS Tax Department website. The property must be your primary residence. The exemption is issued as a tax credit check.',
  },
];

export default function PropertyTaxPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">Tools</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Property Tax Lookup</span>
      </nav>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🏠</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">NY Property Tax Lookup</h1>
        <p className="text-gray-500">New York State Property Tax & Assessment Lookup</p>
        <p className="text-xs text-gray-400 mt-1">Covering all five NYC boroughs, Long Island, Westchester, and all 62 NYS counties</p>
      </div>

      {/* Guide Content (SEO) */}
      <article className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 prose prose-sm max-w-none text-gray-700">
        <h2 className="text-lg font-bold text-gray-900 mt-0">How is NY property tax calculated?</h2>
        <p>Property owners in New York City pay annual property tax based on the property's <strong>assessed value</strong>, not market value. The assessed value is typically much lower than market value, with the ratio depending on the tax class. Formula: <strong>Annual Property Tax = Assessed Value x Tax Rate</strong>.</p>

        <h3 className="text-base font-bold text-gray-900">Four Property Tax Classes</h3>
        <div className="not-prose overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">Class</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">Property Type</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">2025/26 Tax Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Class 1</td><td className="px-3 py-2 border border-gray-200">1-3 Family Homes</td><td className="px-3 py-2 border border-gray-200">20.309%</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Class 2</td><td className="px-3 py-2 border border-gray-200">Apartment Buildings (incl. Co-op, Condo)</td><td className="px-3 py-2 border border-gray-200">12.267%</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Class 3</td><td className="px-3 py-2 border border-gray-200">Utilities</td><td className="px-3 py-2 border border-gray-200">12.826%</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Class 4</td><td className="px-3 py-2 border border-gray-200">Commercial Properties</td><td className="px-3 py-2 border border-gray-200">10.646%</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-bold text-gray-900">What is the STAR Exemption?</h3>
        <p>STAR (School Tax Relief) is a New York State tax exemption for owner-occupied homes. <strong>Basic STAR</strong> is available to all owner-occupants. <strong>Enhanced STAR</strong> is for homeowners age 65+ with lower incomes. New applications are submitted through the NYS Tax Department website.</p>

        <h3 className="text-base font-bold text-gray-900">How to appeal a high assessment?</h3>
        <p>You can appeal to the Tax Commission, with a deadline in March each year. About 40% of appeals result in a reduction, saving an average of $1,000-$5,000 per year. Market value evidence is required.</p>
      </article>

      {/* Search Tool */}
      <Suspense fallback={<div className="h-40 bg-gray-50 rounded-2xl animate-pulse" />}>
        <PropertyTaxClient />
      </Suspense>

      {/* FAQ */}
      <div className="mt-8">
        <ServiceFAQ items={FAQ_ITEMS} />
      </div>

      {/* Baam Integration */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Related Resources</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/businesses" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🏪</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Find a Real Estate Agent</h3>
            <p className="text-xs text-gray-500">Browse Baam-certified real estate agents</p>
          </Link>
          <Link href="/ask" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Ask AI Assistant</h3>
            <p className="text-xs text-gray-500">&ldquo;What are typical property taxes in Middletown?&rdquo;</p>
          </Link>
          <Link href="/services/vehicle-violations" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🚗</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Parking Ticket Lookup</h3>
            <p className="text-xs text-gray-500">Check vehicle violation records</p>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>Data source: NYC Department of Finance via NYC Open Data. Tax rates are estimated for fiscal year 2025/26. Actual taxes may differ due to exemptions and adjustments. Refer to your official NYC Finance tax bill for accuracy.</p>
      </div>
    </main>
  );
}
