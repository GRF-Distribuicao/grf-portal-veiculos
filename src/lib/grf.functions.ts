import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  decisionInputSchema,
  listInputSchema,
  makeProtocol,
  plateInputSchema,
  registrationIdSchema,
  submitInputSchema,
  trackingInputSchema,
  uploadTicketSchema,
} from "@/lib/grf-server-helpers";
import {
  ACCEPTED_DOC_MIME,
  ATTACHMENT_TYPES,
  MAX_FILE_MB,
  acceptedMimeFor,
} from "@/lib/grf-domain";
import { STORAGE_BUCKET } from "@/integrations/supabase/env";

/* Todas as leituras/escritas passam pelo servidor. As tabelas estão bloqueadas
   para o navegador e os documentos ficam em bucket privado (links temporários). */

export const checkPlate = createServerFn({ method: "POST" })
  .inputValidator((d: { plate: string }) => plateInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("vehicle_registrations")
      .select("protocol, status")
      .eq("plate", data.plate.toUpperCase())
      .maybeSingle();
    return { exists: !!row, protocol: row?.protocol ?? null, status: row?.status ?? null };
  });

/**
 * Emite uma URL assinada para o navegador enviar UM arquivo direto ao Storage.
 *
 * Por que assim: o bucket `grf-documentos` é privado e o formulário é público.
 * O token assinado é gerado com o service role, então o upload não depende de
 * política RLS para `anon` e o arquivo não trafega pela função serverless
 * (a Vercel limita o corpo da requisição a ~4,5 MB).
 *
 * O caminho é montado no servidor — o cliente não escolhe onde grava.
 */
