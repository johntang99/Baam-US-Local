import { Link } from '@/lib/i18n/routing';
import { ServiceFAQ } from '@/components/services/service-faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How to View Your Full NYS Driving Record | NYS Driving Record Guide · Baam',
  description: 'Step-by-step guide: How to check your complete driving record on the NYS DMV website, including police-issued traffic tickets, points, and suspension/revocation records.',
  keywords: ['NYS driving record lookup', 'NYS DMV abstract', 'traffic violation record', 'license points check', 'MyDMV', 'ticket lookup'],
};

const FAQ_ITEMS = [
  {
    question: 'What information does a driving record (Abstract) show?',
    answer: 'A standard driving record includes: license class and status, all traffic violation convictions (retained for 3 years + current year), DWI records (retained 15 years), DWAI records (retained 10 years), suspension/revocation records (retained 4 years), accident records, and accumulated points. This covers much more than our free ticket lookup tool, including all police-issued moving violations.',
  },
  {
    question: 'How much does it cost?',
    answer: 'Online lookup is $7, in-person at a DMV office is $10. After online purchase, the record is available in your MyDMV account for 5 days and can be viewed or downloaded anytime.',
  },
  {
    question: 'What do I need to look up my record online?',
    answer: 'You need a NY.gov ID account (free to register). Registration requires: your Client ID number or Document Number from your license, date of birth, address on file with DMV (state and zip code), and last 4 digits of your Social Security Number. First-time registration also requires setting up two-factor authentication.',
  },
  {
    question: 'What is the difference between the free ticket lookup and a paid driving record?',
    answer: 'Our free tool only looks up NYC parking tickets and camera violations (red light cameras, speed cameras). The paid DMV driving record (Abstract) includes all types of violations: police-issued tickets (running red lights, stop signs, speeding, and other moving violations), point accumulation, and license suspension/revocation records. If you want a complete record, you need to purchase it through the DMV website.',
  },
];

