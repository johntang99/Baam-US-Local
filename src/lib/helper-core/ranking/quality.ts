/**
 * Quality assessment for RAG answers.
 * Determines how confident we should be in the answer based on evidence coverage.
 * Extracted from NY assistant's evaluateQualityLevel.
 */

import type { QualityLevel } from '../types';

export interface QualityInput {
  hasLocalEvidence: boolean;
  totalResults: number;
  rankingConsistency: number;
  /** Count of primary content type items (e.g., businesses) */
  primaryCount: number;
  /** Count of all other content type items combined */
  secondaryCount: number;
}

/**
 * Evaluate the quality level of a RAG answer.
 *
 * - 'high': Strong coverage with consistent ranking
 * - 'medium': Decent coverage but some gaps
 * - 'low': Insufficient evidence for reliable answers
 */
export function evaluateQualityLevel(input: QualityInput): QualityLevel {
  if (!input.hasLocalEvidence) return 'low';

  const weakCoverage =
    input.totalResults <= 2 ||
    (input.primaryCount === 0 && input.secondaryCount <= 1);
  const strongCoverage =
    input.totalResults >= 6 &&
    (input.primaryCount >= 3 || input.secondaryCount >= 4);

  if (weakCoverage) return 'low';
  if (input.rankingConsistency < 0.75) return 'medium';
  return strongCoverage ? 'high' : 'medium';
}
