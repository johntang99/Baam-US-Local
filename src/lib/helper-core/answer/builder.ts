/**
 * Answer prompt assembly.
 * Delegates to LocaleKit for locale-specific prompt text.
 * Handles quality-based mode selection and evidence constraints.
 */

import type { HelperMessage, HelperIntent, LocaleKit, QualityLevel } from '../types';

export interface AnswerPromptInput {
  query: string;
  intent: HelperIntent;
  qualityLevel: QualityLevel;
  contextParts: string[];
  hasLocalEvidence: boolean;
  totalResults: number;
  strictEvidenceMode: boolean;
  history: HelperMessage[];
  usedWebFallback: boolean;
  webContextBlocks: string[];
  webCounts: Record<string, number>;
}

/**
 * Build the system prompt with quality-based mode modifiers.
 */
export function buildEffectiveSystemPrompt(
  localeKit: LocaleKit,
  assistantName: string,
  siteName: string,
  qualityLevel: QualityLevel,
  strictEvidenceMode: boolean,
): string {
  const basePrompt = localeKit.buildSystemPrompt(assistantName, siteName);

  if (qualityLevel === 'low') {
    const lowEvidenceNote = localeKit.locale === 'zh'
      ? `\n\n【低证据模式】\n- 回答时先给"证据不足声明"\n- 不给具体商家结论，只给检索建议和补充提问\n- 结尾必须提供3个可执行下一步${strictEvidenceMode ? '\n- 强证据模式开启：禁止输出任何无证据支撑的细节。' : ''}`
      : `\n\n[LOW EVIDENCE MODE]\n- Start with an evidence disclaimer\n- Don't give specific conclusions, only suggest next steps\n- End with 3 actionable suggestions${strictEvidenceMode ? '\n- Strict evidence mode: do not output any unsupported claims.' : ''}`;
    return basePrompt + lowEvidenceNote;
  }

  if (strictEvidenceMode) {
    const strictNote = localeKit.locale === 'zh'
      ? `\n\n【强证据模式】\n- 仅可引用已提供证据中的事实\n- 若证据不充分，明确写"未检索到足够本地数据"并提出补充问题`
      : `\n\n[STRICT EVIDENCE MODE]\n- Only cite facts from the provided evidence\n- If evidence is insufficient, state clearly and ask for more details`;
    return basePrompt + strictNote;
  }

  return basePrompt;
}

/**
 * Build the user prompt using the LocaleKit's implementation.
 */
export function buildAnswerUserPrompt(
  localeKit: LocaleKit,
  input: AnswerPromptInput,
): string {
  return localeKit.buildUserPrompt({
    query: input.query,
    intent: input.intent,
    qualityLevel: input.qualityLevel,
    contextParts: input.contextParts,
    hasLocalEvidence: input.hasLocalEvidence,
    totalResults: input.totalResults,
    strictEvidenceMode: input.strictEvidenceMode,
    history: input.history,
    usedWebFallback: input.usedWebFallback,
    webContextBlocks: input.webContextBlocks,
    webCounts: input.webCounts,
  });
}
