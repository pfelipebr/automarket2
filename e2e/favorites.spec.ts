import { test, expect } from '@playwright/test';

test.describe('Favorites (authenticated)', () => {
  let email: string;

  test.beforeEach(async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? 'https://demo.aidevcowork.com';
    email = `e2e_fav_${Date.now()}@test.com`;

    await page.request.post(`${base}/auth/register`, {
      data: { name: 'Fav E2E', email, password: 'TestPass123!' },
    });

    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill(email);
    await page.getByLabel(/senha/i).fill('TestPass123!');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('favorites page loads (empty state for new user)', async ({ page }) => {
    await page.goto('/favorites');
    await expect(
      page.locator('text=/favorito|nenhum|saved/i').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('user can add a vehicle to favorites from listing', async ({ page }) => {
    await page.goto('/');

    // Find a vehicle card with a favorite button
    const favBtn = page.locator('button[title*="avorit"]').first();
    const count = await favBtn.count();
    if (count === 0) {
      test.skip(); // No vehicles available
      return;
    }

    await favBtn.click();
    // Button should reflect favorited state (❤️)
    await expect(favBtn).toContainText('❤️', { timeout: 5_000 });
  });
});
