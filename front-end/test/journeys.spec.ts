import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
test('login inicial evita envio de credenciais pela URL antes da hidratação', async ({
  request,
}) => {
  const response = await request.get('/login');
  const html = await response.text();
  expect(html).toMatch(/<form[^>]*method="post"/);
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Entrar no sistema/);
  expect(html).toMatch(/<input[^>]*id="email"[^>]*disabled/);
  expect(html).toMatch(/<input[^>]*id="password"[^>]*disabled/);
});
test('área privada exige login; gestor cadastra e desativa veículo', async ({ page }) => {
  await page.goto('/app/vehicles');
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('E-mail').fill('gestor@frotalab.test');
  await page.getByLabel('Senha', { exact: true }).fill('FrotaLab@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await page.getByRole('link', { name: 'Veículos', exact: true }).click();
  await page.getByRole('button', { name: 'Novo veículo' }).click();
  const plate = `QA${Date.now().toString().slice(-5)}`;
  await page.getByLabel('Placa', { exact: true }).fill(plate);
  await page.getByLabel('Modelo', { exact: true }).fill('Veículo de teste');
  await page.getByLabel('Categoria exigida').selectOption('B');
  await page.getByLabel('Capacidade (kg)').fill('1500');
  await page.getByLabel('Hodômetro (km)', { exact: true }).fill('100');
  await page.getByLabel('Documento válido até').fill('2035-12-31');
  await page.getByLabel('Seguro válido até').fill('2035-12-31');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByText(plate, { exact: true })).toBeVisible();
});
test('motorista vê suas rotas; interface móvel não transborda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('motorista@frotalab.test');
  await page.getByLabel('Senha', { exact: true }).fill('FrotaLab@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
});

async function signInAsManager(page: Page) {
  await signIn(page, 'gestor');
}

