import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const form = await readFile(new URL("../src/routes/cadastro.tsx", import.meta.url), "utf8");
const schema = await readFile(new URL("../src/lib/grf-server-helpers.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../src/lib/grf.functions.ts", import.meta.url), "utf8");
const review = await readFile(new URL("../src/routes/admin.$id.tsx", import.meta.url), "utf8");

test("cadastro novo exige e envia as três medidas", () => {
  for (const field of ["bodyWidthM", "bodyHeightM", "bodyLengthM"]) {
    assert.match(form, new RegExp(`if \\(!num\\(form\\.${field}\\)\\)`));
    assert.match(form, new RegExp(`${field}: num\\(form\\.${field}\\)`));
    assert.match(schema, new RegExp(`${field}: z\\.number\\(\\)\\.positive\\(\\)`));
  }
});

test("medidas são salvas no cadastro mestre e vistas na aprovação", () => {
  assert.match(server, /body_width_m: data\.vehicle\.bodyWidthM/);
  assert.match(server, /body_height_m: data\.vehicle\.bodyHeightM/);
  assert.match(server, /body_length_m: data\.vehicle\.bodyLengthM/);
  assert.match(server, /select\("body_width_m, body_height_m, body_length_m"\)/);
  assert.match(review, /Largura \/ altura \/ comprimento/);
});
