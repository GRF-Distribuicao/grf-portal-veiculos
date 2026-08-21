// Sincronização do relatório de Ocupação com o Supabase — módulo SERVER-ONLY.
//
// Chamado pela rota POST /admin/ocupacao/painel, que já valida o ticket HMAC
// e reconfere o papel GRF antes de importar este módulo (mesmo padrão de
// grf-occupation-panel.server.ts). Nunca importar no navegador.

type RawRow = Record<string, unknown>;

interface ParsedRecord {
  id_romaneio: number;
  rota: string | null;
  placa: string | null;
  transportadora: string | null;
  data_movimento: string;
  id_romaneio_transb: number | null;
  placa_transb: string | null;
  transp_transbordo: string | null;
  notas_fiscais: number | null;
  entregas: number | null;
  ponto_apoio: string | null;
  volumes: number | null;
  itens: number | null;
  valor: number | null;
  peso_bruto: number | null;
  peso_maximo: number | null;
  perc_ocup_peso: number | null;
  volume_m3: number | null;
  volume_maximo: number | null;
  perc_ocup_volume: number | null;
  pallets_inf: number | null;
  pallets_maximo: number | null;
  perc_ocup_pallets: number | null;
  source_file: string | null;
}

const MAX_ROWS_PER_REQUEST = 20000;
const UPSERT_CHUNK_SIZE = 500;

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** "162498" -> 162498. Só dígitos; qualquer outra coisa é descartada. */
function parseIntId(v: unknown): number | null {
  const s = toStr(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** "1.081,000" -> 1081. "8" -> 8. */
function parseBrInt(v: unknown): number | null {
  const n = parseBrNumber(v);
  return n === null ? null : Math.round(n);
}

/** "5.757,37" -> 5757.37. "100,45" -> 100.45. Aceita também "5757.37" (ponto decimal). */
function parseBrNumber(v: unknown): number | null {
  const s = toStr(v);
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** "03/08/2026" -> "2026-08-03". */
function parseBrDate(v: unknown): string | null {
  const s = toStr(v);
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = m[1];
  const mm = m[2];
  const yyyy = m[3];
  if (!dd || !mm || !yyyy) return null;
  const day = Number(dd);
  const month = Number(mm);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/** Devolve null (linha inválida/descartável) em vez de lançar — uma linha ruim não derruba o lote. */
function parseRow(raw: RawRow, sourceFile: string | null): ParsedRecord | null {
  const idRomaneio = parseIntId(raw["idRomaneio"]);
  const dataMovimento = parseBrDate(raw["DataMovimento"]);
  if (idRomaneio === null || dataMovimento === null) return null;

  return {
    id_romaneio: idRomaneio,
    rota: toStr(raw["Rota"]),
    placa: toStr(raw["Placa"]),
    transportadora: toStr(raw["Transportadora"]),
    data_movimento: dataMovimento,
    id_romaneio_transb: parseIntId(raw["idRomaneioTransb"]),
    placa_transb: toStr(raw["PlacaTransb"]),
    transp_transbordo: toStr(raw["TranspTransbordo"]),
    notas_fiscais: parseBrInt(raw["NotasFiscais"]),
    entregas: parseBrInt(raw["Entregas"]),
    ponto_apoio: toStr(raw["PontoApoio"]),
    volumes: parseBrNumber(raw["Volumes"]),
    itens: parseBrInt(raw["itens"]),
    valor: parseBrNumber(raw["Valor"]),
    peso_bruto: parseBrNumber(raw["PesoBruto"]),
    peso_maximo: parseBrNumber(raw["PesoMaximo"]),
    perc_ocup_peso: parseBrNumber(raw["PercOcupPeso"]),
    volume_m3: parseBrNumber(raw["VolumeM3"]),
    volume_maximo: parseBrNumber(raw["VolumeMaximo"]),
    perc_ocup_volume: parseBrNumber(raw["PercOcupVolume"]),
    pallets_inf: parseBrInt(raw["PalletsInf"]),
    pallets_maximo: parseBrInt(raw["PalletsMaximo"]),
    perc_ocup_pallets: parseBrNumber(raw["PercOcupPallets"]),
    source_file: sourceFile,
  };
}

export interface SyncResult {
  total: number;
  valid: number;
  invalid: number;
  saved: number;
}

/**
 * Faz upsert em lotes por `id_romaneio` — reenviar o mesmo relatório (ou um
 * relatório mais recente que reinclui dias antigos) não duplica nada: linha
 * conhecida é atualizada, linha nova é inserida.
 */
export async function syncOccupationRecords(rows: RawRow[], sourceFile: string | null): Promise<SyncResult> {
  const limited = rows.slice(0, MAX_ROWS_PER_REQUEST);
  const parsed = limited.map((r) => parseRow(r, sourceFile)).filter((r): r is ParsedRecord => r !== null);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  let saved = 0;
  for (let i = 0; i < parsed.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = parsed.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await db
      .from("grf_occupation_records")
      .upsert(chunk, { onConflict: "id_romaneio" });
    if (error) {
      throw new Error(`Falha ao salvar linhas ${i}-${i + chunk.length} no banco: ${error.message}`);
    }
    saved += chunk.length;
  }

  return {
    total: rows.length,
    valid: parsed.length,
    invalid: limited.length - parsed.length,
    saved,
  };
}
