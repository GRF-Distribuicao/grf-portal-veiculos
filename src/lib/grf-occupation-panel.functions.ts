import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOccupationPanelHtml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);

    const { getOccupationPanelHtmlServer } = await import("@/lib/grf-occupation-panel.server");
    return { html: getOccupationPanelHtmlServer() };
  });
