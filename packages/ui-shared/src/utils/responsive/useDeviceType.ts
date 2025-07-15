"use client";

import { useMediaQuery } from "./useMediaQuery";

export interface DeviceType {
  isDesktop: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isNative: boolean;
}

/**
 * Hook to detect the current device type based on screen size and platform
 * @returns Object with device type booleans
 */
export function useDeviceType(): DeviceType {
  // Breakpoints based on Tailwind defaults
  const isMobileScreen = useMediaQuery("(max-width: 639px)"); // < sm
  const isTabletScreen = useMediaQuery("(min-width: 640px) and (max-width: 1023px)"); // sm to lg
  const isDesktopScreen = useMediaQuery("(min-width: 1024px)"); // >= lg

  // Check if running in React Native (native app)
  const isNative = typeof window !== "undefined" && 
    window.navigator && 
    /ReactNative/i.test(window.navigator.userAgent);

  return {
    isDesktop: isDesktopScreen && !isNative,
    isMobile: isMobileScreen && !isNative,
    isTablet: isTabletScreen && !isNative,
    isNative,
  };
}