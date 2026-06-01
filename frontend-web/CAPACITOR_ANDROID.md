# OpsLite Android Bridge

The Android app uses Capacitor as a native shell around the existing Next.js
frontend. This keeps the browser and supervisor workspace intact while making
the mobile-first staff interface installable on Android.

## Current milestone

This first milestone is for local development and demonstrations. Capacitor
loads the Next.js frontend from the development machine, so the existing Next
rewrites continue to proxy `/api/*` requests to Traefik.

The default URL is suitable for the Android Emulator:

```text
http://10.0.2.2:3000
```

For a physical Android phone, allow the computer's current LAN address in
Next.js and use the same address in Capacitor:

```bash
NEXT_ALLOWED_DEV_ORIGINS=192.168.1.142 docker compose -f ../docker-compose.dev.yml up -d --force-recreate frontend-web
CAPACITOR_SERVER_URL=http://192.168.1.142:3000 npm run android:sync
npm run android:open
```

The computer and phone must be connected to the same network. Replace the
example IP address in both commands if the computer receives a different
address. Without `NEXT_ALLOWED_DEV_ORIGINS`, Next.js blocks the development
runtime requested by the phone and the native shell can remain on its loading
screen.

## Run the Android app

Install Android Studio and its Android SDK first. If Gradle cannot find the SDK,
open the generated `android` folder in Android Studio once or create the local
file `android/local.properties` with your SDK path:

```properties
sdk.dir=/home/rodrigo/Android/Sdk
```

This file is machine-specific and must not be committed.

Start the backend and frontend:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Synchronize native assets and configuration:

```bash
cd frontend-web
npm run android:sync
npm run android:open
```

In Android Studio, select an emulator or connected Android phone and press
Run. The login page should open inside the native app shell.

## Production follow-up

Do not use `server.url` for a production release. A distributable offline APK
requires a separate mobile build strategy:

1. Route mobile API requests directly through Traefik.
2. Configure production HTTPS, CORS and authentication cookies.
3. Generate static web assets or host the production frontend over HTTPS.
4. Remove the development `server.url` before publishing the APK.
