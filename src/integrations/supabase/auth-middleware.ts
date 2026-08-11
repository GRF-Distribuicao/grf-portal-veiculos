// Valida o bearer token enviado pelo navegador nas server functions da área GRF.
import { createMiddleware } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createSupabaseFetch, requireEnv } from "./env";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const [url, publishableKey] = requireEnv(["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) as [
    string,
    string,
  ];

  // Import dinâmico de propósito: importar "@tanstack/react-start/server" no
  // topo faz o barrel de servidor ser avaliado antes do módulo interno do
  // Start, criando um ciclo que quebra o SSR inteiro com
  // "createCsrfMiddleware is not a function". Carregar aqui dentro evita isso.
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");

  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");

  const token = authHeader.slice("Bearer ".length);
  if (!token) throw new Error("Unauthorized: No token provided");
  if (token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const supabase = createClient<Database>(url, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized: Invalid token");
  if (!data.claims.sub) throw new Error("Unauthorized: No user ID found in token");

  return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
});
