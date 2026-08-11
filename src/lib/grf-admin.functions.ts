import { createServerFn } from "@tanstack/react-start";
import { firstAdminSchema } from "@/lib/grf-server-helpers";

/** Indica se já existe algum usuário da equipe GRF cadastrado. */
export const grfAdminExists = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true });
  return { exists: (count ?? 0) > 0 };
});

/**
 * Cria o primeiro acesso da equipe GRF. Só funciona enquanto não existir
 * nenhum usuário administrativo — depois disso a rotina se desativa sozinha.
 */
export const createFirstGrfAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => firstAdminSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      return { ok: false as const, error: "O primeiro acesso já foi criado." };
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      return { ok: false as const, error: error?.message ?? "Não foi possível criar o usuário." };
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) return { ok: false as const, error: "Usuário criado, mas sem permissão. Tente novamente." };

    return { ok: true as const };
  });
