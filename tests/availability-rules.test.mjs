import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  compareDistribution,
  compareTransbordo,
  findRepeatedTrailer,
  isCutoffError,
  isFriendlyAvailabilityError,
  isMissingFunctionError,
  isTransbordoVehicle,
  isValidPlate,
  normalizePlate,
  palletOptions,
  validateAvailabilityDetail,
} from '../src/lib/grf-availability-rules.ts';
import { buildAvailabilityWorkbook } from '../src/lib/grf-availability-export.ts';

test('transbordo = modelo ou tipo com CARRETA, como no cadastro', () => {
  assert.equal(isTransbordoVehicle({ brand_model: 'CARRETA', vehicle_type: '7- CARRETA' }), true);
  assert.equal(isTransbordoVehicle({ brand_model: 'CARRETA VOLVO/FH 440 6X2T', vehicle_type: null }), true);
  assert.equal(isTransbordoVehicle({ brand_model: 'VW/20.480 CTM 4X2', vehicle_type: 'Carreta' }), true);
  assert.equal(isTransbordoVehicle({ brand_model: 'VAN', vehicle_type: null }), false);
  assert.equal(isTransbordoVehicle({ brand_model: '3/4', vehicle_type: 'TOCO' }), false);
  assert.equal(isTransbordoVehicle({ brand_model: null, vehicle_type: null }), false);
});

test('lista de pallets vai do cadastro até 1; sem cadastro não oferece nada', () => {
  assert.deepEqual(palletOptions(3), [3, 2, 1]);
  assert.equal(palletOptions(30).length, 30);
  assert.equal(palletOptions(30)[0], 30);
  assert.deepEqual(palletOptions(null), []);
  assert.deepEqual(palletOptions(0), []);
});

test('placa: normaliza e aceita antiga e Mercosul', () => {
  assert.equal(normalizePlate(' abc-1d23 '), 'ABC1D23');
  assert.equal(isValidPlate('ABC1D23'), true);
  assert.equal(isValidPlate('ABC1234'), true);
  assert.equal(isValidPlate('AB12'), false);
  assert.equal(isValidPlate('1BC1D23'), false);
});

test('validação do transbordo segue o gatilho do banco', () => {
  const cavalo = { plate: 'CHP9C36', brand_model: 'CARRETA', vehicle_type: '7- CARRETA', pallets: 28 };
  const ok = { note: '', trailer_plate: 'abc-1d23', trailer_pallets: 28 };
  assert.equal(validateAvailabilityDetail(cavalo, ok), null);
  assert.match(validateAvailabilityDetail(cavalo, { ...ok, trailer_plate: '' }), /Informe a placa da carreta/);
  assert.match(validateAvailabilityDetail(cavalo, { ...ok, trailer_plate: 'AB12' }), /inválida/);
  assert.match(validateAvailabilityDetail(cavalo, { ...ok, trailer_plate: 'CHP9C36' }), /mesma do cavalo/);
  assert.match(validateAvailabilityDetail(cavalo, { ...ok, trailer_pallets: null }), /Selecione a quantidade/);
  assert.match(validateAvailabilityDetail(cavalo, { ...ok, trailer_pallets: 29 }), /entre 1 e 28/);
  assert.match(validateAvailabilityDetail({ ...cavalo, pallets: null }, ok), /sem quantidade de pallets/);
  assert.match(validateAvailabilityDetail(cavalo, { ...ok, note: 'x'.repeat(201) }), /200 caracteres/);

  const van = { plate: 'CQW3F29', brand_model: 'VAN', vehicle_type: null, pallets: 3 };
  assert.equal(validateAvailabilityDetail(van, { note: 'folga sexta', trailer_plate: '', trailer_pallets: null }), null);
});

test('mesma carreta em dois cavalos é recusada', () => {
  assert.equal(findRepeatedTrailer(['ABC1D23', 'abc-1d23']), 'ABC1D23');
  assert.equal(findRepeatedTrailer(['ABC1D23', 'XYZ9876', '', '']), null);
});

test('distribuição: maior lotação primeiro, sem lotação no fim', () => {
  const rows = [
    { plate: 'RJI6G45', lotacao_kg: 700, pallets: 1 },
    { plate: 'SEMLOTA', lotacao_kg: null, pallets: 8 },
    { plate: 'KYG9099', lotacao_kg: 3500, pallets: 8 },
    { plate: 'PZN2626', lotacao_kg: 3500, pallets: 8 },
    { plate: 'CQW3F29', lotacao_kg: 1600, pallets: 3 },
    { plate: 'KRE2210', lotacao_kg: 1500, pallets: 3 },
    { plate: 'DXA7I79', lotacao_kg: 1600, pallets: 2 },
  ];
  assert.deepEqual(rows.sort(compareDistribution).map((row) => row.plate), [
    'KYG9099', 'PZN2626', 'CQW3F29', 'DXA7I79', 'KRE2210', 'RJI6G45', 'SEMLOTA',
  ]);
});

test('transbordo: mais pallets informados primeiro, depois lotação', () => {
  const rows = [
    { plate: 'AAA1111', lotacao_kg: 26000, pallets: 28, trailer_pallets: 28 },
    { plate: 'BBB2222', lotacao_kg: 39000, pallets: 30, trailer_pallets: 30 },
    { plate: 'CCC3333', lotacao_kg: 32000, pallets: 30, trailer_pallets: 30 },
    { plate: 'DDD4444', lotacao_kg: 32000, pallets: 30, trailer_pallets: 12 },
  ];
  assert.deepEqual(rows.sort(compareTransbordo).map((row) => row.plate), ['BBB2222', 'CCC3333', 'AAA1111', 'DDD4444']);
});

