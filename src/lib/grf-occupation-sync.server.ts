// Sincronização do relatório de Ocupação com o Supabase — módulo SERVER-ONLY.
//
// Chamado pela rota POST /admin/ocupacao/painel, que já valida o ticket HMAC
// e reconfere o papel GRF antes de importar este módulo (mesmo padrão de
// grf-occupation-panel.server.ts). Nunca importar no navegador.
//
// Regra de gravação combinada: grava apenas o que ainda NÃO existe. Uma linha
// já gravada nunca é sobrescrita (o relatório é cumulativo e reenviado todo
// dia, então o histórico antigo é reenviado junto — ele deve ser ignorado, não
// reescrito). Isso é garantido pelo banco via INSERT ... ON CONFLICT DO NOTHING
// sobre a PK id_romaneio, não por comparação no cliente.

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

const MAX_ROWS_PER_REQUEST = 50000;
const INSERT_CHUNK_SIZE = 500;

/* ---------------------------------------------------------------------------
 * Leitura tolerante dos cabeçalhos
 * ------------------------------------------------------------------------ */

/** "  Peso Bruto " / "PESO_BRUTO" / "PesoBruto" → "pesobruto". */
function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/**
 * Índice normalizado da linha: o painel envia os cabeçalhos exatamente como
 * estão na planilha, e eles variam entre exportações (espaço sobrando, caixa
 * diferente, acento). Ler por chave normalizada evita que uma variação boba do
 * cabeçalho descarte o arquivo inteiro em silêncio.
 */
function indexRow(raw: RawRow): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const key of Object.keys(raw)) {
    const norm = normalizeHeader(key);
    if (norm && !map.has(norm)) map.set(norm, raw[key]);
  }
  return map;
}

