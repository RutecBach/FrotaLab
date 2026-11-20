import { test, expect } from '@playwright/test';
import { civilToday, initialDateTime } from '../lib/dates';

test('período padrão do relatório usa a data civil de São Paulo, não a do UTC', () => {
  expect(civilToday(new Date('2026-11-01T01:30:00Z'))).toBe('2026-10-31');
  expect(civilToday(new Date('2026-11-02T01:00:00Z'))).toBe('2026-11-01');
});

test('formulário preserva segundos e abastecimento não começa com horário passado', () => {
  const now = new Date('2026-11-01T21:00:38.550Z');
  const value = initialDateTime('occurredAt', now);
  expect(value).toMatch(/T\d{2}:\d{2}:\d{2}$/);
  expect(new Date(value).getTime()).toBeGreaterThanOrEqual(now.getTime());
  expect(new Date(value).getTime() - now.getTime()).toBeLessThan(1000);
});
