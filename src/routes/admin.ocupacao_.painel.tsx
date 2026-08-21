import { createFileRoute } from "@tanstack/react-router";

const SECURITY_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
  "content-security-policy": "frame-ancestors 'self'",
};

/** Mensagem legível dentro do iframe quando o ticket expira ou o acesso é negado. */
function deniedResponse(status: number, message: string) {
  const body = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Painel de Ocupação</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font:15px/1.5 system-ui,sans-serif;color:#4a4a4c;background:#f5f6f8">
<p style="max-width:32rem;text-align:center;padding:1.5rem">${message}</p>
</body></html>`;
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Entrega o HTML do Painel de Ocupação direto como `text/html`, para ser
 * consumido pelo `<iframe src>` em `/admin/ocupacao`.
 *
 * Rota sem componente: só existe o handler GET. O acesso continua restrito —
 * exige um ticket assinado (emitido apenas para usuário autenticado) e revalida
 * o papel GRF via `assertGrfUser`, o mesmo usado no resto da Área GRF.
 */
export const Route = createFileRoute("/admin/ocupacao_/painel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { verifyOccupationPanelTicket, getOccupationPanelHtmlServer } =
          await import("@/lib/grf-occupation-panel.server");

        const ticket = new URL(request.url).searchParams.get("t");
        const userId = verifyOccupationPanelTicket(ticket);
        if (!userId) {
          return deniedResponse(
            401,
            "Sessão expirada. Atualize a página para recarregar o painel.",
          );
        }

        const { assertGrfUser } = await import("@/lib/grf-auth.server");
        try {
          await assertGrfUser(userId);
        } catch {
          return deniedResponse(403, "Seu usuário não tem acesso ao Painel de Ocupação.");
        }

        return new Response(getOccupationPanelHtmlServer(), {
          status: 200,
          headers: { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
