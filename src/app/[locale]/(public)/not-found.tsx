import { Link } from '@/lib/i18n/routing';

export default function NotFound() {
  return (
    <main>
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-6xl mb-6">🔍</p>
        <h1 className="text-3xl font-bold mb-3">Page Not Found</h1>
        <p className="text-text-secondary mb-8">
          Sorry, the page you are looking for does not exist or has been removed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className="btn btn-primary h-10 px-6 text-sm">
            Go Home
          </Link>
          <Link href="/ask" className="btn btn-outline h-10 px-6 text-sm">
            Ask AI Assistant
          </Link>
          <Link href="/search" className="btn btn-outline h-10 px-6 text-sm">
            Search
          </Link>
        </div>
      </div>
    </main>
  );
}
