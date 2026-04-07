import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Immigration Services · Baam',
  description: 'Useful immigration tools — AI visa eligibility screener, visa bulletin, immigration policy updates. All free.',
  keywords: ['immigration services', 'visa screener', 'green card application', 'immigration lawyer', 'USCIS'],
};

export default function ImmigrationIndexPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/services" className="hover:text-primary">Tools</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Immigration Services</span>
      </nav>

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🛂</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Immigration Services</h1>
        <p className="text-gray-500">Useful immigration tools — AI screening, visa bulletin, policy updates</p>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium mt-3">
          All Free · AI Powered
        </div>
      </div>

      {/* Legal Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-8 text-xs text-amber-800 flex items-start gap-2">
        <span className="flex-shrink-0">⚠️</span>
        <p>All tools on this page provide general information only and do not constitute legal advice. Please consult a licensed immigration attorney for professional guidance.</p>
      </div>

      {/* Featured: Visa Screener */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-gray-900">Featured Tool</h2>
          <span className="text-xs text-white bg-primary px-2 py-0.5 rounded-full">Recommended</span>
        </div>
        <Link href="/immigration/visa-screener"
          className="block bg-gradient-to-br from-primary to-orange-500 rounded-2xl p-6 sm:p-8 text-white hover:shadow-lg transition group">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🤖</div>
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">AI Powered</span>
                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">Free</span>
              </div>
              <h3 className="text-xl font-bold mb-2">AI Visa Eligibility Screener</h3>
              <p className="text-sm text-white/80 mb-4">Answer 6 simple questions and AI will analyze which visa categories may fit you</p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold bg-white text-primary px-4 py-2 rounded-xl group-hover:bg-gray-50 transition">
                Start Assessment →
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Coming Soon */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">More Tools</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: '🔍', title: 'USCIS Case Status Lookup', desc: 'Check your immigration application progress', badge: 'Coming Soon' },
            { icon: '📊', title: 'Visa Bulletin Tracker', desc: 'View EB/Family green card priority dates', badge: 'Coming Soon' },
            { icon: '⏱️', title: 'Processing Time Lookup', desc: 'Check current processing times for visa categories', badge: 'Coming Soon' },
            { icon: '⚖️', title: 'Immigration Court Dates', desc: 'Look up immigration court hearing dates', badge: 'Coming Soon' },
          ].map((tool) => (
            <div key={tool.title} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 opacity-75">
              <div className="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">{tool.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{tool.badge}</span>
                </div>
                <p className="text-xs text-gray-500">{tool.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visa Category Guide */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">US Visa and Immigration Categories</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: '💼', title: 'Work Visas', items: ['H-1B Professional Worker', 'L-1 Intracompany Transfer', 'O-1 Extraordinary Ability', 'E-2 Treaty Investor'] },
            { icon: '🟢', title: 'Green Card / Permanent Residency', items: ['EB-1/2/3 Employment-Based', 'Family-Based (F1-F4)', 'EB-5 Investor Immigration'] },
            { icon: '🎓', title: 'Student Visas', items: ['F-1 Academic Student', 'J-1 Exchange Visitor', 'OPT/CPT Work Authorization'] },
            { icon: '👨‍👩‍👧‍👦', title: 'Family Immigration', items: ['Immediate Relatives (Spouse/Children)', 'Preference Categories (Siblings etc.)'] },
          ].map((cat) => (
            <div key={cat.title} className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span>{cat.icon}</span> {cat.title}
              </h3>
              <ul className="space-y-1">
                {cat.items.map((item) => (
                  <li key={item} className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-gray-300 rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* AI + Lawyer CTA */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Link href="/ask" className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 hover:shadow-md transition group">
          <div className="text-2xl mb-2">🤖</div>
          <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Have immigration questions? Ask AI</h3>
          <p className="text-xs text-gray-500">&ldquo;How long does H1B to green card take?&rdquo;</p>
        </Link>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 text-white">
          <div className="text-2xl mb-2">⚖️</div>
          <h3 className="text-sm font-bold mb-1">Need a professional immigration lawyer?</h3>
          <p className="text-xs text-white/70 mb-3">Baam partner immigration attorneys offer free initial consultations</p>
          <Link href="/businesses" className="inline-flex text-xs font-semibold text-primary bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
            Find an Immigration Lawyer →
          </Link>
        </div>
      </div>

      {/* Email */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <h3 className="text-base font-bold text-gray-900 mb-1">Subscribe to Immigration Policy Updates</h3>
        <p className="text-xs text-gray-500 mb-4">Monthly visa bulletin changes, policy updates, and practical guides</p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input type="email" placeholder="Enter your email" className="flex-1 h-10 px-4 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
          <button className="h-10 px-5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition">Subscribe</button>
        </div>
      </div>
    </main>
  );
}
