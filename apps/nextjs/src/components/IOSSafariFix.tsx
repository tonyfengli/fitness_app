"use client";

import { useEffect } from 'react';

export function IOSSafariFix() {
  useEffect(() => {
    // Detect iOS Safari specifically
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                        /Safari/.test(navigator.userAgent) && 
                        !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
    
    if (!isIOSSafari) return;

    console.log('[IOSSafariFix] Applying iOS Safari autofill fixes');

    // Add empty touch listeners to improve Safari touch compatibility
    const addTouchListeners = () => {
      const elements = document.querySelectorAll('input, button, [role="button"], [data-clickable]');
      elements.forEach(element => {
        // These empty listeners force Safari to properly handle touch events
        element.addEventListener('touchstart', () => {}, { passive: true });
        element.addEventListener('touchend', () => {}, { passive: true });
        element.addEventListener('touchcancel', () => {}, { passive: true });
      });
    };

    // Initial setup
    addTouchListeners();

    // Handle autofill overlay issues
    const handleInputEvent = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target && target.tagName === 'INPUT') {
        // Small delay to ensure autofill has completed
        setTimeout(() => {
          // Force viewport recalculation to clear any stuck overlays
          if (window.scrollY === 0) {
            window.scrollTo(0, 1);
            window.scrollTo(0, 0);
          } else {
            const currentY = window.scrollY;
            window.scrollTo(0, currentY + 1);
            window.scrollTo(0, currentY);
          }
        }, 100);
      }
    };

    // Listen for input blur events (when autofill completes)
    document.addEventListener('blur', handleInputEvent, true);
    
    // Also handle input changes (covers paste events and autofill)
    document.addEventListener('input', handleInputEvent, true);

    // Re-add touch listeners when new elements are added to DOM
    const observer = new MutationObserver(() => {
      addTouchListeners();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Cleanup
    return () => {
      document.removeEventListener('blur', handleInputEvent, true);
      document.removeEventListener('input', handleInputEvent, true);
      observer.disconnect();
    };
  }, []);

  return null;
}