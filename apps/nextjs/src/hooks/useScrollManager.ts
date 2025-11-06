import { useEffect, useRef } from 'react';

interface ScrollManager {
  isActive: boolean;
  priority: number;
}

// Global state for managing multiple scroll lockers
let activeScrollManagers: Map<string, ScrollManager> = new Map();
let originalScrollPosition = 0;
let isScrollLocked = false;
let currentManagerId: string | null = null;

// Safari detection
const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export const useScrollManager = ({ isActive, priority }: ScrollManager) => {
  const managerId = useRef<string>(Math.random().toString(36).substr(2, 9));
  
  useEffect(() => {
    const id = managerId.current;
    
    if (isActive) {
      // Register this manager
      activeScrollManagers.set(id, { isActive, priority });
      
      // Find the highest priority active manager
      const highestPriority = Math.max(
        ...Array.from(activeScrollManagers.values())
          .filter(manager => manager.isActive)
          .map(manager => manager.priority)
      );
      
      // If this manager has the highest priority, lock scroll
      if (priority === highestPriority && (!isScrollLocked || currentManagerId !== id)) {
        lockScroll(id);
      }
    } else {
      // Unregister this manager
      activeScrollManagers.delete(id);
      
      // If this was the current manager, find the next highest priority
      if (currentManagerId === id) {
        const remainingManagers = Array.from(activeScrollManagers.values())
          .filter(manager => manager.isActive);
        
        if (remainingManagers.length === 0) {
          unlockScroll();
        } else {
          const highestPriority = Math.max(
            ...remainingManagers.map(manager => manager.priority)
          );
          const nextManager = Array.from(activeScrollManagers.entries())
            .find(([_, manager]) => manager.isActive && manager.priority === highestPriority);
          
          if (nextManager) {
            lockScroll(nextManager[0]);
          }
        }
      }
    }
  }, [isActive, priority]);

  // Cleanup on unmount
  useEffect(() => {
    const id = managerId.current;
    return () => {
      activeScrollManagers.delete(id);
      if (currentManagerId === id) {
        unlockScroll();
      }
    };
  }, []);
};

const lockScroll = (managerId: string) => {
  if (isScrollLocked && currentManagerId === managerId) {
    return; // Already locked by this manager
  }

  currentManagerId = managerId;
  
  if (!isScrollLocked) {
    originalScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    isScrollLocked = true;

    if (isSafari) {
      // Safari: Aggressive approach with fixed positioning
      document.body.style.position = 'fixed';
      document.body.style.top = `-${originalScrollPosition}px`;
      document.body.style.width = '100%';
      document.body.style.transform = 'translate3d(0, 0, 0)';
      document.body.style.webkitTransform = 'translate3d(0, 0, 0)';
      
      // Additional Safari optimizations
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.position = 'fixed';
      document.documentElement.style.width = '100%';
      document.documentElement.style.height = '100%';
    } else {
      // Chrome and other browsers: Simpler approach
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = getScrollbarWidth() + 'px';
    }
  } else {
    // Update which manager is in control
    currentManagerId = managerId;
  }
};

const unlockScroll = () => {
  if (!isScrollLocked) return;
  
  isScrollLocked = false;
  currentManagerId = null;

  if (isSafari) {
    // Safari: Restore original state
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.transform = '';
    document.body.style.webkitTransform = '';
    
    document.documentElement.style.overflow = '';
    document.documentElement.style.position = '';
    document.documentElement.style.width = '';
    document.documentElement.style.height = '';
    
    // Restore scroll position
    window.scrollTo(0, originalScrollPosition);
  } else {
    // Chrome and other browsers
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
};

// Helper function to calculate scrollbar width
const getScrollbarWidth = (): number => {
  if (typeof document === 'undefined') return 0;
  
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  outer.style.msOverflowStyle = 'scrollbar';
  document.body.appendChild(outer);

  const inner = document.createElement('div');
  outer.appendChild(inner);

  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
  outer.parentNode?.removeChild(outer);

  return scrollbarWidth;
};