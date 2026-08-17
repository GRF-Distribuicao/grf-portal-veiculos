import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ATTACHMENT_TYPES } from "@/lib/grf-domain";
import { STORAGE_BUCKET } from "@/integrations/supabase/env";

const authSchema = z.object({
  accessToken: z.string().min(20),
});

const registrationSchema = authSchema.extend({
  registrationId: z.string().uuid(),
});

const correctionSchema = registrationSchema.extend({
  transporter: z.object({
    name: z.string().min(3),
    docType: z.string(),
    docNumber: z.string().min(11),
    phone: z.string().min(10),
    email: z.string().optional().nullable(),
    city: z.string().min(2),
    uf: z.string().length(2),
    linkType: z.string().min(1),
  }),
  vehicle: z.object({
    plate: z.string().min(7),
    brandModel: z.string().min(1),
    vehicleType: z.string().optional().nullable(),
    species: z.string().optional().nullable(),
    wheelType: z.string().optional().nullable(),
    bodyType: z.string().optional().nullable(),
    manufactureYear: z.number().int().optional().nullable(),
    modelYear: z.number().int().optional().nullable(),
    pbtKg: z.number().positive(),
    tareKg: z.number().nonnegative(),
    lotacaoKg: z.number().positive(),
    pallets: z.number().int().nonnegative(),
    axles: z.number().int().nonnegative().optional().nullable(),
    renavam: z.string().min(5),
    chassis: z.string().min(5),
    engineNumber: z.string().optional().nullable(),
    plateCity: z.string().optional().nullable(),
    plateUf: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    fuel: z.string().optional().nullable(),
    rntrc: z.string().min(3),
    bodyWidthM: z.number().positive(),
    bodyHeightM: z.number().positive(),
    bodyLengthM: z.number().positive(),
    tollTagNumber: z.string().optional().nullable(),
    tollTagCompany: z.string().optional().nullable(),
    tollTagOwned: z.boolean(),
    grfSticker: z.boolean(),
    hasMonitoringCamera: z.boolean(),
  }),
  driver: z.object({
    name: z.string().min(3),
    cpf: z.string().min(11),
    cnh: z.string().min(5),
    cnhCategory: z.string().min(1),
    phone: z.string().min(10),
  }),
  tracking: z.object({
    hasTracker: z.boolean(),
    provider: z.string().optional().nullable(),
    identifier: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
  }),
  documents: z.array(
    z.object({
      docType: z.string(),
      fileName: z.string(),
      fileSize: z.number().int().nonnegative(),
      mimeType: z.string().optional().nullable(),
      storagePath: z.string().min(1),
    }),
  ),
  declarationAccepted: z.boolean(),
});

