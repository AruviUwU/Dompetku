import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aruvi.dompetku',
  appName: 'Dompetku',
  webDir: 'public',
  server: {
    url: 'https://dompetku-hazel.vercel.app',
    cleartext: false,
    androidScheme: 'https'
  }
};

export default config;
