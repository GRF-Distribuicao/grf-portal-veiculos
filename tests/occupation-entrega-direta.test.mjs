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
const consts = html.slice(html.indexOf("const EXCLUDED_PLATES"), html.indexOf("function", html.indexOf("const UNIFIED_EXACT_MAP")));
const ctx = { Math, String, Number, isNaN, Set, Object, Array, Date, XLSX: { SSF: { parse_date_code: () => null } } };
vm.createContext(ctx);
vm.runInContext(
  consts.replace(/^const /gm, "var ") +
    ["normalizeKey", "normalizeHeader", "parseBRNumber", "toISODate", "mapRow", "splitUnifiedSheet"].map(grab).join("\n") +
    "\nfunction enrichRecord(rec){ return rec; }",
  ctx,
);

test("ENTREGA DIRETA entra na distribuição; Goiânia-CE e cobrança continuam fora", () => {
  const header = ["Rota", "idRomaneio", "Placa", "DataMovimento", "PontoApoio", "PesoBruto", "Valor"];
  const rows = [
    header,
    ["SAPUCAIA", "1", "AAA1A11", "26/11/2026", "CD TRES RIOS", "100", "10"],
    ["ENTREGA DIRETA", "2", "BBB2B22", "26/11/2026", "ENTREGA DIRETA", "200", "20"],
    ["PENHA", "3", "CCC3C33", "26/11/2026", "PA OLARIA - TRANSG", "300", "30"],
    ["GOIÂNIA - CE", "4", "PLACACE", "26/11/2026", "CARGA ATACADO GRF", "400", "40"],
    ["PEDIDOS-COBRANÇA", "5", "PCEGRF0", "26/11/2026", "CD TRES RIOS", "500", "50"],
  ];
  const r = ctx.splitUnifiedSheet(rows);
  assert.equal(JSON.stringify(r.dist.map((x) => x.placa)), JSON.stringify(["AAA1A11", "BBB2B22"]));
  assert.equal(JSON.stringify(r.transb.map((x) => x.placa)), JSON.stringify(["CCC3C33"]));
  assert.equal(r.excluidas, 2);
  assert.equal(r.naoClassificadas, 0);
});
