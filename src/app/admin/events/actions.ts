'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

function generateSlug(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 80);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

export async function createEvent(formData: FormData) {
  const supabase = db();
  const ctx = await getAdminSiteContext();
  const titleZh = formData.get('title_zh') as string;
  const slug = generateSlug(titleZh || 'event');

  const { data, error } = await supabase
    .from('events')
    .insert({
      title_zh: titleZh,
      title_en: formData.get('title_en') as string || null,
      summary_zh: formData.get('summary_zh') as string || null,
      description_zh: formData.get('description_zh') as string || null,
      venue_name: formData.get('venue_name') as string || null,
      address: formData.get('address') as string || null,
      start_at: formData.get('start_at') as string || null,
      end_at: formData.get('end_at') as string || null,
      is_free: formData.get('is_free') === 'true',
      ticket_price: formData.get('ticket_price') as string || null,
      organizer_name: formData.get('organizer_name') as string || null,
      region_id: formData.get('region_id') as string || null,
      site_id: ctx.siteId || null,
      status: (formData.get('status') as string) || 'draft',
      slug,
    })
    .select('id')
    .single();

  revalidatePath('/admin/events');

  if (error) {
    return { id: null, error: error.message };
  }
  return { id: data?.id, error: null };
}

export async function updateEvent(eventId: string, formData: FormData) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('events')
    .update({
      title_zh: formData.get('title_zh') as string,
      title_en: formData.get('title_en') as string || null,
      summary_zh: formData.get('summary_zh') as string || null,
      description_zh: formData.get('description_zh') as string || null,
      venue_name: formData.get('venue_name') as string || null,
      address: formData.get('address') as string || null,
      start_at: formData.get('start_at') as string || null,
      end_at: formData.get('end_at') as string || null,
      is_free: formData.get('is_free') === 'true',
      ticket_price: formData.get('ticket_price') as string || null,
      organizer_name: formData.get('organizer_name') as string || null,
      region_id: formData.get('region_id') as string || null,
      site_id: ctx.siteId || null,
      status: formData.get('status') as string,
    })
    .eq('id', eventId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/events');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteEvent(eventId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/events');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function publishEvent(eventId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('events')
    .update({ status: 'published' })
    .eq('id', eventId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/events');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function toggleFeatured(eventId: string, featured: boolean) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('events')
    .update({ is_featured: featured })
    .eq('id', eventId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/events');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
