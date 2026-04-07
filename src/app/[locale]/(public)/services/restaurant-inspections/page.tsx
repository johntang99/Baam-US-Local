import { Suspense } from 'react';
import { Link } from '@/lib/i18n/routing';
import { InspectionsClient } from './inspections-client';
import { ServiceFAQ } from '@/components/services/service-faq';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NYC Restaurant Health Inspection Lookup · Baam',
  description: 'Free lookup for any NYC restaurant health inspection grade, violations, and history. Enter a restaurant name to see A/B/C grade details.',
  keywords: ['NYC restaurant health inspection', 'restaurant grade NYC', 'restaurant inspection lookup', 'NYC restaurant grade'],
  openGraph: {
    title: 'NYC Restaurant Health Inspection Lookup',
    description: 'Free lookup for any NYC restaurant health inspection grade and violations',
    locale: 'en_US',
  },
};

const FAQ_ITEMS = [
  {
    question: 'Where can I check a NYC restaurant health grade?',
    answer: 'You can search directly using the tool on this page. Our data comes from the NYC Department of Health and Mental Hygiene (DOHMH) open data platform and syncs with official records. Every restaurant is also required to post their most recent grade at the entrance.',
  },
  {
    question: 'Is a Grade B restaurant safe to eat at?',
    answer: 'A Grade B score (14-27 points) means the restaurant has some sanitation issues, but is still within an acceptable range. Many well-known restaurants occasionally receive a B due to individual point deductions. Check the specific violations — if they are mostly "non-critical" (e.g., floor cleanliness), it\'s generally not a major concern.',
  },
  {
    question: 'How often are grades updated?',
    answer: 'The NYC Health Department inspects each restaurant at least once a year. If a restaurant does not receive an A grade, a re-inspection is typically scheduled within a few weeks. Our data syncs daily from NYC Open Data.',
  },
  {
    question: 'What does it mean if a restaurant has no grade posted?',
    answer: 'Per NYC regulations, all restaurants must post their grade at the entrance. If none is posted, the restaurant may be newly opened and not yet inspected, awaiting re-inspection, or in violation of posting requirements (which is itself a violation). You can call 311 to report it to the Health Department.',
  },
];

export default function RestaurantInspectionsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/services" className="hover:text-primary">Tools</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Restaurant Health Grades</span>
      </nav>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🍽️</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">NYC Restaurant Health Inspection</h1>
        <p className="text-gray-500">Look up health grades, violations, and inspection history</p>
      </div>

      {/* Guide Content (SEO) */}
      <article className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 prose prose-sm max-w-none text-gray-700">
        <h2 className="text-lg font-bold text-gray-900 mt-0">Understanding NYC Restaurant Health Grades</h2>
        <p>In New York City, every restaurant is regularly inspected by the NYC Department of Health and Mental Hygiene (DOHMH). Inspectors score restaurants based on food handling, kitchen hygiene, pest control, and other standards. <strong>Lower scores are better</strong> — the score directly determines the restaurant&apos;s A/B/C grade.</p>
        <p>NYC has required restaurant health grading since 2010. Over <strong>27,000 restaurants</strong> participate in the grading program, with each receiving 1-3 inspections per year on average. All inspection data is fully public, and you can search it for free using the tool below.</p>

        {/* Grade Badges */}
        <h3 className="text-base font-bold text-gray-900">A / B / C Grading Scale</h3>
        <div className="grid grid-cols-3 gap-3 not-prose mb-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-green-500 rounded-xl text-white text-xl font-bold flex items-center justify-center mx-auto mb-2">A</div>
            <div className="text-sm font-bold text-green-800">Excellent</div>
            <div className="text-xs text-green-600">0 - 13 points</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-yellow-500 rounded-xl text-white text-xl font-bold flex items-center justify-center mx-auto mb-2">B</div>
            <div className="text-sm font-bold text-yellow-800">Good</div>
            <div className="text-xs text-yellow-600">14 - 27 points</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-orange-500 rounded-xl text-white text-xl font-bold flex items-center justify-center mx-auto mb-2">C</div>
            <div className="text-sm font-bold text-orange-800">Needs Improvement</div>
            <div className="text-xs text-orange-600">28+ points</div>
          </div>
        </div>

        <h3 className="text-base font-bold text-gray-900">Common Violation Types</h3>
        <p><strong>Critical Violations:</strong> Can directly cause foodborne illness, including improper food temperatures, cross-contamination between raw and cooked foods, evidence of rodent activity, etc. Each carries 5-28 points.</p>
        <p><strong>Non-Critical Violations:</strong> Reflect management standards but don&apos;t directly cause illness, including unclean floors, poor ventilation maintenance, uncovered trash containers, etc. Each carries 2-5 points.</p>
      </article>

      {/* Search Tool */}
      <Suspense fallback={<div className="h-40 bg-gray-50 rounded-2xl animate-pulse" />}>
        <InspectionsClient />
      </Suspense>

      {/* FAQ */}
      <div className="mt-8">
        <ServiceFAQ items={FAQ_ITEMS} />
      </div>

      {/* Baam Integration */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Explore More on Baam</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/businesses" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🍜</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Find More Restaurants</h3>
            <p className="text-xs text-gray-500">Browse local restaurant directory</p>
          </Link>
          <Link href="/discover/new-post" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">✍️</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Write a Food Review</h3>
            <p className="text-xs text-gray-500">Share your dining experience</p>
          </Link>
          <Link href="/ask" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition group text-center">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary mb-1">Ask AI Assistant</h3>
            <p className="text-xs text-gray-500">&ldquo;Which restaurants near me have the best grades?&rdquo;</p>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p>Data source: NYC Department of Health and Mental Hygiene (DOHMH) via NYC Open Data. Data updated daily, for reference only. Grading: A (0-13 points), B (14-27 points), C (28+ points).</p>
      </div>
    </main>
  );
}
