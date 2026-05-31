# OpsLite Monitoring

This folder contains the local Prometheus and Grafana setup used by `docker-compose.dev.yml`.

## Services

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Grafana Tempo: http://localhost:3200
- OpenTelemetry Collector health: http://localhost:13133
- Blackbox exporter: http://localhost:9115
- Redis exporter: http://localhost:9121
- Postgres map exporter: http://localhost:9187

Grafana credentials:

- User: `admin`
- Password: `admin`

## What Is Scraped

- `routing-service:8002/metrics`
- `congestion-service:8005/metrics`
- `ws-gateway:8089/actuator/prometheus`
- Redis exporter
- Postgres exporter for `postgres_map`
- Health probes for the main microservices through Blackbox exporter
- Keycloak identity-provider readiness through Blackbox exporter

## Quick Check

```bash
docker compose -f docker-compose.dev.yml up -d prometheus grafana
curl http://localhost:9090/-/ready
curl http://localhost:3001/api/health
```

Open Grafana and go to `Dashboards > OpsLite > OpsLite Operational Overview`.

## Distributed Tracing

Tempo stores traces exported through the OpenTelemetry Collector. Tracing is
enabled for Traefik, `routing-service`, `emergency-service`, and `ws-gateway`.

Generate a trace through the public gateway:

```bash
curl "http://localhost:8080/api/routing/route/pgrouting/geojson?from_node=62&to_node=66"
curl "http://localhost:8080/api/emergency/status"
```

Check that the tracing stack is ready and that Tempo has received traces:

```bash
curl http://localhost:13133
curl http://localhost:3200/ready
curl "http://localhost:3200/api/search?limit=10"
```

To inspect the timeline visually, open Grafana at http://localhost:3001, go to
`Explore`, select the `Tempo` datasource, choose `Search`, and filter by
`Service Name`. Tempo also derives service-graph metrics and sends them to
Prometheus, allowing Grafana to render a service map after traffic is generated.

## Load Testing

Grafana k6 runs as an on-demand Docker tool and exports its metrics to
Prometheus. The available scenarios validate baseline traffic, pgRouting stress,
and Traefik rate limiting.

Run all three scenarios:

```bash
docker compose -f docker-compose.dev.yml --profile tools run --rm k6 run -o experimental-prometheus-rw baseline.js
docker compose -f docker-compose.dev.yml --profile tools run --rm k6 run -o experimental-prometheus-rw routing-stress.js
docker compose -f docker-compose.dev.yml --profile tools run --rm k6 run -o experimental-prometheus-rw rate-limit.js
```

Open Grafana and go to `Dashboards > OpsLite > OpsLite k6 Load Testing`. More
details about each scenario are available in `monitoring/k6/README.md`.