async function transporterContext(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  const user = userResult?.user;
  if (userError || !user) return null;

  const { data: membership } = await db
    .from("transporter_memberships")
    .select("transporter_company_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!membership) return null;

  return {
    userId: user.id,
    companyId: String(membership.transporter_company_id),
    db,
    supabaseAdmin,
  };
}

async function ownedVehicleIds(db: any, companyId: string) {
  const { data: links } = await db
    .from("transporter_vehicle_links")
    .select("vehicle_id")
    .eq("transporter_company_id", companyId)
    .eq("active", true);
  return (links ?? []).map((row: any) => String(row.vehicle_id));
}

async function getOwnedReturnedRegistration(ctx: Awaited<ReturnType<typeof transporterContext>>, registrationId: string) {
  if (!ctx) return null;
  const vehicleIds = await ownedVehicleIds(ctx.db, ctx.companyId);
  if (!vehicleIds.length) return null;

  const { data: registration } = await ctx.db
    .from("vehicle_registrations")
    .select("*")
    .eq("id", registrationId)
    .eq("status", "DEVOLVIDO")
    .in("vehicle_id", vehicleIds)
    .maybeSingle();
  return registration ?? null;
}

export const listReturnedCorrections = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => authSchema.parse(d))
  .handler(async ({ data }) => {
    const ctx = await transporterContext(data.accessToken);
    if (!ctx) return { ok: false as const, error: "Acesso de transportadora inválido ou expirado." };

    const vehicleIds = await ownedVehicleIds(ctx.db, ctx.companyId);
    if (!vehicleIds.length) return { ok: true as const, rows: [] };

    const { data: registrations, error } = await ctx.db
      .from("vehicle_registrations")
      .select("id, protocol, plate, brand_model, status, updated_at, vehicle_id")
      .eq("status", "DEVOLVIDO")
      .in("vehicle_id", vehicleIds)
      .order("updated_at", { ascending: false });
    if (error) return { ok: false as const, error: "Não foi possível consultar os cadastros devolvidos." };

    const ids = (registrations ?? []).map((row: any) => String(row.id));
    const latestNote = new Map<string, string>();
    if (ids.length) {
      const { data: history } = await ctx.db
        .from("approval_history")
        .select("registration_id, note, created_at")
        .in("registration_id", ids)
        .eq("to_status", "DEVOLVIDO")
        .order("created_at", { ascending: false });
      for (const row of history ?? []) {
        const id = String(row.registration_id);
        if (!latestNote.has(id) && row.note) latestNote.set(id, String(row.note));
      }
    }

    return {
      ok: true as const,
      rows: (registrations ?? []).map((row: any) => ({
        id: String(row.id),
        protocol: String(row.protocol),
        plate: String(row.plate),
        brandModel: row.brand_model ? String(row.brand_model) : null,
        updatedAt: String(row.updated_at),
        note: latestNote.get(String(row.id)) ?? null,
      })),
    };
  });

export const getReturnedCorrection = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registrationSchema.parse(d))
  .handler(async ({ data }) => {
    const ctx = await transporterContext(data.accessToken);
    if (!ctx) return { ok: false as const, error: "Acesso de transportadora inválido ou expirado." };

    const registration = await getOwnedReturnedRegistration(ctx, data.registrationId);
    if (!registration) {
      return { ok: false as const, error: "Cadastro devolvido não encontrado para esta transportadora." };
    }

    const [{ data: transporter }, { data: drivers }, { data: trackers }, { data: documents }, { data: master }, { data: history }] = await Promise.all([
      ctx.db.from("transporters").select("*").eq("id", registration.transporter_id).maybeSingle(),
      ctx.db.from("drivers").select("*").eq("registration_id", registration.id).order("created_at", { ascending: false }).limit(1),
      ctx.db.from("tracking_devices").select("*").eq("registration_id", registration.id).order("created_at", { ascending: false }).limit(1),
      ctx.db.from("documents").select("id, doc_type, file_name, file_size, mime_type, storage_path, status").eq("registration_id", registration.id).order("created_at", { ascending: false }),
      ctx.db.from("vehicles").select("*").eq("id", registration.vehicle_id).maybeSingle(),
      ctx.db.from("approval_history").select("note, created_at").eq("registration_id", registration.id).eq("to_status", "DEVOLVIDO").order("created_at", { ascending: false }).limit(1),
    ]);

    const seen = new Set<string>();
    const docs = [] as Array<Record<string, unknown>>;
    for (const doc of documents ?? []) {
      const type = String(doc.doc_type);
      if (seen.has(type)) continue;
      seen.add(type);
      let url: string | null = null;
      if (doc.storage_path) {
        const { data: signed } = await ctx.supabaseAdmin.storage.from(STORAGE_BUCKET).createSignedUrl(String(doc.storage_path), 60 * 60);
        url = signed?.signedUrl ?? null;
      }
      docs.push({ ...doc, url });
    }

    return {
      ok: true as const,
      registration,
      transporter: transporter ?? null,
      driver: drivers?.[0] ?? null,
      tracking: trackers?.[0] ?? null,
      master: master ?? null,
      documents: docs,
      returnNote: history?.[0]?.note ? String(history[0].note) : null,
    };
  });

