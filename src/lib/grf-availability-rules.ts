/**
 * Regras da disponibilidade diária para a roteirização (migrações 17 a 19).
 *
 * O banco é quem trava de fato (horário de corte, carreta e pallets do
 * transbordo); estas funções só fazem a tela seguir a mesma régua e mostrar o
 * erro antes do envio.
 */

/** Horário de corte, no horário de Brasília. Depois dele ninguém altera o dia. */
export const AVAILABILITY_CUTOFF = "16:30";

/** Tamanho máximo da observação de cada placa. */
export const NOTE_MAX_LENGTH = 200;

type VehicleModel = { brand_model?: string | null; vehicle_type?: string | null };

/**
 * Transbordo = cavalo cadastrado com modelo ou tipo "CARRETA". Mesma régua do
 * gatilho validate_availability_vehicle_trailer (migração 18).
 */
export function isTransbordoVehicle(vehicle: VehicleModel): boolean {
  const text = `${vehicle.brand_model ?? ""} ${vehicle.vehicle_type ?? ""}`.toUpperCase();
  return text.includes("CARRETA");
}

/** Opções da lista de pallets: de 1 até o número do cadastro do cavalo. */
export function palletOptions(registryPallets: number | null | undefined): number[] {
  const max = Number(registryPallets);
  if (!Number.isInteger(max) || max < 1) return [];
  return Array.from({ length: max }, (_, index) => max - index);
}

export function normalizePlate(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Placa antiga (ABC1234) ou Mercosul (ABC1D23). */
export function isValidPlate(value: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value);
}

export type AvailabilityDetail = {
  note: string;
  trailer_plate: string;
  trailer_pallets: number | null;
};

export const emptyDetail = (): AvailabilityDetail => ({
  note: "",
  trailer_plate: "",
  trailer_pallets: null,
});

type DetailVehicle = VehicleModel & { plate: string; pallets: number | null };

/** Mesmo conjunto de regras do gatilho do banco. Devolve a mensagem do primeiro problema. */
export function validateAvailabilityDetail(
  vehicle: DetailVehicle,
  detail: AvailabilityDetail,
): string | null {
  const plate = normalizePlate(vehicle.plate);
  if (detail.note.trim().length > NOTE_MAX_LENGTH) {
    return `Observação da placa ${plate} passa de ${NOTE_MAX_LENGTH} caracteres.`;
  }
  if (!isTransbordoVehicle(vehicle)) return null;

  const trailer = normalizePlate(detail.trailer_plate);
  if (!trailer) return `Informe a placa da carreta do cavalo ${plate}.`;
  if (!isValidPlate(trailer)) return `Placa da carreta ${trailer} inválida (cavalo ${plate}).`;
  if (trailer === plate) return `A placa da carreta não pode ser a mesma do cavalo ${plate}.`;

  const options = palletOptions(vehicle.pallets);
  if (!options.length)
    return `O cavalo ${plate} está sem quantidade de pallets no cadastro. Fale com a GRF.`;
  if (detail.trailer_pallets == null)
    return `Selecione a quantidade de pallets do cavalo ${plate}.`;
  if (!options.includes(detail.trailer_pallets))
    return `Pallets do cavalo ${plate} devem ficar entre 1 e ${options[0]}.`;
  return null;
}

/** A mesma carreta não pode ser informada em dois cavalos no mesmo dia. */
export function findRepeatedTrailer(trailerPlates: string[]): string | null {
  const seen = new Set<string>();
  for (const raw of trailerPlates) {
    const plate = normalizePlate(raw);
    if (!plate) continue;
    if (seen.has(plate)) return plate;
    seen.add(plate);
  }
  return null;
}

type SortableVehicle = {
  plate: string;
  lotacao_kg: number | null;
  pallets: number | null;
  trailer_pallets?: number | null;
};

const desc = (a: number | null | undefined, b: number | null | undefined) => {
  const aKnown = a != null && Number.isFinite(a);
  const bKnown = b != null && Number.isFinite(b);
  if (aKnown && bKnown) return (b as number) - (a as number);
  if (aKnown) return -1;
  if (bKnown) return 1;
  return 0;
};

/** Distribuição: maior lotação (kg) primeiro; empate por pallets; depois placa. */
export function compareDistribution(a: SortableVehicle, b: SortableVehicle): number {
  return (
    desc(a.lotacao_kg, b.lotacao_kg) || desc(a.pallets, b.pallets) || a.plate.localeCompare(b.plate)
  );
}

/** Transbordo: mais pallets informados primeiro; empate por lotação (kg); depois placa. */
export function compareTransbordo(a: SortableVehicle, b: SortableVehicle): number {
  return (
    desc(a.trailer_pallets, b.trailer_pallets) ||
    desc(a.lotacao_kg, b.lotacao_kg) ||
    a.plate.localeCompare(b.plate)
  );
}

/** Mensagens que o banco devolve e que podem ser mostradas como estão ao transportador. */
const FRIENDLY_ERRORS = [
  "sem cadastro aprovado pela GRF",
  "encerrada às",
  "placa da carreta",
  "Placa da carreta",
  "pallets",
  "Observação da placa",
  "não é de transbordo",
  "foi informada em mais de um cavalo",
];

export function isFriendlyAvailabilityError(message: unknown): boolean {
  return typeof message === "string" && FRIENDLY_ERRORS.some((part) => message.includes(part));
}

export function isCutoffError(message: unknown): boolean {
  return typeof message === "string" && message.includes("encerrada às");
}
