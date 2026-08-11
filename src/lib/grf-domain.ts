// Domínio do Portal GRF — client-safe (validações, rótulos, constantes).
// Preparado para futura integração com o Sankhya: os nomes de campos seguem
// o mesmo vocabulário usado no ERP (CODVEICULO_SANKHYA, STATUS_INTEGRACAO...).

export const STATUSES = [
  "RASCUNHO",
  "AGUARDANDO_ANALISE",
  "EM_ANALISE",
  "DEVOLVIDO",
  "APROVADO",
  "REPROVADO",
  "PRONTO_INTEGRACAO",
  "INTEGRADO_SANKHYA",
  "ERRO_INTEGRACAO",
] as const;

export type RegistrationStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_ANALISE: "Aguardando análise",
  EM_ANALISE: "Em análise",
  DEVOLVIDO: "Devolvido para correção",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  PRONTO_INTEGRACAO: "Pronto para integração Sankhya",
  INTEGRADO_SANKHYA: "Integrado ao Sankhya",
  ERRO_INTEGRACAO: "Erro de integração",
};

export const STATUS_TONE: Record<string, "neutral" | "info" | "warn" | "ok" | "bad"> = {
  RASCUNHO: "neutral",
  AGUARDANDO_ANALISE: "warn",
  EM_ANALISE: "info",
  DEVOLVIDO: "warn",
  APROVADO: "ok",
  REPROVADO: "bad",
  PRONTO_INTEGRACAO: "ok",
  INTEGRADO_SANKHYA: "ok",
  ERRO_INTEGRACAO: "bad",
};

export const LINK_TYPES = ["Agregado", "Terceiro", "Frota própria"];
export const VEHICLE_TYPES = ["Cavalo mecânico", "Truck", "Toco", "VUC", "Carreta", "Bitrem", "Rodotrem", "Van", "Utilitário"];
export const SPECIES = ["Tração", "Reboque", "Semirreboque", "Misto", "Carga"];
export const WHEEL_TYPES = ["Simples", "Duplo", "4x2", "6x2", "6x4", "8x2"];
export const BODY_TYPES = ["Baú", "Baú frigorífico", "Sider", "Graneleiro", "Carga seca", "Prancha", "Tanque", "Basculante", "Porta-container"];
export const FUELS = ["Diesel S10", "Diesel S500", "Gasolina", "Etanol", "Flex", "GNV", "Elétrico"];
export const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];
export const TRACKER_STATUS = ["Ativo", "Inativo", "Em instalação", "Em manutenção"];
export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

/* ---------- anexos ---------- */

export type AttachmentKind = "doc" | "photo";

export type AttachmentType = {
  key: string;
  label: string;
  hint: string;
  kind: AttachmentKind;
  required: boolean;
};

/** Documentos (PDF ou imagem). */
export const DOC_TYPES: AttachmentType[] = [
  {
    key: "CRLV",
    label: "CRLV do veículo",
    hint: "Documento do veículo do exercício vigente.",
    kind: "doc",
    required: true,
  },
  {
    key: "DOC_PROPRIETARIO",
    label: "Documento do proprietário / transportador",
    hint: "RG, CNH ou cartão CNPJ do titular do veículo.",
    kind: "doc",
    required: true,
  },
  {
    key: "CNH",
    label: "CNH do motorista",
    hint: "Frente e verso, legível e dentro da validade.",
    kind: "doc",
    required: true,
  },
];

/**
 * Fotos do veículo — comprovam visualmente os dados declarados no formulário.
 * Só aceitam imagem (a câmera do celular abre direto).
 */
export const PHOTO_TYPES: AttachmentType[] = [
  {
    key: "FOTO_FRENTE",
    label: "Foto frontal do veículo",
    hint: "Veículo inteiro de frente, com a PLACA legível na imagem.",
    kind: "photo",
    required: true,
  },
  {
    key: "FOTO_LATERAL",
    label: "Foto lateral do veículo",
    hint: "Lateral completa, mostrando a carroceria (comprova tipo e tamanho).",
    kind: "photo",
    required: true,
  },
  {
    key: "FOTO_CARROCERIA",
    label: "Foto do interior da carroceria",
    hint: "Opcional — ajuda a confirmar a capacidade em pallets declarada.",
    kind: "photo",
    required: false,
  },
];

export const ATTACHMENT_TYPES: AttachmentType[] = [...DOC_TYPES, ...PHOTO_TYPES];

export function attachmentLabel(key: string): string {
  return ATTACHMENT_TYPES.find((a) => a.key === key)?.label ?? key;
}

export function isPhotoAttachment(key: string): boolean {
  return PHOTO_TYPES.some((p) => p.key === key);
}

/* ---------- regras de arquivo ---------- */
// Os MIME types abaixo precisam bater com os permitidos no bucket `grf-documentos`.

export const ACCEPTED_DOC_MIME = ["application/pdf", "image/jpeg", "image/png"];
export const ACCEPTED_PHOTO_MIME = ["image/jpeg", "image/png"];
/** Mantido para compatibilidade com código já existente. */
export const ACCEPTED_MIME = ACCEPTED_DOC_MIME;
export const MAX_FILE_MB = 10;

export function acceptedMimeFor(kind: AttachmentKind): string[] {
  return kind === "photo" ? ACCEPTED_PHOTO_MIME : ACCEPTED_DOC_MIME;
}

/** Atributo `accept` do <input type="file">. */
export function acceptAttrFor(kind: AttachmentKind): string {
  return kind === "photo" ? "image/*" : ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
}

/* ---------- formatação ---------- */

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function formatDoc(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function formatPlate(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

export function prettyPlate(p: string) {
  const s = formatPlate(p);
  return s.length === 7 ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/* ---------- validações ---------- */

export function isValidCPF(value: string) {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(c[i]) * (10 - i);
  let d1 = ((sum * 10) % 11) % 10;
  if (d1 !== Number(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(c[i]) * (11 - i);
  const d2 = ((sum * 10) % 11) % 10;
  return d2 === Number(c[10]);
}

export function isValidCNPJ(value: string) {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let pos = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(c[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function isValidDoc(value: string) {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim());
export const isValidPhone = (v: string) => [10, 11].includes(onlyDigits(v).length);
export const isValidPlate = (v: string) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(formatPlate(v));
