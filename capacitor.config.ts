import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yump.game',
  appName: 'YUMP!',
  webDir: 'dist/yump/browser',
  // Keep the splash screen visible while the app loads.
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
