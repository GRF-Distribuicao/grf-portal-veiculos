import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
type ExportValue = string | number | boolean | null | ExportValue[] | { [key: string]: ExportValue };

/** Leitura independente: exportar nunca altera a fila ou o cadastro. */
export const exportSankhyaQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows: Record<string, ExportValue>[] = [];
    // Paginação evita o limite padrão de linhas da API.
    const pageSize = 200;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from("vehicle_registrations")
        .select("*, transporters(*), drivers(*), tracking_devices(*), vehicles!vehicle_registrations_vehicle_id_fkey(rntrc, toll_tag_number, toll_tag_company, toll_tag_owned, body_width_m, body_height_m, body_length_m, pbt_kg, lotacao_kg, operation, support_point, completion_status, fleet_status, sankhya_registered, sankhya_tipo_rodado, sankhya_tipo_carroceria), documents(doc_type, file_name, file_size, mime_type, status, created_at)")
        .eq("status", "PRONTO_INTEGRACAO")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error("Não foi possível consultar a fila para exportação.");
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return withSankhyaPartner(supabaseAdmin, rows);
  });

/**
 * Parceiro Sankhya = transportadora ativa do veículo no portal (migração 22).
 * Sem vínculo ou sem código, a coluna sai vazia; a exportação não falha.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withSankhyaPartner(db: any, rows: Record<string, ExportValue>[]) {
  const vehicleIds = [...new Set(rows.map((r) => r["vehicle_id"]).filter((v): v is string => typeof v === "string"))];
  const companyByVehicle = new Map<string, { name: string; codparc: number | null }>();
  for (let i = 0; i < vehicleIds.length; i += 200) {
    const { data, error } = await db
      .from("transporter_vehicle_links")
      .select("vehicle_id, transporter_companies(name, sankhya_codparc)")
      .eq("active", true)
      .in("vehicle_id", vehicleIds.slice(i, i + 200));
    if (error) throw new Error("Não foi possível consultar a transportadora dos veículos.");
    for (const link of (data ?? []) as unknown as { vehicle_id: string; transporter_companies: { name: string; sankhya_codparc: number | null } | null }[]) {
      const company = link.transporter_companies;
      if (company) companyByVehicle.set(link.vehicle_id, { name: company.name, codparc: company.sankhya_codparc });
    }
  }
  return rows.map((row) => {
    const company = typeof row["vehicle_id"] === "string" ? companyByVehicle.get(row["vehicle_id"]) : undefined;
    return { ...row, portal_company: company?.name ?? null, sankhya_codparc: company?.codparc ?? null };
  });
}
