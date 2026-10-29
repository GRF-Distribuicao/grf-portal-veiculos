import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import vm from "node:vm";
import test from "node:test";

const panelBase64 = (
  await readFile(new URL("../src/assets/ocupacao/painel.b64.txt", import.meta.url), "utf8")
).trim();
const html = gunzipSync(Buffer.from(panelBase64, "base64")).toString("utf8");

function grab(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `função ${name} não encontrada`);
  let depth = 0;
  for (let p = html.indexOf("{", start); ; p++) {
    if (html[p] === "{") depth++;
    else if (html[p] === "}" && --depth === 0) return html.slice(start, p + 1);
  }
}
const ctx = { FLEET_DB: null, FLEET_CAP: {}, TARGET_OCC: 0.85, Math, String, isNaN };
vm.createContext(ctx);
vm.runInContext(
  ["plateKey", "fleetLookup", "normModeloFiltro", "filterLabels", "isRksPlate", "enrichRecord"].map(grab).join("\n"),
  ctx,
);
const rec = (r) => ctx.enrichRecord({ paletesWMS: null, placaTransb: null, idRomaneioTransb: null, ...r }, "dist");

test("filtros usam modelo padronizado e empresa do vínculo; gráficos e cálculo não mudam", () => {
  ctx.FLEET_CAP = { JET0001: { capKg: 900, tipoVeic: "Até 1.000kg", transportadora: "JET OIL", modelo: "2026-04-03 00:00:00" } };
  ctx.FLEET_DB = {
    JET0001: { capKg: 900, capPaletes: 2, modelo: "fiorino ", tipoVeic: "1- Até 1.000kg", transportadora: "JET OIL", empresa: "JETOIL" },
    AJX0001: { capKg: 1500, capPaletes: 3, modelo: "FIAT/ FIORINO", tipoVeic: null, transportadora: "ajox logistica", empresa: "AJOX" },
    SEM0001: { capKg: 1000, capPaletes: 2, modelo: null, tipoVeic: "4- CAMINHAO", transportadora: null, empresa: null },
  };
  const a = rec({ placa: "JET0001", pesoBruto: 450 });
  assert.equal(a.filtroTipo, "FIORINO");
  assert.equal(a.filtroTransp, "JETOIL");
  // Campos dos gráficos e a ocupação continuam como antes.
  assert.equal(a.tipoVeic, "1- Até 1.000kg");
  assert.equal(a.transportadora, "JET OIL");
  assert.equal(a.ocupPeso, 0.5);

  const b = rec({ placa: "AJX0001", pesoBruto: 750 });
  assert.equal(b.filtroTipo, "FIORINO");
  assert.equal(b.filtroTransp, "AJOX");
  assert.equal(b.ocupPeso, 0.5);

  const c = rec({ placa: "SEM0001", pesoBruto: 500 });
  assert.equal(c.filtroTipo, "Sem modelo");
  assert.equal(c.filtroTransp, "Sem transportadora");

  const fora = rec({ placa: "XXX0000", pesoBruto: 100 });
  assert.equal(fora.filtroTipo, "Sem modelo");
  assert.equal(fora.filtroTransp, "Sem transportadora");
});

test("antes do cadastro carregar, filtros usam o retrato sem datas como modelo", () => {
  ctx.FLEET_DB = null;
  ctx.FLEET_CAP = { JET0001: { capKg: 900, transportadora: "JET OIL", modelo: "2026-04-03 00:00:00" } };
  const l = ctx.filterLabels("JET-0001");
  assert.equal(l.tipo, "Sem modelo");
  assert.equal(l.transp, "JET OIL");
});
