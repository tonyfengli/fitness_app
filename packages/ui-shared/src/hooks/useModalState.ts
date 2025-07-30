'use client';

import { useState, useCallback } from 'react';

export interface UseModalStateReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Hook for managing modal state
 * Provides consistent modal state management across the application
 */
export function useModalState(initialState = false): UseModalStateReturn {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle
  };
}

/**
 * Hook for managing multiple modals
 * Useful when you have several modals on the same page
 */
export function useMultipleModals<T extends string>(modalNames: T[]): Record<T, UseModalStateReturn> {
  const modals = {} as Record<T, UseModalStateReturn>;
  
  modalNames.forEach(name => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    modals[name] = useModalState();
  });
  
  return modals;
}