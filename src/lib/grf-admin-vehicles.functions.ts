import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listVehicleMasterSchema = z.object({
  search: z.string().optional(),
  sankhya: z.enum(["TODOS", "SIM", "NAO"]).optional(),
  completionStatus: z.string().optional(),
});

export const listVehicleMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listVehicleMasterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: rows, error } = await db
      .from("vehicles")
      .select(
        "id, plate, source, sankhya_registered, completion_status, brand_model, vehicle_type, transporter_name, driver_name, pbt_kg, tare_kg, lotacao_kg, pallets, rntrc, grf_sticker, has_monitoring_camera, updated_at, vehicle_registrations(id, protocol, status)",
      )
      .order("plate", { ascending: true });

    if (error) throw error;

    const all = (rows ?? []) as Array<Record<string, any>>;
    const term = (data.search ?? "").trim().toLowerCase();
    const plateTerm = term.replace(/[^a-z0-9]/g, "");

    const filtered = all.filter((row) => {
      if (data.sankhya === "SIM" && !row.sankhya_registered) return false;
      if (data.sankhya === "NAO" && row.sankhya_registered) return false;
      if (
        data.completionStatus &&
        data.completionStatus !== "TODOS" &&
        row.completion_status !== data.completionStatus
      ) {
        return false;
      }
      if (!term) return true;

      return (
        String(row.plate ?? "").toLowerCase().includes(plateTerm) ||
        String(row.brand_model ?? "").toLowerCase().includes(term) ||
        String(row.vehicle_type ?? "").toLowerCase().includes(term) ||
        String(row.transporter_name ?? "").toLowerCase().includes(term) ||
        String(row.driver_name ?? "").toLowerCase().includes(term) ||
        String(row.rntrc ?? "").toLowerCase().includes(term)
      );
    });

    const counts = {
      total: all.length,
      sankhya: all.filter((row) => row.sankhya_registered).length,
      foraSankhya: all.filter((row) => !row.sankhya_registered).length,
      pendentes: all.filter((row) => row.completion_status === "PENDENTE_COMPLEMENTO").length,
      emAnalise: all.filter((row) => row.completion_status === "EM_ANALISE").length,
      completos: all.filter((row) => row.completion_status === "COMPLETO").length,
    };

    return { list: filtered, counts };
  });
