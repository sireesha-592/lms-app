import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.lms.trainee',
  appName: 'LMS Trainee',
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
      backgroundColor:       '#00d4aa',
      androidSplashResourceName: 'splash',
      showSpinner:           true,
      spinnerColor:          '#ffffff',
    },
    StatusBar: {
      style:           'light',
      backgroundColor: '#00d4aa',
    },
  },
};

export default config;
