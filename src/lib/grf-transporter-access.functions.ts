import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requestSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  companyName: z.string().trim().min(2).max(160),
  companyCnpj: z.string().transform((value) => value.replace(/\D/g, "")),
});

const decisionSchema = z.object({
  requestId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  createNewCompany: z.boolean().optional().default(false),
  note: z.string().trim().max(500).optional().default(""),
});

function normalizeCompanyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isValidCnpj(value: string) {
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calcDigit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${first}${second}`);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

async function notifyApprovers(request: {
  id: string;
  requester_name: string;
  email: string;
  company_name: string;
  company_cnpj: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: approvers } = await db
    .from("grf_access_approvers")
    .select("email")
    .eq("active", true)
    .order("email");

  const recipients = (approvers ?? []).map((row: { email: string }) => row.email).filter(Boolean);
  if (!recipients.length) return { sent: false, error: "Nenhum responsável configurado." };

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.GRF_APPROVAL_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return {
      sent: false,
      error: "Envio automático de e-mail aguardando configuração do provedor.",
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
      subject: `Portal GRF - acesso de transportadora: ${request.company_name}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
          <h2 style="margin:0 0 16px;color:#111827">Nova solicitação de acesso de transportadora</h2>
          <p><strong>Responsável:</strong> ${escapeHtml(request.requester_name)}</p>
          <p><strong>E-mail:</strong> ${escapeHtml(request.email)}</p>
          <p><strong>Empresa:</strong> ${escapeHtml(request.company_name)}</p>
          <p><strong>CNPJ:</strong> ${escapeHtml(request.company_cnpj)}</p>
          <p>O acesso só será liberado depois que a GRF confirmar a transportadora correta.</p>
          ${reviewUrl ? `<p style="margin-top:24px"><a href="${reviewUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Analisar solicitação</a></p>` : ""}
          <p style="margin-top:24px;color:#6b7280;font-size:12px">Portal de Veículos GRF</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false, error: `Falha no envio do e-mail (${response.status}): ${body.slice(0, 300)}` };
  }
  return { sent: true, error: null as string | null };
}

export const createTransporterAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    if (!isValidCnpj(data.companyCnpj)) {
      return { ok: false as const, error: "Informe um CNPJ válido." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const user = authUser?.user;

    if (userError || !user || (user.email ?? "").toLowerCase() !== data.email) {
      return { ok: false as const, error: "Não foi possível validar o usuário solicitado." };
    }

    const { data: grfRole } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (grfRole) {
      return {
        ok: false as const,
        error: "Este e-mail pertence à Área GRF. Os acessos internos e de transportadora são separados.",
      };
    }

    const { data: membership } = await db
      .from("transporter_memberships")
      .select("id")
      .eq("user_id", data.userId)
      .eq("active", true)
      .maybeSingle();
    if (membership) {
      return { ok: false as const, error: "Este e-mail já possui acesso de transportadora." };
    }

    const { data: pending } = await db
      .from("transporter_access_requests")
      .select("id")
      .eq("user_id", data.userId)
      .eq("status", "PENDING")
      .maybeSingle();
    if (pending) {
      return { ok: true as const, pending: true as const, emailSent: false };
    }

    const { data: request, error } = await db
      .from("transporter_access_requests")
      .insert({
        user_id: data.userId,
        requester_name: data.name,
        email: data.email,
        company_name: data.companyName,
        company_cnpj: data.companyCnpj,
        status: "PENDING",
      })
      .select("id, requester_name, email, company_name, company_cnpj")
      .single();

    if (error || !request) {
      return { ok: false as const, error: "Não foi possível registrar a solicitação de acesso." };
    }

    const notification = await notifyApprovers(request);
    await db
      .from("transporter_access_requests")
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

export const listTransporterAccessRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const approver = await getApprover(context.userId);
    if (!approver) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: requests, error: requestError }, { data: companies, error: companyError }, { data: links }] =
      await Promise.all([
        db
          .from("transporter_access_requests")
          .select("id, user_id, requester_name, email, company_name, company_cnpj, status, requested_at, decided_at, decision_note, matched_company_id, notification_sent_at, notification_error")
          .order("requested_at", { ascending: false })
          .limit(100),
        db
          .from("transporter_companies")
          .select("id, name, normalized_name, cnpj, active")
          .eq("active", true)
          .order("name"),
        db
          .from("transporter_vehicle_links")
          .select("transporter_company_id")
          .eq("active", true),
      ]);

    if (requestError) throw new Error(requestError.message);
    if (companyError) throw new Error(companyError.message);

    const vehicleCounts = new Map<string, number>();
    for (const link of links ?? []) {
      const id = String(link.transporter_company_id);
      vehicleCounts.set(id, (vehicleCounts.get(id) ?? 0) + 1);
    }

    const companyRows = (companies ?? []).map((company: any) => ({
      id: String(company.id),
      name: String(company.name),
      cnpj: company.cnpj ? String(company.cnpj) : null,
      normalizedName: String(company.normalized_name),
      vehicleCount: vehicleCounts.get(String(company.id)) ?? 0,
    }));

    const requestRows = (requests ?? []).map((request: any) => {
      const cnpjMatch = companyRows.find((company) => company.cnpj === request.company_cnpj);
      const nameMatch = companyRows.find(
        (company) => company.normalizedName === normalizeCompanyName(String(request.company_name)),
      );
      return {
        ...request,
        suggested_company_id: cnpjMatch?.id ?? nameMatch?.id ?? null,
      };
    });

    return { rows: requestRows, companies: companyRows, approverEmail: approver.email };
  });

