import * as XLSX from "xlsx";

type Row = Record<string, unknown>;
type Field = readonly [string, string];
const vehicleFields: Field[] = [
  ["protocol", "Protocolo"], ["plate", "Placa"], ["status", "Status do cadastro"],
  ["vehicle_type", "Tipo de veículo"], ["species", "Espécie"],
  ["wheel_type", "Rodado"], ["body_type", "Carroceria"], ["brand_model", "Marca / modelo"],
  ["manufacture_year", "Ano de fabricação"], ["model_year", "Ano do modelo"],
  ["max_weight_kg", "Peso máximo (kg)"], ["tare_kg", "Tara (kg)"],
  ["max_capacity_kg", "Capacidade (kg)"], ["pallets", "Pallets"], ["axles", "Eixos"],
  ["renavam", "RENAVAM"], ["chassis", "Chassi"], ["engine_number", "Número do motor"],
  ["plate_city", "Cidade de emplacamento"], ["plate_uf", "UF de emplacamento"],
  ["color", "Cor"], ["fuel", "Combustível"], ["company_vehicle", "Veículo próprio"],
  ["grf_sticker", "Adesivação GRF"], ["has_monitoring_camera", "Câmera de monitoramento"],
  ["operation_base", "Base de operação"], ["operation_base_required", "Base obrigatória"],
  ["declaration_accepted", "Declaração aceita"], ["is_demo", "Cadastro demonstrativo"],
  ["codveiculo_sankhya", "Código do veículo Sankhya"], ["status_integracao", "Status da integração"],
  ["mensagem_integracao", "Mensagem da integração"], ["submitted_at", "Enviado em"],
  ["created_at", "Criado em"], ["updated_at", "Atualizado em"],
];
const transporterFields: Field[] = [
  ["name", "Transportadora"], ["doc_type", "Tipo de documento"], ["doc_number", "CPF / CNPJ"],
  ["phone", "Telefone da transportadora"], ["email", "E-mail da transportadora"],
  ["city", "Cidade da transportadora"], ["uf", "UF da transportadora"], ["link_type", "Vínculo"],
];
// Estes campos são gravados pelo formulário de complemento apenas em vehicles.
const masterFields: Field[] = [
  ["body_width_m", "Largura da carroceria (m)"],
  ["body_height_m", "Altura da carroceria (m)"],
  ["body_length_m", "Comprimento da carroceria (m)"],
  ["rntrc", "ANTT / RNTRC"], ["toll_tag_number", "Número da tag de pedágio"],
  ["toll_tag_company", "Empresa da tag de pedágio"], ["toll_tag_owned", "Tag de pedágio própria"],
  ["pbt_kg", "PBT do cadastro mestre (kg)"], ["lotacao_kg", "Lotação do cadastro mestre (kg)"],
  ["operation", "Operação do cadastro mestre"], ["support_point", "Ponto de apoio"],
  ["completion_status", "Status de complementação"], ["fleet_status", "Status da frota"],
  ["sankhya_registered", "Cadastrado no Sankhya"],
];
const driverFields: Field[] = [
  ["name", "Motorista"], ["cpf", "CPF do motorista"], ["cnh", "CNH"],
  ["cnh_category", "Categoria CNH"], ["phone", "Telefone do motorista"],
];
const trackingFields: Field[] = [
  ["has_tracker", "Possui rastreador"], ["provider", "Empresa de rastreamento"],
  ["identifier", "Identificador do rastreador"], ["status", "Status do rastreador"],
];
const documentFields: Field[] = [
  ["doc_type", "Tipo de anexo"], ["file_name", "Nome do arquivo"], ["file_size", "Tamanho (bytes)"],
  ["mime_type", "Formato"], ["status", "Status do anexo"], ["created_at", "Enviado em"],
];
const related = (value: unknown): Row[] =>
  Array.isArray(value) ? value as Row[] : value && typeof value === "object" ? [value as Row] : [];
const cell = (value: unknown): string | number =>
  value == null ? "" : typeof value === "boolean" ? value ? "Sim" : "Não"
    : typeof value === "number" ? value : String(value);
const fields = (row: Row, columns: Field[]) => columns.map(([key]) => cell(row[key]));

export function buildSankhyaWorkbook(rows: Row[]) {
  const book = XLSX.utils.book_new();
  const addSheet = (name: string, headers: string[], values: (string | number)[][]) => {
    // Strings permanecem texto, inclusive zeros iniciais e conteúdo iniciado por '='.
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...values]);
    sheet["!cols"] = headers.map((header) => ({ wch: Math.min(36, Math.max(18, header.length + 2)) }));
    sheet["!autofilter"] = { ref: sheet["!ref"]! };
    XLSX.utils.book_append_sheet(book, sheet, name);
  };
  addSheet("Veículos", [...vehicleFields, ...transporterFields, ...driverFields, ...trackingFields, ...masterFields].map(([, label]) => label),
    rows.map((row) => [
      ...fields(row, vehicleFields), ...fields(related(row["transporters"])[0] ?? {}, transporterFields),
      ...driverFields.map(([key]) => related(row["drivers"]).map((d) => cell(d[key])).join(" | ")),
      ...trackingFields.map(([key]) => related(row["tracking_devices"]).map((t) => cell(t[key])).join(" | ")),
      ...fields(related(row["vehicles"])[0] ?? {}, masterFields),
    ]));
  addSheet("Anexos", ["Protocolo", "Placa", ...documentFields.map(([, label]) => label)],
    rows.flatMap((row) => related(row["documents"]).map((doc) => [cell(row["protocol"]), cell(row["plate"]), ...fields(doc, documentFields)])));
  return book;
}
