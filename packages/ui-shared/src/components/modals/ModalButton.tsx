"use client";

import React from 'react';
import { SpinnerIcon } from '../icons';

export interface ModalButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Consistent button styling for modals
 */
export const ModalButton: React.FC<ModalButtonProps> = ({
  onClick,
  disabled = false,
  variant = 'secondary',
  loading = false,
  loadingText = 'Loading...',
  children,
  className = ''
}) => {
  const baseClasses = "px-4 py-2 rounded-lg transition-colors flex items-center gap-2";
  
  const variantClasses = {
    primary: disabled || loading
      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'text-gray-700 hover:text-gray-900 disabled:opacity-50'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <>
          <SpinnerIcon className="animate-spin h-4 w-4 text-white" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
};