export const approveTransporterAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const approver = await getApprover(context.userId);
    if (!approver) return { ok: false as const, error: "Você não possui permissão para aprovar acessos." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: request } = await db
      .from("transporter_access_requests")
      .select("id, user_id, requester_name, email, company_name, company_cnpj, status")
      .eq("id", data.requestId)
      .maybeSingle();

    if (!request || request.status !== "PENDING") {
      return { ok: false as const, error: "Solicitação não encontrada ou já analisada." };
    }

    const { data: grfRole } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", request.user_id)
      .maybeSingle();
    if (grfRole) {
      return { ok: false as const, error: "Este usuário pertence à Área GRF e não pode ser vinculado como transportador." };
    }

    const { data: existingMembership } = await db
      .from("transporter_memberships")
      .select("id")
      .eq("user_id", request.user_id)
      .eq("active", true)
      .maybeSingle();
    if (existingMembership) {
      return { ok: false as const, error: "Este usuário já está vinculado a uma transportadora." };
    }

    let company: { id: string; name: string; cnpj: string | null } | null = null;

    if (data.createNewCompany) {
      const { data: existingByCnpj } = await db
        .from("transporter_companies")
        .select("id, name, cnpj")
        .eq("cnpj", request.company_cnpj)
        .maybeSingle();
      if (existingByCnpj) {
        return {
          ok: false as const,
          error: `Este CNPJ já está vinculado à transportadora ${existingByCnpj.name}. Selecione a empresa existente.`,
        };
      }

      const { data: created, error: createError } = await db
        .from("transporter_companies")
        .insert({
          name: request.company_name,
          normalized_name: normalizeCompanyName(request.company_name),
          cnpj: request.company_cnpj,
          active: true,
        })
        .select("id, name, cnpj")
        .single();
      if (createError || !created) {
        return { ok: false as const, error: "Não foi possível criar a nova transportadora." };
      }
      company = { id: String(created.id), name: String(created.name), cnpj: created.cnpj ?? null };
    } else {
      if (!data.companyId) {
        return { ok: false as const, error: "Selecione a transportadora correta antes de aprovar." };
      }

      const { data: selectedCompany } = await db
        .from("transporter_companies")
        .select("id, name, cnpj, active")
        .eq("id", data.companyId)
        .eq("active", true)
        .maybeSingle();
      if (!selectedCompany) {
        return { ok: false as const, error: "Transportadora não encontrada ou inativa." };
      }

      if (selectedCompany.cnpj && selectedCompany.cnpj !== request.company_cnpj) {
        return {
          ok: false as const,
          error: `O CNPJ informado não corresponde ao CNPJ já confirmado para ${selectedCompany.name}.`,
        };
      }

      if (!selectedCompany.cnpj) {
        const { error: cnpjError } = await db
          .from("transporter_companies")
          .update({ cnpj: request.company_cnpj, updated_at: new Date().toISOString() })
          .eq("id", selectedCompany.id);
        if (cnpjError) {
          return { ok: false as const, error: "Não foi possível confirmar o CNPJ da transportadora selecionada." };
        }
      }

      company = {
        id: String(selectedCompany.id),
        name: String(selectedCompany.name),
        cnpj: selectedCompany.cnpj ?? request.company_cnpj,
      };
    }

    const now = new Date().toISOString();
    const { error: membershipError } = await db.from("transporter_memberships").insert({
      user_id: request.user_id,
      transporter_company_id: company.id,
      role: "OPERADOR",
      active: true,
      approved_by: context.userId,
      approved_at: now,
      request_id: request.id,
    });

    if (membershipError) {
      return { ok: false as const, error: "Não foi possível vincular o usuário à transportadora." };
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(request.user_id);
    await supabaseAdmin.auth.admin.updateUserById(request.user_id, {
      app_metadata: {
        ...(authUser?.user?.app_metadata ?? {}),
        transporter_access: true,
        transporter_company_id: company.id,
      },
    });

    const { error: updateError } = await db
      .from("transporter_access_requests")
      .update({
        status: "APPROVED",
        matched_company_id: company.id,
        decided_at: now,
        decided_by: context.userId,
        decision_note: data.note || `Aprovado por ${approver.email}`,
      })
      .eq("id", request.id)
      .eq("status", "PENDING");

    if (updateError) {
      return { ok: false as const, error: "Vínculo criado, mas houve falha ao atualizar a solicitação." };
    }

    return { ok: true as const, companyId: company.id, companyName: company.name };
  });

export const rejectTransporterAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const approver = await getApprover(context.userId);
    if (!approver) return { ok: false as const, error: "Você não possui permissão para reprovar acessos." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: request } = await db
      .from("transporter_access_requests")
      .select("id, user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();

    if (!request || request.status !== "PENDING") {
      return { ok: false as const, error: "Solicitação não encontrada ou já analisada." };
    }

    const { error } = await db
      .from("transporter_access_requests")
      .update({
        status: "REJECTED",
        decided_at: new Date().toISOString(),
        decided_by: context.userId,
        decision_note: data.note || `Reprovado por ${approver.email}`,
      })
      .eq("id", request.id)
      .eq("status", "PENDING");

    if (error) return { ok: false as const, error: "Não foi possível reprovar a solicitação." };

    const [{ data: role }, { data: membership }] = await Promise.all([
      db.from("user_roles").select("id").eq("user_id", request.user_id).maybeSingle(),
      db.from("transporter_memberships").select("id").eq("user_id", request.user_id).eq("active", true).maybeSingle(),
    ]);

    if (!role && !membership) {
      await supabaseAdmin.auth.admin.deleteUser(request.user_id).catch(() => undefined);
    }

    return { ok: true as const };
  });