export const createUploadTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => uploadTicketSchema.parse(d))
  .handler(async ({ data }) => {
    const attachment = ATTACHMENT_TYPES.find((a) => a.key === data.attachmentKey);
    if (!attachment) return { ok: false as const, error: "Tipo de anexo desconhecido." };

    const allowed = acceptedMimeFor(attachment.kind);
    if (!allowed.includes(data.mimeType)) {
      return {
        ok: false as const,
        error:
          attachment.kind === "photo"
            ? "Envie a foto em JPG ou PNG."
            : "Formato não permitido. Envie PDF, JPG ou PNG.",
      };
    }

    if (data.fileSize > MAX_FILE_MB * 1024 * 1024) {
      return { ok: false as const, error: `Arquivo maior que ${MAX_FILE_MB} MB.` };
    }

    const ext = ACCEPTED_DOC_MIME.includes(data.mimeType)
      ? { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" }[data.mimeType]
      : "bin";
    const safeName = `${attachment.key}-${Date.now()}.${ext}`;
    const path = `cadastros/${data.sessionId}/${safeName}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !signed) {
      console.error("[GRF] createSignedUploadUrl falhou", error);
      return { ok: false as const, error: "Não foi possível preparar o envio do arquivo." };
    }

    return { ok: true as const, path: signed.path, token: signed.token };
  });

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const plate = data.vehicle.plate.toUpperCase();

    // Reforço no servidor: o formulário do navegador pode ser burlado.
    const sent = new Set(data.documents.map((d) => d.docType));
    const missing = ATTACHMENT_TYPES.filter((a) => a.required && !sent.has(a.key));
    if (missing.length) {
      return {
        ok: false as const,
        error: `Anexos obrigatórios faltando: ${missing.map((m) => m.label).join(", ")}.`,
      };
    }

    const { data: existing } = await supabaseAdmin
      .from("vehicle_registrations")
      .select("protocol, status")
      .eq("plate", plate)
      .maybeSingle();
    if (existing) {
      return {
        ok: false as const,
        error: `Veículo já possui cadastro no Portal GRF (placa ${plate}, protocolo ${existing.protocol}).`,
      };
    }

    const { data: transporter, error: tErr } = await supabaseAdmin
      .from("transporters")
      .insert({
        name: data.transporter.name,
        doc_type: data.transporter.docType,
        doc_number: data.transporter.docNumber,
        phone: data.transporter.phone,
        email: data.transporter.email ?? "",
        city: data.transporter.city,
        uf: data.transporter.uf,
        link_type: data.transporter.linkType,
      })
      .select("id")
      .single();
    if (tErr || !transporter) return { ok: false as const, error: "Falha ao salvar o transportador." };

    const protocol = makeProtocol();
    const { data: reg, error: rErr } = await supabaseAdmin
      .from("vehicle_registrations")
      .insert({
        protocol,
        transporter_id: transporter.id,
        status: "AGUARDANDO_ANALISE",
        plate,
        vehicle_type: data.vehicle.vehicleType,
        species: data.vehicle.species,
        wheel_type: data.vehicle.wheelType,
        body_type: data.vehicle.bodyType,
        brand_model: data.vehicle.brandModel,
        manufacture_year: data.vehicle.manufactureYear,
        model_year: data.vehicle.modelYear,
        max_weight_kg: data.vehicle.maxWeightKg,
        tare_kg: data.vehicle.tareKg,
        max_capacity_kg: data.vehicle.maxCapacityKg,
        pallets: data.vehicle.pallets,
        axles: data.vehicle.axles,
        renavam: data.vehicle.renavam,
        chassis: data.vehicle.chassis,
        engine_number: data.vehicle.engineNumber,
        plate_city: data.vehicle.plateCity,
        plate_uf: data.vehicle.plateUf,
        color: data.vehicle.color,
        fuel: data.vehicle.fuel,
        company_vehicle: data.vehicle.companyVehicle,
        declaration_accepted: data.declarationAccepted,
      })
      .select("id, protocol")
      .single();
    if (rErr || !reg) return { ok: false as const, error: "Falha ao salvar o cadastro do veículo." };

    await supabaseAdmin.from("drivers").insert({
      registration_id: reg.id,
      name: data.driver.name,
      cpf: data.driver.cpf,
      cnh: data.driver.cnh,
      cnh_category: data.driver.cnhCategory,
      phone: data.driver.phone,
    });

    await supabaseAdmin.from("tracking_devices").insert({
      registration_id: reg.id,
      has_tracker: data.tracking.hasTracker,
      provider: data.tracking.provider,
      identifier: data.tracking.identifier,
      status: data.tracking.status,
    });

    if (data.documents.length) {
      await supabaseAdmin.from("documents").insert(
        data.documents.map((d) => ({
          registration_id: reg.id,
          doc_type: d.docType,
          file_name: d.fileName,
          file_size: d.fileSize,
          mime_type: d.mimeType ?? null,
          storage_path: d.storagePath,
          status: "ENVIADO",
        })),
      );
    }

    await supabaseAdmin.from("approval_history").insert({
      registration_id: reg.id,
      action: "ENVIO",
      from_status: "RASCUNHO",
      to_status: "AGUARDANDO_ANALISE",
      user_name: data.transporter.name,
      note: "Cadastro enviado pelo transportador.",
    });

    return { ok: true as const, protocol: reg.protocol, id: reg.id };
  });

export const trackRegistration = createServerFn({ method: "POST" })
  .inputValidator((d: { protocol: string; doc: string }) => trackingInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg } = await supabaseAdmin
      .from("vehicle_registrations")
      .select("id, protocol, plate, status, submitted_at, updated_at, transporters(doc_number, name)")
      .eq("protocol", data.protocol.trim().toUpperCase())
      .maybeSingle();

    const digits = data.doc.replace(/\D/g, "");
    const transporter = reg?.transporters as unknown as { doc_number: string; name: string } | null;
    if (!reg || !transporter || transporter.doc_number.replace(/\D/g, "") !== digits) {
      return { ok: false as const, error: "Protocolo e CPF/CNPJ não conferem." };
    }

    const { data: history } = await supabaseAdmin
      .from("approval_history")
      .select("action, to_status, note, user_name, created_at")
      .eq("registration_id", reg.id)
      .order("created_at", { ascending: true });

    return {
      ok: true as const,
      registration: {
        protocol: reg.protocol,
        plate: reg.plate,
        status: reg.status,
        submittedAt: reg.submitted_at,
        updatedAt: reg.updated_at,
        transporterName: transporter.name,
      },
      history: history ?? [],
    };
  });

export const listRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInputSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);

    const { data: rows } = await supabaseAdmin
      .from("vehicle_registrations")
      .select(
        "id, protocol, plate, status, is_demo, submitted_at, updated_at, brand_model, vehicle_type, body_type, max_capacity_kg, pallets, codveiculo_sankhya, status_integracao, transporters(name, doc_number, link_type), tracking_devices(has_tracker, provider)",
      )
      .order("submitted_at", { ascending: false });

    const all = rows ?? [];
    const norm = (v?: string | null) => (v ?? "").toLowerCase();
    const term = (data.search ?? "").trim().toLowerCase();
    const digits = term.replace(/\D/g, "");

    const list = all.filter((r) => {
      const t = r.transporters as unknown as { name: string; doc_number: string; link_type: string } | null;
      const tr = (Array.isArray(r.tracking_devices) ? r.tracking_devices[0] : r.tracking_devices) as
        | { has_tracker: boolean; provider: string | null }
        | null;

      if (data.scope === "APROVADOS" && r.status !== "APROVADO") return false;
      if (data.scope === "PENDENTES" && r.status === "APROVADO") return false;
      if (data.status && data.status !== "TODOS" && r.status !== data.status) return false;
      if (data.plate && !norm(r.plate).includes(data.plate.toLowerCase().replace(/[^a-z0-9]/g, ""))) return false;
      if (data.protocol && !norm(r.protocol).includes(data.protocol.toLowerCase())) return false;
      if (data.transporter && !norm(t?.name).includes(data.transporter.toLowerCase())) return false;
      if (data.linkType && data.linkType !== "TODOS" && t?.link_type !== data.linkType) return false;
      if (data.hasTracker === "SIM" && !tr?.has_tracker) return false;
      if (data.hasTracker === "NAO" && tr?.has_tracker) return false;
      if (data.dateFrom && new Date(r.submitted_at) < new Date(`${data.dateFrom}T00:00:00`)) return false;
      if (data.dateTo && new Date(r.submitted_at) > new Date(`${data.dateTo}T23:59:59`)) return false;
      if (!term) return true;
      return (
        norm(r.plate).includes(term.replace(/[^a-z0-9]/g, "")) ||
        norm(r.protocol).includes(term) ||
        norm(t?.name).includes(term) ||
        (digits.length > 2 && (t?.doc_number ?? "").replace(/\D/g, "").includes(digits))
      );
    });

    const counts: Record<string, number> = {};
    for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;

    return { list, counts, total: all.length };
  });

/* Exportação Excel: retorna as linhas dos veículos APROVADOS já achatadas. */
export const listApprovedForExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);

    const { data: rows } = await supabaseAdmin
      .from("vehicle_registrations")
      .select("*, transporters(*), drivers(*), tracking_devices(*)")
      .eq("status", "APROVADO")
      .order("updated_at", { ascending: false });

    const { data: approvals } = await supabaseAdmin
      .from("approval_history")
      .select("registration_id, created_at, to_status")
      .eq("to_status", "APROVADO");

    const approvedAt = new Map<string, string>();
    for (const a of approvals ?? []) approvedAt.set(a.registration_id, a.created_at);

    return (rows ?? []).map((r) => {
      const t = r.transporters as unknown as Record<string, string> | null;
      const d = (Array.isArray(r.drivers) ? r.drivers[0] : r.drivers) as Record<string, string> | null;
      const tr = (Array.isArray(r.tracking_devices) ? r.tracking_devices[0] : r.tracking_devices) as
        | Record<string, unknown>
        | null;
      return {
        protocol: r.protocol,
        plate: r.plate,
        transporter: t?.["name"] ?? "",
        doc: t?.["doc_number"] ?? "",
        linkType: t?.["link_type"] ?? "",
        brandModel: r.brand_model ?? "",
        year: r.model_year ?? r.manufacture_year ?? "",
        vehicleType: r.vehicle_type ?? "",
        bodyType: r.body_type ?? "",
        capacity: r.max_capacity_kg ?? "",
        tare: r.tare_kg ?? "",
        pallets: r.pallets ?? "",
        axles: r.axles ?? "",
        renavam: r.renavam ?? "",
        chassis: r.chassis ?? "",
        driver: d?.["name"] ?? "",
        driverCpf: d?.["cpf"] ?? "",
        tracker: tr?.["has_tracker"] ? "Sim" : "Não",
        trackerProvider: (tr?.["provider"] as string) ?? "",
        status: r.status,
        approvedAt: approvedAt.get(r.id) ?? r.updated_at,
        sankhyaCode: r.codveiculo_sankhya ?? "",
        sankhyaStatus: r.status_integracao ?? "NAO_INICIADA",
        isDemo: r.is_demo,
      };
    });
  });

export const getRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => registrationIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);
    const { data: reg } = await supabaseAdmin
      .from("vehicle_registrations")
      .select("*, transporters(*), drivers(*), tracking_devices(*), documents(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (!reg) return { ok: false as const };

    const docs = (reg.documents ?? []) as Array<{ id: string; storage_path: string; [k: string]: unknown }>;
    const withUrls = await Promise.all(
      docs.map(async (d) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(d.storage_path, 60 * 30);
        return { ...d, url: signed?.signedUrl ?? null };
      }),
    );

    const { data: history } = await supabaseAdmin
      .from("approval_history")
      .select("*")
      .eq("registration_id", data.id)
      .order("created_at", { ascending: false });

    return { ok: true as const, registration: { ...reg, documents: withUrls }, history: history ?? [] };
  });

export const decideRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decisionInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);
    const { data: current } = await supabaseAdmin
      .from("vehicle_registrations")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) return { ok: false as const, error: "Cadastro não encontrado." };

    const map: Record<string, string> = {
      EM_ANALISE: "EM_ANALISE",
      APROVAR: "APROVADO",
      DEVOLVER: "DEVOLVIDO",
      REPROVAR: "REPROVADO",
      PRONTO_INTEGRACAO: "PRONTO_INTEGRACAO",
    };
    const to = map[data.action]!;

    if ((data.action === "DEVOLVER" || data.action === "REPROVAR") && !data.note?.trim()) {
      return { ok: false as const, error: "Informe uma observação para devolver ou reprovar." };
    }

    await supabaseAdmin
      .from("vehicle_registrations")
      .update({
        status: to,
        status_integracao: to === "PRONTO_INTEGRACAO" ? "AGUARDANDO_ENVIO" : "NAO_INICIADA",
        mensagem_integracao:
          to === "PRONTO_INTEGRACAO" ? "Aguardando conexão real com o Sankhya (próxima etapa)." : null,
      })
      .eq("id", data.id);

    await supabaseAdmin.from("approval_history").insert({
      registration_id: data.id,
      action: data.action,
      from_status: current.status,
      to_status: to,
      user_name: data.userName,
      note: data.note?.trim() || null,
    });

    return { ok: true as const, status: to };
  });
