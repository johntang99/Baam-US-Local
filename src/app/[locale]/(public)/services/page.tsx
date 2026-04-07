import { Link } from '@/lib/i18n/routing';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tools · Baam',
  description: 'Useful local tools — vehicle violation lookup, restaurant inspections, property tax lookup, and more.',
};

const services = [
  {
    href: '/services/vehicle-violations',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
    ),
    title: 'Vehicle Violation Lookup',
    description: 'Look up NYC parking tickets, traffic camera violations, and payment status',
    badge: 'Free',
  },
  {
    href: '/services/restaurant-inspections',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    title: 'Restaurant Health Scores',
    description: 'View health inspection scores, violations, and inspection history for any NYC restaurant',
    badge: 'Free',
  },
  {
    href: '/services/property-tax',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    ),
    title: 'Property Tax Lookup',
    description: 'View assessed value, property tax, and transaction history for any NY property across all 62 counties',
    badge: 'Free',
  },
  {
    href: '/immigration/visa-screener',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
    ),
    title: 'Visa Eligibility AI Screener',
    description: 'Answer a few simple questions, and AI will analyze which US visa and immigration categories may fit you',
    badge: 'AI',
  },
];

export default function ServicesIndexPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tools</h1>
        <p className="text-gray-500">Useful local lookup tools, free to use</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {services.map((service) => (
          <Link
            key={service.href}
            href={service.href}
            className="group bg-white border border-gray-200 rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0 group-hover:bg-primary/20 transition">
                {service.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-gray-900 group-hover:text-primary transition">{service.title}</h2>
                  {service.badge && (
                    <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{service.badge}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{service.description}</p>
              </div>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-primary transition flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
