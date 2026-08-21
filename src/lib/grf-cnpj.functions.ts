import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidCNPJ, onlyDigits } from "@/lib/grf-domain";

const lookupSchema = z.object({
  cnpj: z.string().transform((value) => onlyDigits(value)),
});

type BrasilApiCompany = {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  municipio?: string | null;
  uf?: string | null;
  descricao_situacao_cadastral?: string | null;
};

function formatCnpj(value: string) {
  const raw = onlyDigits(value).slice(0, 14);
  return raw
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export const lookupTransporterCnpj = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => lookupSchema.parse(input))
  .handler(async ({ data }) => {
    const cnpj = data.cnpj;
    if (!isValidCNPJ(cnpj)) {
      return { ok: false as const, error: "Informe um CNPJ válido." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [{ data: existingCompany }, { data: savedTransporters }] = await Promise.all([
      db
        .from("transporter_companies")
        .select("name, cnpj, active")
        .eq("cnpj", cnpj)
        .eq("active", true)
        .maybeSingle(),
      db
        .from("transporters")
        .select("name, doc_number, phone, email, city, uf, link_type, created_at")
        .eq("doc_type", "CNPJ")
        .in("doc_number", [cnpj, formatCnpj(cnpj)])
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const savedTransporter = Array.isArray(savedTransporters) && savedTransporters.length
      ? savedTransporters[0]
      : null;

    let publicCompany: BrasilApiCompany | null = null;
    let publicLookupUnavailable = false;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(7000),
      });

      if (response.ok) {
        publicCompany = (await response.json()) as BrasilApiCompany;
      } else if (response.status !== 404) {
        publicLookupUnavailable = true;
      }
    } catch {
      publicLookupUnavailable = true;
    }

    if (!existingCompany && !savedTransporter && !publicCompany) {
      return {
        ok: false as const,
        error: publicLookupUnavailable
          ? "A consulta do CNPJ está temporariamente indisponível. Preencha os dados manualmente para continuar."
          : "CNPJ não encontrado no cadastro do Portal nem na consulta pública.",
        allowManual: true,
      };
    }

    const officialName = publicCompany?.razao_social?.trim() || null;
    const companyName = String(existingCompany?.name ?? savedTransporter?.name ?? officialName ?? "").trim();

    return {
      ok: true as const,
      companyName,
      officialName,
      tradeName: publicCompany?.nome_fantasia?.trim() || null,
      city: savedTransporter?.city?.trim() || publicCompany?.municipio?.trim() || null,
      uf: savedTransporter?.uf?.trim() || publicCompany?.uf?.trim() || null,
      cadastralStatus: publicCompany?.descricao_situacao_cadastral?.trim() || null,
      knownToPortal: Boolean(existingCompany || savedTransporter),
      hasSavedProfile: Boolean(savedTransporter),
      savedTransporter: savedTransporter
        ? {
            name: String(savedTransporter.name ?? "").trim(),
            phone: String(savedTransporter.phone ?? "").trim(),
            email: String(savedTransporter.email ?? "").trim(),
            city: String(savedTransporter.city ?? "").trim(),
            uf: String(savedTransporter.uf ?? "").trim(),
            linkType: String(savedTransporter.link_type ?? "").trim(),
          }
        : null,
      publicLookupUnavailable,
    };
  });