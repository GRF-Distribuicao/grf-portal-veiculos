import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requestSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
});

const decisionSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().trim().max(500).optional().default(""),
});

const revokeSchema = z.object({
  userId: z.string().uuid(),
});

const COMPANY_DOMAIN = "@grfdistribuicao.com.br";

async function getApprover(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data } = await db
    .from("grf_access_approvers")
    .select("email, active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  return data as { email: string; active: boolean } | null;
}

function appUrl() {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel.replace(/\/$/, "")}` : "";
}

async function notifyApprovers(request: { id: string; name: string; email: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: approvers } = await db
    .from("grf_access_approvers")
    .select("email")
    .eq("active", true)
    .order("email");

  const recipients = (approvers ?? []).map((r: { email: string }) => r.email).filter(Boolean);
  if (!recipients.length) return { sent: false, error: "Nenhum responsável configurado." };

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.GRF_APPROVAL_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return {
      sent: false,
      error:
        "Envio automático de e-mail aguardando configuração do provedor (RESEND_API_KEY e GRF_APPROVAL_EMAIL_FROM).",
    };
  }

  const portal = appUrl();
  const reviewUrl = portal ? `${portal}/admin/acessos` : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `Portal GRF - nova solicitação de acesso: ${request.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
          <h2 style="margin:0 0 16px;color:#111827">Nova solicitação de acesso à Área GRF</h2>
          <p><strong>Nome:</strong> ${request.name}</p>
          <p><strong>E-mail:</strong> ${request.email}</p>
          <p>Qualquer um dos responsáveis autorizados pode analisar e liberar este acesso.</p>
          ${reviewUrl ? `<p style="margin-top:24px"><a href="${reviewUrl}" style="display:inline-block;background:#16a832;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Analisar solicitação</a></p>` : ""}
          <p style="margin-top:24px;color:#6b7280;font-size:12px">Portal de Veículos GRF</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      sent: false,
      error: `Falha no envio do e-mail (${response.status}): ${body.slice(0, 300)}`,
    };
  }
  return { sent: true, error: null as string | null };
}

/** Registra a solicitação depois que o Supabase Auth criou o usuário. */
export const createGrfAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => requestSchema.parse(d))
  .handler(async ({ data }) => {
    if (!data.email.endsWith(COMPANY_DOMAIN)) {
      return { ok: false as const, error: "Use um e-mail corporativo @grfdistribuicao.com.br." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    const user = authUser?.user;
    if (userError || !user || (user.email ?? "").toLowerCase() !== data.email) {
      return { ok: false as const, error: "Não foi possível validar o usuário solicitado." };
    }

    const { data: existingRole } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (existingRole) {
      return { ok: false as const, error: "Este e-mail já possui acesso à Área GRF." };
    }

    const { data: pending } = await db
      .from("grf_access_requests")
      .select("id, status")
      .eq("user_id", data.userId)
      .eq("status", "PENDING")
      .maybeSingle();
    if (pending) {
      return { ok: true as const, pending: true as const, emailSent: false };
    }

    const { data: request, error } = await db
      .from("grf_access_requests")
      .insert({ user_id: data.userId, name: data.name, email: data.email, status: "PENDING" })
      .select("id, name, email")
      .single();
    if (error || !request) {
      return { ok: false as const, error: "Não foi possível registrar a solicitação de acesso." };
    }

    const notification = await notifyApprovers(request);
    await db
      .from("grf_access_requests")
      .update(
        notification.sent
          ? { notification_sent_at: new Date().toISOString(), notification_error: null }
          : { notification_error: notification.error ?? "Falha não identificada no envio." },
      )
      .eq("id", request.id);

    return {
      ok: true as const,
      pending: false as const,
      emailSent: notification.sent,
      notificationError: notification.sent ? null : notification.error,
    };
  });

export const listGrfAccessRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const approver = await getApprover(context.userId);
    if (!approver) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data, error }, { data: roles, error: roleError }] = await Promise.all([
      db
        .from("grf_access_requests")
        .select(
          "id, user_id, name, email, status, requested_at, decided_at, revoked_at, decision_note, notification_sent_at, notification_error",
        )
        .order("requested_at", { ascending: false })
        .limit(100),
      db.from("user_roles").select("user_id, role, approved_at").in("role", ["admin", "analista"]),
    ]);
    if (error) throw new Error(error.message);
    if (roleError) throw new Error(roleError.message);

    const requests = data ?? [];
    const rolesByUser = new Map<string, { role: string; approved_at: string | null }>();
    for (const role of roles ?? []) {
      const userId = String(role.user_id);
      const current = rolesByUser.get(userId);
      if (!current || role.role === "admin") {
        rolesByUser.set(userId, { role: String(role.role), approved_at: role.approved_at ?? null });
      }
    }

    const activeAccesses = (
      await Promise.all(
        [...rolesByUser.entries()].map(async ([userId, role]) => {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
          const user = authUser?.user;
          if (!user) return null;
          const request = requests.find((row: any) => String(row.user_id) === userId);
          const metadata = user.user_metadata ?? {};
          return {
            id: userId,
            user_id: userId,
            name:
              request?.name ??
              metadata["full_name"] ??
              metadata["name"] ??
              user.email ??
              "Usuário GRF",
            email: user.email ?? request?.email ?? "",
            role: role.role,
            approved_at: role.approved_at,
          };
        }),
      )
    ).filter(Boolean);

    return {
      rows: requests,
      activeAccesses,
      approverEmail: approver.email,
      currentUserId: context.userId,
    };
  });

