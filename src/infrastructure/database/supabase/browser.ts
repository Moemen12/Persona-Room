'use client';

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import { env } from '../../shared/env';

let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

export function createBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createSupabaseBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return browserClient;
}
