'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentSite } from '@/lib/sites';
import { revalidatePath } from 'next/cache';
import { moderateDiscoverPost } from '@/lib/ai/moderate-post';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> extends infer T ? T : any;

// ─── Newsletter Subscription ──────────────────────────────────────────

export async function subscribeNewsletter(formData: FormData) {
  const email = formData.get('email') as string;
  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address' };
  }

  const source = (formData.get('source') as string) || 'footer';
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('newsletter_subscribers')
    .upsert(
      { email, source, language: 'zh', status: 'active' },
      { onConflict: 'email,region_id' }
    );

  if (error) {
    if (error.code === '23505') {
      return { success: true, message: 'You are already subscribed' };
    }
    return { error: 'Subscription failed, please try again later' };
  }

  return { success: true, message: 'Subscribed successfully! Thanks for following us' };
}

// ─── Forum: Create Thread ─────────────────────────────────────────────

export async function createForumThread(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'UNAUTHORIZED' };
  }

  const boardId = formData.get('board_id') as string;
  const title = (formData.get('title') as string)?.trim();
  const body = (formData.get('body') as string)?.trim();
  const tagsRaw = (formData.get('tags') as string)?.trim();

  if (!boardId || !title || !body) {
    return { error: 'Please fill in the board, title, and content' };
  }

  if (title.length > 120) {
    return { error: 'Title must be 120 characters or fewer' };
  }

  // Generate slug
  const slug = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Date.now().toString(36);

  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // Get board slug for redirect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: board } = await (supabase as any)
    .from('categories_forum')
    .select('slug')
    .eq('id', boardId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thread, error } = await (supabase as any)
    .from('forum_threads')
    .insert({
      slug,
      title,
      title_zh: title,
      body,
      board_id: boardId,
      author_id: user.id,
      author_name: user.displayName,
      region_id: user.regionId,
      site_id: site.id,
      language: 'zh',
      status: 'published',
      ai_tags: tags,
    })
    .select('slug')
    .single();

  if (error) {
    return { error: 'Failed to post: ' + error.message };
  }

  const boardSlug = board?.slug || 'general';
  revalidatePath(`/forum/${boardSlug}`);

  return { success: true, redirect: `/forum/${boardSlug}/${thread?.slug}` };
}

// ─── Forum: Create Reply ──────────────────────────────────────────────

export async function createForumReply(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'UNAUTHORIZED' };
  }

  const threadId = formData.get('thread_id') as string;
  const body = (formData.get('body') as string)?.trim();

  if (!threadId || !body) {
    return { error: 'Please enter your reply' };
  }

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('forum_replies')
    .insert({
      thread_id: threadId,
      author_id: user.id,
      author_name: user.displayName,
      body,
      site_id: site.id,
      status: 'published',
    });

  if (error) {
    return { error: 'Reply failed: ' + error.message };
  }

  // Update thread's last_replied_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('forum_threads')
    .update({ last_replied_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('site_id', site.id);

  revalidatePath(`/forum`);
  return { success: true };
}

// ─── Voices: Create Post ──────────────────────────────────────────────

export async function createVoicePost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'UNAUTHORIZED' };
  }

  const title = (formData.get('title') as string)?.trim();
  const content = (formData.get('content') as string)?.trim();
  const postType = (formData.get('post_type') as string) || 'short_post';
  const tagsRaw = (formData.get('tags') as string)?.trim();

  if (!content) {
    return { error: 'Please enter content' };
  }

  const slug = (title || content.slice(0, 30))
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Date.now().toString(36);

  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post, error } = await (supabase as any)
    .from('voice_posts')
    .insert({
      author_id: user.id,
      post_type: postType,
      title: title || null,
      slug,
      content,
      content_zh: content,
      visibility: 'public',
      status: 'published',
      region_id: user.regionId,
      site_id: site.id,
      language: 'zh',
      topic_tags: tags,
    })
    .select('slug')
    .single();

  if (error) {
    return { error: 'Failed to publish: ' + error.message };
  }

  revalidatePath(`/voices/${user.username}`);
  return { success: true, redirect: `/voices/${user.username}/posts/${post?.slug}` };
}

