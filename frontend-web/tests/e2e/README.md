# OpsLite Playwright E2E

Playwright validates the Traefik entrypoint and the supervisor frontend flow.

## Install

```bash
cd frontend-web
npm install
npx playwright install chromium
```

## Safe Test Suite

The default suite does not create operational data:

```bash
npm run test:e2e
```

It verifies:

- Traefik routes Routing, GIS, Emergency and Congestion through port `8080`.
- Protected audit endpoints still reject unauthenticated requests.
- A supervisor can log in and open incident controls through the migrated
  frontend.

## Controlled Demo Scenario

The demo scenario creates one `cleaning` incident, verifies its
`incident.created` audit event and closes the technical occurrence as a false
alarm automatically:

```bash
npm run test:e2e:demo
```

## Visual Report

```bash
npm run test:e2e:report
```

The HTML report opens at:

```text
http://localhost:9323
```
