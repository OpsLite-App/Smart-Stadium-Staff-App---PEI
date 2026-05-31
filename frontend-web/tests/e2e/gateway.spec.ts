import { expect, test } from '@playwright/test';

const gatewayUrl = process.env.OPSLITE_GATEWAY_URL || 'http://localhost:8080';

test.describe('Traefik API Gateway', () => {
  test('routes critical public services through one entrypoint', async ({ request }) => {
    const checks = [
      '/api/routing/route/pgrouting/geojson?from_node=62&to_node=66',
      '/api/gis/nodes?floor_id=1',
      '/api/emergency/incidents',
      '/api/congestion/heatmap',
    ];

    for (const path of checks) {
      const response = await request.get(`${gatewayUrl}${path}`);
      expect(response.ok(), `${path} returned ${response.status()}`).toBeTruthy();
    }
  });

  test('preserves authentication on protected audit endpoints', async ({ request }) => {
    const response = await request.get(`${gatewayUrl}/api/emergency/audit/status`);
    expect(response.status()).toBe(401);
  });
});
