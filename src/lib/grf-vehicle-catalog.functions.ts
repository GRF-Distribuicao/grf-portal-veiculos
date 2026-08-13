import { createServerFn } from "@tanstack/react-start";
import { plateInputSchema } from "@/lib/grf-server-helpers";

/**
 * Consulta somente a base de referência importada do Sankhya.
 *
 * Importante: esta função NÃO consulta `vehicle_registrations` e NÃO altera a
 * regra existente que impede cadastro duplicado no Portal GRF. O catálogo é
 * usado apenas para apresentar/preencher informações já conhecidas quando a
 * placa é digitada.
 */
export const lookupSankhyaVehicle = createServerFn({ method: "POST" })
  .inputValidator((d: { plate: string }) => plateInputSchema.parse(d))
  .handler(async ({ data }) => {
    const plate = data.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (plate.length !== 7) return { found: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A tabela é server-only (RLS sem política pública). `any` mantém esta
    // adição isolada até a próxima regeneração automática dos tipos do banco.
    const db = supabaseAdmin as any;
    const { data: row, error } = await db
      .from("sankhya_vehicle_catalog")
      .select(
        "plate, fleet_status, operation, support_point, transporter_name, driver_name, model, capacity_kg, pallets, fleet_vehicle_type",
      )
      .eq("plate", plate)
      .maybeSingle();

    if (error) {
      console.error("[GRF] Falha na consulta do catálogo Sankhya", error);
      return { found: false as const };
    }
    if (!row) return { found: false as const };

    return {
      found: true as const,
      vehicle: {
        plate: row.plate as string,
        fleetStatus: (row.fleet_status as string | null) ?? null,
        operation: (row.operation as string | null) ?? null,
        supportPoint: (row.support_point as string | null) ?? null,
        transporterName: (row.transporter_name as string | null) ?? null,
        driverName: (row.driver_name as string | null) ?? null,
        model: (row.model as string | null) ?? null,
        capacityKg: row.capacity_kg == null ? null : Number(row.capacity_kg),
        pallets: row.pallets == null ? null : Number(row.pallets),
        fleetVehicleType: (row.fleet_vehicle_type as string | null) ?? null,
      },
    };
  });
