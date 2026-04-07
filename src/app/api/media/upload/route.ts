import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function sanitizeFolder(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '');
  if (!cleaned) return '';
  const normalized = path.posix.normalize(cleaned);
  if (normalized.startsWith('..') || normalized.includes('../')) {
    return '';
  }
  return normalized;
}

function sanitizeFilename(value: string) {
  const lower = value.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9.-]/g, '-').replace(/-+/g, '-');
  return cleaned || `upload-${Date.now()}`;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const folderInput = formData.get('folder');
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'file is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { message: 'Only image uploads are supported' },
        { status: 400 }
      );
    }

    const folder =
      typeof folderInput === 'string' ? sanitizeFolder(folderInput) : 'general';
    if (!folder) {
      return NextResponse.json({ message: 'folder is required' }, { status: 400 });
    }

    const safeName = sanitizeFilename(file.name);
    const filename = `${Date.now()}-${safeName}`;
    const objectPath = folder ? `${folder}/${filename}` : filename;
    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'media';

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { message: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });
    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return NextResponse.json({ message: 'Upload failed' }, { status: 500 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const url = data.publicUrl;

    return NextResponse.json({ url, path: objectPath, filename });
  } catch (error) {
    console.error('Media upload error:', error);
    return NextResponse.json(
      { message: 'Upload failed due to a server error.' },
      { status: 500 }
    );
  }
}
