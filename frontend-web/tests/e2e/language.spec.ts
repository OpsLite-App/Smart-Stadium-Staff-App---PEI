import { expect, test } from '@playwright/test';

const supervisorEmail = process.env.OPSLITE_SUPERVISOR_EMAIL || 'eu@test.com';
const supervisorPassword = process.env.OPSLITE_SUPERVISOR_PASSWORD || 'password';

test('switches language, persists the preference and updates the supervisor workspace', async ({ page }) => {
  await page.goto('/auth-routes/login');

  await expect(page.getByRole('heading', { name: 'Iniciar sessão' })).toBeVisible();
  await page.getByTitle('Mudar para inglês').first().click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByTitle('Switch to Portuguese').first().click();
  await expect(page.getByRole('heading', { name: 'Iniciar sessão' })).toBeVisible();

  await page.locator('input[type="email"]').fill(supervisorEmail);
  await page.locator('input[type="password"]').fill(supervisorPassword);
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page).toHaveURL(/\/app-routes\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Painel de supervisão' })).toBeVisible();

  await page.locator('[title="Mudar para inglês"]:visible').click();
  await expect(page.getByRole('heading', { name: 'Supervisor dashboard' })).toBeVisible();
});
