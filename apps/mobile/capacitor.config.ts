import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pphotonn.saveslot',
  appName: 'Save Slot',
  webDir: '../web/build',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#080c0d',
    resolveServiceWorkerRequests: false,
  },
};

export default config;
