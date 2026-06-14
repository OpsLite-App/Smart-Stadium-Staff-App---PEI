# Smart Stadium Staff App - PEI

Supervisor web application and supporting microservices for indoor GIS routing,
operational monitoring, incident management and staff coordination.

## Active Architecture

The active map/routing flow no longer uses `services/Map-Service`.

```text
frontend-web -> routing-service -> postgres_map/PostGIS/pgRouting
```

Core active services:

- `frontend-web`: Next.js supervisor/staff web UI
- `routing-service`: GIS layers, pgRouting routes, camera status and graph impacts
- `postgres_map`: PostGIS + pgRouting database loaded from `indoor_gis_backup.sql`
- `auth-service`: login/session/staff users
- `emergency-service`: incidents and responder dispatch
- `maintenance-service`: cleaning/bin tasks
- `congestion-service`: heatmap/crowd data
- `queueing-service`, `chat-service`, `positioning-service`, `ws-gateway`, `event-processor`

Access control is role-based and shared between backend and frontend. See
[`docs/development/rbac.md`](docs/development/rbac.md) for the active role and
permission matrix.

In `docker-compose.dev.yml`, `auth-service` seeds demo users automatically on
startup with `OPSLITE_SEED_USERS=true`. The dev compose also sets
`OPSLITE_SEED_USERS_RESET=true`, so the auth users table is reset to the demo
accounts each time the auth service starts:

- `john.doe@example.com` - `Security` - Node `62` (cruzamento, F1)
- `bruno@test.com` - `Cleaning` - Node `70` (escadas, F2)
- `alice@test.com` - `Security` - Node `66` (cruzamento, F1)
- `eu@test.com` - `Supervisor` - Node `62` (cruzamento, F1)
- `medico@test.com` - `Medical` - Node `1` (SalaIn, F1)

## Legacy Map Service

`services/Map-Service` is kept in the repository for reference/legacy tests only.
It is not started by default.

To start it manually:

```bash
docker compose -f docker-compose.dev.yml --profile legacy up -d map-service
```

Normal development should use `routing-service` endpoints:

- `GET /api/gis/rooms`
- `GET /api/gis/corridors`
- `GET /api/gis/cameras`
- `GET /api/gis/camera-coverage`
- `GET /api/gis/camera-status`
- `GET /api/gis/impacted-edges`
- `GET /api/pois`
- `GET /api/route/pgrouting`
- `GET /api/route/pgrouting/by-poi`
- `GET /api/route/pgrouting/by-poi/geojson`

## Run

Start backend and frontend services:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Open:

```text
http://localhost:3000
```

## Useful Checks

Validate GIS database:

```bash
docker exec -it postgres_map psql -U postgres -d estadio_do_dragao -c "
SELECT 'edges' AS layer, COUNT(*) FROM indoor.edges
UNION ALL SELECT 'nodes', COUNT(*) FROM indoor.nodes
UNION ALL SELECT 'rooms_polygons', COUNT(*) FROM indoor.rooms_polygons
UNION ALL SELECT 'camera_infrastructure', COUNT(*) FROM indoor.camera_infrastructure
UNION ALL SELECT 'camera_coverage', COUNT(*) FROM indoor.camera_coverage
UNION ALL SELECT 'vertical_transitions', COUNT(*) FROM indoor.vertical_transitions;
SELECT * FROM pgr_version();
"
```

Validate frontend:

```bash
cd frontend-web
npx tsc --noEmit
npm run lint
npm run build
```
