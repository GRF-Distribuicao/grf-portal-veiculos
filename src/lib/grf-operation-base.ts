/** A cidade do transportador não identifica a operação do veículo. */
export const TRANSGARRA_CNPJ = "53638584000191";
export const OPERATION_BASES = ["PENHA", "CD TRÊS RIOS"] as const;
export type OperationBase = (typeof OPERATION_BASES)[number];

export function isTransgarra(doc: string | null | undefined): boolean {
  return (doc ?? "").replace(/\D/g, "") === TRANSGARRA_CNPJ;
}

export function isOperationBase(value: unknown): value is OperationBase {
  return value === "PENHA" || value === "CD TRÊS RIOS";
}

export function operationBaseLabel(value: unknown): string {
  if (value === "PENHA") return "Penha — Transgarra Rio";
  if (value === "CD TRÊS RIOS") return "CD Três Rios — Transgarra Três Rios";
  return "Não informada";
}

/** Apenas bases explícitas do cadastro mestre; nunca inferir pelo endereço. */
export function knownOperationBase(value: string | null | undefined): OperationBase | "" {
  const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  if (normalized === "PENHA") return "PENHA";
  if (normalized === "CD TRES RIOS") return "CD TRÊS RIOS";
  return "";
}
