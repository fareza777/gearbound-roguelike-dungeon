import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.f7developer.gearbound',
  appName: 'Gearbound',
  webDir: 'dist',
  backgroundColor: '#F3E9D2',
  android: {
    allowMixedContent: false,
    backgroundColor: '#F3E9D2',
    overrideUserAgent: 'GearboundAndroid/1.0'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#2A1F14'
    }
  }
};

export default config;
