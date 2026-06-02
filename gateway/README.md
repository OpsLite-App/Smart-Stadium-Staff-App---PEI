# OpsLite API Gateway

Traefik provides a single public entry point for the OpsLite frontend and
microservices:

```text
http://localhost
```

Port `8080` remains available for debugging and load testing. The Docker
frontend forwards its same-origin `/api/*` requests to Traefik through
`API_GATEWAY_URL=http://traefik-gateway:8080`. Browser WebSocket traffic uses
the same public host through `/ws`, including when the Android shell loads the
app from `http://192.168.0.35`.

For a local-router demonstration, open `http://192.168.0.35` from the phone.
For a public deployment, create a DNS record such as
`opslite.nmiguelcosta.pt` and terminate TLS before Traefik.

## Public Routes

| Public prefix | Target service |
| --- | --- |
| `/` | `frontend-web` |
| `/api/auth/*` | `auth-service` |
| `/api/routing/*` | `routing-service` |
| `/api/gis/*` | `routing-service` |
| `/api/congestion/*` | `congestion-service` |
| `/api/emergency/*` | `emergency-service` |
| `/api/maintenance/*` | `maintenance-service` |
| `/api/queueing/*` | `queueing-service` |
| `/api/positioning/*` | `positioning-service` |
| `/api/chat/*` | `chat-service` |
| `/ws` | `ws-gateway` |

## Start And Verify

```bash
docker compose -f docker-compose.dev.yml up -d traefik
docker compose -f docker-compose.dev.yml ps traefik

curl -I http://localhost
curl http://localhost:8080/api/routing/route/pgrouting/geojson?from_node=62\&to_node=66
curl http://localhost:8080/api/gis/nodes?floor_id=1
curl http://localhost:8080/api/emergency/incidents
curl http://localhost:8080/api/congestion/heatmap
```

Open the Traefik dashboard:

```text
http://localhost:8088/dashboard/
```

## Design Choice

The gateway uses Traefik's file provider instead of the Docker socket. Routing
configuration is versioned in `gateway/traefik/dynamic/routes.yml`, and Traefik
reloads it automatically when the file changes.

## API Protection

Traefik applies security headers and token-bucket rate limiting before requests
reach the microservices. The limits are intentionally stricter for login and
more permissive for operational traffic:

| Traffic | Average | Burst |
| --- | ---: | ---: |
| `POST /api/auth/login` | 5 req/s | 10 |
| Routing and GIS | 30 req/s | 60 |
| Emergency | 20 req/s | 40 |
| Other APIs | 50 req/s | 100 |
| WebSocket handshakes | 20 req/s | 40 |

Verify security headers:

```bash
curl -sS -D - -o /dev/null "http://localhost:8080/api/gis/nodes?floor_id=1"
```

Generate a routing burst and count the responses:

```bash
seq 1 160 | xargs -P 80 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8080/api/routing/route/pgrouting/geojson?from_node=62&to_node=66" \
  | sort | uniq -c
```

Normal traffic returns `200`. Excess requests from the same source return
`429 Too Many Requests` and are rejected before reaching PostGIS.
