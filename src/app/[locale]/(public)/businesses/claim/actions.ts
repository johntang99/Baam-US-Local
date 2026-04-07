'use server';

import { getCurrentUser } from '@/lib/auth';
import { getCurrentSite } from '@/lib/sites';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function submitBusinessClaim(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };
  const site = await getCurrentSite();

  const displayName = (formData.get('display_name') as string)?.trim();
  const categoryId = formData.get('category_id') as string;
  const phone = (formData.get('phone') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();
  const address = (formData.get('address') as string)?.trim();
  const website = (formData.get('website') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();

  if (!displayName || !categoryId || !phone) {
    return { error: 'Please fill in the business name, category, and phone number' };
  }

  // Generate slug
  const slug = displayName
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) + '-' + Date.now().toString(36);

  const supabase = createAdminClient();

  // Create business with "unclaimed" status (pending review)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business, error } = await (supabase as any)
    .from('businesses')
    .insert({
      slug,
      display_name: displayName,
      display_name_zh: displayName,
      phone,
      email: email || null,
      website_url: website || null,
      short_desc_zh: description || null,
      status: 'unclaimed',
      verification_status: 'pending',
      claimed_by_user_id: user.id,
      claimed_at: new Date().toISOString(),
      site_id: site.id,
      is_active: false, // Not visible until approved
    })
    .select('id')
    .single();

  if (error) return { error: 'Submission failed: ' + error.message };

  // Add business-category link
  if (business?.id && categoryId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('business_categories')
      .insert({ business_id: business.id, category_id: categoryId, is_primary: true });
  }

  // Create a claim record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('business_claims')
    .insert({
      business_id: business?.id,
      user_id: user.id,
      status: 'pending',
    }).catch(() => {}); // Claims table might not exist

  // Add address to business_locations if provided
  if (address && business?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('business_locations')
      .insert({
        business_id: business.id,
        address_full: address,
        is_primary: true,
      }).catch(() => {});
  }

  revalidatePath('/businesses');
  return { error: null };
}
