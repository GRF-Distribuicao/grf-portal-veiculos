// Cliente Supabase do navegador (chave publicável). Só é usado para:
//  - sessão de login da equipe GRF (área /admin)
//  - upload direto de arquivos via URL assinada emitida pelo servidor
// Nenhuma tabela é lida/escrita daqui: tudo passa por server functions.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createSupabaseFetch, requireEnv } from "./env";

function createSupabaseClient() {
  const [url, key] = requireEnv(["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) as [string, string];

  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
