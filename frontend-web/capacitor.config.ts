import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'http://opslite-server.local';

const config: CapacitorConfig = {
  appId: 'pt.opslite.staff',
  appName: 'OpsLite Staff',
  webDir: 'capacitor-web',
  server: {
    // Local bridge: the phone reaches Traefik through the VM's mDNS hostname.
    // Override this with an HTTPS URL when deploying through a public domain.
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;
