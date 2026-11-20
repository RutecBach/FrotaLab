import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { today, expiryState, deliveryLate, csvCell } from '../src/rules';

const now = new Date('2026-11-02T01:00:00Z');
test('data civil respeita São Paulo e validade de hoje é inclusiva', () => {
  assert.equal(today(now), '2026-11-01');
  assert.equal(expiryState('2026-11-01', now), 'due');
  assert.equal(expiryState('2026-10-31', now), 'expired');
  assert.equal(expiryState('2026-11-02', now), 'due');
  assert.equal(expiryState('2027-01-01', now), 'valid');
});
test('atraso usa conclusão real e desconsidera cancelamento', () => {
  const d = {
    status: 'DELIVERED',
    deadline: '2026-11-01T10:00:00Z',
    completedAt: '2026-11-01T11:00:00Z',
  };
  assert.equal(deliveryLate(d, now), true);
  assert.equal(deliveryLate({ ...d, status: 'CANCELLED' }, now), false);
  assert.equal(deliveryLate({ ...d, completedAt: d.deadline }, now), false);
});
test('exportação escapa aspas e neutraliza fórmulas', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('A "B"'), '"A ""B"""');
});
test('exportação escreve datas em ISO 8601', () => {
  assert.equal(csvCell(new Date('2026-11-01T10:00:00Z')), '"2026-11-01T10:00:00.000Z"');
});
