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
  return cleaned || `ai-image-${Date.now()}`;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeSize(raw: string): '1024x1024' | '1536x1024' | '1024x1536' {
  if (raw === '1024x1024' || raw === '1536x1024' || raw === '1024x1536') return raw;
  return '1536x1024';
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const prompt = String(payload?.prompt || '').trim();
    const folderInput = String(payload?.folder || 'general');
    const size = normalizeSize(String(payload?.size || '1536x1024'));

    if (!prompt) {
      return NextResponse.json({ message: 'prompt is required' }, { status: 400 });
    }
    if (prompt.length > 500) {
      return NextResponse.json({ message: 'prompt is too long (max 500 chars)' }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ message: 'OPENAI_API_KEY is not configured' }, { status: 400 });
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size,
        quality: 'medium',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { message: `OpenAI image generation failed (${response.status})`, detail: text.slice(0, 300) },
        { status: 502 },
      );
    }

    const gen = await response.json() as {
      data?: Array<{ b64_json?: string }>;
    };
    const b64 = gen?.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ message: 'OpenAI returned empty image data' }, { status: 502 });
    }

    const buffer = Buffer.from(b64, 'base64');
    const folder = sanitizeFolder(folderInput) || 'general';
    const filename = `${Date.now()}-${sanitizeFilename(prompt.slice(0, 48))}.png`;
    const objectPath = `${folder}/${filename}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'media';

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ message: 'Supabase is not configured' }, { status: 500 });
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) {
      console.error('AI image upload error:', uploadError);
      return NextResponse.json({ message: 'Failed to save generated image' }, { status: 500 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return NextResponse.json({
      url: data.publicUrl,
      path: objectPath,
      filename,
      provider: 'openai:gpt-image-1',
    });
  } catch (error) {
    console.error('AI image generate error:', error);
    return NextResponse.json(
      { message: 'AI image generation failed due to a server error.' },
      { status: 500 },
    );
  }
}

