import { Link } from '@/lib/i18n/routing';
import { ViolationLookup } from './violation-lookup';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vehicle Violation Lookup · Baam',
  description: 'Free lookup for NYC parking tickets and camera violations. Enter your plate number to check fines and payment status.',
};

export default function VehicleViolationsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehicle Violation Lookup</h1>
            <p className="text-sm text-gray-500">Look up NYC parking and camera violations</p>
          </div>
        </div>
      </div>

      {/* Lookup Component */}
      <ViolationLookup />

      {/* Coverage Notice */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Coverage:</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>NYC parking tickets (expired meter, fire hydrant, street cleaning, double parking, etc.)</li>
          <li>NYC camera violations (red light cameras, school zone speed cameras, bus lane cameras)</li>
        </ul>
        <p className="mt-2 text-xs text-blue-600"><strong>Not included:</strong> Police-issued traffic tickets (running red lights, stop signs, speeding, and other moving violations), license points, suspension/revocation records.</p>
        <Link href="/services/vehicle-violations/guide" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:underline">
          How to view your full driving record (including police tickets and points) &rarr;
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-6">
        <p className="mb-2">
          <strong>Data source:</strong> NYC Open Data — Open Parking and Camera Violations.
        </p>
        <p className="mb-2">
          Data may be delayed and is for reference only. To confirm fine amounts or payment status, please visit the{' '}
          <a href="https://a836-citypay.nyc.gov/citypay/violations" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            NYC Finance
          </a>
          {' '}official website.
        </p>
        <p>This service is provided free of charge. Baam is not responsible for the accuracy of search results.</p>
      </div>
    </main>
  );
}
