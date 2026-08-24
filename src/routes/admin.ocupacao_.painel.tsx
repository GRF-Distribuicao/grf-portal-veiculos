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

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, "content-type": "application/json; charset=utf-8" },
  });
}

/** Mesmo ticket usado pelo GET, validado + papel GRF reconferido. Compartilhado pelos dois handlers. */
async function requireGrfUserFromTicket(request: Request): Promise<string | Response> {
  const { verifyOccupationPanelTicket } = await import("@/lib/grf-occupation-panel.server");
  const ticket = new URL(request.url).searchParams.get("t");
  const userId = verifyOccupationPanelTicket(ticket);
  if (!userId) {
    return jsonResponse(401, { error: "Sessão expirada. Atualize a página e tente novamente." });
  }

  const { assertGrfUser } = await import("@/lib/grf-auth.server");
  try {
    await assertGrfUser(userId);
  } catch {
    return jsonResponse(403, { error: "Seu usuário não tem acesso ao Painel de Ocupação." });
  }
  return userId;
}

/**
 * Entrega o HTML do Painel de Ocupação direto como `text/html`, para ser
 * consumido pelo `<iframe src>` em `/admin/ocupacao`, e recebe (via POST) as
 * linhas da planilha carregada dentro do painel para gravar no histórico.
 *
 * Rota sem componente: só existem os handlers GET/POST. O acesso continua
 * restrito — exige o mesmo ticket assinado (emitido apenas para usuário
 * autenticado) e revalida o papel GRF via `assertGrfUser` em cada chamada.
 */
export const Route = createFileRoute("/admin/ocupacao_/painel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireGrfUserFromTicket(request);
        if (auth instanceof Response) {
          return deniedResponse(
            auth.status,
            auth.status === 401
              ? "Sessão expirada. Atualize a página para recarregar o painel."
              : "Seu usuário não tem acesso ao Painel de Ocupação.",
          );
        }

        const { getOccupationPanelHtmlServer } = await import("@/lib/grf-occupation-panel.server");
        return new Response(getOccupationPanelHtmlServer(), {
          status: 200,
          headers: { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" },
        });
      },

      POST: async ({ request }) => {
        const auth = await requireGrfUserFromTicket(request);
        if (auth instanceof Response) return auth;

        let payload: { rows?: unknown; sourceFile?: unknown };
        try {
          payload = await request.json();
        } catch {
          return jsonResponse(400, { error: "Corpo da requisição inválido (esperado JSON)." });
        }

        if (!Array.isArray(payload.rows)) {
          return jsonResponse(400, { error: "Campo 'rows' ausente ou não é uma lista." });
        }

        const sourceFile = typeof payload.sourceFile === "string" ? payload.sourceFile.slice(0, 200) : null;

        try {
          const { syncOccupationRecords } = await import("@/lib/grf-occupation-sync.server");
          const result = await syncOccupationRecords(payload.rows as Record<string, unknown>[], sourceFile);
          return jsonResponse(200, { ok: true, ...result });
        } catch (err) {
          // A mensagem de OccupationSyncError já é escrita para o operador ler
          // no painel (ex.: "a tabela ainda não existe, rode a migration").
          const message = err instanceof Error ? err.message : "Falha ao salvar os dados no banco.";
          console.error("[ocupacao] falha ao sincronizar planilha:", err);
          return jsonResponse(500, { error: message });
        }
      },
    },
  },
});
