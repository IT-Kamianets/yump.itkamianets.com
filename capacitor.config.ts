/// <reference types="@capawesome/capacitor-android-edge-to-edge-support" />
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.itkamianets.yump',
  appName: 'YUMP!',
  webDir: 'dist/yump/browser',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    EdgeToEdge: {
      backgroundColor: '#0c1024',
      statusBarColor: '#0c1024',
      navigationBarColor: '#070a1a',
    },
    SystemBars: {
      insetsHandling: 'disable',
      style: 'DARK',
    },
    Keyboard: {
      resizeOnFullScreen: false,
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
