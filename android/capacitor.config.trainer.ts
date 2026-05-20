import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.lms.trainer',
  appName: 'LMS Trainer',
  webDir:  'build',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration:    2500,
      launchAutoHide:        true,
      backgroundColor:       '#8b5cf6',
      androidSplashResourceName: 'splash',
      showSpinner:           true,
      spinnerColor:          '#ffffff',
    },
    StatusBar: {
      style:           'dark',
      backgroundColor: '#8b5cf6',
    },
  },
};

export default config;
