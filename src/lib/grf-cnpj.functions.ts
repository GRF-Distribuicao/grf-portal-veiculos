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

export const lookupTransporterCnpj = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => lookupSchema.parse(input))
  .handler(async ({ data }) => {
    const cnpj = data.cnpj;
    if (!isValidCNPJ(cnpj)) {
      return { ok: false as const, error: "Informe um CNPJ válido." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: existingCompany } = await db
      .from("transporter_companies")
      .select("name, cnpj, active")
      .eq("cnpj", cnpj)
      .eq("active", true)
      .maybeSingle();

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

    if (!existingCompany && !publicCompany) {
      return {
        ok: false as const,
        error: publicLookupUnavailable
          ? "A consulta pública do CNPJ está temporariamente indisponível. Preencha a razão social manualmente para continuar."
          : "CNPJ não encontrado na consulta pública.",
        allowManual: publicLookupUnavailable,
      };
    }

    const officialName = publicCompany?.razao_social?.trim() || null;
    const companyName = String(existingCompany?.name ?? officialName ?? "").trim();

    return {
      ok: true as const,
      companyName,
      officialName,
      tradeName: publicCompany?.nome_fantasia?.trim() || null,
      city: publicCompany?.municipio?.trim() || null,
      uf: publicCompany?.uf?.trim() || null,
      cadastralStatus: publicCompany?.descricao_situacao_cadastral?.trim() || null,
      knownToPortal: Boolean(existingCompany),
      publicLookupUnavailable,
    };
  });
