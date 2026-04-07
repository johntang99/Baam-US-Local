'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSiteContext } from '@/lib/admin-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

function generateSlug(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 80);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

export async function createArticle(formData: FormData) {
  const supabase = db();
  const ctx = await getAdminSiteContext();
  const titleZh = formData.get('title_zh') as string;
  const slug = (formData.get('slug') as string) || generateSlug(titleZh || 'article');

  const { data, error } = await supabase
    .from('articles')
    .insert({
      title_zh: titleZh,
      title_en: formData.get('title_en') as string,
      content_vertical: formData.get('content_vertical') as string,
      body_zh: formData.get('body_zh') as string,
      body_en: formData.get('body_en') as string,
      editorial_status: (formData.get('editorial_status') as string) || 'draft',
      category_id: formData.get('category_id') as string || null,
      region_id: formData.get('region_id') as string || null,
      source_type: formData.get('source_type') as string || null,
      source_name: formData.get('source_name') as string || null,
      source_url: formData.get('source_url') as string || null,
      seo_title_zh: formData.get('seo_title_zh') as string || null,
      seo_desc_zh: formData.get('seo_desc_zh') as string || null,
      cover_image_url: formData.get('cover_image_url') as string || null,
      audience_types: JSON.parse((formData.get('audience_types') as string) || '[]'),
      site_id: ctx.siteId || null,
      slug,
    })
    .select('id')
    .single();

  revalidatePath('/admin/articles');

  if (error) {
    return { id: null, error: error.message };
  }

  // Sync guide_business_links
  if (data?.id) {
    await syncBusinessLinks(supabase, data.id, formData);
  }

  return { id: data?.id, error: null };
}

async function syncBusinessLinks(supabase: ReturnType<typeof db>, articleId: string, formData: FormData) {
  const linkedIdsRaw = formData.get('linked_business_ids') as string;
  const linkedIds: string[] = linkedIdsRaw ? JSON.parse(linkedIdsRaw) : [];

  // Delete existing links
  await supabase.from('guide_business_links').delete().eq('article_id', articleId);

  // Insert new links
  if (linkedIds.length > 0) {
    const rows = linkedIds.map((bizId: string) => ({
      article_id: articleId,
      business_id: bizId,
      relation_type: 'editorial',
    }));
    await supabase.from('guide_business_links').insert(rows);
  }
}

export async function updateArticle(articleId: string, formData: FormData) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('articles')
    .update({
      title_zh: formData.get('title_zh') as string,
      title_en: formData.get('title_en') as string,
      content_vertical: formData.get('content_vertical') as string,
      body_zh: formData.get('body_zh') as string,
      body_en: formData.get('body_en') as string,
      editorial_status: formData.get('editorial_status') as string,
      category_id: formData.get('category_id') as string || null,
      region_id: formData.get('region_id') as string || null,
      source_type: formData.get('source_type') as string || null,
      source_name: formData.get('source_name') as string || null,
      source_url: formData.get('source_url') as string || null,
      seo_title_zh: formData.get('seo_title_zh') as string || null,
      seo_desc_zh: formData.get('seo_desc_zh') as string || null,
      cover_image_url: formData.get('cover_image_url') as string || null,
      audience_types: JSON.parse((formData.get('audience_types') as string) || '[]'),
    })
    .eq('id', articleId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }

  // Sync guide_business_links
  await syncBusinessLinks(supabase, articleId, formData);

  return { error: null };
}

