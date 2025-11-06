"use client";

import { useEffect } from 'react';

// Detect iOS Safari
const isIOSSafari = () => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  return isIOS && isSafari;
};

export function IOSSafariFix() {
  useEffect(() => {
    if (!isIOSSafari()) return;

    const handleViewportFix = () => {
      // Force viewport recalculation to fix Safari rendering issues
      const currentScrollY = window.scrollY;
      
      // Micro-scroll technique
      window.scrollBy(0, 1);
      requestAnimationFrame(() => {
        window.scrollBy(0, -1);
        
        // Ensure exact position restoration
        if (window.scrollY !== currentScrollY) {
          window.scrollTo(0, currentScrollY);
        }
      });
    };

    const addTouchOptimizations = () => {
      // Add passive touch event listeners for better performance
      const elements = document.querySelectorAll('button, [role="button"], .touchable');
      
      elements.forEach(element => {
        element.addEventListener('touchstart', () => {}, { passive: true });
        element.addEventListener('touchend', () => {}, { passive: true });
      });
    };

    const handleDOMChanges = () => {
      // Watch for DOM mutations that might affect viewport
      const observer = new MutationObserver((mutations) => {
        const hasSignificantChanges = mutations.some(mutation => 
          mutation.type === 'childList' && 
          mutation.addedNodes.length > 0 &&
          Array.from(mutation.addedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).tagName !== 'SCRIPT'
          )
        );
        
        if (hasSignificantChanges) {
          // Debounce viewport fixes
          clearTimeout(viewportFixTimeout);
          viewportFixTimeout = setTimeout(handleViewportFix, 16);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
      });

      return () => observer.disconnect();
    };

    let viewportFixTimeout: NodeJS.Timeout;

    // Initial setup
    addTouchOptimizations();
    const cleanupObserver = handleDOMChanges();

    // Handle resize events (orientation changes, keyboard appearance)
    const handleResize = () => {
      clearTimeout(viewportFixTimeout);
      viewportFixTimeout = setTimeout(handleViewportFix, 100);
    };

    // Handle focus events (for input fields that might trigger autofill overlay)
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        // Delay viewport fix to let Safari's autofill overlay settle
        setTimeout(handleViewportFix, 300);
      }
    };

    // Handle visual viewport changes (iOS Safari specific)
    const handleVisualViewportChange = () => {
      handleViewportFix();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    document.addEventListener('focusin', handleFocus, { passive: true });
    
    // Visual viewport API support (modern iOS Safari)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }

    // Cleanup
    return () => {
      clearTimeout(viewportFixTimeout);
      cleanupObserver();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('focusin', handleFocus);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportChange);
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}