# OpsLite k6 Load Tests

These tests exercise the public Traefik gateway and publish k6 metrics to the
existing Prometheus instance through remote write.

## Run

Start the monitored stack first:

```bash
docker compose -f docker-compose.dev.yml up -d traefik prometheus grafana routing-service emergency-service
```

Run one scenario:

```bash
docker compose -f docker-compose.dev.yml --profile tools run --rm k6 run -o experimental-prometheus-rw baseline.js
docker compose -f docker-compose.dev.yml --profile tools run --rm k6 run -o experimental-prometheus-rw routing-stress.js
docker compose -f docker-compose.dev.yml --profile tools run --rm k6 run -o experimental-prometheus-rw rate-limit.js
```

## Scenarios

- `baseline.js` validates normal routing and emergency traffic below gateway limits.
- `routing-stress.js` alternates four real pgRouting paths at 25 requests per second.
- `rate-limit.js` sends a burst of 160 routing requests and passes only when Traefik rejects part of the burst with `429`.

## View

Open Grafana at `http://localhost:3001`, then select `Dashboards` and
`OpsLite k6 Load Testing`. Use a recent time range such as `Last 15 minutes`.

For raw metrics, open `Explore`, select `Prometheus`, and run:

```promql
rate(k6_http_reqs_total[1m])
```

```promql
k6_http_req_duration_p95
```

```promql
rate(k6_rate_limited_requests_total[1m])
```
