import { createServerFn } from "@tanstack/react-start";
import { plateInputSchema } from "@/lib/grf-server-helpers";

export const prepareVehicleMaster = createServerFn({ method: "POST" })
  .inputValidator((d: { plate: string }) => plateInputSchema.parse(d))
  .handler(async ({ data }) => {
    const plate = data.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (plate.length !== 7) return { ok: false as const, error: "Informe uma placa valida." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: sent } = await supabaseAdmin
      .from("vehicle_registrations")
      .select("protocol, status")
      .eq("plate", plate)
      .maybeSingle();

    if (sent) {
      return {
        ok: false as const,
        alreadySubmitted: true as const,
        protocol: sent.protocol,
        status: sent.status,
        error: "Este veiculo ja possui cadastro enviado no Portal GRF.",
      };
    }

    const { data: existing, error: lookupError } = await db
      .from("vehicles")
      .select("id")
      .eq("plate", plate)
      .maybeSingle();

    if (lookupError) return { ok: false as const, error: "Falha ao consultar o cadastro mestre." };
    if (existing) return { ok: true as const, created: false as const, plate };

    const { error: insertError } = await db.from("vehicles").insert({
      plate,
      source: "PORTAL",
      sankhya_registered: false,
      completion_status: "PENDENTE_COMPLEMENTO",
    });

    if (insertError) return { ok: false as const, error: "Falha ao preparar o cadastro do veiculo." };
    return { ok: true as const, created: true as const, plate };
  });
