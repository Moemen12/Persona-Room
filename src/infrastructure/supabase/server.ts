import "server-only";

import { createClient } from "@supabase/supabase-js";

import { AuthenticationError } from "@/lib/errors";
import { getServerEnvironment } from "@/infrastructure/shared/env";

export function getSupabaseAdminClient() {
  const environment = getServerEnvironment();
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

export async function getSupabaseAuthUser(accessToken: string) {
  const environment = getServerEnvironment();
  const client = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new AuthenticationError();
  }
  return data.user;
}
