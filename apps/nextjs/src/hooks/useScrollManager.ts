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
      console.log('[useScrollManager] 📱 ACTIVATION REQUEST:', {
        timestamp: new Date().toISOString(),
        managerId: managerId.toString().substr(2, 4), // Short ID for logging
        browser: /Chrome/.test(navigator.userAgent) ? 'Chrome' : /Safari/.test(navigator.userAgent) ? 'Safari' : 'Other',
        platform: navigator.platform,
        priority,
        activeManager: activeManager ? activeManager.toString().substr(2, 4) : null,
        currentScrollY: window.pageYOffset || document.documentElement.scrollTop,
        bodyPosition: document.body.style.position || 'initial',
        bodyOverflow: document.body.style.overflow || 'initial'
      });

      // Check if we should become the active manager
      const shouldTakeControl = activeManager === null || 
        (scrollStateMap.get(activeManager)?.timestamp || 0) < Date.now() - 100;

      console.log('[useScrollManager] 🎯 CONTROL DECISION:', {
        shouldTakeControl,
        currentActiveManager: activeManager ? activeManager.toString().substr(2, 4) : null,
        requestingManager: managerId.toString().substr(2, 4),
        timeSinceLastActive: activeManager ? Date.now() - (scrollStateMap.get(activeManager)?.timestamp || 0) : 'N/A'
      });

      if (shouldTakeControl) {
        // Store current scroll position before taking control
        scrollPositionRef.current = window.pageYOffset || document.documentElement.scrollTop;
        scrollStateMap.set(managerId, {
          position: scrollPositionRef.current,
          timestamp: Date.now()
        });

        // Update active manager
        activeManager = managerId;

        console.log('[useScrollManager] 👑 TAKING CONTROL:', {
          managerId: managerId.toString().substr(2, 4),
          savedScrollPosition: scrollPositionRef.current,
          timestamp: Date.now()
        });

        // Apply scroll fixes - Safari needs aggressive body manipulation, Chrome needs lighter approach
        const originalPosition = scrollPositionRef.current;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isSafari) {
          // Safari: Full aggressive body styling (needed for iOS Safari modal behavior)
          const safariBodyStyles = {
            position: 'fixed',
            top: `-${originalPosition}px`,
            left: '0',
            right: '0',
            overflow: 'hidden',
            transform: 'translate3d(0, 0, 0)'
          };

          console.log('[useScrollManager] 🍎 APPLYING SAFARI BODY STYLES:', {
            originalPosition,
            styles: safariBodyStyles,
            beforeStyles: {
              position: document.body.style.position || 'initial',
              top: document.body.style.top || 'initial',
              overflow: document.body.style.overflow || 'initial',
              transform: document.body.style.transform || 'initial'
            }
          });

          document.body.style.position = 'fixed';
          document.body.style.top = `-${originalPosition}px`;
          document.body.style.left = '0';
          document.body.style.right = '0';
          document.body.style.overflow = 'hidden';
          document.body.style.transform = 'translate3d(0, 0, 0)';
        } else {
          // Chrome/Other: Lighter approach that doesn't break portal positioning
          const chromeBodyStyles = {
            overflow: 'hidden'
            // No position/transform changes that break portal positioning
          };

          console.log('[useScrollManager] 🌐 APPLYING CHROME BODY STYLES (LIGHT):', {
            originalPosition,
            styles: chromeBodyStyles,
            beforeStyles: {
              overflow: document.body.style.overflow || 'initial'
            },
            note: 'Light approach to preserve portal positioning'
          });

          // Only prevent scrolling, don't mess with positioning
          document.body.style.overflow = 'hidden';
        }
        
        console.log('[useScrollManager] ✅ BODY STYLES APPLIED:', {
          appliedStyles: {
            position: document.body.style.position,
            top: document.body.style.top,
            overflow: document.body.style.overflow,
            transform: document.body.style.transform
          }
        });
        
        isAppliedRef.current = true;
        
        if (onActivate) {
          onActivate();
        }
      }
    } else {
      // Only restore if this manager was the active one
      if (activeManager === managerId && isAppliedRef.current) {
        console.log('[useScrollManager] 🔄 DEACTIVATION - RESTORING SCROLL:', {
          managerId: managerId.toString().substr(2, 4),
          timestamp: new Date().toISOString(),
          wasActive: activeManager === managerId,
          hadStyles: isAppliedRef.current
        });

        // Restore scroll position
        const savedState = scrollStateMap.get(managerId);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        console.log('[useScrollManager] 🧹 REMOVING BODY STYLES:', {
          browser: isSafari ? 'Safari' : 'Chrome/Other',
          beforeRemoval: {
            position: document.body.style.position,
            top: document.body.style.top,
            overflow: document.body.style.overflow,
            transform: document.body.style.transform
          },
          savedState: savedState ? savedState.position : null
        });

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
        
        console.log('[useScrollManager] ✅ BODY STYLES REMOVED:', {
          afterRemoval: {
            position: document.body.style.position || 'initial',
            top: document.body.style.top || 'initial',
            overflow: document.body.style.overflow || 'initial',
            transform: document.body.style.transform || 'initial'
          }
        });
        
        // Restore scroll position
        if (savedState) {
          console.log('[useScrollManager] 📍 RESTORING SCROLL POSITION:', savedState.position);
          requestAnimationFrame(() => {
            window.scrollTo({
              top: savedState.position,
              behavior: 'instant' as ScrollBehavior
            });
            console.log('[useScrollManager] ✅ SCROLL RESTORED TO:', window.scrollY);
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