/* ---------------------------------------------------------------------------
 * Conversão de valores
 * ------------------------------------------------------------------------ */

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** "162498" / 162498 → 162498. Só dígitos; qualquer outra coisa vira null. */
function parseIntId(v: unknown): number | null {
  if (typeof v === "number") return Number.isSafeInteger(v) ? v : null;
  const s = toStr(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Números vindos do Excel em português.
 *
 * Casos tratados:
 *   1081        (number)   → 1081
 *   "1.081,000" (BR)       → 1081
 *   "904,091"   (BR)       → 904.091
 *   "1.081"     (milhar BR)→ 1081     ← sem isto virava 1.081 (erro de 1000x)
 *   "904.091"   (US)       → 904.091
 */
function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = toStr(v);
  if (!s) return null;

  const cleaned = s.replace(/\s/g, "").replace(/[R$%]/g, "");
  if (!cleaned) return null;

  let normalized: string;
  if (cleaned.includes(",")) {
    // Vírgula presente = decimal brasileiro; pontos são separador de milhar.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Só pontos, todos em grupos de exatamente 3 dígitos → separador de milhar
    // ("1.081" = 1081). O relatório é exportado em pt-BR: toda casa decimal
    // vem com vírgula, então um ponto sozinho nunca é decimal aqui (conferido
    // no relatório de agosto: 0 ocorrências de ponto sem vírgula na mesma
    // célula). Sem esta regra, "1.081" virava 1,081 — erro de 1000x.
    normalized = cleaned.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseIntValue(v: unknown): number | null {
  const n = parseNumber(v);
  return n === null ? null : Math.round(n);
}

function isoFromParts(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Datas do relatório. O painel lê a planilha com `cellDates:true`, então a
 * mesma coluna pode chegar como string "03/08/2026", como Date (quando a
 * célula é data de verdade) ou como serial do Excel — todos são aceitos, senão
 * uma exportação diferente zeraria a importação sem avisar ninguém.
 */
function parseDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return isoFromParts(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }

  // Serial do Excel (dias desde 1899-12-30), intervalo defensivo: 1970..2100.
  if (typeof v === "number" && Number.isFinite(v) && v > 25000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400000);
    const d = new Date(ms);
    return isoFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  const s = toStr(v);
  if (!s) return null;

  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (br) return isoFromParts(Number(br[3]), Number(br[2]), Number(br[1]));

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  return null;
}

/* ---------------------------------------------------------------------------
 * Linha → registro
 * ------------------------------------------------------------------------ */

/** Devolve null (linha descartável) em vez de lançar — uma linha ruim não derruba o lote. */
function parseRow(raw: RawRow, sourceFile: string | null): ParsedRecord | null {
  const row = indexRow(raw);
  const get = (name: string) => row.get(name);

  const idRomaneio = parseIntId(get("idromaneio"));
  const dataMovimento = parseDate(get("datamovimento"));
  if (idRomaneio === null || dataMovimento === null) return null;

  return {
    id_romaneio: idRomaneio,
    rota: toStr(get("rota")),
    placa: toStr(get("placa")),
    transportadora: toStr(get("transportadora")),
    data_movimento: dataMovimento,
    id_romaneio_transb: parseIntId(get("idromaneiotransb")),
    placa_transb: toStr(get("placatransb")),
    transp_transbordo: toStr(get("transptransbordo")),
    notas_fiscais: parseIntValue(get("notasfiscais")),
    entregas: parseIntValue(get("entregas")),
    ponto_apoio: toStr(get("pontoapoio")),
    volumes: parseNumber(get("volumes")),
    itens: parseIntValue(get("itens")),
    valor: parseNumber(get("valor")),
    peso_bruto: parseNumber(get("pesobruto")),
    peso_maximo: parseNumber(get("pesomaximo")),
    perc_ocup_peso: parseNumber(get("percocuppeso")),
    volume_m3: parseNumber(get("volumem3")),
    volume_maximo: parseNumber(get("volumemaximo")),
    perc_ocup_volume: parseNumber(get("percocupvolume")),
    pallets_inf: parseIntValue(get("palletsinf")),
    pallets_maximo: parseIntValue(get("palletsmaximo")),
    perc_ocup_pallets: parseNumber(get("percocuppallets")),
    source_file: sourceFile,
  };
}

/* ---------------------------------------------------------------------------
 * Gravação
 * ------------------------------------------------------------------------ */

export interface SyncResult {
  /** Linhas recebidas do painel. */
  total: number;
  /** Linhas que viraram registro válido (com idRomaneio e data). */
  valid: number;
  /** Linhas descartadas por não terem idRomaneio/data reconhecíveis. */
  invalid: number;
  /** Linhas repetidas dentro do próprio arquivo (mesmo idRomaneio). */
  duplicatesInFile: number;
  /** Registros novos realmente gravados. */
  inserted: number;
  /** Registros que já existiam e foram preservados como estavam. */
  alreadyStored: number;
  /** Menor e maior data do arquivo, para conferência. */
  dateRange: { from: string; to: string } | null;
}

/** Erro com mensagem pronta para exibir no painel. */
export class OccupationSyncError extends Error {}

function describeDbError(error: { message?: string; code?: string; details?: string }): string {
  const code = error.code ?? "";
  const message = error.message ?? "erro desconhecido";

  // Tabela ausente: a migration 11_grf_occupation_records.sql ainda não rodou.
  if (code === "42P01" || code === "PGRST205" || /does not exist|could not find the table/i.test(message)) {
    return (
      "A tabela grf_occupation_records ainda não existe no Supabase. " +
      "Rode o script supabase/migrations/11_grf_occupation_records.sql no SQL Editor e suba a planilha de novo."
    );
  }
  if (code === "42501" || /permission denied/i.test(message)) {
    return `Sem permissão para gravar em grf_occupation_records (${message}).`;
  }
  return `O banco recusou a gravação: ${message}`;
}

/**
 * Grava apenas as linhas ainda não conhecidas. Reenviar o relatório inteiro é
 * inofensivo: o que já está gravado permanece exatamente como está.
 */
export async function syncOccupationRecords(
  rows: RawRow[],
  sourceFile: string | null,
): Promise<SyncResult> {
  const limited = rows.slice(0, MAX_ROWS_PER_REQUEST);

  const parsedAll: ParsedRecord[] = [];
  for (const row of limited) {
    const rec = parseRow(row, sourceFile);
    if (rec) parsedAll.push(rec);
  }

  // Deduplica dentro do próprio arquivo: um lote com o mesmo id_romaneio duas
  // vezes faz o Postgres recusar o INSERT inteiro ("ON CONFLICT DO UPDATE
  // command cannot affect row a second time" e similares).
  const byId = new Map<number, ParsedRecord>();
  for (const rec of parsedAll) {
    if (!byId.has(rec.id_romaneio)) byId.set(rec.id_romaneio, rec);
  }
  const parsed = [...byId.values()];

  const dates = parsed.map((r) => r.data_movimento).sort();
  const dateRange =
    dates.length > 0 ? { from: dates[0] as string, to: dates[dates.length - 1] as string } : null;

  const result: SyncResult = {
    total: rows.length,
    valid: parsed.length,
    invalid: limited.length - parsedAll.length,
    duplicatesInFile: parsedAll.length - parsed.length,
    inserted: 0,
    alreadyStored: 0,
    dateRange,
  };

  if (parsed.length === 0) return result;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  for (let i = 0; i < parsed.length; i += INSERT_CHUNK_SIZE) {
    const chunk = parsed.slice(i, i + INSERT_CHUNK_SIZE);

    // ignoreDuplicates → INSERT ... ON CONFLICT DO NOTHING: o que já existe
    // fica intacto. O select devolve só o que entrou de fato agora.
    const { data, error } = await db
      .from("grf_occupation_records")
      .upsert(chunk, { onConflict: "id_romaneio", ignoreDuplicates: true })
      .select("id_romaneio");

    if (error) throw new OccupationSyncError(describeDbError(error));

    result.inserted += Array.isArray(data) ? data.length : 0;
  }

  result.alreadyStored = parsed.length - result.inserted;
  return result;
}

/* ---------------------------------------------------------------------------
 * Leitura: histórico acumulado de volta para o painel
 * ------------------------------------------------------------------------ */

/**
 * Colunas do banco na ordem/nome em que a planilha as traz. O painel recebe as
 * linhas exatamente no formato de uma aba lida do Excel (linha 0 = cabeçalho),
 * e assim reaproveita `splitUnifiedSheet` — as regras de classificação, de
 * exclusão de placa/rota/apoio e de agregação de transbordo continuam num
 * lugar só, sem cópia paralela aqui no servidor.
 */
const EXPORT_COLUMNS: ReadonlyArray<readonly [dbColumn: string, sheetHeader: string]> = [
  ["rota", "Rota"],
  ["id_romaneio", "idRomaneio"],
  ["placa", "Placa"],
  ["transportadora", "Transportadora"],
  ["data_movimento", "DataMovimento"],
  ["id_romaneio_transb", "idRomaneioTransb"],
  ["placa_transb", "PlacaTransb"],
  ["transp_transbordo", "TranspTransbordo"],
  ["notas_fiscais", "NotasFiscais"],
  ["entregas", "Entregas"],
  ["ponto_apoio", "PontoApoio"],
  ["volumes", "Volumes"],
  ["itens", "itens"],
  ["valor", "Valor"],
  ["peso_bruto", "PesoBruto"],
  ["peso_maximo", "PesoMaximo"],
  ["perc_ocup_peso", "PercOcupPeso"],
  ["volume_m3", "VolumeM3"],
  ["volume_maximo", "VolumeMaximo"],
  ["perc_ocup_volume", "PercOcupVolume"],
  ["pallets_inf", "PalletsInf"],
  ["pallets_maximo", "PalletsMaximo"],
  ["perc_ocup_pallets", "PercOcupPallets"],
];

/** PostgREST devolve no máximo 1000 linhas por requisição. */
const READ_PAGE_SIZE = 1000;

/** Teto de segurança: o painel é uma análise de período, não um dump da base. */
const MAX_ROWS_RETURNED = 25000;

export interface LoadResult {
  /** Linhas no formato de aba do Excel: `rows[0]` é o cabeçalho. */
  rows: unknown[][];
  /** Quantidade de registros (sem contar o cabeçalho). */
  count: number;
  dateRange: { from: string; to: string } | null;
  /** true quando o teto foi atingido e registros mais antigos ficaram de fora. */
  truncated: boolean;
}

/**
 * Lê o histórico acumulado. Traz os registros mais recentes primeiro (para que
 * o teto corte o passado distante, não o presente) e devolve em ordem
 * cronológica, como o painel espera de uma planilha.
 */
export async function loadOccupationRecords(options?: {
  from?: string | null;
  to?: string | null;
}): Promise<LoadResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const columns = EXPORT_COLUMNS.map(([dbColumn]) => dbColumn).join(", ");
  const collected: Record<string, unknown>[] = [];
  let truncated = false;

  for (let offset = 0; offset < MAX_ROWS_RETURNED; offset += READ_PAGE_SIZE) {
    let query = db
      .from("grf_occupation_records")
      .select(columns)
      .order("data_movimento", { ascending: false })
      .order("id_romaneio", { ascending: false })
      .range(offset, offset + READ_PAGE_SIZE - 1);

    if (options?.from) query = query.gte("data_movimento", options.from);
    if (options?.to) query = query.lte("data_movimento", options.to);

    const { data, error } = await query;
    if (error) throw new OccupationSyncError(describeDbError(error));

    const page = Array.isArray(data) ? data : [];
    collected.push(...page);

    if (page.length < READ_PAGE_SIZE) break;
    if (collected.length >= MAX_ROWS_RETURNED) {
      truncated = true;
      break;
    }
  }

  // De volta à ordem cronológica (a leitura foi do mais novo para o mais antigo).
  collected.reverse();

  const header = EXPORT_COLUMNS.map(([, sheetHeader]) => sheetHeader);
  const rows: unknown[][] = [header];
  for (const record of collected) {
    rows.push(EXPORT_COLUMNS.map(([dbColumn]) => record[dbColumn] ?? null));
  }

  const dates = collected
    .map((r) => r["data_movimento"])
    .filter((d): d is string => typeof d === "string")
    .sort();

  return {
    rows,
    count: collected.length,
    dateRange:
      dates.length > 0 ? { from: dates[0] as string, to: dates[dates.length - 1] as string } : null,
    truncated,
  };
}
