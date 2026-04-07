import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const folder = formData.get('folder') as string; // e.g. 'businesses/wang-family-medical'

  // Validate — accept images and videos
  const isImage = file?.type.startsWith('image/');
  const isVideo = file?.type.startsWith('video/');
  if (!file || (!isImage && !isVideo)) {
    return NextResponse.json({ error: 'Invalid file type. Accepts images and videos.' }, { status: 400 });
  }

  // Supabase Pro plan: bucket set to 200MB
  if (isVideo && file.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: 'Video must be under 200MB' }, { status: 400 });
  }
  if (isImage && file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 10MB' }, { status: 400 });
  }

  if (!folder) {
    return NextResponse.json({ error: 'Folder is required' }, { status: 400 });
  }

  const supabase = getSupabase();

  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
  const path = `${folder}/${timestamp}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl, path });
}

export async function DELETE(request: Request) {
  try {
    const { path } = await request.json();

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
