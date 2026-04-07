import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder');

  if (!folder) {
    return NextResponse.json({ message: 'folder is required' }, { status: 400 });
  }

  const normalized = path.posix.normalize(folder);
  if (normalized.startsWith('..') || normalized.includes('../')) {
    return NextResponse.json({ message: 'Invalid folder' }, { status: 400 });
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'media';
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { message: 'Supabase is not configured' },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(normalized, {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('Supabase storage list error:', error);
      return NextResponse.json({ message: 'Failed to list files' }, { status: 500 });
    }

    const items = (data || [])
      .filter((file) => file.name && !file.name.startsWith('.'))
      .map((file) => {
        const filePath = `${normalized}/${file.name}`;
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        return {
          id: file.id || file.name,
          url: urlData.publicUrl,
          path: filePath,
        };
      });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Media list error:', error);
    return NextResponse.json(
      { message: 'Failed to list media files.' },
      { status: 500 }
    );
  }
}
