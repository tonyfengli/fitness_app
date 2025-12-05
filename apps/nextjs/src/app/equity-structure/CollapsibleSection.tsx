"use client";

import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export default function CollapsibleSection({ 
  title, 
  defaultOpen = true, 
  children, 
  className = "",
  isOpen: controlledIsOpen,
  onToggle
}: CollapsibleSectionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleToggle}
        className={`w-full flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-200 ${
          isOpen 
            ? 'bg-transparent border-0 pb-2' 
            : 'bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md'
        }`}
      >
        <h3 className="text-sm sm:text-lg font-semibold text-gray-900">{title}</h3>
        <svg
          className={`w-5 h-5 sm:w-6 sm:h-6 text-gray-500 transform transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-gray-700' : ''
          }`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div
        className={`transition-all duration-300 overflow-hidden ${
          isOpen ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {isOpen && (
          <div className="pt-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}