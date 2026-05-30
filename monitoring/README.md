# OpsLite Monitoring

This folder contains the local Prometheus and Grafana setup used by `docker-compose.dev.yml`.

## Services

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
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

## Quick Check

```bash
docker compose -f docker-compose.dev.yml up -d prometheus grafana
curl http://localhost:9090/-/ready
curl http://localhost:3001/api/health
```

Open Grafana and go to `Dashboards > OpsLite > OpsLite Operational Overview`.
