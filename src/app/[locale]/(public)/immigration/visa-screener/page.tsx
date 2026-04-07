import { Link } from '@/lib/i18n/routing';
import { ScreenerClient } from './screener-client';
import { ServiceFAQ } from '@/components/services/service-faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Visa Eligibility Screener · Baam',
  description: 'Free AI visa eligibility assessment — answer a few simple questions to discover which US visa and immigration categories may fit you. H1B, green card, family immigration, investment immigration, and more.',
  keywords: ['visa eligibility screener', 'US visa', 'green card application', 'H1B', 'EB2', 'EB3', 'immigration lawyer'],
  openGraph: {
    title: 'AI Visa Eligibility Screener',
    description: 'Answer 6 simple questions, and AI will analyze which visa categories may fit you',
    locale: 'en_US',
  },
};

const FAQ_ITEMS = [
  {
    question: 'How accurate is this assessment tool?',
    answer: 'This tool uses AI to provide a preliminary analysis based on the information you provide, suggesting visa categories that may be a fit. However, immigration law is very complex and every case is unique. The results do not constitute legal advice — specific eligibility should be determined by a licensed immigration attorney based on your full situation.',
  },
  {
    question: 'How long does it take to get a green card?',
    answer: 'It depends on the category: EB-1 takes about 1-2 years, EB-2 about 2-4 years, EB-3 about 3-5 years. Applicants born in mainland China and India face additional visa bulletin wait times and actual processing may be longer. Family-based immigration can take even longer, with some categories requiring 10+ years. It is recommended to start the process early.',
  },
  {
    question: 'Can an H1B visa be converted to a green card?',
    answer: 'Yes. H1B is a "dual intent" visa, which allows you to apply for a green card while holding an H1B. The most common path is through employer-sponsored EB-2 or EB-3 green cards. This involves PERM labor certification, I-140 petition, and then submitting I-485 once your priority date becomes current.',
  },
  {
    question: 'Will my information be saved?',
    answer: 'Your assessment information is not saved or shared. All data is only used for the current AI analysis and no personal information is stored after the assessment is complete. You can use the tool with confidence.',
  },
];

export default function VisaScreenerPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">Tools</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Visa Eligibility Screener</span>
      </nav>

      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">🛂</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">AI Visa Eligibility Screener</h1>
        <p className="text-gray-500 text-sm">Powered by AI</p>
        <p className="text-gray-400 text-sm mt-1">Answer a few simple questions and AI will analyze which visa categories may fit you</p>
      </div>

      {/* Legal Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 flex items-start gap-2">
        <span className="text-base flex-shrink-0">⚠️</span>
        <p><strong>Disclaimer:</strong> This tool provides general information only and does not constitute legal advice. Immigration law is complex and varies by individual. Always consult a licensed immigration attorney before making any decisions.</p>
      </div>

      {/* Guide Content (SEO) */}
      <article className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 prose prose-sm max-w-none text-gray-700">
        <h2 className="text-lg font-bold text-gray-900 mt-0">Overview of US Visa and Immigration Categories</h2>
        <p>The US visa and immigration system is divided into <strong>nonimmigrant visas</strong> (H-1B work visa, L-1 intracompany transfer, O-1 extraordinary ability, F-1 student visa, etc.) and <strong>immigrant visas / green cards</strong> (EB employment-based, family-based, etc.). For applicants born in certain countries, most categories have visa bulletin wait times.</p>
        <p>This assessment tool uses AI to analyze your personal situation (goals, education, work experience, family ties, etc.) to help you understand which visa categories may be a fit, and provides next-step recommendations.</p>
      </article>

      {/* Screener Tool */}
      <ScreenerClient />

      {/* FAQ */}
      <div className="mt-8">
        <ServiceFAQ items={FAQ_ITEMS} />
      </div>

      {/* Related */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Related Resources</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/ask" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Ask AI Assistant</h3>
            <p className="text-xs text-gray-500">&ldquo;How long does H1B to green card take?&rdquo;</p>
          </Link>
          <Link href="/services/property-tax" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🏠</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Property Tax Lookup</h3>
            <p className="text-xs text-gray-500">NY property assessments and tax amounts</p>
          </Link>
          <Link href="/businesses" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">⚖️</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Find an Immigration Lawyer</h3>
            <p className="text-xs text-gray-500">Baam verified immigration attorney directory</p>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>This tool is powered by AI and results are for reference only. Immigration law is complex and changes frequently. Specific eligibility and application strategies should be determined by a licensed immigration attorney based on your detailed situation. Baam is not responsible for the accuracy of assessment results.</p>
      </div>
    </main>
  );
}
