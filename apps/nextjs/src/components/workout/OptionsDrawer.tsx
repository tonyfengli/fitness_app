"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@acme/ui-shared";

interface DrawerItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  preventAutoClose?: boolean;
}

interface OptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items?: DrawerItem[];
  title?: string;
  customContent?: React.ReactNode;
}

export function OptionsDrawer({
  isOpen,
  onClose,
  items,
  title = "Options",
  customContent,
}: OptionsDrawerProps) {
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering portal
  useEffect(() => {
    console.log('[OptionsDrawer] Component mounting');
    setMounted(true);
    
    // Create a dedicated portal container for Safari
    if (typeof document !== 'undefined') {
      let portalRoot = document.getElementById('drawer-portal-root');
      if (!portalRoot) {
        portalRoot = document.createElement('div');
        portalRoot.id = 'drawer-portal-root';
        // Place it as a direct child of body, outside of Next.js root
        document.body.appendChild(portalRoot);
        console.log('[OptionsDrawer] Created portal root');
      }
    }
  }, []);

  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      console.log('[OptionsDrawer] Opening drawer', {
        isOpen,
        mounted,
        bodyScrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        bodyStyles: window.getComputedStyle(document.body),
      });
      
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = "hidden";
      
      // Safari fix: Force viewport recalculation with micro-scroll
      if (isSafari && typeof window !== 'undefined') {
        console.log('[OptionsDrawer] Applying Safari scroll fix');
        const currentScrollY = window.scrollY;
        window.scrollBy(0, 1);
        requestAnimationFrame(() => {
          window.scrollBy(0, -1);
          // Ensure we're back at the exact same position
          if (window.scrollY !== currentScrollY) {
            window.scrollTo(0, currentScrollY);
          }
        });
      }
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, mounted]);

  // Log when drawer is about to render
  useEffect(() => {
    if (isOpen && mounted) {
      // Check after a small delay to ensure drawer is rendered
      setTimeout(() => {
        const drawerElement = document.querySelector('[data-drawer="options-drawer"]');
        if (drawerElement) {
          const rect = drawerElement.getBoundingClientRect();
          console.log('[OptionsDrawer] Drawer element position', {
            rect,
            computedStyle: window.getComputedStyle(drawerElement),
            parentElement: drawerElement.parentElement,
            offsetParent: (drawerElement as HTMLElement).offsetParent,
          });
        } else {
          console.log('[OptionsDrawer] Drawer element not found in DOM');
        }
      }, 100);
    }
  }, [isOpen, mounted]);

  // Detect Safari
  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Add Safari-specific animation
  useEffect(() => {
    if (isSafari && isOpen && mounted) {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        /* Safari-specific fixes */
        #drawer-portal-root {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          pointer-events: none !important;
          z-index: 9999 !important;
          transform: none !important;
          -webkit-transform: none !important;
        }
        
        #drawer-portal-root > * {
          pointer-events: auto !important;
        }
        
        /* Force body to not have transforms in Safari */
        body {
          transform: none !important;
          -webkit-transform: none !important;
        }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
  }, [isSafari, isOpen, mounted]);

  if (!isOpen || !mounted) return null;

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0 duration-200"
        onClick={onClose}
        style={isSafari ? {
          position: 'fixed',
          top: '0px',
          left: '0px',
          right: '0px',
          bottom: '0px',
        } : undefined}
      />

      {/* Drawer */}
      <div
        data-drawer="options-drawer"
        className={cn(
          "fixed z-50 bg-white dark:bg-gray-800 rounded-t-2xl shadow-xl",
          !isSafari && "animate-in slide-in-from-bottom duration-300"
        )}
        style={isSafari ? {
          // Safari-specific positioning using viewport units
          position: 'fixed',
          bottom: '0px',
          left: '0px',
          width: '100vw',
          maxWidth: '100vw',
          height: 'auto',
          transform: 'none',
          WebkitTransform: 'none',
          zIndex: 9999,
          // Force Safari to recalculate position
          WebkitBackfaceVisibility: 'hidden',
          WebkitPerspective: 1000,
          WebkitTransformStyle: 'preserve-3d',
        } : {
          // Standard positioning for other browsers
          position: 'fixed',
          bottom: '0px',
          left: '0px',
          right: '0px',
          width: '100%',
          top: 'auto',
          transform: 'translateZ(0)',
          animation: 'slideUp 0.3s ease-out',
          zIndex: 9999,
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2">
          <div className="h-1 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Custom content or default menu */}
        {customContent ? (
          <div className="max-h-[80vh] overflow-y-auto">
            {customContent}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
            </div>

            {/* Options */}
            <div className="py-2 max-h-[60vh] overflow-y-auto">
              {items?.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick();
                      if (!item.preventAutoClose) {
                        onClose();
                      }
                    }
                  }}
                  disabled={item.disabled}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4 text-left transition-colors",
                    item.disabled
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                    item.variant === "danger"
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-700 dark:text-gray-300"
                  )}
                >
                  {item.icon && (
                    <span className="flex-shrink-0">{item.icon}</span>
                  )}
                  <span className="text-base font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Cancel button with safe area padding */}
            <div className="px-6 pb-20 pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 text-base font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );

  const portalRoot = document.getElementById('drawer-portal-root') || document.body;
  
  console.log('[OptionsDrawer] Creating portal', {
    targetElement: portalRoot,
    portalRootId: portalRoot.id,
    bodyClasses: document.body.className,
    bodyTransform: window.getComputedStyle(document.body).transform,
    htmlTransform: window.getComputedStyle(document.documentElement).transform,
    nextRoot: document.getElementById('__next'),
    nextRootTransform: document.getElementById('__next') ? window.getComputedStyle(document.getElementById('__next')!).transform : 'none',
  });
  
  return createPortal(drawerContent, portalRoot);
}