test('mensagens do banco mostradas ao transportador', () => {
  assert.equal(isCutoffError('Disponibilidade de 28/09/2026 encerrada às 16:30. Depois do horário de corte não é possível alterar.'), true);
  assert.equal(isFriendlyAvailabilityError('Cavalo CHP9C36 é de transbordo: informe a placa da carreta e a quantidade de pallets.'), true);
  assert.equal(isFriendlyAvailabilityError('Veículo KRD5225 sem cadastro aprovado pela GRF. Finalize o cadastro para informar disponibilidade.'), true);
  assert.equal(isFriendlyAvailabilityError('duplicate key value violates unique constraint'), false);
  assert.equal(isFriendlyAvailabilityError(null), false);
});

test('Excel exporta tudo, distribuição antes do transbordo, e marca o que foi usado', () => {
  const base = { sankhya_registered: true, submittedAt: '2026-09-28T12:11:00.000Z', availability_note: null, trailer_plate: null, trailer_pallets: null, usedAt: null };
  const rows = [
    { ...base, plate: 'RJI6G45', transporterName: 'SUPER VINHOS', brand_model: 'FIORINO', vehicle_type: null, lotacao_kg: 700, pallets: 1 },
    { ...base, plate: 'CHP9C36', transporterName: 'TRANSGARRA TRÊS RIOS', brand_model: 'CARRETA', vehicle_type: '7- CARRETA', lotacao_kg: 26000, pallets: 28, trailer_plate: 'ABC1D23', trailer_pallets: 28, availability_note: '=1+1' },
    { ...base, plate: 'PZN2626', transporterName: 'SUPER VINHOS', brand_model: '3/4', vehicle_type: null, lotacao_kg: 3500, pallets: 8, usedAt: '2026-09-28T20:00:00.000Z' },
  ];
  const book = XLSX.read(XLSX.write(buildAvailabilityWorkbook(rows), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  const sheet = XLSX.utils.sheet_to_json(book.Sheets['Disponibilidade']);
  assert.deepEqual(sheet.map((row) => row['Placa']), ['PZN2626', 'RJI6G45', 'CHP9C36']);
  assert.deepEqual(sheet.map((row) => row['Operação']), ['Distribuição', 'Distribuição', 'Transbordo']);
  assert.deepEqual(sheet.map((row) => row['Usado']), ['Sim', 'Não', 'Não']);
  assert.equal(sheet[2]['Placa da carreta'], 'ABC1D23');
  assert.equal(sheet[2]['Pallets informados'], 28);
  assert.equal(sheet[2]['Observação'], '=1+1');
  assert.equal(sheet[0]['Placa da carreta'] ?? '', '');
  assert.equal(sheet[1]['Atualizado'], '09:11');
});

test('função inexistente no banco é reconhecida; outros erros não', () => {
  assert.equal(isMissingFunctionError({ code: 'PGRST202', message: 'Could not find the function public.submit_fleet_availability_items(p_availability_date, p_items) in the schema cache' }), true);
  assert.equal(isMissingFunctionError({ message: 'Could not find the function public.fleet_availability_window without parameters in the schema cache' }), true);
  assert.equal(isMissingFunctionError({ code: '42501', message: 'permission denied for function transporter_fleet_status' }), false);
  assert.equal(isMissingFunctionError({ code: 'P0001', message: 'Disponibilidade de 28/09/2026 encerrada às 16:30.' }), false);
  assert.equal(isMissingFunctionError(null), false);
  assert.equal(isMissingFunctionError(new Error('Failed to fetch')), false);
});

test('distribuição: no mesmo peso, os veículos ficam agrupados pelo tipo', () => {
  // Disponibilidade de 28/09 (print da aba Disponibilidade).
  const rows = [
    { plate: 'PZN2626', brand_model: '3/4', lotacao_kg: 3500, pallets: 8 },
    { plate: 'RJI6G45', brand_model: 'FIORINO', lotacao_kg: 700, pallets: 1 },
    { plate: 'KYG9099', brand_model: '3/4', lotacao_kg: 3500, pallets: 8 },
    { plate: 'CQW3F29', brand_model: 'VAN', lotacao_kg: 1600, pallets: 3 },
    { plate: 'KRE2210', brand_model: 'VAN', lotacao_kg: 1500, pallets: 3 },
    { plate: 'KRZ0E44', brand_model: 'BONGO', lotacao_kg: 1600, pallets: 3 },
    { plate: 'GVI4I08', brand_model: 'VAN', lotacao_kg: 1500, pallets: 3 },
    { plate: 'DXA7I79', brand_model: 'VAN', lotacao_kg: 1600, pallets: 2 },
    { plate: 'KLF2I19', brand_model: 'BONGO', lotacao_kg: 1500, pallets: 3 },
  ];
  assert.deepEqual(
    rows.sort(compareDistribution).map((row) => `${row.brand_model} ${row.lotacao_kg} ${row.plate}`),
    [
      '3/4 3500 KYG9099',
      '3/4 3500 PZN2626',
      'BONGO 1600 KRZ0E44',
      'VAN 1600 CQW3F29',
      'VAN 1600 DXA7I79',
      'BONGO 1500 KLF2I19',
      'VAN 1500 GVI4I08',
      'VAN 1500 KRE2210',
      'FIORINO 700 RJI6G45',
    ],
  );
});
