"use client";

import { useFeatureFlags as useFeatureFlagsContext } from "./context";
import type { FeatureFlags } from "./types";

/**
 * Hook to check if a specific feature flag is enabled
 * @param flag - The feature flag to check
 * @returns boolean indicating if the flag is enabled
 */
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const { isEnabled } = useFeatureFlagsContext();
  return isEnabled(flag);
}

/**
 * Hook to get multiple feature flags at once
 * @param flags - Array of feature flags to check
 * @returns Object with flag names as keys and boolean values
 */
export function useFeatureFlags(flags: (keyof FeatureFlags)[]): Record<string, boolean> {
  const { isEnabled } = useFeatureFlagsContext();
  
  return flags.reduce((acc, flag) => {
    acc[flag] = isEnabled(flag);
    return acc;
  }, {} as Record<string, boolean>);
}