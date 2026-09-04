import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const syncSource = await readFile(
  new URL("../src/lib/grf-occupation-sync.server.ts", import.meta.url),
  "utf8",
);
const panelServerSource = await readFile(
  new URL("../src/lib/grf-occupation-panel.server.ts", import.meta.url),
  "utf8",
);
const panelBase64 = (
  await readFile(new URL("../src/assets/ocupacao/painel.b64.txt", import.meta.url), "utf8")
).trim();
const panelHtml = gunzipSync(Buffer.from(panelBase64, "base64")).toString("utf8");

test("cadastro mestre entrega brand_model sem retirar vehicle_type", () => {
  assert.match(syncSource, /\.select\(\s*"plate,[^"]*brand_model[^"]*vehicle_type[^"]*",?\s*\)/);
  assert.match(syncSource, /row\["brand_model"\]/);
  assert.match(syncSource, /tipoVeic: typeof row\["vehicle_type"\]/);
});

test("somente as três visualizações de Distribuição usam o modelo", () => {
  const uses = panelHtml.match(/modeloDistribuicao/g) ?? [];
  assert.equal(uses.length, 5, "esperava uma atribuição e três pontos de modeloDistribuicao");

  assert.match(panelHtml, /rec\.modeloDistribuicao = \(fleet && fleet\.modelo\)/);
  assert.match(panelHtml, /dist\.forEach\(r=>\{ tipoDistCount\.set\(r\.modeloDistribuicao,/);
  assert.match(panelHtml, /aggUtilByField\(dist, 'modeloDistribuicao', 'pesoBruto', 'capKg'\)/);
  assert.match(panelHtml, /const tipo = uniqueLabel\(rows, 'modeloDistribuicao', 1\)/);
});

test("Transbordo permanece usando vehicle_type", () => {
  assert.match(panelHtml, /trips\.forEach\(t=>\{ if\(t\.tipoVeic\) tipoTransbCount/);
  assert.match(panelHtml, /tipoVeic: fleet \? fleet\.tipoVeic : null/);
  assert.match(panelHtml, /const tipo = uniqueLabel\(rows, 'tipoVeic', 1\)/);
  assert.match(panelHtml, /aggUtilByField\(matched, 'tipoVeic', 'palTotal', 'capPaletes'\)/);
});

test("assinaturas do asset correspondem ao HTML gerado", () => {
  const expectedBase64 = Number(panelServerSource.match(/EXPECTED_BASE64_LENGTH = (\d+)/)?.[1]);
  const expectedHtmlBytes = Number(panelServerSource.match(/EXPECTED_HTML_BYTES = (\d+)/)?.[1]);

  assert.equal(panelBase64.length, expectedBase64);
  assert.equal(Buffer.byteLength(panelHtml), expectedHtmlBytes);
});
