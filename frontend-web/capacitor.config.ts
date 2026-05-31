import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:3000';

const config: CapacitorConfig = {
  appId: 'pt.opslite.staff',
  appName: 'OpsLite Staff',
  webDir: 'capacitor-web',
  server: {
    // Development bridge: Android Emulator reaches the host machine at 10.0.2.2.
    // For a physical phone, set CAPACITOR_SERVER_URL to the computer's LAN address.
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;
