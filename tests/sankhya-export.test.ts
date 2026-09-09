import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildSankhyaWorkbook } from "../src/lib/grf-sankhya-export.ts";

test("Excel preserva identificadores, números, campos opcionais e anexos", () => {
  const original = [{
    protocol: "GRF-TESTE", plate: "ABC1234", renavam: "00123456789", chassis: "000123ABC",
    manufacture_year: 2020, model_year: 2021, max_capacity_kg: 4000, pallets: 0,
    grf_sticker: false, has_monitoring_camera: true, operation_base: "PENHA",
    transporters: { name: "=1+1", doc_number: "00123456000100" },
    drivers: [{ name: "Motorista 1", cpf: "00123456789", cnh: "000123" }, { name: "Motorista 2", cnh: "000456" }],
    tracking_devices: [{ has_tracker: false }],
    vehicles: { body_width_m: 2.45, body_height_m: 2.7, body_length_m: 14.8, rntrc: "00012345", toll_tag_number: "0000987", toll_tag_company: "Empresa teste", toll_tag_owned: false, pbt_kg: 23000, lotacao_kg: 15000 },
    documents: [{ doc_type: "CRLV", file_name: "documento.pdf", file_size: 1234 }],
  }];
  const before = JSON.stringify(original);
  const book = XLSX.read(XLSX.write(buildSankhyaWorkbook(original), { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["Veículos"]);
  assert.equal(rows.length, 1);
  for (const [key, value] of Object.entries({ "Largura da carroceria (m)": 2.45, "Altura da carroceria (m)": 2.7, "Comprimento da carroceria (m)": 14.8, "ANTT / RNTRC": "00012345", "Número da tag de pedágio": "0000987", "Tag de pedágio própria": "Não", "Lotação do cadastro mestre (kg)": 15000 })) assert.equal(rows[0][key], value, key);
  for (const [key, value] of Object.entries({ RENAVAM: "00123456789", Chassi: "000123ABC", "CPF / CNPJ": "00123456000100", Transportadora: "=1+1", "Capacidade (kg)": 4000, Pallets: 0, "Adesivação GRF": "Não", "Câmera de monitoramento": "Sim", "Base de operação": "PENHA", CNH: "000123 | 000456", "Cor": "" })) assert.equal(rows[0][key], value, key);
  assert.equal(XLSX.utils.sheet_to_json(book.Sheets["Anexos"]).length, 1);
  for (const [key, value] of Object.entries(book.Sheets["Veículos"])) if (!key.startsWith("!")) assert.equal(value.f, undefined);
  assert.equal(JSON.stringify(original), before);
});

test("Relações ausentes e fila vazia geram planilhas válidas", () => {
  for (const rows of [[], [{ plate: "ABC1234", drivers: null, transporters: null }]]) {
    const book = buildSankhyaWorkbook(rows);
    assert.deepEqual(book.SheetNames, ["Veículos", "Anexos"]);
    assert.equal(XLSX.utils.sheet_to_json(book.Sheets["Veículos"]).length, rows.length);
  }
});
