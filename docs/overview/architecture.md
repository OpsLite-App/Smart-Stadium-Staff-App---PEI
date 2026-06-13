# System Architecture

OpsLite is currently a web-based operational supervision platform built around
FastAPI/Spring Boot microservices, Docker Compose and a real indoor GIS model in
PostGIS.

## Active Runtime Flow

```text
frontend-web -> routing-service -> postgres_map/PostGIS/pgRouting
```

The legacy `services/Map-Service` remains in the repository, but it is not part
of the active runtime. The old Flutter staff application was removed after the
project scope moved to a web-only operational platform. The map service is only
available through the optional Docker Compose `legacy` profile.

## Active Services

| Component | Technology | Purpose |
| --- | --- | --- |
| `frontend-web` | Next.js/React | Supervisor and staff web UI |
| `auth-service` | Spring Boot | Login, session validation, seeded dev users and RBAC permissions |
| `routing-service` | FastAPI | GIS layers, pgRouting routes, graph impacts and camera state |
| `postgres_map` | PostgreSQL/PostGIS/pgRouting | Indoor GIS source of truth loaded from `indoor_gis_backup.sql` |
| `emergency-service` | FastAPI | Incidents, sensor alerts, dispatches and evacuation workflow |
| `maintenance-service` | FastAPI | Cleaning/bin tasks and staff assignment |
| `congestion-service` | FastAPI | Heatmap, crowd density and congestion alerts |
| `queueing-service` | FastAPI | Queue/wait-time calculations |
| `positioning-service` | FastAPI | Staff position/fingerprint endpoints |
| `chat-service` | FastAPI | Chat room messages |
| `ws-gateway` | Spring Boot | Authenticated WebSocket/MQTT bridge |
| `event-processor` | Python | MQTT event processing |
| `emulator` | Python | Development stadium event simulation |

## Indoor GIS Model

The active GIS data lives in `postgres_map`, primarily under the `indoor`
schema. The routing service exposes it through `/api/gis/*`, `/api/pois` and
`/api/route/pgrouting/*`.

Core layers:

- `floors`
- `nodes`
- `edges`
- `corridors_polygons`
- `rooms_polygons`
- `pois`
- `camera_infrastructure`
- `camera_coverage`
- `vertical_transitions`

Routes use numeric pgRouting node IDs. The routing service still tolerates old
labels such as `N62` on compatibility endpoints, but the active frontend flow
uses numeric IDs such as `62` and `66`.

## Operational Workflow

Supervisors create or receive incidents, then assign one or more responders.
Each assignment creates an independent dispatch, so one incident can have
separate Security, Medical and Cleaning dispatches.

```text
Incident
|-- Dispatch A -> Security
|-- Dispatch B -> Medical
`-- Dispatch C -> Cleaning
```

Dispatches move independently through `dispatched`, `en_route`, `completed` or
`declined`. Completing one dispatch does not resolve the incident; the global
incident is resolved separately by a permitted user.

When a dispatch is assigned, route calculation follows:

```text
staff.current_location -> incident.location_node
GET /api/route/pgrouting/geojson?from_node=62&to_node=66
```

The frontend renders the returned GeoJSON route with distance, ETA and floor
transition information on the indoor map.

## Access Control

RBAC is shared by backend and frontend. The backend returns the normalized role
and permission matrix from `/auth/login`, `/auth/me` and `/auth/validate`; the
frontend uses the same permission names for route guards and navigation
visibility.

Active roles:

- `Security`
- `Cleaning`
- `Medical`
- `Supervisor`

See [`../development/rbac.md`](../development/rbac.md) for the active permission
matrix.

## Legacy / Unused Areas

- `services/Map-Service`: legacy compatibility layer for simplified
  nodes/edges; not started by default.
- Former Flutter staff app: removed from the repository after the active
  implementation moved to `frontend-web`.
- Older documentation or diagrams may still mention Kafka, Kubernetes, Java map
  services or a mobile-first architecture. Those describe prior design intent,
  not the current Docker Compose runtime.
