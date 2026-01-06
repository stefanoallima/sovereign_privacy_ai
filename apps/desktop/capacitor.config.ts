import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.privateassistant.app",
  appName: "Private Assistant",
  webDir: "dist",
  server: {
    // Allow loading from localhost during development
    androidScheme: "https",
  },
  plugins: {
    // Configure plugins as needed
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#14b8a6", // Primary teal color
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  android: {
    // Android-specific config
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },
};

export default config;
