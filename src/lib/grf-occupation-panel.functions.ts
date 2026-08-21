import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Emite o ticket de curta duração que autoriza o `<iframe>` a buscar o HTML do
 * painel em `/admin/ocupacao/painel`. O HTML em si NÃO trafega por aqui: antes
 * ele era devolvido inteiro dentro do JSON desta server function, o que fazia a
 * chamada falhar no navegador ("Failed to fetch").
 */
export const createOccupationPanelTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);

    const { issueOccupationPanelTicket } = await import("@/lib/grf-occupation-panel.server");
    return { ticket: issueOccupationPanelTicket(context.userId) };
  });
