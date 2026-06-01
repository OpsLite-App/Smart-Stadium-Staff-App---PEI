import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const baseUrl = __ENV.BASE_URL || 'http://traefik-gateway:8080';
const rateLimitedRequests = new Counter('rate_limited_requests');
const successfulRequests = new Counter('successful_requests');
const unexpectedStatuses = new Counter('unexpected_statuses');

http.setResponseCallback(http.expectedStatuses(200, 429));

export const options = {
  scenarios: {
    routingRateLimit: {
      executor: 'shared-iterations',
      vus: 80,
      iterations: 160,
      maxDuration: '15s',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    rate_limited_requests: ['count>0'],
    unexpected_statuses: ['count==0'],
  },
};

export default function () {
  const response = http.get(
    `${baseUrl}/api/routing/route/pgrouting/geojson?from_node=62&to_node=66`,
    { tags: { endpoint: 'routing-rate-limit' } },
  );

  if (response.status === 200) {
    successfulRequests.add(1);
  } else if (response.status === 429) {
    rateLimitedRequests.add(1);
  } else {
    unexpectedStatuses.add(1);
  }

  check(response, {
    'gateway returns 200 or expected 429': (result) =>
      result.status === 200 || result.status === 429,
  });
}
