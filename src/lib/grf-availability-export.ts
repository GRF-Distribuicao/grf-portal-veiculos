import * as XLSX from "xlsx";
import {
  compareDistribution,
  compareTransbordo,
  isTransbordoVehicle,
} from "./grf-availability-rules.ts";

export type AvailabilityExportRow = {
  plate: string;
  transporterName: string;
  brand_model: string | null;
  vehicle_type: string | null;
  lotacao_kg: number | null;
  pallets: number | null;
  trailer_plate: string | null;
  trailer_pallets: number | null;
  availability_note: string | null;
  sankhya_registered: boolean | null;
  submittedAt: string | null;
  usedAt: string | null;
};

const HEADERS = [
  "Operação",
  "Placa",
  "Transportadora",
  "Veículo",
  "Lotação (kg)",
  "Pallets do cadastro",
  "Placa da carreta",
  "Pallets informados",
  "Observação",
  "Sankhya",
  "Atualizado",
  "Usado",
];

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Planilha com todos os veículos disponíveis do dia: distribuição (maior
 * lotação primeiro) e depois transbordo (mais pallets primeiro), com a coluna
 * "Usado" marcando o que a roteirização já usou.
 */
export function buildAvailabilityWorkbook(rows: AvailabilityExportRow[]) {
  const distribution = rows.filter((row) => !isTransbordoVehicle(row)).sort(compareDistribution);
  const transbordo = rows.filter((row) => isTransbordoVehicle(row)).sort(compareTransbordo);

  const values = [...distribution, ...transbordo].map((row) => {
    const isTransbordo = isTransbordoVehicle(row);
    return [
      isTransbordo ? "Transbordo" : "Distribuição",
      row.plate,
      row.transporterName,
      row.brand_model || row.vehicle_type || "",
      row.lotacao_kg ?? "",
      row.pallets ?? "",
      isTransbordo ? (row.trailer_plate ?? "") : "",
      isTransbordo ? (row.trailer_pallets ?? "") : "",
      row.availability_note ?? "",
      row.sankhya_registered ? "Sim" : "Não",
      formatTime(row.submittedAt),
      row.usedAt ? "Sim" : "Não",
    ];
  });

  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...values]);
  sheet["!cols"] = HEADERS.map((header) => ({
    wch: Math.min(40, Math.max(12, header.length + 2)),
  }));
  sheet["!autofilter"] = { ref: sheet["!ref"]! };
  XLSX.utils.book_append_sheet(book, sheet, "Disponibilidade");
  return book;
}
