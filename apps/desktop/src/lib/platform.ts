// Platform detection utilities
// Detects whether we're running in Tauri (desktop), Capacitor (mobile), or web browser

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

export const platform = {
  /**
   * Check if running in Tauri desktop app
   */
  isTauri: (): boolean => {
    return "__TAURI__" in window;
  },

  /**
   * Check if running in Capacitor native app
   */
  isCapacitor: (): boolean => {
    try {
      // Capacitor sets this when running natively
      return (
        typeof (window as any).Capacitor !== "undefined" &&
        (window as any).Capacitor.isNativePlatform()
      );
    } catch {
      return false;
    }
  },

  /**
   * Check if running on Android
   */
  isAndroid: (): boolean => {
    try {
      return (
        platform.isCapacitor() &&
        (window as any).Capacitor.getPlatform() === "android"
      );
    } catch {
      // Fallback to user agent check
      return /android/i.test(navigator.userAgent);
    }
  },

  /**
   * Check if running on iOS
   */
  isIOS: (): boolean => {
    try {
      return (
        platform.isCapacitor() &&
        (window as any).Capacitor.getPlatform() === "ios"
      );
    } catch {
      // Fallback to user agent check
      return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }
  },

  /**
   * Check if running in web browser (not native)
   */
  isWeb: (): boolean => {
    return !platform.isTauri() && !platform.isCapacitor();
  },

  /**
   * Check if running on any mobile platform
   */
  isMobile: (): boolean => {
    return (
      platform.isAndroid() ||
      platform.isIOS() ||
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent.toLowerCase()
      )
    );
  },

  /**
   * Check if running as desktop app (Tauri)
   */
  isDesktop: (): boolean => {
    return platform.isTauri();
  },

  /**
   * Get the current platform name
   */
  getPlatformName: (): "tauri" | "android" | "ios" | "web" => {
    if (platform.isTauri()) return "tauri";
    if (platform.isAndroid()) return "android";
    if (platform.isIOS()) return "ios";
    return "web";
  },

  /**
   * Check if the device has touch capability
   */
  hasTouch: (): boolean => {
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );
  },

  /**
   * Check if the app should use mobile UI
   * (either on mobile device or small screen)
   */
  shouldUseMobileUI: (): boolean => {
    return platform.isMobile() || window.innerWidth < 768;
  },
};

// Export individual functions for convenience
export const {
  isTauri,
  isCapacitor,
  isAndroid,
  isIOS,
  isWeb,
  isMobile,
  isDesktop,
  getPlatformName,
  hasTouch,
  shouldUseMobileUI,
} = platform;
