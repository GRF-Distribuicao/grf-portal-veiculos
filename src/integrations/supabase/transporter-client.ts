import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createSupabaseFetch, requireEnv } from "./env";

function createTransporterSupabaseClient() {
  const [url, key] = requireEnv(["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) as [string, string];

  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey: "grf-transporter-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _transporterSupabase: ReturnType<typeof createTransporterSupabaseClient> | undefined;

/**
 * Cliente de autenticação exclusivo da Área do Transportador.
 * Usa uma chave de armazenamento diferente da Área GRF para que as sessões
 * não se confundam mesmo quando ambas são abertas no mesmo navegador.
 */
export const transporterSupabase = new Proxy({} as ReturnType<typeof createTransporterSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_transporterSupabase) _transporterSupabase = createTransporterSupabaseClient();
    return Reflect.get(_transporterSupabase, prop, receiver);
  },
});
