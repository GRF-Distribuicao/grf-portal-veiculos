import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import vm from "node:vm";
import test from "node:test";

const panelBase64 = (
  await readFile(new URL("../src/assets/ocupacao/painel.b64.txt", import.meta.url), "utf8")
).trim();
const html = gunzipSync(Buffer.from(panelBase64, "base64")).toString("utf8");

// Roda as funções reais do painel, sem navegador.
function grab(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `função ${name} não encontrada`);
  let depth = 0;
  for (let p = html.indexOf("{", start); ; p++) {
    if (html[p] === "{") depth++;
    else if (html[p] === "}" && --depth === 0) return html.slice(start, p + 1);
  }
}
const ctx = { FLEET_DB: {}, FLEET_CAP: {}, TARGET_OCC: 0.85, Math, String, isNaN };
vm.createContext(ctx);
vm.runInContext(
  ["plateKey", "fleetLookup", "isRksPlate", "weightedUtilization", "enrichRecord"].map(grab).join("\n"),
  ctx,
);
ctx.FLEET_DB = {
  VAN0001: { capKg: 1500, capPaletes: 3, modelo: "VAN", tipoVeic: "2- Até 2.000kg" },
  CAR0001: { capKg: 26000, capPaletes: 28, modelo: "CARRETA", tipoVeic: "7- CARRETA" },
  CAR0002: { capKg: 30000, capPaletes: 28, modelo: "CARRETA", tipoVeic: null },
  TRK0001: { capKg: 14000, capPaletes: 16, modelo: "TRUCK", tipoVeic: "6- TRUCK" },
};
const rec = (r) => ctx.enrichRecord({ paletesWMS: null, placaTransb: null, idRomaneioTransb: null, ...r }, "dist");
const util = (rows) => ctx.weightedUtilization(rows, "pesoBruto", "capKg", true);

test("veículo que não é carreta segue só pelo peso, mesmo com pallets cheios", () => {
  const van = rec({ placa: "VAN0001", pesoBruto: 750, paletesWMS: 3 });
  assert.equal(van.ocupPeso, 0.5);
  assert.equal(van.cargaEquivalenteKg, null);
  const truck = rec({ placa: "TRK0001", pesoBruto: 7000, paletesWMS: 16 });
  assert.equal(truck.ocupPeso, 0.5);
  assert.equal(util([van]), 0.5);
});

test("cenário 2: carreta só com distribuição vale o maior entre peso e pallets", () => {
  const cheiaDePallet = rec({ placa: "CAR0001", pesoBruto: 13000, paletesWMS: 28 });
  assert.equal(cheiaDePallet.ocupPeso, 1);
  assert.equal(cheiaDePallet.kgOciosos, 0);
  const pesada = rec({ placa: "CAR0001", pesoBruto: 23400, paletesWMS: 14 });
  assert.equal(pesada.ocupPeso, 0.9);
  assert.equal(pesada.cargaEquivalenteKg, null);
  const semPallet = rec({ placa: "CAR0001", pesoBruto: 13000, paletesWMS: null });
  assert.equal(semPallet.ocupPeso, 0.5);
  const acimaDoCadastro = rec({ placa: "CAR0001", pesoBruto: 13000, paletesWMS: 40 });
  assert.equal(acimaDoCadastro.ocupPeso, 1);

  const van = rec({ placa: "VAN0001", pesoBruto: 750 });
  assert.equal(util([cheiaDePallet, van]), (26000 + 750) / (26000 + 1500));
});

test("cenário 1: carreta que é o próprio transbordo sai da média da distribuição", () => {
  const perna = rec({ placa: "CAR0002", pesoBruto: 5139, paletesWMS: 8, placaTransb: "CAR0002", idRomaneioTransb: 1 });
  assert.equal(perna.medidaNoTransbordo, true);
  assert.equal(perna.ocupPeso, null);
  assert.equal(perna.kgOciosos, null);
  assert.equal(perna.pesoBruto, 5139, "o peso continua no total");
  const van = rec({ placa: "VAN0001", pesoBruto: 750 });
  assert.equal(util([perna, van]), 0.5);
});

test("carreta abastecida por outro transbordo continua só pelo peso", () => {
  const r = rec({ placa: "CAR0001", pesoBruto: 13000, paletesWMS: 28, placaTransb: "CAR0002", idRomaneioTransb: 1 });
  assert.equal(r.medidaNoTransbordo, false);
  assert.equal(r.ocupPeso, 0.5);
});

test("placa RKS continua em 0%", () => {
  ctx.FLEET_DB.RKS0001 = { capKg: 26000, capPaletes: 28, modelo: "CARRETA", tipoVeic: null };
  const r = rec({ placa: "RKS0001", pesoBruto: 13000, paletesWMS: 28 });
  assert.equal(r.ocupPeso, 0);
  assert.equal(util([r]), 0);
});
