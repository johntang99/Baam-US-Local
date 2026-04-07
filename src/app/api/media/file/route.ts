import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const filePath = String(body?.path || '');

    if (!filePath) {
      return NextResponse.json({ message: 'path is required' }, { status: 400 });
    }

    const normalized = path.posix.normalize(filePath);
    if (normalized.startsWith('..') || normalized.includes('../')) {
      return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'media';
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { message: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const { error } = await supabase.storage.from(bucket).remove([normalized]);
    if (error) {
      console.error('Supabase storage delete error:', error);
      return NextResponse.json({ message: 'Delete failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Media delete error:', error);
    return NextResponse.json(
      { message: 'Delete failed due to a server error.' },
      { status: 500 }
    );
  }
}
