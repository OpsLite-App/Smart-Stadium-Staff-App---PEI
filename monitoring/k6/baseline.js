import http from 'k6/http';
import { check, group } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://traefik-gateway:8080';

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 8,
      timeUnit: '1s',
      duration: '15s',
      preAllocatedVUs: 4,
      maxVUs: 12,
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  group('routing', () => {
    const response = http.get(
      `${baseUrl}/api/routing/route/pgrouting/geojson?from_node=62&to_node=66`,
      { tags: { endpoint: 'routing' } },
    );

    check(response, {
      'routing returns 200': (result) => result.status === 200,
    });
  });

  group('emergency', () => {
    const response = http.get(`${baseUrl}/api/emergency/status`, {
      tags: { endpoint: 'emergency' },
    });

    check(response, {
      'emergency returns 200': (result) => result.status === 200,
    });
  });
}