export default function DrivingRecordGuidePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">Tools</Link>
        <span className="mx-2">/</span>
        <Link href="/services/vehicle-violations" className="hover:text-primary">Vehicle Violations</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Full Driving Record Guide</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">How to View Your Full NYS Driving Record</h1>
        <p className="text-gray-500">NYS DMV Driving Record (Abstract) Lookup Guide</p>
      </div>

      {/* Why You Need This */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
          <span>⚠️</span> Why do you need to check your full driving record?
        </h2>
        <p className="text-sm text-amber-800 leading-relaxed">
          Our <Link href="/services/vehicle-violations" className="text-primary font-medium underline">free ticket lookup tool</Link> only covers NYC parking tickets and camera violations.
          If you received a <strong>police-issued traffic ticket</strong> (e.g., running a red light, stop sign, speeding, failure to yield to pedestrians),
          these are <strong>moving violations</strong> not included in NYC Open Data and must be viewed through the NYS DMV.
        </p>
      </div>

      {/* Coverage Comparison */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Comparison of Two Lookup Methods</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold">Coverage</th>
                <th className="text-center px-3 py-2 border border-gray-200 font-semibold">Baam Free Tool</th>
                <th className="text-center px-3 py-2 border border-gray-200 font-semibold">DMV Driving Record ($7)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border border-gray-200">Parking tickets (meter, fire hydrant, etc.)</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td><td className="px-3 py-2 border border-gray-200 text-center text-gray-400">✕</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200">Camera violations (red light, speed cameras)</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">Police-issued moving violations</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">License points</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200 font-medium">License suspension/revocation</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200">DWI/DWAI records</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr><td className="px-3 py-2 border border-gray-200">Accident records</td><td className="px-3 py-2 border border-gray-200 text-center text-red-500 font-bold">✕</td><td className="px-3 py-2 border border-gray-200 text-center text-green-600 font-bold">✓</td></tr>
              <tr className="bg-gray-50"><td className="px-3 py-2 border border-gray-200 font-bold">Cost</td><td className="px-3 py-2 border border-gray-200 text-center font-bold text-green-600">Free</td><td className="px-3 py-2 border border-gray-200 text-center font-bold">$7 (online) / $10 (in-person)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Step by Step Guide */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Online Lookup Steps ($7, most convenient)</h2>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Register for a NY.gov ID account (if you don't have one)</h3>
              <p className="text-sm text-gray-600 mb-2">
                Visit <a href="https://my.ny.gov/" target="_blank" rel="noopener noreferrer" className="text-primary underline">my.ny.gov</a> and click &ldquo;Create Account&rdquo;
              </p>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <p className="font-medium mb-1">You will need:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>Client ID</strong> or <strong>Document Number</strong> (on the front or back of your license)</li>
                  <li>Date of birth</li>
                  <li>Address on file with DMV (state and zip code)</li>
                  <li>Last 4 digits of your Social Security Number (SSN)</li>
                </ul>
                <p className="mt-2 text-amber-600">Tip: The Client ID is a number on the front of your license. If you can't find it, bring your license to any DMV office.</p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Log in to MyDMV</h3>
              <p className="text-sm text-gray-600">
                Visit <a href="https://my.dmv.ny.gov/" target="_blank" rel="noopener noreferrer" className="text-primary underline">my.dmv.ny.gov</a> and log in with your NY.gov ID
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Select &ldquo;Get My Driving Record&rdquo;</h3>
              <p className="text-sm text-gray-600">
                On the MyDMV dashboard, find the &ldquo;My Records&rdquo; or &ldquo;Get My Driving Record&rdquo; option
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Choose record type and pay</h3>
              <p className="text-sm text-gray-600 mb-2">
                Select <strong>&ldquo;Standard Driving Abstract&rdquo;</strong>, $7, accepts credit/debit cards
              </p>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                <p className="font-medium mb-1">Three record types:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>Standard $7</strong> — Last 3 years + current year violations, recommended for most people</li>
                  <li><strong>Lifetime $7</strong> — All historical violation records</li>
                  <li><strong>CDL $7</strong> — For commercial driver's license holders only</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">View and download your record</h3>
              <p className="text-sm text-gray-600">
                Your record is available immediately after payment. It stays in MyDMV for <strong>5 days</strong> — we recommend downloading the PDF right away.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Understanding Your Record */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Understanding Your Driving Record</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Point System</h3>
            <p className="text-sm text-gray-600 mb-2">New York State traffic violation point system: accumulating 11 points within 18 months will result in license suspension.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1.5 border border-gray-200">Violation Type</th>
                    <th className="text-left px-2 py-1.5 border border-gray-200">Description</th>
                    <th className="text-center px-2 py-1.5 border border-gray-200">Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Speeding 1-10 mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 1-10 mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">3 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Speeding 11-20 mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 11-20 mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">4 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Speeding 21-30 mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 21-30 mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">6 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Speeding 31-40 mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 31-40 mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">8 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Speeding 41+ mph</td><td className="px-2 py-1.5 border border-gray-200">Speeding 41+ mph over</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">11 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Running red light</td><td className="px-2 py-1.5 border border-gray-200">Failure to stop for red light</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">3 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Running stop sign</td><td className="px-2 py-1.5 border border-gray-200">Failure to stop for stop sign</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">3 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Improper lane change</td><td className="px-2 py-1.5 border border-gray-200">Improper lane change</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">3 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Tailgating</td><td className="px-2 py-1.5 border border-gray-200">Following too closely</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">4 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Cell phone use (handheld)</td><td className="px-2 py-1.5 border border-gray-200">Cell phone use</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">5 pts</td></tr>
                  <tr><td className="px-2 py-1.5 border border-gray-200">Reckless driving</td><td className="px-2 py-1.5 border border-gray-200">Reckless driving</td><td className="px-2 py-1.5 border border-gray-200 text-center font-bold">5 pts</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Record Retention Periods</h3>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-0.5">
              <li>Regular traffic violations: current year + 3 years</li>
              <li>DWAI (Driving While Ability Impaired): 10 years</li>
              <li>DWI (Driving While Intoxicated): 15 years</li>
              <li>License suspension/revocation: 4 years after conclusion</li>
              <li>Refusal of chemical test: 5 years after conclusion</li>
            </ul>
          </div>
        </div>
      </div>

      {/* In-Person Alternative */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Prefer in-person? Visit a DMV office</h2>
        <p className="text-sm text-gray-600 mb-3">
          You can also visit any NYS DMV office in person. The fee is $10.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
          <p className="font-medium mb-1">What to bring:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Completed <strong>MV-15C form</strong> (downloadable from the DMV website)</li>
            <li>Photo ID (driver's license, government-issued Photo ID, or 6-point ID documents)</li>
            <li>$10 fee (cash, credit card, or check accepted)</li>
          </ul>
        </div>
        <a href="https://dmv.ny.gov/offices" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-3 hover:underline">
          Find a DMV office near you &rarr;
        </a>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-primary to-orange-600 rounded-2xl p-6 text-center text-white mb-8">
        <h3 className="text-lg font-bold mb-2">Need help with a traffic ticket?</h3>
        <p className="text-sm text-white/80 mb-4">Traffic violations can affect your license points and insurance rates. Consult a professional attorney about your appeal options.</p>
        <Link href="/businesses" className="inline-flex px-6 py-2.5 bg-white text-primary font-bold rounded-xl hover:bg-gray-50 transition">
          Find a Traffic Attorney
        </Link>
      </div>

      {/* Quick Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Official Links</h2>
        <div className="space-y-2">
          <a href="https://my.dmv.ny.gov/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <span>🔗</span> MyDMV Online Portal (login required)
          </a>
          <a href="https://dmv.ny.gov/records/get-my-own-driving-record-abstract" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <span>🔗</span> DMV Driving Record Instructions
          </a>
          <a href="https://dmv.ny.gov/tickets/traffic-violations-bureau" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <span>🔗</span> NYC Traffic Violations Bureau (TVB) — Pay/Contest Moving Violations
          </a>
          <a href="https://dmv.ny.gov/tickets/plead-or-pay-tvb-tickets" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <span>🔗</span> Pay or Contest TVB Tickets
          </a>
        </div>
      </div>

      {/* FAQ */}
      <ServiceFAQ items={FAQ_ITEMS} />

      {/* Related */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-3">Related Tools</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/services/vehicle-violations" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group">
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Free Parking Ticket Lookup</h3>
            <p className="text-xs text-gray-500">Look up NYC parking and camera violations (free)</p>
          </Link>
          <Link href="/ask" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group">
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Ask AI Assistant</h3>
            <p className="text-xs text-gray-500">&ldquo;How do I contest a traffic ticket?&rdquo;</p>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>This guide is for reference only. NYS DMV may update procedures and fees at any time. For questions, contact the DMV customer service line: (518) 486-9786.</p>
      </div>
    </main>
  );
}
