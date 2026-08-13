import { createServerFn } from "@tanstack/react-start";
import { plateInputSchema } from "@/lib/grf-server-helpers";

export const lookupSankhyaVehicle = createServerFn({ method: "POST" })
  .inputValidator((d: { plate: string }) => plateInputSchema.parse(d))
  .handler(async ({ data }) => {
    const plate = data.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (plate.length !== 7) return { found: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row, error } = await db
      .from("sankhya_vehicle_catalog")
      .select("plate, model, capacity_kg, pallets, fleet_vehicle_type")
      .eq("plate", plate)
      .maybeSingle();

    if (error || !row) return { found: false as const };

    return {
      found: true as const,
      vehicle: {
        plate: row.plate as string,
        model: (row.model as string | null) ?? null,
        capacityKg: row.capacity_kg == null ? null : Number(row.capacity_kg),
        pallets: row.pallets == null ? null : Number(row.pallets),
        fleetVehicleType: (row.fleet_vehicle_type as string | null) ?? null,
      },
    };
  });
