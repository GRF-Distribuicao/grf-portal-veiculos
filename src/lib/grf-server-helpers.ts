import { z } from "zod";

export const plateInputSchema = z.object({ plate: z.string() });

export const trackingInputSchema = z.object({
  protocol: z.string().min(3),
  doc: z.string().min(11),
});

export const listInputSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  plate: z.string().optional(),
  transporter: z.string().optional(),
  protocol: z.string().optional(),
  linkType: z.string().optional(),
  hasTracker: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  scope: z.enum(["TODOS", "PENDENTES", "APROVADOS"]).optional(),
});

export const registrationIdSchema = z.object({ id: z.string().uuid() });

/** Pedido de URL assinada para upload de um anexo. */
export const uploadTicketSchema = z.object({
  sessionId: z.string().uuid(),
  attachmentKey: z.string().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(100),
  fileSize: z.number().int().positive(),
});

export const decisionInputSchema = z.object({
  operationBase: z.enum(["PENHA", "CD TRÊS RIOS"]).nullable().optional(),
  id: z.string().uuid(),
  action: z.enum(["EM_ANALISE", "APROVAR", "DEVOLVER", "REPROVAR", "PRONTO_INTEGRACAO"]),
  userName: z.string().min(2),
  note: z.string().optional(),
});

export const submitInputSchema = z.object({
  operationBase: z.enum(["PENHA", "CD TRÊS RIOS"]).nullable().optional(),
  transporter: z.object({
    name: z.string().min(3),
    docType: z.string(),
    docNumber: z.string().min(11),
    phone: z.string().min(10),
    email: z.string().optional().nullable(),
    city: z.string().min(2),
    uf: z.string().length(2),
    linkType: z.string(),
  }),
  vehicle: z.object({
    plate: z.string().min(7),
    vehicleType: z.string().nullable(),
    species: z.string().nullable(),
    wheelType: z.string().nullable(),
    bodyType: z.string().nullable(),
    brandModel: z.string().nullable(),
    manufactureYear: z.number().nullable(),
    modelYear: z.number().nullable(),
    maxWeightKg: z.number().nullable(),
    tareKg: z.number().nullable(),
    maxCapacityKg: z.number().positive(),
    pallets: z.number().int().nonnegative(),
    axles: z.number().nullable(),
    renavam: z.string().nullable(),
    chassis: z.string().nullable(),
    engineNumber: z.string().nullable(),
    plateCity: z.string().nullable(),
    plateUf: z.string().nullable(),
    color: z.string().nullable(),
    fuel: z.string().nullable(),
    companyVehicle: z.boolean(),
  }),
  driver: z.object({
    name: z.string().min(3),
    cpf: z.string().min(11),
    cnh: z.string().nullable(),
    cnhCategory: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  tracking: z.object({
    hasTracker: z.boolean(),
    provider: z.string().nullable(),
    identifier: z.string().nullable(),
    status: z.string().nullable(),
  }),
  documents: z.array(z.object({
    docType: z.string(),
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string().nullable().optional(),
    storagePath: z.string(),
  })),
  declarationAccepted: z.boolean(),
});

export function makeProtocol() {
  const year = new Date().getFullYear();
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `GRF-${year}-${random}`;
}
export const firstAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Nome da transportadora a gravar no cadastro mestre do veículo.
 *
 * Para veículo que veio do Sankhya, o `transporter_name` não é um rótulo
 * qualquer: é ele que identifica a OPERAÇÃO. A TRANSGARRA, por exemplo, tem o
 * mesmo CNPJ em duas operações que precisam de disponibilidade separada, e
 * quem as distingue é justamente o nome — "TRANSGARRA" (Três Rios) e
 * "TRANSGARRA RIO" (Penha).
 *
 * O complemento e a correção de cadastro gravam a razão social digitada no
 * formulário. Sobrescrever o nome do Sankhya com ela apaga a operação, e o
 * gatilho `sync_vehicle_transporter_company` reage a essa troca movendo o
 * veículo para outra empresa — foi o que tirou 18 carros da Penha e deixou 11
 * da VISÃO numa empresa sem acesso.
 *
 * Por isso: veículo do Sankhya mantém o nome que já tem; veículo novo, que não
 * carrega operação nenhuma, recebe normalmente o nome informado no cadastro.
 */
export function resolveVehicleTransporterName(
  master: { sankhya_registered?: unknown; transporter_name?: unknown } | null | undefined,
  submittedName: string,
): string {
  const current = typeof master?.transporter_name === "string" ? master.transporter_name.trim() : "";
  const fromSankhya = master?.sankhya_registered === true;
  return fromSankhya && current.length > 0 ? current : submittedName;
}
