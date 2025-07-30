"use client";

import React from 'react';
import { XIcon } from '../icons';

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Base modal component with consistent styling
 * Used as foundation for all other modals
 */
export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className = ''
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] flex flex-col ${className}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        {children}

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  );
};