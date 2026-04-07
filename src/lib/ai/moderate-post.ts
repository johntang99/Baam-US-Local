import Anthropic from '@anthropic-ai/sdk';

interface ModerationResult {
  pass: boolean;
  score: number;
  reason: string | null;
}

const SPAM_THRESHOLD = 0.6;

export async function moderateDiscoverPost(
  title: string,
  content: string
): Promise<ModerationResult> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const text = [title, content].filter(Boolean).join('\n');
    if (!text || text.length < 3) {
      return { pass: true, score: 0, reason: null };
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You are a content moderator for a Chinese community platform in New York. Check the post for:
1. Spam or excessive advertising
2. Inappropriate/offensive content
3. Gibberish or nonsensical text
4. Scams or phishing

Return JSON only: {"pass": true/false, "score": 0.0-1.0, "reason": "..." or null}
- score 0.0 = clearly safe, 1.0 = clearly spam/harmful
- pass=false if score >= ${SPAM_THRESHOLD}
- reason should be in Chinese, brief (e.g. "疑似广告" or "内容不当")
- Most normal posts about food, life, businesses, etc. should pass easily`,
      messages: [{ role: 'user', content: `审核以下帖子内容：\n\n${text.slice(0, 1000)}` }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { pass: true, score: 0, reason: null };

    const result = JSON.parse(jsonMatch[0]) as ModerationResult;
    return {
      pass: result.score < SPAM_THRESHOLD,
      score: result.score,
      reason: result.reason || null,
    };
  } catch {
    // If moderation fails, don't block the post
    return { pass: true, score: 0, reason: null };
  }
}
