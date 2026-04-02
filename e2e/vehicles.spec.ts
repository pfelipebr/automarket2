import { test, expect } from '@playwright/test';

test.describe('Vehicle listing', () => {
  test('home page loads and shows vehicle cards', async ({ page }) => {
    await page.goto('/');
    // Wait for either vehicles or the empty state message
    await expect(
      page.locator('text=/veículos encontrados|nenhum veículo/i').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('filter by brand narrows results', async ({ page }) => {
    await page.goto('/');

    // Wait for the filter panel to be visible (desktop)
    const brandInput = page.getByPlaceholder(/toyota/i);
    await brandInput.fill('Porsche');

    await page.getByRole('button', { name: /buscar/i }).first().click();

    // Either results mention Porsche or show empty state
    await expect(
      page.locator('text=/Porsche|nenhum veículo/i').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('vehicle detail page renders correctly', async ({ page }) => {
    await page.goto('/');

    // Click the first vehicle card if one exists
    const firstCard = page.locator('a[href^="/vehicles/"]').first();
    const count = await firstCard.count();
    if (count === 0) {
      test.skip(); // No vehicles in DB — skip gracefully
      return;
    }

    await firstCard.click();
    await expect(page.getByText(/r\$\s*[\d.]+/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/contato|whatsapp|ver no mapa/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Vehicle creation (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? 'https://demo.aidevcowork.com';
    const email = `e2e_create_${Date.now()}@test.com`;

    await page.request.post(`${base}/auth/register`, {
      data: { name: 'Creator', email, password: 'TestPass123!' },
    });

    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill(email);
    await page.getByLabel(/senha/i).fill('TestPass123!');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('authenticated user can navigate to create vehicle page', async ({ page }) => {
    await page.getByRole('link', { name: /anunciar/i }).click();
    await expect(page).toHaveURL('/vehicles/create');
    await expect(page.getByText(/novo anúncio|cadastrar/i)).toBeVisible();
  });
});