export async function deleteArticle(articleId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', articleId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function publishArticle(articleId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('articles')
    .update({
      editorial_status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', articleId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function archiveArticle(articleId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('articles')
    .update({ editorial_status: 'archived' })
    .eq('id', articleId)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function bulkPublish(articleIds: string[]) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('articles')
    .update({
      editorial_status: 'published',
      published_at: new Date().toISOString(),
    })
    .in('id', articleIds)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function bulkArchive(articleIds: string[]) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  const { error } = await supabase
    .from('articles')
    .update({ editorial_status: 'archived' })
    .in('id', articleIds)
    .eq('site_id', ctx.siteId);

  revalidatePath('/admin/articles');

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function generateAISummary(articleId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  // Fetch article content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article, error: fetchError } = await (supabase as any)
    .from('articles')
    .select('title_zh, title_en, body_zh, body_en')
    .eq('id', articleId)
    .eq('site_id', ctx.siteId)
    .single();

  if (fetchError || !article) {
    return { error: fetchError?.message || 'Article not found' };
  }

  const bodyText = article.body_zh || article.body_en || '';
  const titleText = article.title_zh || article.title_en || '';

  if (!bodyText && !titleText) {
    return { error: 'Article content is empty, cannot generate summary' };
  }

  try {
    const { generateSummary, generateTags } = await import('@/lib/ai/claude');

    // Generate Chinese summary
    const contentForSummary = `Title: ${titleText}\n\n${bodyText.slice(0, 3000)}`;
    const summaryResult = await generateSummary(contentForSummary, 'zh');

    // Generate tags
    const tagsResult = await generateTags(contentForSummary).catch(() => null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      ai_summary_zh: summaryResult.data,
    };
    if (tagsResult?.data) {
      updateData.ai_tags = tagsResult.data;
    }

    // Also generate English summary if English content exists
    if (article.body_en || article.title_en) {
      const enContent = `Title: ${article.title_en || titleText}\n\n${(article.body_en || bodyText).slice(0, 3000)}`;
      const enResult = await generateSummary(enContent, 'en').catch(() => null);
      if (enResult?.data) {
        updateData.ai_summary_en = enResult.data;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('articles')
      .update(updateData)
      .eq('id', articleId)
      .eq('site_id', ctx.siteId);

    revalidatePath('/admin/articles');

    if (error) return { error: error.message };

    // Log AI job (best-effort, don't fail if this errors)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('ai_jobs').insert({
        job_type: 'summary',
        entity_type: 'article',
        entity_id: articleId,
        status: 'completed',
        model_name: summaryResult.model,
        input_tokens: summaryResult.inputTokens,
        output_tokens: summaryResult.outputTokens,
        cost_usd: ((summaryResult.inputTokens * 0.25 + summaryResult.outputTokens * 1.25) / 1_000_000),
      });
    } catch {
      // ignore logging errors
    }

    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return { error: `AI generation failed: ${message}` };
  }
}

export async function generateAIFAQ(articleId: string) {
  const supabase = db();
  const ctx = await getAdminSiteContext();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article, error: fetchError } = await (supabase as any)
    .from('articles')
    .select('title_zh, title_en, body_zh, body_en')
    .eq('id', articleId)
    .eq('site_id', ctx.siteId)
    .single();

  if (fetchError || !article) {
    return { error: fetchError?.message || 'Article not found' };
  }

  const bodyText = article.body_zh || article.body_en || '';
  const titleText = article.title_zh || article.title_en || '';

  if (!bodyText && !titleText) {
    return { error: 'Article content is empty, cannot generate FAQ' };
  }

  try {
    const { generateFAQ } = await import('@/lib/ai/claude');

    const contentForFAQ = `Title: ${titleText}\n\n${bodyText.slice(0, 4000)}`;
    const faqResult = await generateFAQ(contentForFAQ, 5);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('articles')
      .update({ ai_faq: faqResult.data })
      .eq('id', articleId)
      .eq('site_id', ctx.siteId);

    revalidatePath('/admin/articles');

    if (error) return { error: error.message };
    return { error: null, faq: faqResult.data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return { error: `FAQ generation failed: ${message}` };
  }
}

// ─── AI Article Generation (from scratch or rewrite) ──────────────────

export async function aiGenerateArticle(params: {
  mode: 'generate' | 'rewrite';
  // Generate mode fields
  topic?: string;
  keywords?: string;
  region?: string;
  category?: string;
  style?: string;
  tone?: string;
  audience?: string;
  sourceUrl?: string;
  notes?: string;
  // Rewrite mode fields
  sourceContent?: string;
}) {
  try {
    const { generateArticleFromScratch, rewriteArticle } = await import('@/lib/ai/claude');

    let result;
    if (params.mode === 'rewrite') {
      if (!params.sourceContent?.trim()) {
        return { error: 'Please paste the source content' };
      }
      result = await rewriteArticle({
        sourceContent: params.sourceContent,
        style: params.style,
        tone: params.tone,
        audience: params.audience,
        notes: params.notes,
      });
    } else {
      if (!params.topic?.trim()) {
        return { error: 'Please enter an article topic' };
      }
      result = await generateArticleFromScratch({
        topic: params.topic,
        keywords: params.keywords,
        region: params.region,
        category: params.category,
        style: params.style,
        tone: params.tone,
        audience: params.audience,
        sourceUrl: params.sourceUrl,
        notes: params.notes,
      });
    }

    return {
      error: null,
      article: result.data,
      model: result.model,
      tokens: result.inputTokens + result.outputTokens,
      prompt: (result as { prompt?: string }).prompt || '',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return { error: `AI generation failed: ${message}` };
  }
}
