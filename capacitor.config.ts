/// <reference types="@capawesome/capacitor-android-edge-to-edge-support" />
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.itkamianets.yump',
  appName: 'YUMP!',
  webDir: 'dist/yump/browser',
  backgroundColor: '#0c1024',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0c1024',
  },
  plugins: {
    EdgeToEdge: {
      backgroundColor: '#0c1024',
      statusBarColor: '#0c1024',
      navigationBarColor: '#0c1024',
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
