# WS Gateway (Spring Boot)

This gateway bridges MQTT topics to WebSocket STOMP endpoints (and vice-versa).

Run with:

```bash
# using maven
./mvnw package
java -jar target/ws-gateway-0.0.1-SNAPSHOT.jar
```

Environment variables / properties:
- `mqtt.broker` - MQTT broker connection (default tcp://localhost:1883)
- `auth.serviceUrl` - Auth Service endpoint used to validate tokens (default http://localhost:8081)

WebSocket STOMP endpoints:
- STOMP endpoint: `/ws` (SockJS fallback enabled)
- Destinations: `/topic/crowd`, `/topic/emergency`, `/topic/maintenance`, `/topic/events`

Authentication:
- The gateway expects clients to provide a `Authorization: Bearer <token>` header in STOMP CONNECT.
- Tokens are validated by calling `POST {auth.serviceUrl}/auth/validate`.
- Subscription permissions are enforced based on user role (e.g. `security`, `admin`, `cleaning`).

Publish from gateway:
- POST /api/gateway/assign to publish a staff assignment to `stadium/maintenance/staff-assignments`.

Example curl to post an assignment (dev only):
```bash
curl -X POST http://localhost:8089/api/gateway/assign -H 'Content-Type: application/json' -d '{"id":"assign-1","staff_id":"STAFF_001","poi":"Restroom-A3"}'
```

Quick STOMP client test (JS):
```js
import { Client } from '@stomp/stompjs';

const token = '<PUT_BEARER_TOKEN_HERE>';
const client = new Client({
  brokerURL: 'ws://localhost:8089/ws',
  connectHeaders: { Authorization: `Bearer ${token}` },
  debug: (str) => console.log(str),
});

client.onConnect = () => {
  client.subscribe('/topic/emergency', (msg) => console.log('emergency:', msg.body));
};

client.activate();
```

Next steps:
- Harden the JWT validation (cache results, implement public-key verification)
- Add tests and a Dockerfile for local composition with `mosquitto` and other services.
- Docker image now includes a startup helper that waits for the MQTT broker to be reachable before starting the JVM.

Frontend connection (React Native)
---------------------------------
This project includes a React Native frontend in `staff-app/frontend` which stores the user token in SecureStore via `useAuthStore` (see `staff-app/frontend/src/stores/useAuthStore.tsx`, key `userToken`).

Minimal connect/subscribe example (React Native / Expo):

1) Add the STOMP client to your frontend project:
```bash
cd staff-app/frontend
npm install @stomp/stompjs
# or: yarn add @stomp/stompjs
```

2) Use a small hook to connect and subscribe (drop this into `src/hooks/useGateway.ts`):
```tsx
import { useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/useAuthStore';

export function useGateway() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    let client: any;
    (async () => {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;

      client = new Client({
        webSocketFactory: () => new WebSocket('ws://localhost:8089/ws'),
        connectHeaders: { Authorization: `Bearer ${token}` },
      });

      client.onConnect = () => {
        // example subscriptions
        client.subscribe('/topic/emergency', (msg) => console.log('Emergency', msg.body));
        client.subscribe('/topic/maintenance', (msg) => console.log('Maintenance', msg.body));
        client.subscribe('/topic/crowd', (msg) => console.log('Crowd', msg.body));
      };

      client.activate();
    })();

    return () => { if (client) client.deactivate(); };
  }, [user]);
}
```

3) Send a REST publish from the frontend (if your frontend needs to publish assignments):
```js
const token = await SecureStore.getItemAsync('userToken');
await fetch('http://localhost:8089/api/gateway/assign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ id: 'assign-1', staff_id: 'STAFF_001', poi: 'Restroom-A3' }),
});
```

Notes:
- Use the `userToken` saved by `useAuthStore` (or your auth flow) as the JWT bearer token.
- On the gateway side, STOMP CONNECT must include `Authorization: Bearer <token>` in the connect headers for the connection to be validated.
- If you prefer a SockJS fallback, adapt `webSocketFactory` to use a SockJS client.

That's it — the frontend pulls the token from `useAuthStore` and connects directly to the gateway STOMP endpoint `/ws`.
