import { createServerFn } from "@tanstack/react-start";
import { plateInputSchema } from "@/lib/grf-server-helpers";

/**
 * Consulta o cadastro mestre definitivo de veículos.
 * O nome da função foi mantido para não quebrar as telas que já a utilizavam.
 */
export const lookupSankhyaVehicle = createServerFn({ method: "POST" })
  .inputValidator((d: { plate: string }) => plateInputSchema.parse(d))
  .handler(async ({ data }) => {
    const plate = data.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (plate.length !== 7) return { found: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row, error } = await db
      .from("vehicles")
      .select(
        "plate, source, sankhya_registered, completion_status, fleet_status, operation, support_point, transporter_name, driver_name, brand_model, vehicle_type, body_type, pbt_kg, tare_kg, lotacao_kg, max_capacity_kg, pallets, renavam, chassis, rntrc, body_width_m, body_height_m, body_length_m, has_tracker, tracker_provider, tracker_identifier, tracker_status",
      )
      .eq("plate", plate)
      .maybeSingle();

    if (error || !row) return { found: false as const };

    const missingFields: string[] = [];
    if (!row.brand_model) missingFields.push("Marca / modelo");
    if (row.pbt_kg == null) missingFields.push("PBT");
    if (row.tare_kg == null) missingFields.push("TARA");
    if (row.lotacao_kg == null && row.max_capacity_kg == null) missingFields.push("LOTAÇÃO");
    if (row.pallets == null) missingFields.push("Quantidade de pallets");
    if (!row.renavam) missingFields.push("RENAVAM");
    if (!row.chassis) missingFields.push("Chassi");
    if (!row.rntrc) missingFields.push("ANTT / RNTRC");
    if (row.body_width_m == null) missingFields.push("Largura da carroceria");
    if (row.body_height_m == null) missingFields.push("Altura da carroceria");
    if (row.body_length_m == null) missingFields.push("Comprimento da carroceria");
    if (row.has_tracker == null) missingFields.push("Rastreamento");

    return {
      found: true as const,
      vehicle: {
        plate: row.plate as string,
        source: (row.source as string | null) ?? null,
        sankhyaRegistered: Boolean(row.sankhya_registered),
        completionStatus: (row.completion_status as string | null) ?? "PENDENTE_COMPLEMENTO",
        fleetStatus: (row.fleet_status as string | null) ?? null,
        operation: (row.operation as string | null) ?? null,
        supportPoint: (row.support_point as string | null) ?? null,
        transporterName: (row.transporter_name as string | null) ?? null,
        driverName: (row.driver_name as string | null) ?? null,
        model: (row.brand_model as string | null) ?? null,
        fleetVehicleType: (row.vehicle_type as string | null) ?? null,
        bodyType: (row.body_type as string | null) ?? null,
        pbtKg: row.pbt_kg == null ? null : Number(row.pbt_kg),
        tareKg: row.tare_kg == null ? null : Number(row.tare_kg),
        capacityKg:
          row.lotacao_kg != null
            ? Number(row.lotacao_kg)
            : row.max_capacity_kg == null
              ? null
              : Number(row.max_capacity_kg),
        pallets: row.pallets == null ? null : Number(row.pallets),
        renavam: (row.renavam as string | null) ?? null,
        chassis: (row.chassis as string | null) ?? null,
        rntrc: (row.rntrc as string | null) ?? null,
        bodyWidthM: row.body_width_m == null ? null : Number(row.body_width_m),
        bodyHeightM: row.body_height_m == null ? null : Number(row.body_height_m),
        bodyLengthM: row.body_length_m == null ? null : Number(row.body_length_m),
        hasTracker: row.has_tracker == null ? null : Boolean(row.has_tracker),
        trackerProvider: (row.tracker_provider as string | null) ?? null,
        trackerIdentifier: (row.tracker_identifier as string | null) ?? null,
        trackerStatus: (row.tracker_status as string | null) ?? null,
        missingFields,
      },
    };
  });
