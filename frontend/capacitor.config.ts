import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codemedha.lms',
  appName: 'CodeMedha',
  webDir: 'build',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    // FIX: Keyboard plugin — resizes WebView instead of pan, prevents content hidden behind keyboard
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
  // FIX: Safe area insets for Android status bar + navigation bar
  server: {
    androidScheme: 'https',
  },
};

export default config;
