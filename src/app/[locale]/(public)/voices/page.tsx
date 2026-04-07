import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

export default async function VoicesRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.page) params.set('page', sp.page);
  if (sp.tag) params.set('tag', sp.tag);
  const qs = params.toString();
  redirect(`/discover/voices${qs ? `?${qs}` : ''}`);
}
