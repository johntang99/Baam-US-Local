// ─── Core value types ──────────────────────────────────────────────

export type HelperRole = 'user' | 'assistant';

export type HelperIntent =
  | 'followup'
  | 'localRecommendation'
  | 'localLookup'
  | 'guideMode'
  | 'discoverMode'
  | 'freshInfo'
  | 'broadWeb'
  | 'community'
  | 'newsEvents'
  | 'comparison';

export type ProviderTask = 'classify' | 'keywords' | 'answer';
export type ProviderKind = 'openai' | 'anthropic';
export type QualityLevel = 'high' | 'medium' | 'low';
export type FollowUpClassification = 'FOLLOWUP' | 'SEARCH' | 'NEW';

// ─── Messages & Sources ────────────────────────────────────────────

export interface HelperMessage {
  role: HelperRole;
  content: string;
}

export interface SourceItem {
  type: string;
  title: string;
  url: string;
  snippet?: string;
  isExternal?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Content Type Configuration ────────────────────────────────────

export interface ContentTypeConfig {
  /** Internal key, e.g., 'businesses', 'services', 'blogs' */
  key: string;
  /** Display label shown to users, e.g., '商家', 'Service' */
  label: string;
  /** URL path prefix for links, e.g., '/businesses/' */
  pathPrefix: string;
  /** Relevance threshold for filtering (0-1). Default 0.2 */
  relevanceMin?: number;
  /** Maximum items in context. Default 8 for primary, 4 for others */
  maxContext?: number;
  /** Maximum items in sources list. Default 12 for primary, 4 for others */
  maxSources?: number;
  /** Is this the primary type that gets table/ranking treatment? */
  isPrimary?: boolean;
}

// ─── Retrieval ─────────────────────────────────────────────────────

export interface SearchParams {
  query: string;
  keywords: string[];
  intent: HelperIntent;
  locale: string;
  siteContext: Record<string, unknown>;
}

export interface RetrievalPayload {
  sources: SourceItem[];
  contextBlocks: string[];
  counts: Record<string, number>;
  businessCandidates?: SourceItem[];
}

export interface ContentFetcher {
  search(params: SearchParams): Promise<RetrievalPayload>;
}

// ─── Intent ────────────────────────────────────────────────────────

export interface IntentDecision {
  intent: HelperIntent;
  needsWeb: boolean;
  reason?: string;
}

// ─── Service Intent (locale plugins provide these) ─────────────────

export interface ServiceIntentProfile {
  key: string;
  entityRegex: RegExp;
  fallbackOr: string;
  countOr?: string;
}

// ─── Provider ──────────────────────────────────────────────────────

export interface ProviderRequest {
  task: ProviderTask;
  system: string;
  prompt: string;
  maxTokens?: number;
  json?: boolean;
}

export interface ProviderResponse<T = string> {
  data: T;
  model: string;
  provider: ProviderKind;
}

export interface ProviderClient {
  kind: ProviderKind;
  isAvailable(): boolean;
  complete<T = string>(request: ProviderRequest): Promise<ProviderResponse<T>>;
}

export interface ProviderRouter {
  complete<T = string>(task: ProviderTask, request: Omit<ProviderRequest, 'task'>): Promise<ProviderResponse<T>>;
}

// ─── LocaleKit (helper-zh / helper-en implement this) ──────────────

export interface UserPromptParams {
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

export interface LocaleKit {
  locale: 'zh' | 'en';

  /** System prompt for answer generation */
  buildSystemPrompt(assistantName: string, siteName: string): string;

  /** User prompt with retrieval context */
  buildUserPrompt(params: UserPromptParams): string;

  /** Prompt for AI intent classification */
  buildIntentPrompt(query: string, history: HelperMessage[]): string;

  /** Prompt for AI keyword extraction */
  buildKeywordPrompt(query: string, siteDescription: string): string;

  /** Heuristic intent guess without AI call */
  guessIntent(query: string, history: HelperMessage[]): IntentDecision;

  /** Fallback keyword extraction without AI call */
  fallbackKeywords(query: string): string[];

  /** Prompt for follow-up classification */
  buildFollowUpPrompt(query: string, lastAssistantExcerpt: string): string;

  /** System prompt for follow-up continuation */
  buildFollowUpSystemPrompt(assistantName: string, siteName: string): string;

  /** Mode-specific instructions appended to answer prompt */
  buildModeInstructions(intent: HelperIntent): string;

  /** Detect service-specific intent (dental, lawyer, etc.) — optional */
  detectServiceIntent?(query: string, keywords: string[]): ServiceIntentProfile | null;

  /** Extract service constraints from query — optional */
  extractServiceConstraints?(query: string): string[];

  /** Locale-specific UI messages */
  messages: {
    emptyQueryError: string;
    fallbackError: string;
    noResultsMessage: (query: string) => string;
  };
}

// ─── Site Configuration ────────────────────────────────────────────

export interface HelperSiteConfig {
  siteName: string;
  assistantName: string;
  siteDescription: string;
  contentTypes: ContentTypeConfig[];
  fetcher: ContentFetcher;
  localeKit: LocaleKit;
  siteContext: Record<string, unknown>;
  providers: {
    strategy: 'hybrid' | 'openai' | 'anthropic';
    openAiApiKey?: string;
    openAiModel?: string;
    anthropicApiKey?: string;
    anthropicModel?: string;
  };
  features?: {
    webFallbackEnabled?: boolean;
    telemetryEnabled?: boolean;
    strictEvidenceMode?: boolean;
    fastMode?: boolean;
    answerMaxTokens?: number;
  };
  /** Optional: Supabase admin client for telemetry logging */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin?: any;
}

// ─── Result ────────────────────────────────────────────────────────

export interface HelperDebugInfo {
  keywords: string[];
  systemPrompt: string;
  userPrompt: string;
  model: string;
  totalResults: number;
  qualityLevel?: QualityLevel;
  strictEvidenceMode?: boolean;
  rankingConsistency?: number;
  rankingFallbackApplied?: boolean;
  contextCounts?: Record<string, number>;
  relevanceCounts?: Record<string, { before: number; after: number }>;
}

export interface HelperResult {
  answer: string;
  sources: SourceItem[];
  intent: HelperIntent;
  keywords: string[];
  usedWebFallback: boolean;
  provider: string;
  qualityLevel?: QualityLevel;
  debugInfo?: HelperDebugInfo;
  quickReplies?: string[];
  mapBusinesses?: { id: string; slug: string; display_name: string; short_desc_en: string; avg_rating: number | null; review_count: number | null; phone: string | null; address_full: string | null; latitude: number; longitude: number; ai_tags: string[]; total_score: number; is_featured: boolean }[];
}

// ─── Engine ────────────────────────────────────────────────────────

export interface HelperEngine {
  ask(query: string, history?: HelperMessage[]): Promise<HelperResult>;
}

// ─── Legacy compatibility ──────────────────────────────────────────

export interface HelperRuntimeConfig {
  siteName: string;
  assistantName: string;
  assistantNameZh: string;
  locale: 'zh' | 'en';
  providerStrategy: 'hybrid' | 'openai' | 'anthropic';
  openAiApiKey?: string;
  openAiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  webFallbackEnabled?: boolean;
  fastMode?: boolean;
  answerMaxTokens?: number;
}

export interface HelperRunInput {
  query: string;
  history?: HelperMessage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  config: HelperRuntimeConfig;
}
