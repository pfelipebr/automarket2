import { test, expect } from '@playwright/test';

// Unique email per test run to avoid DB conflicts across runs
const uniqueEmail = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

test.describe('Auth flows', () => {
  test('user can register with a new email', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/');
    await page.getByRole('link', { name: /entrar/i }).click();
    await page.getByRole('link', { name: /criar conta/i }).click();

    await page.getByLabel(/nome/i).fill('E2E User');
    await page.getByLabel(/e-mail/i).fill(email);
    await page.getByLabel(/senha/i).fill('TestPass123!');
    await page.getByRole('button', { name: /criar conta/i }).click();

    // After registration the user should land on the home page authenticated
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/anunciar/i)).toBeVisible();
  });

  test('registered user can login and see home page', async ({ page }) => {
    // Use a pre-created user to avoid dependency on register flow
    const email = uniqueEmail();

    // Register first via API
    const base = process.env.PLAYWRIGHT_BASE_URL ?? 'https://demo.aidevcowork.com';
    await page.request.post(`${base}/auth/register`, {
      data: { name: 'Login E2E', email, password: 'TestPass123!' },
    });

    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill(email);
    await page.getByLabel(/senha/i).fill('TestPass123!');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page).toHaveURL('/');
  });

  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill('nobody@test.com');
    await page.getByLabel(/senha/i).fill('wrongpassword');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByText(/credenciais|inválid/i)).toBeVisible();
  });
});
