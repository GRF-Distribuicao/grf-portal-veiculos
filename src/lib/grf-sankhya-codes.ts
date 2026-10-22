/**
 * Códigos que o Sankhya usa no cadastro de veículo (padrão MDF-e), a partir do
 * que a transportadora já preenche no portal. Só para veículos novos: o que já
 * está no Sankhya não é reenviado.
 *
 * Tipo de Rodado vem do "Tipo de veículo" do portal; o "Tipo de rodado" do
 * portal (Simples, 6x2…) é outra coisa (eixos). Carreta não tem rodado próprio
 * (00), igual aos cadastros existentes no Sankhya.
 */

export const SANKHYA_NOT_APPLICABLE = "00-Não Aplicável";

const RODADO: Record<string, string> = {
  TRUCK: "01-Truck",
  TOCO: "02-Toco",
  "CAVALO MECANICO": "03-Cavalo Mecânico",
  VAN: "04-Van",
  UTILITARIO: "05-Utilitário",
  CARRETA: SANKHYA_NOT_APPLICABLE,
  VUC: "06-Outros",
  BITREM: "06-Outros",
  RODOTREM: "06-Outros",
};

const CARROCERIA: Record<string, string> = {
  "CARGA SECA": "01-Aberta",
  PRANCHA: "01-Aberta",
  TANQUE: "01-Aberta",
  BASCULANTE: "01-Aberta",
  BAU: "02-Fechada/Baú",
  "BAU FRIGORIFICO": "02-Fechada/Baú",
  GRANELEIRO: "03-Granelera",
  "PORTA-CONTAINER": "04-Porta Container",
  SIDER: "05-Sider",
};

function key(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}

/** Vazio quando o tipo não está preenchido ou não é conhecido. */
export function sankhyaTipoRodado(vehicleType: string | null | undefined): string {
  return RODADO[key(vehicleType)] ?? "";
}

/** Cavalo mecânico não tem carroceria (00), como no Sankhya. */
export function sankhyaTipoCarroceria(
  bodyType: string | null | undefined,
  vehicleType?: string | null,
): string {
  if (key(vehicleType) === "CAVALO MECANICO") return SANKHYA_NOT_APPLICABLE;
  return CARROCERIA[key(bodyType)] ?? "";
}
