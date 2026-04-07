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
  return cleaned || `import-${Date.now()}`;
}

function extFromContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('jpeg')) return '.jpg';
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('svg')) return '.svg';
  if (normalized.includes('avif')) return '.avif';
  return '';
}

function isAllowedSource(provider: string, host: string) {
  const normalizedHost = host.toLowerCase();
  if (provider === 'unsplash') {
    return normalizedHost.endsWith('images.unsplash.com');
  }
  if (provider === 'pexels') {
    return normalizedHost.endsWith('images.pexels.com');
  }
  return false;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const provider = String(payload?.provider || '').toLowerCase();
    const sourceUrl = String(payload?.sourceUrl || '');
    const folderInput = String(payload?.folder || 'general');

    if (!sourceUrl || !provider) {
      return NextResponse.json(
        { message: 'provider and sourceUrl are required' },
        { status: 400 }
      );
    }
    if (!['unsplash', 'pexels'].includes(provider)) {
      return NextResponse.json({ message: 'Invalid provider' }, { status: 400 });
    }

    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ message: 'Only https URLs are allowed' }, { status: 400 });
    }
    if (!isAllowedSource(provider, parsedUrl.hostname)) {
      return NextResponse.json(
        { message: 'Source URL host is not allowed for this provider' },
        { status: 400 }
      );
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return NextResponse.json(
        { message: `Failed to fetch source image (${response.status})` },
        { status: 502 }
      );
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { message: 'Source file is not an image' },
        { status: 400 }
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const folder = sanitizeFolder(folderInput) || 'general';
    const sourcePathname = parsedUrl.pathname.split('/').pop() || '';
    const sourceExt = path.extname(sourcePathname).toLowerCase();
    const ext = sourceExt || extFromContentType(contentType) || '.jpg';
    const sourceBase = sourcePathname
      ? path.basename(sourcePathname, sourceExt || undefined)
      : `${provider}-image`;
    const filename = `${Date.now()}-${sanitizeFilename(sourceBase)}${ext}`;
    const objectPath = `${folder}/${filename}`;

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
        contentType,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) {
      console.error('Provider import upload error:', uploadError);
      return NextResponse.json({ message: 'Import upload failed' }, { status: 500 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const url = data.publicUrl;

    return NextResponse.json({
      url,
      path: objectPath,
      filename,
      provider,
    });
  } catch (error) {
    console.error('Provider import error:', error);
    return NextResponse.json(
      { message: 'Provider import failed due to a server error.' },
      { status: 500 }
    );
  }
}
