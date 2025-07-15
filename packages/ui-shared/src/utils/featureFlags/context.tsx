"use client";

import React, { createContext, useContext, ReactNode } from "react";
import type { FeatureFlags } from "./types";
import { defaultFeatureFlags } from "./defaults";

interface FeatureFlagContextValue {
  flags: FeatureFlags;
  isEnabled: (flag: keyof FeatureFlags) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(undefined);

interface FeatureFlagProviderProps {
  children: ReactNode;
  flags?: Partial<FeatureFlags>;
}

/**
 * Provider component for feature flags
 * Wrap your app with this to enable feature flag checks
 */
export function FeatureFlagProvider({ 
  children, 
  flags = {} 
}: FeatureFlagProviderProps) {
  const mergedFlags: FeatureFlags = {
    ...defaultFeatureFlags,
    ...flags,
  };

  const isEnabled = (flag: keyof FeatureFlags): boolean => {
    return mergedFlags[flag];
  };

  return (
    <FeatureFlagContext.Provider value={{ flags: mergedFlags, isEnabled }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Hook to access feature flags context
 * Throws if used outside of FeatureFlagProvider
 */
export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagProvider");
  }
  return context;
}