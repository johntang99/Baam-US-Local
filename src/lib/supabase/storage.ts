import { createClient } from './client';

/**
 * Single storage bucket name from environment.
 * All files organized by folder prefix: avatars/, covers/, articles/, businesses/, etc.
 */
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || 'media';

export type MediaFolder =
  | 'avatars'
  | 'covers'
  | 'articles'
  | 'businesses'
  | 'forum'
  | 'voices'
  | 'events'
  | 'classifieds';

/**
 * Upload an image to Supabase Storage.
 * Files stored under `{folder}/{userId}/{timestamp}.{ext}` in the single `media` bucket.
 */
export async function uploadImage(
  folder: MediaFolder,
  file: File,
  userId: string
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const supabase = createClient();
  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${folder}/${userId}/${timestamp}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return { error: error.message };
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return { path, publicUrl: urlData.publicUrl };
}

/**
 * Get the public URL for a stored file.
 */
export function getPublicUrl(path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteImage(path: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) return { error: error.message };
  return {};
}