// ─── Discover: Create Post (extended with images, businesses, topics, location) ──

export async function createDiscoverPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'UNAUTHORIZED' };
  }

  const title = (formData.get('title') as string)?.trim();
  const content = (formData.get('content') as string)?.trim();
  const postType = (formData.get('post_type') as string) || 'note';
  const tagsRaw = (formData.get('tags') as string)?.trim();
  const coverImagesRaw = (formData.get('cover_images') as string)?.trim();
  const videoUrl = (formData.get('video_url') as string)?.trim() || null;
  const videoThumbnailUrl = (formData.get('video_thumbnail_url') as string)?.trim() || null;
  const videoDurationRaw = (formData.get('video_duration') as string)?.trim();
  const videoDuration = videoDurationRaw ? parseInt(videoDurationRaw, 10) : null;
  const locationText = (formData.get('location_text') as string)?.trim() || null;
  const businessIdsRaw = (formData.get('business_ids') as string)?.trim();

  if (!content && !title) {
    return { error: 'Please enter a title or content' };
  }

  const slug = (title || content?.slice(0, 30) || '')
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) + '-' + Date.now().toString(36);

  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  const coverImages = coverImagesRaw
    ? JSON.parse(coverImagesRaw) as string[]
    : [];

  const businessIds = businessIdsRaw
    ? JSON.parse(businessIdsRaw) as string[]
    : [];

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // AI moderation check
  const moderation = await moderateDiscoverPost(title || '', content || '');
  const postStatus = moderation.pass ? 'published' : 'pending_review';

  // Insert post
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post, error } = await (supabase as any)
    .from('voice_posts')
    .insert({
      author_id: user.id,
      post_type: postType,
      title: title || null,
      slug,
      content: content || '',
      visibility: 'public',
      status: postStatus,
      published_at: new Date().toISOString(),
      ai_spam_score: moderation.score,
      moderation_reason: moderation.reason,
      region_id: user.regionId,
      site_id: site.id,
      language: 'zh',
      topic_tags: tags,
      cover_images: coverImages.length > 0 ? coverImages : null,
      cover_image_url: coverImages[0] || videoThumbnailUrl || null,
      video_url: videoUrl,
      video_thumbnail_url: videoThumbnailUrl,
      video_duration_seconds: videoDuration,
      location_text: locationText,
      aspect_ratio: postType === 'video' ? '16:9' : '4:3',
    })
    .select('id, slug')
    .single();

  if (error) {
    return { error: 'Failed to publish: ' + error.message };
  }

  // Link businesses
  if (businessIds.length > 0 && post?.id) {
    const bizLinks = businessIds.slice(0, 5).map((bizId: string, i: number) => ({
      post_id: post.id,
      business_id: bizId,
      sort_order: i,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('discover_post_businesses').insert(bizLinks);
  }

  // Link topics (match tags to discover_topics)
  if (tags.length > 0 && post?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchedTopics } = await (supabase as any)
      .from('discover_topics')
      .select('id, name_zh')
      .in('name_zh', tags);

    if (matchedTopics && matchedTopics.length > 0) {
      const topicLinks = matchedTopics.map((t: { id: string }) => ({
        post_id: post.id,
        topic_id: t.id,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('discover_post_topics').insert(topicLinks);
    }
  }

  revalidatePath('/discover');
  return { success: true, redirect: `/discover/${post?.slug}`, moderated: postStatus === 'pending_review' };
}

// ─── Discover: Search Businesses (for business linker) ──

export async function searchBusinesses(query: string) {
  if (!query || query.length < 1) return { businesses: [] };

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('businesses')
    .select('id, slug, display_name, display_name_zh, short_desc_zh, address_line1')
    .or(`display_name.ilike.%${query}%,display_name_zh.ilike.%${query}%`)
    .eq('site_id', site.id)
    .eq('status', 'active')
    .limit(8);

  return { businesses: data || [] };
}

// ─── Discover: Delete Post ──

export async function deleteDiscoverPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const postId = formData.get('post_id') as string;
  if (!postId) return { error: 'Missing post ID' };

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post } = await (supabase as any)
    .from('voice_posts')
    .select('id, author_id')
    .eq('id', postId)
    .eq('site_id', site.id)
    .single();

  if (!post || post.author_id !== user.id) {
    return { error: 'You do not have permission to delete this post' };
  }

  // Delete linked topics and businesses first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('discover_post_topics').delete().eq('post_id', postId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('discover_post_businesses').delete().eq('post_id', postId);

  // Delete the post
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('voice_posts')
    .delete()
    .eq('id', postId)
    .eq('site_id', site.id);

  if (error) return { error: 'Delete failed: ' + error.message };

  revalidatePath('/discover');
  return { success: true };
}

// ─── Follow / Unfollow ────────────────────────────────────────────────

export async function toggleFollow(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const profileId = formData.get('profile_id') as string;
  if (!profileId || profileId === user.id) return { error: 'Invalid action' };

  const supabase = createAdminClient();

  // Check if already following
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('follows')
    .select('id')
    .eq('follower_user_id', user.id)
    .eq('followed_profile_id', profileId)
    .single();

  if (existing) {
    // Unfollow
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('follows')
      .delete()
      .eq('follower_user_id', user.id)
      .eq('followed_profile_id', profileId);
    return { success: true, following: false };
  } else {
    // Follow
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('follows')
      .insert({ follower_user_id: user.id, followed_profile_id: profileId });
    return { success: true, following: true };
  }
}

// ─── Like Voice Post ──────────────────────────────────────────────────

export async function toggleLike(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const postId = formData.get('post_id') as string;
  if (!postId) return { error: 'Invalid action' };

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('voice_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('voice_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id);
    return { success: true, liked: false };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('voice_post_likes')
      .insert({ post_id: postId, user_id: user.id });
    return { success: true, liked: true };
  }
}

// ─── Comment on Voice Post ────────────────────────────────────────────

export async function createVoiceComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'UNAUTHORIZED' };

  const postId = formData.get('post_id') as string;
  const content = (formData.get('content') as string)?.trim();

  if (!postId || !content) return { error: 'Please enter a comment' };

  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('voice_post_comments')
    .insert({
      post_id: postId,
      author_id: user.id,
      site_id: site.id,
      content,
      status: 'approved',
    });

  if (error) return { error: 'Comment failed: ' + error.message };

  revalidatePath('/voices');
  return { success: true };
}

// ─── Lead Capture Form ────────────────────────────────────────────────

export async function submitLead(formData: FormData) {
  const businessId = formData.get('business_id') as string;
  const sourceType = (formData.get('source_type') as string) || 'business_page';
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();
  const message = (formData.get('message') as string)?.trim();

  if (!name && !email && !phone) {
    return { error: 'Please provide at least one contact method' };
  }

  const user = await getCurrentUser().catch(() => null);
  const supabase = createAdminClient();
  const site = await getCurrentSite();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('leads')
    .insert({
      business_id: businessId || null,
      source_type: sourceType,
      site_id: site.id,
      source_article_id: formData.get('source_article_id') || null,
      user_id: user?.id || null,
      contact_name: name || null,
      contact_email: email || null,
      contact_phone: phone || null,
      message: message || null,
      preferred_contact: phone ? 'phone' : email ? 'email' : 'phone',
      status: 'new',
    });

  if (error) return { error: 'Submission failed, please try again later' };

  return { success: true, message: 'Submitted successfully! The business will contact you soon.' };
}
