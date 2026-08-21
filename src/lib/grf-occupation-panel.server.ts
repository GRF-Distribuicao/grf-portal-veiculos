// Painel de Ocupação — módulo SERVER-ONLY.
//
// O HTML original do painel (Chart.js + SheetJS embutidos, ~778 KB) é guardado
// comprimido e em base64 para não inchar o bundle. Nada aqui pode ser importado
// no navegador: use sempre `await import("@/lib/grf-occupation-panel.server")`
// de dentro de uma server function / route handler.
import { createHmac, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { requireServerEnv } from "@/integrations/supabase/env";
import panelBase64 from "@/assets/ocupacao/painel.b64.txt?raw";

/**
 * Assinaturas do asset. Se o arquivo for truncado/corrompido em algum commit,
 * a falha aparece aqui com mensagem clara — e não como um gunzip quebrado
 * devolvendo HTML pela metade (foi exatamente o que derrubou o painel antes).
 */
const EXPECTED_BASE64_LENGTH = 298048;
const EXPECTED_HTML_BYTES = 798226;

let cachedHtml: string | null = null;

export function getOccupationPanelHtmlServer(): string {
  if (cachedHtml) return cachedHtml;

  const encoded = panelBase64.trim();
  if (encoded.length !== EXPECTED_BASE64_LENGTH || encoded.length % 4 !== 0) {
    throw new Error(
      `Painel de Ocupação: asset corrompido (base64 com ${encoded.length} caracteres, ` +
        `esperado ${EXPECTED_BASE64_LENGTH}). Regere src/assets/ocupacao/painel.b64.txt.`,
    );
  }

  const html = gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
  if (Buffer.byteLength(html) !== EXPECTED_HTML_BYTES) {
    throw new Error(
      `Painel de Ocupação: HTML descomprimido com ${Buffer.byteLength(html)} bytes, ` +
        `esperado ${EXPECTED_HTML_BYTES}.`,
    );
  }

  cachedHtml = html;
  return cachedHtml;
}

// ---------------------------------------------------------------------------
// Ticket de acesso ao HTML do painel
// ---------------------------------------------------------------------------
// A sessão da Área GRF vive no localStorage (bearer token), então um `<iframe
// src="...">` — que é um GET normal do navegador — não carrega o Authorization
// header. Para manter a rota protegida sem expor o access token na URL, a
// server function autenticada emite um ticket curto, assinado e de vida curta;
// a rota que devolve o HTML valida o ticket e reconfere o papel GRF do usuário.

const TICKET_TTL_MS = 15 * 60 * 1000;

function ticketSecret(): string {
  const [secret] = requireServerEnv(["SUPABASE_SERVICE_ROLE_KEY"]) as [string];
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", ticketSecret()).update(payload).digest("base64url");
}

/** `<userId>.<expiraEm>.<assinatura>` — só emitido para usuários GRF autenticados. */
export function issueOccupationPanelTicket(userId: string): string {
  const payload = `${userId}.${Date.now() + TICKET_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Devolve o userId se o ticket for válido e não expirado; senão `null`. */
export function verifyOccupationPanelTicket(ticket: string | null): string | null {
  if (!ticket) return null;

  const lastDot = ticket.lastIndexOf(".");
  if (lastDot <= 0) return null;

  const payload = ticket.slice(0, lastDot);
  const signature = ticket.slice(lastDot + 1);

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  const separator = payload.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = payload.slice(0, separator);
  const expiresAt = Number(payload.slice(separator + 1));
  if (!userId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return userId;
}
