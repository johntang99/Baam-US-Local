/**
 * Follow-up detection: FOLLOWUP / SEARCH / NEW classification.
 * Determines if a query continues the current conversation or needs fresh retrieval.
 * Extracted from NY assistant's follow-up detection logic.
 */

import type { FollowUpClassification, HelperMessage, LocaleKit, ProviderRouter } from '../types';

/**
 * Classify whether a query is a follow-up, needs fresh search, or is a new topic.
 * Returns null if classification fails (caller should fall through to full search).
 */
export async function classifyFollowUp(
  router: ProviderRouter,
  localeKit: LocaleKit,
  query: string,
  history: HelperMessage[],
): Promise<FollowUpClassification | null> {
  if (history.length < 2) return null;

  try {
    const lastAssistant = [...history]
      .reverse()
      .find((m) => m.role === 'assistant')
      ?.content.slice(0, 300) || '';

    if (!lastAssistant) return null;

    const response = await router.complete<string>('classify', {
      system: localeKit.buildFollowUpPrompt(query, lastAssistant),
      prompt: `Previous assistant reply (excerpt): "${lastAssistant}"\n\nNew user message: "${query}"`,
      maxTokens: 10,
    });

    const classification = String(response.data).trim().toUpperCase();
    if (['FOLLOWUP', 'SEARCH', 'NEW'].includes(classification)) {
      return classification as FollowUpClassification;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a follow-up response using conversation context only (no RAG search).
 */
export async function generateFollowUpAnswer(
  router: ProviderRouter,
  localeKit: LocaleKit,
  assistantName: string,
  siteName: string,
  query: string,
  history: HelperMessage[],
  maxTokens: number,
): Promise<{ answer: string; model: string; provider: string }> {
  const systemPrompt = localeKit.buildFollowUpSystemPrompt(assistantName, siteName);

  const messages = history.slice(-8).map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // For follow-up, we pass the full conversation as the prompt
  const conversationText = [
    ...messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`),
    `User: ${query}`,
  ].join('\n\n');

  const response = await router.complete<string>('answer', {
    system: systemPrompt,
    prompt: conversationText,
    maxTokens,
  });

  return {
    answer: String(response.data || '').trim(),
    model: response.model,
    provider: `${response.provider}:${response.model}`,
  };
}
