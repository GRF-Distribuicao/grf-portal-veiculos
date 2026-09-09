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
        .select("*, transporters(*), drivers(*), tracking_devices(*), documents(doc_type, file_name, file_size, mime_type, status, created_at)")
        .eq("status", "PRONTO_INTEGRACAO")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error("Não foi possível consultar a fila para exportação.");
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  });
