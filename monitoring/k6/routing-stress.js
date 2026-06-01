import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const baseUrl = __ENV.BASE_URL || 'http://traefik-gateway:8080';
const routes = [
  [62, 66],
  [66, 62],
  [62, 65],
  [65, 62],
];

export const options = {
  scenarios: {
    routingStress: {
      executor: 'constant-arrival-rate',
      rate: 25,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 10,
      maxVUs: 40,
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(99)<800'],
  },
};

export default function () {
  const route = routes[exec.scenario.iterationInTest % routes.length];
  const response = http.get(
    `${baseUrl}/api/routing/route/pgrouting/geojson?from_node=${route[0]}&to_node=${route[1]}`,
    { tags: { endpoint: 'routing-stress' } },
  );

  check(response, {
    'routing stress returns 200': (result) => result.status === 200,
  });
}
