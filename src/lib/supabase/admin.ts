import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Service role client — bypasses RLS. Use ONLY in API routes and server actions.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
