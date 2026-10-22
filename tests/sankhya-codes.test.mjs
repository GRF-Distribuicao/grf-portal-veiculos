import test from 'node:test';
import assert from 'node:assert/strict';
import { sankhyaTipoCarroceria, sankhyaTipoRodado } from '../src/lib/grf-sankhya-codes.ts';

test('rodado Sankhya vem do tipo de veículo do portal', () => {
  assert.equal(sankhyaTipoRodado('Truck'), '01-Truck');
  assert.equal(sankhyaTipoRodado('Toco'), '02-Toco');
  assert.equal(sankhyaTipoRodado('Cavalo mecânico'), '03-Cavalo Mecânico');
  assert.equal(sankhyaTipoRodado('Van'), '04-Van');
  assert.equal(sankhyaTipoRodado('Utilitário'), '05-Utilitário');
  assert.equal(sankhyaTipoRodado('Carreta'), '00-Não Aplicável');
  for (const t of ['VUC', 'Bitrem', 'Rodotrem']) assert.equal(sankhyaTipoRodado(t), '06-Outros');
  assert.equal(sankhyaTipoRodado(null), '');
  assert.equal(sankhyaTipoRodado('Simples'), '');
});

test('carroceria Sankhya vem da carroceria do portal', () => {
  assert.equal(sankhyaTipoCarroceria('Sider'), '05-Sider');
  assert.equal(sankhyaTipoCarroceria('Baú'), '02-Fechada/Baú');
  assert.equal(sankhyaTipoCarroceria('Baú frigorífico'), '02-Fechada/Baú');
  for (const b of ['Carga seca', 'Prancha', 'Tanque', 'Basculante']) assert.equal(sankhyaTipoCarroceria(b), '01-Aberta');
  assert.equal(sankhyaTipoCarroceria('Graneleiro'), '03-Granelera');
  assert.equal(sankhyaTipoCarroceria('Porta-container'), '04-Porta Container');
  assert.equal(sankhyaTipoCarroceria('Baú', 'Cavalo mecânico'), '00-Não Aplicável');
  assert.equal(sankhyaTipoCarroceria(null), '');
});

test('todas as opções do formulário têm código Sankhya', async () => {
  const { VEHICLE_TYPES, BODY_TYPES } = await import('../src/lib/grf-domain.ts');
  for (const t of VEHICLE_TYPES) assert.notEqual(sankhyaTipoRodado(t), '', t);
  for (const b of BODY_TYPES) assert.notEqual(sankhyaTipoCarroceria(b), '', b);
});

test('planilha Sankhya traz parceiro, transportadora, rodado e carroceria primeiro', async () => {
  const XLSX = await import('xlsx');
  const { buildSankhyaWorkbook } = await import('../src/lib/grf-sankhya-export.ts');
  const book = buildSankhyaWorkbook([
    { protocol: 'P1', plate: 'ABC1D23', vehicle_type: 'Truck', body_type: 'Sider', sankhya_codparc: 50002, portal_company: 'SUPER VINHOS' },
    { protocol: 'P2', plate: 'XYZ9A87', vehicle_type: 'Toco', body_type: 'Baú' },
  ]);
  const rows = XLSX.utils.sheet_to_json(book.Sheets['Veículos'], { header: 1, defval: '' });
  assert.deepEqual(rows[0].slice(0, 4), ['Parceiro Sankhya (código)', 'Transportadora no portal', 'Tipo de Rodado (Sankhya)', 'Tipo de Carroceria (Sankhya)']);
  assert.deepEqual(rows[1].slice(0, 4), [50002, 'SUPER VINHOS', '01-Truck', '05-Sider']);
  assert.deepEqual(rows[2].slice(0, 4), ['', '', '02-Toco', '02-Fechada/Baú']);
  assert.equal(rows[1][4], 'P1');
});
