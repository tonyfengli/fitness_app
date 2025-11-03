"use client";

import { useEffect, useRef } from 'react';

interface ScrollState {
  position: number;
  timestamp: number;
}

interface UseScrollManagerProps {
  isActive: boolean;
  priority: number;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

const scrollStateMap = new Map<number, ScrollState>();
let activeManager: number | null = null;

export function useScrollManager({ 
  isActive, 
  priority, 
  onActivate, 
  onDeactivate 
}: UseScrollManagerProps) {
  const scrollPositionRef = useRef<number>(0);
  const managerIdRef = useRef<number>(Math.random());
  const isAppliedRef = useRef<boolean>(false);

  useEffect(() => {
    const managerId = managerIdRef.current;

    if (isActive) {
      // Check if we should become the active manager
      const shouldTakeControl = activeManager === null || 
        (scrollStateMap.get(activeManager)?.timestamp || 0) < Date.now() - 100;

      if (shouldTakeControl) {
        // Store current scroll position before taking control
        scrollPositionRef.current = window.pageYOffset || document.documentElement.scrollTop;
        scrollStateMap.set(managerId, {
          position: scrollPositionRef.current,
          timestamp: Date.now()
        });

        // Update active manager
        activeManager = managerId;

        // Apply scroll fixes - Safari needs aggressive body manipulation, Chrome needs lighter approach
        const originalPosition = scrollPositionRef.current;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isSafari) {
          // Safari: Full aggressive body styling (needed for iOS Safari modal behavior)
          document.body.style.position = 'fixed';
          document.body.style.top = `-${originalPosition}px`;
          document.body.style.left = '0';
          document.body.style.right = '0';
          document.body.style.overflow = 'hidden';
          document.body.style.transform = 'translate3d(0, 0, 0)';
        } else {
          // Chrome/Other: Lighter approach that doesn't break portal positioning
          // Only prevent scrolling, don't mess with positioning
          document.body.style.overflow = 'hidden';
        }
        
        isAppliedRef.current = true;
        
        if (onActivate) {
          onActivate();
        }
      }
    } else {
      // Only restore if this manager was the active one
      if (activeManager === managerId && isAppliedRef.current) {
        // Restore scroll position
        const savedState = scrollStateMap.get(managerId);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isSafari) {
          // Safari: Remove all the aggressive styles we applied
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.left = '';
          document.body.style.right = '';
          document.body.style.overflow = '';
          document.body.style.transform = '';
        } else {
          // Chrome: Only remove the overflow we applied
          document.body.style.overflow = '';
        }
        
        // Restore scroll position
        if (savedState) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: savedState.position,
              behavior: 'instant' as ScrollBehavior
            });
          });
        }
        
        // Clear active manager
        activeManager = null;
        isAppliedRef.current = false;
        scrollStateMap.delete(managerId);
        
        if (onDeactivate) {
          onDeactivate();
        }
      }
    }

    // Cleanup function
    return () => {
      const managerId = managerIdRef.current;
      if (activeManager === managerId && isAppliedRef.current) {
        // Emergency cleanup - restore scroll
        const savedState = scrollStateMap.get(managerId);
        
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        document.body.style.transform = '';
        
        if (savedState) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: savedState.position,
              behavior: 'instant' as ScrollBehavior
            });
          });
        }
        
        activeManager = null;
        isAppliedRef.current = false;
      }
      scrollStateMap.delete(managerId);
    };
  }, [isActive, priority, onActivate, onDeactivate]);

  return {
    isActive: activeManager === managerIdRef.current,
    scrollPosition: scrollPositionRef.current
  };
}