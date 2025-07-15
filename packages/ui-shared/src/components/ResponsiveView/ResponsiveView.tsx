"use client";

import React from "react";
import type { ResponsiveViewProps } from "./ResponsiveView.types";
import { useResponsive } from "../../utils/responsive";

/**
 * Component that renders different content based on screen size
 * Provides a clean way to handle responsive layouts
 */
export function ResponsiveView({
  mobile,
  tablet,
  desktop,
  children,
}: ResponsiveViewProps) {
  const { isMobileView, isTabletView, isDesktopView } = useResponsive();

  // Priority: specific view > children (fallback)
  if (isDesktopView && desktop) {
    return <>{desktop}</>;
  }

  if (isTabletView && tablet) {
    return <>{tablet}</>;
  }

  if (isMobileView && mobile) {
    return <>{mobile}</>;
  }

  // Fallback to children if provided
  if (children) {
    return <>{children}</>;
  }

  // If no matching view and no fallback, return null
  return null;
}