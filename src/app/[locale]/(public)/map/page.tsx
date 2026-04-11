import type { Metadata } from 'next';
import MapClient from './MapClient';
import { fetchMapBusinesses } from './actions';

export const metadata: Metadata = {
  title: 'Map · Baam',
  description: 'Explore local businesses, events, and community on the Baam Map — powered by ratings, reviews, and community insights.',
};

interface Props {
  searchParams: Promise<{ cat?: string; q?: string }>;
}

export default async function MapPage({ searchParams }: Props) {
  const sp = await searchParams;
  const categorySlug = sp.cat || '';
  const searchQuery = sp.q || '';

  const result = await fetchMapBusinesses({
    categorySlug: categorySlug || undefined,
    search: searchQuery || undefined,
    limit: 50,
  });

  return (
    <MapClient
      initialBusinesses={result.businesses}
      initialCategory={categorySlug}
    />
  );
}
