/**
 * Situação do cadastro de um veículo no portal, devolvida pela função
 * `transporter_fleet_status` do banco (migração 16). A regra é da GRF:
 * só veículo com cadastro aprovado vai para a roteirização. Em análise,
 * reprovado, Sankhya sem complemento e cadastro iniciado e não enviado
 * contam todos como PENDENTE.
 *
 * O banco é quem trava de fato (gatilho em fleet_availability_items); estas
 * funções só decidem o que a tela mostra.
 */
export type PortalStatus = "APROVADO" | "DEVOLVIDO" | "PENDENTE";

export function normalizePortalStatus(value: unknown): PortalStatus {
  return value === "APROVADO" || value === "DEVOLVIDO" ? value : "PENDENTE";
}

/** Aparece na Área do Transportador: aprovado, ou devolvido como pendência. */
export function isVisibleInTransporterArea(status: PortalStatus): boolean {
  return status === "APROVADO" || status === "DEVOLVIDO";
}

/** Pode ser informado como disponível para a roteirização. */
export function canInformAvailability(status: PortalStatus): boolean {
  return status === "APROVADO";
}

/** Mensagem do gatilho do banco quando um veículo não aprovado é enviado. */
export function isApprovalRequiredError(message: unknown): boolean {
  return typeof message === "string" && message.includes("sem cadastro aprovado pela GRF");
}
