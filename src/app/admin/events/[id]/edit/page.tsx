import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import EventForm from '../../EventForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditEventPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getAdminSiteContext(sp);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Build site params string for links
  const siteParamsObj = new URLSearchParams();
  if (sp.region) siteParamsObj.set('region', String(sp.region));
  if (sp.locale) siteParamsObj.set('locale', String(sp.locale));

  // Fetch the event
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single();

  if (!event) {
    return (
      <div className="p-12 text-center">
        <p className="text-lg font-medium">Event not found</p>
        <p className="text-sm text-text-muted mt-1">ID: {id}</p>
        <a href={`/admin/events${siteParamsObj.toString() ? `?${siteParamsObj.toString()}` : ''}`} className="text-primary hover:underline text-sm mt-4 inline-block">
          Back to events
        </a>
      </div>
    );
  }

  // Fetch regions for this site
  const { data: rawRegions } = await supabase
    .from('regions')
    .select('id, name_zh, slug')
    .in('id', ctx.regionIds);
  const regions = (rawRegions || []) as AnyRow[];

  return (
    <EventForm
      event={event}
      regions={regions}
      isNew={false}
      siteParams={siteParamsObj.toString()}
    />
  );
}
