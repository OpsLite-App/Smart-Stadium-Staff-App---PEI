# OpsLite Android Bridge

The Android app uses Capacitor as a native shell around the existing Next.js
frontend. This keeps the browser and supervisor workspace intact while making
the mobile-first staff interface installable on Android.

## Current milestone

This milestone supports local development and demonstrations. Capacitor loads
the Next.js frontend through Traefik, so the app, `/api/*` requests and `/ws`
WebSocket connection share one public origin.

The default URL is a readable local-network address:

```text
http://opslite-server.local
```

On the Ubuntu VM, advertise the hostname over mDNS once:

```bash
sudo hostnamectl set-hostname opslite-server
sudo apt update
sudo apt install -y avahi-daemon
sudo systemctl enable --now avahi-daemon
```

The VM and phone must be connected to the same router. Verify the link from the
phone browser before installing the Android shell:

```text
http://opslite-server.local
```

If the router or Android version does not resolve mDNS names, temporarily use
the VM address as a fallback:

```bash
CAPACITOR_SERVER_URL=http://192.168.0.36 npm run android:sync
```

Replace the example address with the VM address shown by `hostname -I`.

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

The Android launcher assets are already versioned. To regenerate them after
changing `microsite/public/logo.jpeg`, install Pillow and run:

```bash
sudo apt install -y python3-pil
npm run android:icons
```

To build and install the debug APK from the terminal instead:

```bash
cd frontend-web
(cd android && ./gradlew assembleDebug)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Production follow-up

For a hosted deployment, point the Android shell at the public HTTPS domain:

```bash
CAPACITOR_SERVER_URL=https://opslite.nmiguelcosta.pt npm run android:sync
```

The DNS record and TLS certificate must resolve to a server running Traefik.
For an offline APK, use a separate mobile build strategy:

1. Configure production HTTPS, CORS and authentication cookies.
2. Generate static web assets or host the production frontend over HTTPS.
3. Remove the development `server.url` before publishing the APK.
