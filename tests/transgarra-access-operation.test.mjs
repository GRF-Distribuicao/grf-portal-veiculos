import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const server = await readFile(new URL("../src/lib/grf-transporter-access.functions.ts", import.meta.url), "utf8");
const form = await readFile(new URL("../src/routes/transportador_.solicitar-acesso.tsx", import.meta.url), "utf8");

test("solicitação Transgarra exige e registra a base escolhida", () => {
  assert.match(server, /isTransgarra\(data\.companyCnpj\).*isOperationBase\(data\.operationBase\)/s);
  assert.match(server, /data\.operationBase === "PENHA" \? "TRANSGARRA RIO" : "TRANSGARRA TRÊS RIOS"/);
  assert.match(form, /value="PENHA">Rio \/ Penha/);
  assert.match(form, /value="CD TRÊS RIOS">Três Rios/);
});

test("aprovação aceita apenas as duas operações Transgarra existentes", () => {
  assert.match(server, /\["TRANSGARRA RIO", "TRANSGARRA TRES RIOS"\]/);
  assert.match(server, /if \(!selectedCompany\.cnpj && !sharedTransgarra\)/);
  assert.match(server, /if \(isTransgarra\(request\.company_cnpj\) && !sharedTransgarra\)/);
});

test("demais transportadoras preservam o fluxo por CNPJ ou nome", () => {
  assert.match(server, /isTransgarra\(request\.company_cnpj\)[\s\S]*?\? nameMatch\?\.id[\s\S]*?: cnpjMatch\?\.id \?\? nameMatch\?\.id/);
});