export const revokeGrfAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => revokeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const approver = await getApprover(context.userId);
    if (!approver)
      return { ok: false as const, error: "Você não possui permissão para excluir acessos." };
    if (data.userId === context.userId) {
      return { ok: false as const, error: "Você não pode excluir o próprio acesso." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: roles, error: roleError }, { data: targetApprover }] = await Promise.all([
      db.from("user_roles").select("id, role").eq("user_id", data.userId),
      db
        .from("grf_access_approvers")
        .select("email")
        .eq("user_id", data.userId)
        .eq("active", true)
        .maybeSingle(),
    ]);

    if (roleError)
      return { ok: false as const, error: "Não foi possível conferir o acesso informado." };
    if (!roles?.length) return { ok: false as const, error: "Este acesso GRF já foi excluído." };

    if (targetApprover) {
      const { count, error: countError } = await db
        .from("grf_access_approvers")
        .select("email", { count: "exact", head: true })
        .eq("active", true)
        .neq("user_id", data.userId);
      if (countError)
        return { ok: false as const, error: "Não foi possível validar os responsáveis ativos." };
      if ((count ?? 0) < 1) {
        return {
          ok: false as const,
          error: "Não é possível excluir o último responsável ativo da Área GRF.",
        };
      }
    }

    const now = new Date().toISOString();
    const { error: deleteRoleError } = await db
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteRoleError)
      return { ok: false as const, error: "Não foi possível excluir a permissão GRF." };

    await Promise.all([
      db
        .from("grf_access_requests")
        .update({ status: "REVOKED", revoked_at: now, revoked_by: context.userId })
        .eq("user_id", data.userId)
        .eq("status", "APPROVED"),
      targetApprover
        ? db
            .from("grf_access_approvers")
            .update({ active: false, user_id: null })
            .eq("user_id", data.userId)
        : Promise.resolve(),
    ]);

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (authUser?.user) {
      const appMetadata = { ...(authUser.user.app_metadata ?? {}) };
      delete appMetadata["grf_access"];
      delete appMetadata["grf_role"];
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { app_metadata: appMetadata });
    }

    const { data: membership } = await db
      .from("transporter_memberships")
      .select("id")
      .eq("user_id", data.userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (membership) {
      return { ok: true as const, accountRemoved: false as const };
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    return {
      ok: true as const,
      accountRemoved: !authDeleteError,
      warning: authDeleteError
        ? "O acesso foi excluído, mas a conta de login não pôde ser removida automaticamente."
        : null,
    };
  });

export const approveGrfAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decisionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const approver = await getApprover(context.userId);
    if (!approver)
      return { ok: false as const, error: "Você não possui permissão para aprovar acessos." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: request } = await db
      .from("grf_access_requests")
      .select("id, user_id, email, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request || request.status !== "PENDING") {
      return { ok: false as const, error: "Solicitação não encontrada ou já analisada." };
    }

    const now = new Date().toISOString();
    const { error: roleError } = await db.from("user_roles").upsert(
      {
        user_id: request.user_id,
        role: "analista",
        must_change_password: false,
        approved_by: context.userId,
        approved_at: now,
      },
      { onConflict: "user_id,role" },
    );
    if (roleError)
      return { ok: false as const, error: "Não foi possível liberar a permissão do usuário." };

    await supabaseAdmin.auth.admin.updateUserById(request.user_id, {
      app_metadata: { grf_access: true, grf_role: "analista" },
    });

    const { error: updateError } = await db
      .from("grf_access_requests")
      .update({
        status: "APPROVED",
        decided_at: now,
        decided_by: context.userId,
        decision_note: data.note || `Aprovado por ${approver.email}`,
      })
      .eq("id", request.id)
      .eq("status", "PENDING");
    if (updateError)
      return {
        ok: false as const,
        error: "Permissão criada, mas houve falha ao atualizar a solicitação.",
      };

    return { ok: true as const };
  });

export const rejectGrfAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decisionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const approver = await getApprover(context.userId);
    if (!approver)
      return { ok: false as const, error: "Você não possui permissão para reprovar acessos." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: request } = await db
      .from("grf_access_requests")
      .select("id, user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request || request.status !== "PENDING") {
      return { ok: false as const, error: "Solicitação não encontrada ou já analisada." };
    }

    const { error } = await db
      .from("grf_access_requests")
      .update({
        status: "REJECTED",
        decided_at: new Date().toISOString(),
        decided_by: context.userId,
        decision_note: data.note || `Reprovado por ${approver.email}`,
      })
      .eq("id", request.id)
      .eq("status", "PENDING");
    if (error) return { ok: false as const, error: "Não foi possível reprovar a solicitação." };

    // Usuário ainda não tinha papel GRF; removê-lo permite uma nova solicitação futura.
    await supabaseAdmin.auth.admin.deleteUser(request.user_id).catch(() => undefined);
    return { ok: true as const };
  });

export const completeFirstPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("user_roles")
      .update({ must_change_password: false })
      .eq("user_id", context.userId);
    if (error) return { ok: false as const, error: "Não foi possível concluir a troca de senha." };
    return { ok: true as const };
  });
