import React from 'react';

interface SimpleIconProps {
  className?: string;
  size?: number;
}

export const XIcon: React.FC<SimpleIconProps> = ({ className = "w-4 h-4", size }) => {
  const sizeClass = size ? `w-${size} h-${size}` : className;
  return (
    <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
};

export const PlusIcon: React.FC<SimpleIconProps> = ({ className = "w-4 h-4", size }) => {
  const sizeClass = size ? `w-${size} h-${size}` : className;
  return (
    <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
};

export const CheckIcon: React.FC<SimpleIconProps> = ({ className = "w-4 h-4", size }) => {
  const sizeClass = size ? `w-${size} h-${size}` : className;
  return (
    <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
};

export const ChevronDownIcon: React.FC<SimpleIconProps> = ({ className = "w-4 h-4", size }) => {
  const sizeClass = size ? `w-${size} h-${size}` : className;
  return (
    <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
};

export const SearchIcon: React.FC<SimpleIconProps> = ({ className = "w-5 h-5", size }) => {
  const sizeClass = size ? `w-${size} h-${size}` : className;
  return (
    <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
};

export const SpinnerIcon: React.FC<SimpleIconProps> = ({ className = "animate-spin h-4 w-4", size }) => {
  const sizeClass = size ? `animate-spin w-${size} h-${size}` : className;
  return (
    <svg className={sizeClass} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
};