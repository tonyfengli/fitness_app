"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, XIcon } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";

interface OptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  fullScreen?: boolean;
}

// Safari detection
const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export function OptionsDrawer({ 
  isOpen, 
  onClose, 
  children, 
  title = "Options",
  fullScreen = false 
}: OptionsDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Create or get portal root
    let root = document.getElementById('drawer-portal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'drawer-portal-root';
      document.body.appendChild(root);
    }
    setPortalRoot(root);

    // Inject Safari-specific CSS when component mounts
    if (isSafari && isOpen) {
      injectSafariCSS();
    }

    return () => {
      // Cleanup Safari CSS when component unmounts
      if (isSafari) {
        removeSafariCSS();
      }
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Safari viewport recalculation hack
  useEffect(() => {
    if (isSafari && isOpen && typeof window !== 'undefined') {
      const currentScrollY = window.scrollY;
      // Micro-scroll hack to force viewport recalculation
      window.scrollBy(0, 1);
      requestAnimationFrame(() => {
        window.scrollBy(0, -1);
        // Ensure exact position restoration
        if (window.scrollY !== currentScrollY) {
          window.scrollTo(0, currentScrollY);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen || !mounted || !portalRoot) return null;

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]",
          isSafari ? "safari-backdrop" : ""
        )}
        onClick={onClose}
        style={isSafari ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: 'none',
          webkitTransform: 'none'
        } : {}}
      />

      {/* Drawer */}
      <div 
        className={cn(
          "fixed z-[9999] bg-white dark:bg-gray-900 shadow-2xl",
          isSafari ? "safari-drawer" : "",
          fullScreen 
            ? "inset-0" 
            : "bottom-0 left-0 right-0 max-h-[90vh] rounded-t-xl",
          !isSafari && !fullScreen && "animate-in slide-in-from-bottom duration-300",
          !isSafari && fullScreen && "animate-in fade-in duration-300"
        )}
        onClick={(e) => e.stopPropagation()}
        style={isSafari ? {
          position: 'fixed',
          transform: 'none',
          webkitTransform: 'none',
          ...(fullScreen ? {
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          } : {
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '90vh',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          })
        } : {}}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[calc(90vh-64px)] p-4">
          {children}
        </div>
      </div>
    </>
  );

  return createPortal(drawerContent, portalRoot);
}

// Safari-specific CSS injection
const injectSafariCSS = () => {
  if (typeof document === 'undefined') return;
  
  const existingStyle = document.getElementById('safari-drawer-styles');
  if (existingStyle) return;

  const style = document.createElement('style');
  style.id = 'safari-drawer-styles';
  style.innerHTML = `
    #drawer-portal-root {
      position: fixed !important;
      transform: none !important;
      -webkit-transform: none !important;
      z-index: 9998;
    }
    
    .safari-backdrop {
      position: fixed !important;
      transform: none !important;
      -webkit-transform: none !important;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }
    
    .safari-drawer {
      position: fixed !important;
      transform: none !important;
      -webkit-transform: none !important;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      -webkit-perspective: 1000;
      perspective: 1000;
    }
    
    body {
      transform: none !important;
      -webkit-transform: none !important;
    }
    
    /* Safari-specific animations */
    @-webkit-keyframes safariSlideUp {
      0% {
        -webkit-transform: translate3d(0, 100%, 0);
        transform: translate3d(0, 100%, 0);
      }
      100% {
        -webkit-transform: translate3d(0, 0, 0);
        transform: translate3d(0, 0, 0);
      }
    }
    
    @keyframes safariSlideUp {
      0% {
        transform: translate3d(0, 100%, 0);
      }
      100% {
        transform: translate3d(0, 0, 0);
      }
    }
    
    .safari-drawer:not(.inset-0) {
      -webkit-animation: safariSlideUp 0.3s ease-out;
      animation: safariSlideUp 0.3s ease-out;
    }
  `;
  
  document.head.appendChild(style);
};

const removeSafariCSS = () => {
  if (typeof document === 'undefined') return;
  
  const existingStyle = document.getElementById('safari-drawer-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
};