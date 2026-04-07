'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;
const reval = () => revalidatePath('/admin/sites');

// ============================================================
// REGION CRUD
// ============================================================

export async function addRegion(formData: FormData) {
  const slug = (formData.get('slug') as string)?.trim();
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const type = (formData.get('type') as string) || 'city';
  const parent_id = (formData.get('parent_id') as string) || null;
  if (!slug || !name_en) return { error: 'Slug and English name are required' };

  const { error } = await db().from('regions').insert({
    slug, name_en, name_zh: name_zh || null, type,
    parent_id: parent_id || null, timezone: 'America/New_York', is_active: true,
  });
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function updateRegion(regionId: string, formData: FormData) {
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const type = (formData.get('type') as string);
  const parent_id = (formData.get('parent_id') as string) || null;
  const slug = (formData.get('slug') as string)?.trim();
  if (!name_en) return { error: 'English name is required' };

  const updates: Record<string, unknown> = { name_en };
  if (name_zh !== undefined) updates.name_zh = name_zh || null;
  if (type) updates.type = type;
  if (slug) updates.slug = slug;
  updates.parent_id = parent_id || null;

  const { error } = await db().from('regions').update(updates).eq('id', regionId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function deleteRegion(regionId: string) {
  // Remove from site_regions first
  await db().from('site_regions').delete().eq('region_id', regionId);
  const { error } = await db().from('regions').delete().eq('id', regionId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function toggleRegionActive(regionId: string, isActive: boolean) {
  const { error } = await db().from('regions').update({ is_active: isActive }).eq('id', regionId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

// ============================================================
// SITE-REGION LINKS
// ============================================================

export async function addRegionToSite(siteId: string, regionId: string) {
  const { error } = await db().from('site_regions').insert({ site_id: siteId, region_id: regionId, is_primary: false });
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function removeRegionFromSite(siteId: string, regionId: string) {
  const { error } = await db().from('site_regions').delete().eq('site_id', siteId).eq('region_id', regionId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function setPrimaryRegion(siteId: string, regionId: string) {
  // Unset all primary for this site, then set the new one
  await db().from('site_regions').update({ is_primary: false }).eq('site_id', siteId);
  const { error } = await db().from('site_regions').update({ is_primary: true }).eq('site_id', siteId).eq('region_id', regionId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

// ============================================================
// SITE CRUD
// ============================================================

export async function addSite(formData: FormData) {
  const slug = (formData.get('slug') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const locale = (formData.get('locale') as string) || 'zh';
  const domain = (formData.get('domain') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  if (!slug || !name) return { error: 'Slug and name are required' };

  const { error } = await db().from('sites').insert({
    slug, name, name_zh: name_zh || null, locale,
    domain: domain || null, description: description || null, status: 'planned',
  });
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function updateSite(siteId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const locale = (formData.get('locale') as string);
  const domain = (formData.get('domain') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const slug = (formData.get('slug') as string)?.trim();
  if (!name) return { error: 'Name is required' };

  const updates: Record<string, unknown> = { name, updated_at: new Date().toISOString() };
  if (name_zh !== undefined) updates.name_zh = name_zh || null;
  if (locale) updates.locale = locale;
  if (domain !== undefined) updates.domain = domain || null;
  if (description !== undefined) updates.description = description || null;
  if (slug) updates.slug = slug;

  const { error } = await db().from('sites').update(updates).eq('id', siteId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function deleteSite(siteId: string) {
  // site_regions will cascade delete
  const { error } = await db().from('sites').delete().eq('id', siteId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function updateSiteStatus(siteId: string, status: string) {
  const { error } = await db().from('sites').update({ status }).eq('id', siteId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}
