import type { ReactNode } from "react";

export interface ResponsiveViewProps {
  /**
   * Content to render on mobile screens (< 768px)
   */
  mobile?: ReactNode;

  /**
   * Content to render on tablet screens (768px - 1023px)
   */
  tablet?: ReactNode;

  /**
   * Content to render on desktop screens (>= 1024px)
   */
  desktop?: ReactNode;

  /**
   * Fallback content to render if no specific view is provided
   */
  children?: ReactNode;
}