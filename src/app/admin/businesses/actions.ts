'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

function generateSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 80);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

function extractBusinessFields(formData: FormData) {
  return {
    display_name: formData.get('display_name') as string,
    display_name_zh: formData.get('display_name_zh') as string,
    short_desc_zh: (formData.get('short_desc_zh') as string) || null,
    full_desc_zh: (formData.get('full_desc_zh') as string) || null,
    address_full: (formData.get('address_full') as string) || null,
    city: (formData.get('city') as string) || null,
    state: (formData.get('state') as string) || null,
    zip_code: (formData.get('zip_code') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    website_url: (formData.get('website_url') as string) || null,

    facebook_url: (formData.get('facebook_url') as string) || null,
    instagram_url: (formData.get('instagram_url') as string) || null,
    tiktok_url: (formData.get('tiktok_url') as string) || null,
    youtube_url: (formData.get('youtube_url') as string) || null,
    twitter_url: (formData.get('twitter_url') as string) || null,
    video_url: (formData.get('video_url') as string) || null,
    status: (formData.get('status') as string) || 'active',
    verification_status: (formData.get('verification_status') as string) || 'unverified',
    current_plan: (formData.get('current_plan') as string) || 'free',
    is_featured: formData.get('is_featured') === 'true',
  };
}

function parseCategoryIds(formData: FormData): string[] {
  const raw = formData.get('category_ids') as string;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function syncBusinessCategories(supabase: ReturnType<typeof db>, businessId: string, categoryIds: string[]) {
  // Delete existing
  await supabase
    .from('business_categories')
    .delete()
    .eq('business_id', businessId);

  // Insert new ones
  if (categoryIds.length > 0) {
    const rows = categoryIds.map((catId) => ({
      business_id: businessId,
      category_id: catId,
    }));
    await supabase.from('business_categories').insert(rows);
  }
}

export async function createBusiness(formData: FormData) {
  const supabase = db();
  const fields = extractBusinessFields(formData);
  const slug = generateSlug(fields.display_name || 'business');
  const categoryIds = parseCategoryIds(formData);

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      ...fields,
      slug,
    })
    .select('id')
    .single();

  if (error) {
    revalidatePath('/admin/businesses');
    return { id: null, error: error.message };
  }

  // Sync categories
  if (data?.id) {
    await syncBusinessCategories(supabase, data.id, categoryIds);
  }

  revalidatePath('/admin/businesses');
  return { id: data?.id, error: null };
}

export async function updateBusiness(bizId: string, formData: FormData) {
  const supabase = db();
  const fields = extractBusinessFields(formData);
  const categoryIds = parseCategoryIds(formData);

  const { error } = await supabase
    .from('businesses')
    .update(fields)
    .eq('id', bizId);

  if (error) {
    revalidatePath('/admin/businesses');
    return { error: error.message };
  }

  // Sync categories
  await syncBusinessCategories(supabase, bizId, categoryIds);

  revalidatePath('/admin/businesses');
  return { error: null };
}

export async function deleteBusiness(bizId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('businesses')
    .delete()
    .eq('id', bizId);

  revalidatePath('/admin/businesses');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function approveClaim(claimId: string) {
  const supabase = db();

  // Get the claim to find the business_id
  const { data: claim } = await supabase
    .from('business_claim_requests')
    .select('business_id')
    .eq('id', claimId)
    .single();

  if (!claim) {
    return { error: 'Claim not found' };
  }

  // Update claim status
  const { error: claimError } = await supabase
    .from('business_claim_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', claimId);

  if (claimError) {
    return { error: claimError.message };
  }

  // Update business status to claimed
  const { error: bizError } = await supabase
    .from('businesses')
    .update({ status: 'claimed' })
    .eq('id', claim.business_id);

  revalidatePath('/admin/businesses');

  if (bizError) {
    return { error: bizError.message };
  }
  return { error: null };
}

export async function rejectClaim(claimId: string) {
  const supabase = db();

  const { error } = await supabase
    .from('business_claim_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', claimId);

  revalidatePath('/admin/businesses');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function toggleFeatured(bizId: string, featured: boolean) {
  const supabase = db();

  const { error } = await supabase
    .from('businesses')
    .update({ is_featured: featured })
    .eq('id', bizId);

  revalidatePath('/admin/businesses');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
