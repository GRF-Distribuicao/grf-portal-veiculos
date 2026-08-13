import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ATTACHMENT_TYPES } from "@/lib/grf-domain";
import { makeProtocol } from "@/lib/grf-server-helpers";

const completeVehicleSchema = z.object({
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
    bodyType: z.string().optional().nullable(),
    pbtKg: z.number().positive(),
    tareKg: z.number().nonnegative(),
    lotacaoKg: z.number().positive(),
    pallets: z.number().int().nonnegative(),
    renavam: z.string().min(5),
    chassis: z.string().min(5),
    rntrc: z.string().min(3),
    bodyWidthM: z.number().positive(),
    bodyHeightM: z.number().positive(),
    bodyLengthM: z.number().positive(),
    tollTagNumber: z.string().optional().nullable(),
    tollTagCompany: z.string().optional().nullable(),
    tollTagOwned: z.boolean(),
    grfSticker: z.boolean().optional().default(false),
    hasMonitoringCamera: z.boolean().optional().default(false),
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
      storagePath: z.string(),
    }),
  ),
  declarationAccepted: z.boolean(),
});

export const completeExistingVehicle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => completeVehicleSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const plate = data.vehicle.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    if (!data.declarationAccepted) {
      return { ok: false as const, error: "Confirme a declaração de veracidade antes de enviar." };
    }

    const sent = new Set(data.documents.map((d) => d.docType));
    const missingDocs = ATTACHMENT_TYPES.filter((a) => a.required && !sent.has(a.key));
    if (missingDocs.length) {
      return {
        ok: false as const,
        error: `Anexos obrigatórios faltando: ${missingDocs.map((m) => m.label).join(", ")}.`,
      };
    }

    const { data: master, error: masterError } = await db
      .from("vehicles")
      .select("id, plate, vehicle_type, species, wheel_type, body_type, manufacture_year, model_year, plate_city, plate_uf, color, fuel, company_vehicle")
      .eq("plate", plate)
      .maybeSingle();

    if (masterError || !master) {
      return {
        ok: false as const,
        error: "Veículo não encontrado no cadastro mestre. Use o cadastro normal para uma placa nova.",
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
        error: `Este veículo já possui um cadastro enviado no Portal GRF (protocolo ${existing.protocol}).`,
      };
    }

    const { data: transporter, error: transporterError } = await supabaseAdmin
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

    if (transporterError || !transporter) {
      return { ok: false as const, error: "Falha ao salvar o responsável / transportador." };
    }

    const protocol = makeProtocol();
    const { data: registration, error: registrationError } = await db
      .from("vehicle_registrations")
      .insert({
        protocol,
        transporter_id: transporter.id,
        vehicle_id: master.id,
        status: "AGUARDANDO_ANALISE",
        plate,
        vehicle_type: master.vehicle_type,
        species: master.species,
        wheel_type: master.wheel_type,
        body_type: data.vehicle.bodyType || master.body_type,
        brand_model: data.vehicle.brandModel,
        manufacture_year: master.manufacture_year,
        model_year: master.model_year,
        max_weight_kg: data.vehicle.pbtKg,
        tare_kg: data.vehicle.tareKg,
        max_capacity_kg: data.vehicle.lotacaoKg,
        pallets: data.vehicle.pallets,
        renavam: data.vehicle.renavam,
        chassis: data.vehicle.chassis,
        plate_city: master.plate_city,
        plate_uf: master.plate_uf,
        color: master.color,
        fuel: master.fuel,
        company_vehicle: master.company_vehicle ?? false,
        grf_sticker: data.vehicle.grfSticker,
        has_monitoring_camera: data.vehicle.hasMonitoringCamera,
        declaration_accepted: true,
      })
      .select("id, protocol")
      .single();

    if (registrationError || !registration) {
      return { ok: false as const, error: "Falha ao criar o protocolo de complementação do veículo." };
    }

    const { error: driverError } = await supabaseAdmin.from("drivers").insert({
      registration_id: registration.id,
      name: data.driver.name,
      cpf: data.driver.cpf,
      cnh: data.driver.cnh,
      cnh_category: data.driver.cnhCategory,
      phone: data.driver.phone,
    });

    const { error: trackingError } = await supabaseAdmin.from("tracking_devices").insert({
      registration_id: registration.id,
      has_tracker: data.tracking.hasTracker,
      provider: data.tracking.hasTracker ? data.tracking.provider ?? null : null,
      identifier: data.tracking.hasTracker ? data.tracking.identifier ?? null : null,
      status: data.tracking.hasTracker ? data.tracking.status ?? null : null,
    });

    if (driverError || trackingError) {
      return { ok: false as const, error: "Cadastro criado, mas houve falha ao salvar motorista ou rastreamento." };
    }

    if (data.documents.length) {
      const { error: docsError } = await supabaseAdmin.from("documents").insert(
        data.documents.map((d) => ({
          registration_id: registration.id,
          doc_type: d.docType,
          file_name: d.fileName,
          file_size: d.fileSize,
          mime_type: d.mimeType ?? null,
          storage_path: d.storagePath,
          status: "ENVIADO",
        })),
      );
      if (docsError) {
        return { ok: false as const, error: "Cadastro criado, mas houve falha ao vincular os documentos." };
      }
    }

    await db
      .from("vehicles")
      .update({
        completion_status: "EM_ANALISE",
        transporter_name: data.transporter.name,
        driver_name: data.driver.name,
        brand_model: data.vehicle.brandModel,
        body_type: data.vehicle.bodyType || master.body_type,
        pbt_kg: data.vehicle.pbtKg,
        tare_kg: data.vehicle.tareKg,
        lotacao_kg: data.vehicle.lotacaoKg,
        max_capacity_kg: data.vehicle.lotacaoKg,
        pallets: data.vehicle.pallets,
        renavam: data.vehicle.renavam,
        chassis: data.vehicle.chassis,
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", master.id);

    await supabaseAdmin.from("approval_history").insert({
      registration_id: registration.id,
      action: "ENVIO_COMPLEMENTO",
      from_status: "PENDENTE_COMPLEMENTO",
      to_status: "AGUARDANDO_ANALISE",
      user_name: data.transporter.name,
      note: "Cadastro pré-existente complementado pelo transportador.",
    });

    return { ok: true as const, protocol: registration.protocol, id: registration.id };
  });
