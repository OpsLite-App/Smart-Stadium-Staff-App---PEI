import { expect, test, type Page } from '@playwright/test';

const supervisorEmail = process.env.OPSLITE_SUPERVISOR_EMAIL || 'eu@test.com';
const supervisorPassword = process.env.OPSLITE_SUPERVISOR_PASSWORD || 'password';

async function loginAsSupervisor(page: Page) {
  await page.goto('/auth-routes/login');
  await page.locator('input[type="email"]').fill(supervisorEmail);
  await page.locator('input[type="password"]').fill(supervisorPassword);
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page).toHaveURL(/\/app-routes\/dashboard$/);
}

test.describe('Supervisor frontend through Traefik', () => {
  test('logs in and opens operational incident controls', async ({ page }) => {
    await loginAsSupervisor(page);
    await expect(page.getByRole('heading', { name: 'Painel de supervisão' })).toBeVisible();

    await page.getByRole('button', { name: 'Alertas' }).click();
    await expect(page).toHaveURL(/\/app-routes\/alerts$/);
    await expect(page.getByRole('heading', { name: 'Controlo do supervisor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar incidente' })).toBeVisible();
  });

  test('creates, audits and closes a cleaning incident', async ({ page }) => {
    test.skip(
      process.env.OPSLITE_RUN_MUTATING_E2E !== 'true',
      'Set OPSLITE_RUN_MUTATING_E2E=true for the controlled demo scenario.',
    );

    await loginAsSupervisor(page);

    const incident = await page.evaluate(async () => {
      const response = await fetch('/api/emergency/incidents?auto_dispatch=false', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_type: 'cleaning',
          location_node: '73',
          severity: 'medium',
          description: 'Playwright E2E verification',
          detected_by: 'staff',
          incident_metadata: { created_from: 'playwright_e2e' },
        }),
      });

      if (!response.ok) {
        throw new Error(`Incident creation failed with ${response.status}`);
      }

      return response.json();
    });

    try {
      const audit = await page.evaluate(async () => {
        const response = await fetch('/api/emergency/audit/events?limit=20', {
          credentials: 'include',
        });
        if (!response.ok) throw new Error(`Audit query failed with ${response.status}`);
        return response.json();
      });

      expect(
        audit.events.some(
          (event: { type: string; payload?: { id?: string } }) =>
            event.type === 'incident.created' && event.payload?.id === incident.id,
        ),
      ).toBeTruthy();
    } finally {
      const closed = await page.evaluate(async (incidentId) => {
        const response = await fetch(`/api/emergency/incidents/${incidentId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'false_alarm',
            notes: 'Playwright cleanup',
          }),
        });
        return response.ok;
      }, incident.id);

      expect(closed).toBeTruthy();
    }
  });
});
