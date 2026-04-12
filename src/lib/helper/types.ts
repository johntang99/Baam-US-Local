/**
 * Helper Answer Type System — Type definitions
 */

export type AnswerType =
  | 'business-recommendation'  // Type 1
  | 'guide'                    // Type 2
  | 'info-lookup'              // Type 3
  | 'mixed'                    // Type 4
  | 'community'               // Type 5
  | 'news-events'             // Type 6
  | 'follow-up'               // Type 7
  | 'no-match'                // Type 8
  | 'business-lookup'         // Type 9
  | 'comparison'              // Type 10
  | 'life-event';             // Type 11

export interface BusinessResult {
  id: string;
  slug: string;
  display_name: string;
  short_desc_en: string;
  avg_rating: number | null;
  review_count: number | null;
  phone: string | null;
  address_full: string | null;
  total_score: number;
  ai_tags: string[];
  latitude?: number | null;
  longitude?: number | null;
}

export interface ContentItem {
  title: string;
  slug: string;
  snippet: string;
  boardSlug?: string; // for forum
  replyCount?: number; // for forum
  likeCount?: number; // for discover
}

export interface EventItem {
  title: string;
  slug: string;
  venueName: string;
  startAt: string;
  isFree: boolean;
  ticketPrice?: string | null;
  summary?: string;
}

export interface RelatedContent {
  guides: ContentItem[];
  forum: ContentItem[];
  discover: ContentItem[];
  news: ContentItem[];
  events?: EventItem[];
}

export interface AllocationResult {
  type: AnswerType;
  keywords: string[];
  businesses: BusinessResult[];
  matchedCategory: string | null;
  locationFallback: boolean;
  townLabel: string | null;
  related: RelatedContent;
  /** For Type 9: single business detail */
  singleBusiness: BusinessResult | null;
  /** For Type 10: the two businesses being compared */
  comparisonPair: [BusinessResult, BusinessResult] | null;
}

export interface HelperSource {
  type: string;
  title: string;
  url: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

export const TOWN_REGION_MAP: Record<string, string> = {
  'middletown': 'a5bb3fb8-26b4-4a91-928e-0373f1d28be0',
  'newburgh': '1e316411-9ee1-41e5-b6d1-a0d92b0683d6',
  'goshen': '5b84e90c-0f37-4e33-b361-b870de175cf7',
  'monroe': 'cdec82a7-eb63-41d2-8c82-95ec36bdb020',
  'warwick': '9d32b3ba-650a-4b52-96bb-7a587891e344',
  'chester': '1e8e1ce2-1d65-49dc-a3d1-de9ad2123519',
  'port jervis': '7a66b436-6117-463b-896a-19b928f67e92',
  'cornwall': '0f9cfd16-d1f7-4474-8ff1-20a2e7eb4a89',
};

export const GENERIC_WORDS = new Set([
  'best', 'good', 'top', 'recommend', 'find', 'near', 'nearby',
  'place', 'places', 'local', 'middletown', 'goshen', 'newburgh',
  'monroe', 'what', 'where', 'how', 'the', 'are', 'any', 'in',
  'can', 'get', 'does', 'there', 'some', 'like', 'want',
  'looking', 'need', 'shops', 'stores', 'please', 'list', 'show',
  'about', 'from', 'anyone', 'people', 'think', 'know',
  'tell', 'think', 'opinions', 'thoughts', 'recommendations',
  'recently', 'lately', 'really', 'also', 'very', 'much',
  'this', 'that', 'with', 'for', 'has', 'have', 'been',
  'coming', 'happening', 'recent', 'upcoming',
]);
