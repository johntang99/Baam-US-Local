/** Shared types for Baam Map components */

export interface MapBusiness {
  id: string;
  slug: string;
  display_name: string;
  short_desc_en: string;
  avg_rating: number | null;
  review_count: number | null;
  phone: string | null;
  address_full: string | null;
  latitude: number;
  longitude: number;
  ai_tags: string[];
  total_score: number;
  is_featured: boolean;
}

export interface MapEvent {
  id: string;
  slug: string;
  title: string;
  venue_name: string;
  start_at: string;
  is_free: boolean;
  ticket_price: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type MapLayer = 'businesses' | 'events' | 'community' | 'new';

export const MIDDLETOWN_CENTER: [number, number] = [41.4459, -74.4229];
export const DEFAULT_ZOOM = 13;