export const resubmitReturnedCorrection = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => correctionSchema.parse(d))
  .handler(async ({ data }) => {
    const ctx = await transporterContext(data.accessToken);
    if (!ctx) return { ok: false as const, error: "Acesso de transportadora inválido ou expirado." };

    if (!data.declarationAccepted) {
      return { ok: false as const, error: "Confirme a declaração de veracidade antes de reenviar." };
    }

    const registration = await getOwnedReturnedRegistration(ctx, data.registrationId);
    if (!registration) {
      return { ok: false as const, error: "Este cadastro não está mais disponível para correção." };
    }

    const plate = data.vehicle.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (plate !== String(registration.plate).toUpperCase()) {
      return { ok: false as const, error: "A placa do cadastro não pode ser alterada nesta correção." };
    }

    const sent = new Set(data.documents.map((d) => d.docType));
    const missing = ATTACHMENT_TYPES.filter((att) => att.required && !sent.has(att.key));
    if (missing.length) {
      return { ok: false as const, error: `Anexos obrigatórios faltando: ${missing.map((item) => item.label).join(", ")}.` };
    }

    const now = new Date().toISOString();

    const { error: transporterError } = await ctx.db
      .from("transporters")
      .update({
        name: data.transporter.name,
        doc_type: data.transporter.docType,
        doc_number: data.transporter.docNumber,
        phone: data.transporter.phone,
        email: data.transporter.email ?? "",
        city: data.transporter.city,
        uf: data.transporter.uf,
        link_type: data.transporter.linkType,
      })
      .eq("id", registration.transporter_id);
    if (transporterError) return { ok: false as const, error: "Não foi possível atualizar os dados do transportador." };

    const { error: registrationError } = await ctx.db
      .from("vehicle_registrations")
      .update({
        status: "AGUARDANDO_ANALISE",
        vehicle_type: data.vehicle.vehicleType || null,
        species: data.vehicle.species || null,
        wheel_type: data.vehicle.wheelType || null,
        body_type: data.vehicle.bodyType || null,
        brand_model: data.vehicle.brandModel,
        manufacture_year: data.vehicle.manufactureYear ?? null,
        model_year: data.vehicle.modelYear ?? null,
        max_weight_kg: data.vehicle.pbtKg,
        tare_kg: data.vehicle.tareKg,
        max_capacity_kg: data.vehicle.lotacaoKg,
        pallets: data.vehicle.pallets,
        axles: data.vehicle.axles ?? null,
        renavam: data.vehicle.renavam,
        chassis: data.vehicle.chassis,
        engine_number: data.vehicle.engineNumber || null,
        plate_city: data.vehicle.plateCity || null,
        plate_uf: data.vehicle.plateUf || null,
        color: data.vehicle.color || null,
        fuel: data.vehicle.fuel || null,
        grf_sticker: data.vehicle.grfSticker,
        has_monitoring_camera: data.vehicle.hasMonitoringCamera,
        declaration_accepted: true,
        updated_at: now,
      })
      .eq("id", registration.id)
      .eq("status", "DEVOLVIDO");
    if (registrationError) return { ok: false as const, error: "Não foi possível reenviar o cadastro para análise." };

    const { data: existingDriver } = await ctx.db.from("drivers").select("id").eq("registration_id", registration.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingDriver?.id) {
      await ctx.db.from("drivers").update({ name: data.driver.name, cpf: data.driver.cpf, cnh: data.driver.cnh, cnh_category: data.driver.cnhCategory, phone: data.driver.phone }).eq("id", existingDriver.id);
    } else {
      await ctx.db.from("drivers").insert({ registration_id: registration.id, name: data.driver.name, cpf: data.driver.cpf, cnh: data.driver.cnh, cnh_category: data.driver.cnhCategory, phone: data.driver.phone });
    }

    const { data: existingTracker } = await ctx.db.from("tracking_devices").select("id").eq("registration_id", registration.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const trackingValues = {
      has_tracker: data.tracking.hasTracker,
      provider: data.tracking.hasTracker ? data.tracking.provider ?? null : null,
      identifier: data.tracking.hasTracker ? data.tracking.identifier ?? null : null,
      status: data.tracking.hasTracker ? data.tracking.status ?? null : null,
    };
    if (existingTracker?.id) await ctx.db.from("tracking_devices").update(trackingValues).eq("id", existingTracker.id);
    else await ctx.db.from("tracking_devices").insert({ registration_id: registration.id, ...trackingValues });

    const { data: existingDocs } = await ctx.db.from("documents").select("id, doc_type, storage_path").eq("registration_id", registration.id).order("created_at", { ascending: false });
    const existingByType = new Map<string, any>();
    for (const row of existingDocs ?? []) {
      const type = String(row.doc_type);
      if (!existingByType.has(type)) existingByType.set(type, row);
    }

    for (const doc of data.documents) {
      const existing = existingByType.get(doc.docType);
      if (existing?.id) {
        if (String(existing.storage_path ?? "") !== doc.storagePath) {
          await ctx.db.from("documents").update({ file_name: doc.fileName, file_size: doc.fileSize, mime_type: doc.mimeType ?? null, storage_path: doc.storagePath, status: "ENVIADO" }).eq("id", existing.id);
        }
      } else {
        await ctx.db.from("documents").insert({ registration_id: registration.id, doc_type: doc.docType, file_name: doc.fileName, file_size: doc.fileSize, mime_type: doc.mimeType ?? null, storage_path: doc.storagePath, status: "ENVIADO" });
      }
    }

    if (registration.vehicle_id) {
      await ctx.db
        .from("vehicles")
        .update({
          completion_status: "EM_ANALISE",
          transporter_name: data.transporter.name,
          driver_name: data.driver.name,
          brand_model: data.vehicle.brandModel,
          vehicle_type: data.vehicle.vehicleType || null,
          species: data.vehicle.species || null,
          wheel_type: data.vehicle.wheelType || null,
          body_type: data.vehicle.bodyType || null,
          manufacture_year: data.vehicle.manufactureYear ?? null,
          model_year: data.vehicle.modelYear ?? null,
          pbt_kg: data.vehicle.pbtKg,
          tare_kg: data.vehicle.tareKg,
          lotacao_kg: data.vehicle.lotacaoKg,
          max_capacity_kg: data.vehicle.lotacaoKg,
          pallets: data.vehicle.pallets,
          axles: data.vehicle.axles ?? null,
          renavam: data.vehicle.renavam,
          chassis: data.vehicle.chassis,
          engine_number: data.vehicle.engineNumber || null,
          plate_city: data.vehicle.plateCity || null,
          plate_uf: data.vehicle.plateUf || null,
          color: data.vehicle.color || null,
          fuel: data.vehicle.fuel || null,
          rntrc: data.vehicle.rntrc,
          toll_tag_number: data.vehicle.tollTagNumber || null,
          toll_tag_company: data.vehicle.tollTagCompany || null,
          toll_tag_owned: data.vehicle.tollTagOwned,
          body_width_m: data.vehicle.bodyWidthM,
          body_height_m: data.vehicle.bodyHeightM,
          body_length_m: data.vehicle.bodyLengthM,
          has_tracker: data.tracking.hasTracker,
          tracker_provider: data.tracking.hasTracker ? data.tracking.provider || null : null,
          tracker_identifier: data.tracking.hasTracker ? data.tracking.identifier || null : null,
          tracker_status: data.tracking.hasTracker ? data.tracking.status || null : null,
          grf_sticker: data.vehicle.grfSticker,
          has_monitoring_camera: data.vehicle.hasMonitoringCamera,
          updated_at: now,
        })
        .eq("id", registration.vehicle_id);
    }

    await ctx.db.from("approval_history").insert({
      registration_id: registration.id,
      action: "REENVIO_CORRECAO",
      from_status: "DEVOLVIDO",
      to_status: "AGUARDANDO_ANALISE",
      user_name: data.transporter.name,
      note: "Correções realizadas e cadastro reenviado pelo transportador.",
    });

    return { ok: true as const, protocol: String(registration.protocol), id: String(registration.id) };
  });
