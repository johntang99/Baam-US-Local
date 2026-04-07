import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';
import EventForm from '../EventForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewEventPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = await getAdminSiteContext(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Fetch regions for this site
  const { data: rawRegions } = await supabase
    .from('regions')
    .select('id, name_zh, slug')
    .in('id', ctx.regionIds);
  const regions = (rawRegions || []) as AnyRow[];

  // Build site params string for links
  const siteParamsObj = new URLSearchParams();
  if (params.region) siteParamsObj.set('region', String(params.region));
  if (params.locale) siteParamsObj.set('locale', String(params.locale));

  return (
    <EventForm
      event={null}
      regions={regions}
      isNew={true}
      siteParams={siteParamsObj.toString()}
    />
  );
}
