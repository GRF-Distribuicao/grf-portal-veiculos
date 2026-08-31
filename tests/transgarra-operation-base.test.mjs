import test from 'node:test';
import assert from 'node:assert/strict';
import { isTransgarra, isOperationBase, knownOperationBase, operationBaseLabel } from '../src/lib/grf-operation-base.ts';
import { decisionInputSchema } from '../src/lib/grf-server-helpers.ts';

test('CNPJ formatted or digits identifies Transgarra, never other carriers', () => {
  assert.equal(isTransgarra('53.638.584/0001-91'), true);
  assert.equal(isTransgarra('53638584000191'), true);
  for (const value of ['48.713.716/0001-62', '5363858400019', '', null, undefined]) assert.equal(isTransgarra(value), false);
});

test('only two explicit operational bases are accepted', () => {
  assert.equal(isOperationBase('PENHA'), true);
  assert.equal(isOperationBase('CD TRÊS RIOS'), true);
  for (const value of ['TRÊS RIOS', 'RIO', '', null, undefined, 'PENHA;delete']) assert.equal(isOperationBase(value), false);
  assert.equal(knownOperationBase('CD TRES RIOS'), 'CD TRÊS RIOS');
  assert.equal(knownOperationBase('TRÊS RIOS'), ''); // address is not a base
  assert.equal(knownOperationBase(null), '');
  assert.equal(operationBaseLabel('PENHA'), 'Penha — Transgarra Rio');
  assert.equal(operationBaseLabel('CD TRÊS RIOS'), 'CD Três Rios — Transgarra Três Rios');
});

test('approval schema preserves old requests and rejects fabricated base values', () => {
  const legacy = { id: '00000000-0000-4000-8000-000000000001', action: 'APROVAR', userName: 'Equipe GRF' };
  assert.equal(decisionInputSchema.safeParse(legacy).success, true);
  assert.equal(decisionInputSchema.safeParse({ ...legacy, operationBase: 'CD TRÊS RIOS' }).success, true);
  assert.equal(decisionInputSchema.safeParse({ ...legacy, operationBase: 'RIO' }).success, false);
});
