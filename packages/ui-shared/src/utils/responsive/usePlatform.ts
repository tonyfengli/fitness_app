"use client";

import { useEffect, useState } from "react";

export type Platform = "web" | "ios" | "android";

export interface PlatformInfo {
  platform: Platform;
  isWeb: boolean;
  isNative: boolean;
}

/**
 * Hook to detect if running in web browser or native app
 * @returns Platform information
 */
export function usePlatform(): PlatformInfo {
  const [platform, setPlatform] = useState<Platform>("web");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const userAgent = window.navigator.userAgent;

    // Check for React Native
    if (/ReactNative/i.test(userAgent)) {
      // Further check for iOS or Android
      if (/iPhone|iPad|iPod/i.test(userAgent)) {
        setPlatform("ios");
      } else if (/Android/i.test(userAgent)) {
        setPlatform("android");
      }
    } else {
      setPlatform("web");
    }
  }, []);

  return {
    platform,
    isWeb: platform === "web",
    isNative: platform === "ios" || platform === "android",
  };
}