import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Garante que o usuário autenticado pertence à equipe GRF (papel admin ou analista). */
export async function assertGrfUser(userId: string | undefined) {
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "analista"]);

  if (error || !data || data.length === 0) {
    throw new Response("Forbidden", { status: 403 });
  }
  return data.map((r) => r.role);
}
