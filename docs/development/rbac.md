# Role-Based Access Control

OpsLite uses a shared RBAC model between the auth-service and the frontend.
The backend is the source of truth for the authenticated role and returns a
permission matrix in `/auth/login`, `/auth/me` and `/auth/validate`.

## Roles

| Role | Purpose |
| --- | --- |
| `Security` | Field security operations, alerts, emergency button, map and routing |
| `Cleaning` | Cleaning/maintenance tasks, alerts, map and routing |
| `Medical` | Medical incident response, alerts, map, routing and the dedicated medical incidents workflow |
| `Supervisor` | Web-only supervision, dashboard, analytics, team, incident dispatch and camera density control |

Legacy role names are normalized:

| Input | Normalized role |
| --- | --- |
| `security` | `Security` |
| `cleaning`, `cleaner`, `maintenance` | `Cleaning` |
| `medical`, `medic`, `doctor` | `Medical` |
| `supervisor`, `admin` | `Supervisor` |

Unknown roles default to `Security`.

## Permission Matrix

| Permission | Security | Cleaning | Medical | Supervisor |
| --- | --- | --- | --- | --- |
| View dashboard | Yes | Yes | Yes | Yes |
| View map | Yes | Yes | Yes | Yes |
| Use navigation | Yes | Yes | Yes | Yes |
| View alerts | Yes | Yes | Yes | Yes |
| Use chat | Yes | Yes | Yes | Yes |
| Emergency / evacuation | Yes | Yes | Yes | Yes |
| View tasks | Yes | Yes | No | No |
| Medical incidents | No | No | Yes | No |
| Analytics | No | No | No | Yes |
| Team management | No | No | No | Yes |
| Heatmap | Yes | No | Yes | Yes |
| Bins/cleaning data | No | Yes | No | Yes |
| Acknowledge alerts | Yes | No | No | Yes |
| Create incidents | No | No | No | Yes |
| Manage incidents | No | No | No | Yes |
| Dispatch incidents | No | No | No | Yes |
| Resolve incidents | No | No | Yes | Yes |
| Manage camera density | No | No | No | Yes |

## Incident Categories

Operational incident categories are restricted to:

| Category | Routed to |
| --- | --- |
| `security` | Security team |
| `medic` | Medical team |
| `cleaning` | Cleaning team |

Legacy values such as `medical`, `fire`, `smoke`, `maintenance` and `other`
may still appear in old database rows, but new incident creation and dispatch
requests must use only the three categories above.

## Implementation Notes

- Backend role normalization and permissions live in
  `backend/auth-service/src/main/java/com/stadium/auth_service/security/RoleAccess.java`.
- Frontend route guards and navigation permissions live in
  `frontend-web/lib/auth/rbac.ts`.
- The frontend must not trust the role selected on the login screen. It stores
  the normalized role returned by `/auth/login` or `/auth/me`.
- `/auth/staff` requires an authenticated session because staff listings are
  operational data.
- Medical users do not use the generic Tasks screen. All supervisor-assigned
  medical work appears in the dedicated Medical Incidents screen.
