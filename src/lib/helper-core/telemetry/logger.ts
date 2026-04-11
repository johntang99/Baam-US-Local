/**
 * Search telemetry logger.
 * Best-effort logging to a search_logs table — failures never break the user flow.
 */

export interface TelemetryPayload {
  query: string;
  queryLanguage: 'zh' | 'en';
  regionId?: string | null;
  resultCount: number;
  resultTypes: string[];
  aiIntent: string;
  responseTimeMs: number;
}

/**
 * Log a search event to the telemetry table.
 * Silently catches errors — telemetry must never break the response.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logSearchTelemetry(supabase: any, payload: TelemetryPayload): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('search_logs').insert({
      query: payload.query,
      query_language: payload.queryLanguage,
      region_id: payload.regionId || null,
      result_count: payload.resultCount,
      result_types: payload.resultTypes,
      ai_intent: payload.aiIntent,
      response_time_ms: payload.responseTimeMs,
    });
  } catch (err) {
    console.warn('[helper-core] telemetry insert failed', err);
  }
}
