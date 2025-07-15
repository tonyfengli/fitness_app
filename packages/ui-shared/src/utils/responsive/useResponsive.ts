"use client";

import { useMediaQuery } from "./useMediaQuery";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";

export interface ResponsiveInfo {
  breakpoint: Breakpoint;
  isMobileView: boolean;
  isTabletView: boolean;
  isDesktopView: boolean;
}

/**
 * Combined hook for responsive design decisions
 * Based on Tailwind CSS default breakpoints
 * @returns Responsive information
 */
export function useResponsive(): ResponsiveInfo {
  // Tailwind breakpoints
  const isXs = useMediaQuery("(max-width: 639px)"); // < 640px
  const isSm = useMediaQuery("(min-width: 640px) and (max-width: 767px)"); // 640px - 767px
  const isMd = useMediaQuery("(min-width: 768px) and (max-width: 1023px)"); // 768px - 1023px
  const isLg = useMediaQuery("(min-width: 1024px) and (max-width: 1279px)"); // 1024px - 1279px
  const isXl = useMediaQuery("(min-width: 1280px)"); // >= 1280px

  // Determine current breakpoint
  let breakpoint: Breakpoint = "xs";
  if (isSm) breakpoint = "sm";
  else if (isMd) breakpoint = "md";
  else if (isLg) breakpoint = "lg";
  else if (isXl) breakpoint = "xl";

  // View categorization
  const isMobileView = isXs || isSm;
  const isTabletView = isMd;
  const isDesktopView = isLg || isXl;

  return {
    breakpoint,
    isMobileView,
    isTabletView,
    isDesktopView,
  };
}