async function signIn(page: Page, account: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(`${account}@frotalab.test`);
  await page.getByLabel('Senha', { exact: true }).fill('FrotaLab@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
}

test('sessão ativa mantém retorno ao painel no Sobre, no início e no login', async ({
  page,
}, testInfo) => {
  await page.goto('/como-funciona');
  await page.getByRole('link', { name: 'Acessar sistema', exact: true }).click();
  await page.getByLabel('E-mail').fill('gestor@frotalab.test');
  await page.getByLabel('Senha', { exact: true }).fill('FrotaLab@2026');
  await page.getByRole('button', { name: 'Entrar no sistema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Sobre o FrotaLab', exact: true }).click();
  await expect(page).toHaveURL(/\/como-funciona$/);
  await expect(page.getByRole('link', { name: 'Voltar ao painel', exact: true })).toBeVisible();
  await expect(page.locator('a[href="/login"]')).toHaveCount(0);
  await expect(page.locator('a[href="/"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('sobre-autenticado.png'), fullPage: true });
  await page.getByRole('link', { name: 'Voltar ao painel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  await expect(page.getByText('Marcos Oliveira', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Ir para o painel', exact: true })).toHaveAttribute(
    'href',
    '/app',
  );
  await expect(
    page.getByRole('link', { name: 'Continuar na operação', exact: true }),
  ).toHaveAttribute('href', '/app');
  await expect(page.locator('a[href="/login"]')).toHaveCount(0);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  await page.goto('about:blank');
  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar no sistema', exact: true })).toBeVisible();
});

test('visitante e cookie inválido mantêm acesso público sem simular sessão ativa', async ({
  page,
  context,
}) => {
  await page.goto('/como-funciona');
  await expect(page.getByRole('link', { name: 'Acessar sistema', exact: true })).toHaveAttribute(
    'href',
    '/login',
  );
  await expect(page.getByRole('link', { name: 'Página inicial', exact: true })).toHaveAttribute(
    'href',
    '/',
  );
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Acessar sistema', exact: true })).toBeVisible();
  await context.addCookies([
    {
      name: 'frotalab',
      value: 'sessao-invalida',
      url: 'http://localhost:3000',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  await page.goto('/como-funciona');
  await expect(page.getByRole('link', { name: 'Acessar sistema', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar ao painel', exact: true })).toHaveCount(0);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar no sistema', exact: true })).toBeVisible();
});

test('relatório distingue o indicador de conclusões atrasadas da coluna de atraso', async ({
  page,
}) => {
  await signInAsManager(page);
  await page.route('**/api/reports/operational?*', (route) =>
    route.fulfill({
      json: {
        period: { from: '2026-11-01', to: '2026-11-02' },
        summary: { delivered: 1, late: 1, pending: 1 },
        items: [
          { reference: 'PENDENTE-ATRASADA', status: 'PENDING', late: true },
          { reference: 'CONCLUIDA-ATRASADA', status: 'DELIVERED', late: true },
        ],
      },
    }),
  );
  await page.getByRole('link', { name: 'Relatórios', exact: true }).click();
  await expect(
    page.getByRole('article').filter({ hasText: 'Concluídas com atraso' }),
  ).toContainText('1');
  await expect(
    page.getByRole('columnheader', { name: 'Atrasada no período', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'PENDENTE-ATRASADA' })).toContainText(
    'Pendente',
  );
  await expect(page.getByRole('row').filter({ hasText: 'PENDENTE-ATRASADA' })).toContainText('Sim');
});

test('gestor anexa documento ao veículo e baixa o mesmo conteúdo', async ({ page }, testInfo) => {
  await signInAsManager(page);
  const response = await page.request.get('/api/vehicles?limit=200');
  expect(response.ok()).toBeTruthy();
  const vehicles = await response.json();
  const vehicle = vehicles.items.find((item: { active: boolean }) => item.active);
  expect(vehicle).toBeTruthy();
  const original = await readFile(resolve(__dirname, 'fixtures/painel.png'));
  const name = `anexo-verificacao-${Date.now()}.png`;
  await page.getByRole('link', { name: 'Documentos', exact: true }).click();
  await page.getByRole('button', { name: 'Anexar documento', exact: true }).click();
  await page.getByRole('combobox', { name: 'Veículo', exact: true }).selectOption(vehicle.id);
  await page
    .getByRole('combobox', { name: 'Tipo de documento', exact: true })
    .selectOption('OTHER');
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: 'image/png', buffer: original });
  await page.getByRole('button', { name: 'Salvar documento', exact: true }).click();
  await expect(page.getByText('Documento anexado com sucesso.', { exact: true })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText(vehicle.plate);
  const pending = page.waitForEvent('download');
  await row.getByRole('link', { name: `Baixar ${name}`, exact: true }).click();
  const download = await pending;
  const target = testInfo.outputPath(name);
  await download.saveAs(target);
  expect(await readFile(target)).toEqual(original);
  await page.screenshot({ path: testInfo.outputPath('documento-anexado.png'), fullPage: true });
});

test('falha fora da API mostra mensagem legível, sem erro de JSON', async ({ page }) => {
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({ status: 500, contentType: 'text/html', body: 'Internal Server Error' }),
  );
  await signInAsManager(page);
  await expect(page.locator('.error-box')).toHaveText('Não foi possível concluir a operação.');
});

test('edição da rota não reenvia entrega cancelada', async ({ page }) => {
  await signIn(page, 'operador');
  const centers = await (await page.request.get('/api/centers?limit=1')).json();
  const stop = (id: string, status: string) => ({
    id,
    status,
    reference: id,
    recipient: 'Destinatário',
    weightKg: 10,
  });
  await page.route('**/api/routes?*', (route) =>
    route.fulfill({
      json: {
        total: 1,
        items: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Rota com entrega cancelada',
            centerId: centers.items[0].id,
            scheduledStart: '2030-01-01T10:00:00.000Z',
            scheduledEnd: '2030-01-01T12:00:00.000Z',
            status: 'ASSIGNED',
            deliveries: [stop('ENTREGA-ATIVA', 'PENDING'), stop('ENTREGA-CANCELADA', 'CANCELLED')],
          },
        ],
      },
    }),
  );
  let sent: { deliveryIds: string[] } | undefined;
  await page.route('**/api/routes/*', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: {} });
  });
  await page.getByRole('link', { name: 'Rotas', exact: true }).click();
  await page.getByRole('button', { name: 'Editar rota', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
  await expect(page.getByText('Registro salvo com sucesso.', { exact: true })).toBeVisible();
  expect(sent?.deliveryIds).toEqual(['ENTREGA-ATIVA']);
});

test('aviso de falha da localização some depois de um envio bem-sucedido', async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as unknown as { emitPosition: () => void };
    navigator.geolocation.watchPosition = (success) => {
      target.emitPosition = () =>
        success({
          coords: { latitude: -24.85, longitude: -54.33, accuracy: 10 },
          timestamp: Date.now(),
        } as GeolocationPosition);
      target.emitPosition();
      return 1;
    };
  });
  await signIn(page, 'motorista');
  await page.route('**/api/routes?*', (route) =>
    route.fulfill({
      json: {
        total: 1,
        items: [
          {
            id: '00000000-0000-4000-8000-000000000002',
            name: 'Rota em viagem',
            scheduledStart: '2030-01-01T10:00:00.000Z',
            status: 'IN_PROGRESS',
            deliveries: [],
          },
        ],
      },
    }),
  );
  let attempts = 0;
  await page.route('**/api/positions', (route) =>
    ++attempts === 1
      ? route.fulfill({ status: 503, json: { message: 'Falha temporária de rede.' } })
      : route.fulfill({ status: 201, json: {} }),
  );
  await page.getByRole('link', { name: 'Rotas', exact: true }).click();
  await page.getByRole('button', { name: 'Compartilhar localização', exact: true }).click();
  await page.getByRole('button', { name: 'Compartilhar localização', exact: true }).first().click();
  await expect(page.locator('.field-error')).toHaveText('Falha temporária de rede.');
  await page.waitForTimeout(5100);
  await page.evaluate(() => (window as unknown as { emitPosition: () => void }).emitPosition());
  await expect(page.getByText(/Posição enviada às/)).toBeVisible();
  await expect(page.locator('.field-error')).toHaveCount(0);
});
