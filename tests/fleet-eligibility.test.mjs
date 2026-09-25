import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canInformAvailability,
  isApprovalRequiredError,
  isVisibleInTransporterArea,
  normalizePortalStatus,
} from '../src/lib/grf-fleet-eligibility.ts';

test('only APROVADO and DEVOLVIDO survive normalization; anything else is PENDENTE', () => {
  assert.equal(normalizePortalStatus('APROVADO'), 'APROVADO');
  assert.equal(normalizePortalStatus('DEVOLVIDO'), 'DEVOLVIDO');
  for (const value of ['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_ANALISE', 'REPROVADO', 'PRONTO_INTEGRACAO', 'COMPLETO', '', null, undefined, 42]) {
    assert.equal(normalizePortalStatus(value), 'PENDENTE', String(value));
  }
});

test('transporter area shows approved and returned vehicles, nothing else', () => {
  assert.equal(isVisibleInTransporterArea('APROVADO'), true);
  assert.equal(isVisibleInTransporterArea('DEVOLVIDO'), true);
  assert.equal(isVisibleInTransporterArea('PENDENTE'), false);
});

test('only approved vehicles can be informed for routing', () => {
  assert.equal(canInformAvailability('APROVADO'), true);
  assert.equal(canInformAvailability('DEVOLVIDO'), false);
  assert.equal(canInformAvailability('PENDENTE'), false);
});

test('recognizes the database refusal message and nothing else', () => {
  assert.equal(
    isApprovalRequiredError('Veículo KRD5225 sem cadastro aprovado pela GRF. Finalize o cadastro para informar disponibilidade.'),
    true,
  );
  for (const value of ['Veículo não pertence à transportadora desta disponibilidade.', '', null, undefined]) {
    assert.equal(isApprovalRequiredError(value), false, String(value));
  }
});
