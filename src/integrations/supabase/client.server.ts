// Cliente Supabase de servidor (service role) — ignora RLS.
// SEGURANÇA: use apenas dentro de server functions / módulos *.server.ts.
// Carregue sob demanda: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createSupabaseFetch, requireEnv, requireServerEnv } from "./env";

function createSupabaseAdminClient() {
  const [url] = requireEnv(["SUPABASE_URL"]) as [string];
  // O service role NUNCA é lido de import.meta.env — só de process.env no servidor.
  const [key] = requireServerEnv(["SUPABASE_SERVICE_ROLE_KEY"]) as [string];

  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
