import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.lms.admin',
  appName: 'LMS Admin',
  webDir:  'build',           // React build output folder
  server: {
    // For production APK: remove this block and use local files.
    // For development against a real server, set the URL below:
    // url: 'http://YOUR_SERVER_IP:5000',
    // cleartext: true,
  },
  android: {
    allowMixedContent: true,   // required if your API is HTTP
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration:    2500,
      launchAutoHide:        true,
      backgroundColor:       '#ef4444',
      androidSplashResourceName: 'splash',
      showSpinner:           true,
      spinnerColor:          '#ffffff',
    },
    StatusBar: {
      style:           'dark',
      backgroundColor: '#ef4444',
    },
  },
};

export default config;
