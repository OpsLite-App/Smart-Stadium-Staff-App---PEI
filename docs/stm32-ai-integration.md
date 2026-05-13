# STM32 AI camera integration

This note is the handoff contract for testing the STM32 people-counting model with the Supervisor Web backend.

## Goal

The STM32/AI pipeline should send camera monitoring results to the Routing Service. The web app then:

- updates the camera status in PostGIS,
- recolors the camera coverage on the map,
- creates routing cost overrides for congested/critical zones,
- shows impacted edges on the supervisor map,
- makes pgRouting avoid those areas when possible.

## Required services

Run the backend services needed for this flow:

```bash
docker compose -f docker-compose.dev.yml up -d --build postgres_map auth-service routing-service
```

Run the frontend if visual validation is needed:

```bash
cd frontend-web
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

Routing Service URL:

```text
http://localhost:8002
```

## Camera IDs

Use one of these `camera_id` values when sending AI results:

| camera_id | Camera name | Floor | Monitored area |
|---:|---|---:|---|
| 1 | Câmara Sala de Reuniões | 1 | Sala de Reuniões |
| 2 | Câmara WC | 1 | WC |
| 3 | Câmara Bar | 1 | Bar |
| 4 | Câmara Entrada | 0 | Entrada |
| 5 | Câmara Secretaria | 2 | Secretaria |
| 6 | Câmara Sala de Estudo | 1 | Sala de Estudo |
| 7 | Câmara Corredor Gabinetes | 2 | Corredor Gabinetes |

## Payload contract

Send updates to:

```text
PUT /api/gis/camera-status/{camera_id}
```

Body:

```json
{
  "people_count": 48,
  "density_level": "congested",
  "queue_level": "congested",
  "status": "online"
}
```

Accepted values:

```text
density_level: normal | busy | congested | critical
queue_level:   normal | busy | congested | critical
status:        online | degraded | offline
```

If `density_level` is omitted, the backend derives it from `people_count`:

| people_count | density_level |
|---:|---|
| 0-19 | normal |
| 20-37 | busy |
| 38-54 | congested |
| 55+ | critical |

## Authentication

Updating camera state is restricted to `Supervisor` or `admin`.

For frontend testing, log in as a supervisor user and use the UI.

For direct API testing, use a supervisor bearer token:

```bash
TOKEN="<SUPERVISOR_TOKEN>"
```

Then call:

```bash
curl -X PUT "http://localhost:8002/api/gis/camera-status/3" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "people_count": 48,
    "density_level": "congested",
    "queue_level": "congested",
    "status": "online"
  }'
```

Expected response:

```json
{
  "camera_id": 3,
  "camera_name": "Câmara Bar",
  "coverage_id": 3,
  "floor_id": 1,
  "monitored_area": "Bar",
  "people_count": 48,
  "density_level": "congested",
  "queue_level": "congested",
  "status": "online",
  "timestamp": "..."
}
```

## Quick hardware-free test

Use this if the STM32 flash/build is not ready yet:

```bash
curl -X PUT "http://localhost:8002/api/gis/camera-status/6" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "people_count": 70,
    "density_level": "critical",
    "queue_level": "critical",
    "status": "online"
  }'
```

Then validate:

```bash
curl "http://localhost:8002/api/gis/camera-status?floor_id=1"
curl "http://localhost:8002/api/gis/impacted-edges?floor_id=1"
curl "http://localhost:8002/api/graph/status"
```

Expected:

- camera status includes the new count,
- impacted edges are returned as GeoJSON,
- graph status becomes `degraded` or `critical`,
- Supervisor Web map changes the coverage color and shows impacted edges.

## Routing impact rules

When camera state changes:

| density_level | Routing effect |
|---|---|
| normal | removes active routing impact for that camera |
| busy | removes active routing impact for that camera |
| congested | creates edge overrides with `cost_multiplier = 2.5` |
| critical | creates edge overrides with `cost_multiplier = 7.5` |

The affected edges are computed spatially:

```text
camera_coverage polygon intersects / is near indoor edges on the same floor
```

## Visual validation checklist

1. Open Supervisor Web.
2. Log in as a supervisor.
3. Go to `Mapa`.
4. Select the camera floor.
5. Send a `congested` or `critical` update.
6. Confirm:
   - camera coverage changes color,
   - impacted edges appear on the map,
   - graph status shows degraded/critical,
   - POI Navigation routes avoid the affected area when possible.

## Minimal STM32 bridge expectation

The STM32 side does not need to know about routing. It only needs to produce:

```json
{
  "camera_id": 3,
  "people_count": 48
}
```

A small bridge script/service can map that output into the API payload:

```json
{
  "people_count": 48,
  "density_level": "congested",
  "queue_level": "congested",
  "status": "online"
}
```

If the model only outputs bounding boxes/detections, count the detected people and send `people_count`.

## Common failures

### 401 Missing bearer token

The request is missing:

```text
Authorization: Bearer <token>
```

### 403 Supervisor role required

The token belongs to a non-supervisor user.

### No visual route impact

Check:

```bash
curl "http://localhost:8002/api/gis/camera-status?floor_id=1"
curl "http://localhost:8002/api/gis/impacted-edges?floor_id=1"
```

If `impacted-edges` is empty, the camera may not have a `camera_coverage` polygon or the camera status is `normal`/`busy`.
