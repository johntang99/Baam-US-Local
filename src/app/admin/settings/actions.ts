'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;
const reval = () => revalidatePath('/admin/settings');
const CONTENT_CATEGORY_TABLES = new Set([
  'categories_guide',
  'categories_news',
  'categories_forum',
  'categories_discover',
]);

function resolveContentTable(tableName: string): string | null {
  const normalized = (tableName || '').trim();
  return CONTENT_CATEGORY_TABLES.has(normalized) ? normalized : null;
}

// ============================================================
// BUSINESS CATEGORY CRUD (hierarchical, from `categories` table)
// ============================================================

export async function addCategory(formData: FormData) {
  const slug = (formData.get('slug') as string)?.trim();
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const icon = (formData.get('icon') as string)?.trim();
  const parent_id = (formData.get('parent_id') as string) || null;
  const sort_order = parseInt((formData.get('sort_order') as string) || '0', 10);
  if (!slug || !name_en) return { error: 'Slug and English name are required' };

  const searchTermsRaw = formData.get('search_terms') as string;
  const search_terms = searchTermsRaw ? JSON.parse(searchTermsRaw) : [];

  const { error } = await db().from('categories').insert({
    slug,
    name_en,
    name_zh: name_zh || null,
    type: 'business',
    parent_id: parent_id || null,
    icon: icon || null,
    sort_order: isNaN(sort_order) ? 0 : sort_order,
    search_terms,
    site_scope: 'en',
  });
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function updateCategory(categoryId: string, formData: FormData) {
  const slug = (formData.get('slug') as string)?.trim();
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const icon = (formData.get('icon') as string)?.trim();
  const parent_id = (formData.get('parent_id') as string) || null;
  const sort_order = parseInt((formData.get('sort_order') as string) || '0', 10);
  if (!name_en) return { error: 'English name is required' };

  const searchTermsRaw = formData.get('search_terms') as string;
  const search_terms = searchTermsRaw ? JSON.parse(searchTermsRaw) : [];

  const updates: Record<string, unknown> = {
    name_en,
    name_zh: name_zh || null,
    icon: icon || null,
    parent_id: parent_id || null,
    sort_order: isNaN(sort_order) ? 0 : sort_order,
    search_terms,
  };
  if (slug) updates.slug = slug;

  const { error } = await db().from('categories').update(updates).eq('id', categoryId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function deleteCategory(categoryId: string) {
  await db().from('categories').delete().eq('parent_id', categoryId);
  const { error } = await db().from('categories').delete().eq('id', categoryId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

// ============================================================
// CONTENT CATEGORY CRUD (flat, for categories_guide/news/forum/discover)
// ============================================================

export async function updateCategoryBasic(categoryId: string, formData: FormData) {
  const requestedTable = (formData.get('table_name') as string) || '';
  const tableName = resolveContentTable(requestedTable);
  const slug = (formData.get('slug') as string)?.trim();
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const icon = (formData.get('icon') as string)?.trim();
  const sort_order = parseInt((formData.get('sort_order') as string) || '0', 10);
  const is_active = (formData.get('is_active') as string) === 'true';

  if (!slug || !name_en) return { error: 'Slug and English name are required' };
  if (!tableName) return { error: 'Invalid category table' };

  const updates: Record<string, unknown> = {
    slug,
    name_en,
    name_zh: name_zh || null,
    icon: icon || null,
    sort_order: isNaN(sort_order) ? 0 : sort_order,
    is_active,
  };
  const site_scope = ((formData.get('site_scope') as string) || '').trim().toLowerCase();
  if (site_scope === 'zh' || site_scope === 'en') {
    updates.site_scope = site_scope;
  }

  const { error } = await db().from(tableName).update(updates).eq('id', categoryId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function addCategoryBasic(formData: FormData) {
  const requestedTable = (formData.get('table_name') as string) || '';
  const tableName = resolveContentTable(requestedTable);
  const slug = (formData.get('slug') as string)?.trim();
  const name_en = (formData.get('name_en') as string)?.trim();
  const name_zh = (formData.get('name_zh') as string)?.trim();
  const icon = (formData.get('icon') as string)?.trim();
  const sort_order = parseInt((formData.get('sort_order') as string) || '0', 10);
  const is_active = (formData.get('is_active') as string) !== 'false';
  const site_scope = ((formData.get('site_scope') as string) || '').trim().toLowerCase();

  if (!slug || !name_en) return { error: 'Slug and English name are required' };
  if (!tableName) return { error: 'Invalid category table' };

  const { error } = await db().from(tableName).insert({
    slug,
    name_en,
    name_zh: name_zh || null,
    icon: icon || null,
    sort_order: isNaN(sort_order) ? 0 : sort_order,
    is_active,
    site_scope: site_scope === 'en' ? 'en' : 'zh',
  });
  if (error) return { error: error.message };
  reval();
  return { success: true };
}

export async function deleteCategoryBasic(categoryId: string, formData: FormData) {
  const requestedTable = (formData.get('table_name') as string) || '';
  const tableName = resolveContentTable(requestedTable);
  if (!tableName) return { error: 'Invalid category table' };
  const { error } = await db().from(tableName).delete().eq('id', categoryId);
  if (error) return { error: error.message };
  reval();
  return { success: true };
}
