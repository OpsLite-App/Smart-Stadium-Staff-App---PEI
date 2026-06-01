# OpsLite Keycloak

Keycloak is the identity provider for the development stack. The existing
`auth-service` remains the compatibility boundary used by the frontend and
microservices, but it delegates password authentication and role lookup to the
`opslite` Keycloak realm before issuing the internal HttpOnly session cookie.

## Start

```bash
docker compose -f docker-compose.dev.yml up -d postgres_keycloak keycloak auth-service
```

Open the administration console:

```text
http://localhost:8084/admin/
```

Development administrator:

```text
admin / admin
```

## Verify

Check OpenID Connect discovery:

```bash
curl http://localhost:8084/realms/opslite/.well-known/openid-configuration
```

Log in through the OpsLite API gateway:

```bash
curl -i -c /tmp/opslite-cookie.txt \
  -H 'Content-Type: application/json' \
  -d '{"username":"eu@test.com","password":"password"}' \
  http://localhost:8080/api/auth/login
```

Validate the resulting HttpOnly session:

```bash
curl -b /tmp/opslite-cookie.txt http://localhost:8080/api/auth/me
```

The response must contain the `Supervisor` role and its RBAC permissions.

## Architecture Choice

The current frontend keeps its existing credential form while `auth-service`
uses Keycloak Direct Access Grants as a compatibility bridge. This avoids
breaking the operational microservices that already consume the internal
OpsLite JWT.

For a production deployment, migrate the web client to Authorization Code Flow
with PKCE, replace the development secrets, use HTTPS, and run Keycloak with a
production configuration instead of `start-dev`.

## Seed Users

All development users use the password `password`.

| Username | Realm role |
| --- | --- |
| `john.doe@example.com` | `security` |
| `alice@test.com` | `security` |
| `bruno@test.com` | `cleaning` |
| `medico@test.com` | `medical` |
| `eu@test.com` | `supervisor` |
