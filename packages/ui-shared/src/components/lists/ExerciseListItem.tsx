import React from 'react';
import { CheckIcon } from '../icons';

export interface ExerciseListItemProps {
  name: string;
  isSelected?: boolean;
  isActive?: boolean;
  isExcluded?: boolean;
  isLoading?: boolean;
  reason?: string;
  onClick?: () => void;
  actionButton?: React.ReactNode;
  className?: string;
}

/**
 * Reusable exercise list item component
 * Used in exercise selection modals and confirmed exercise lists
 */
export const ExerciseListItem: React.FC<ExerciseListItemProps> = React.memo(({
  name,
  isSelected = false,
  isActive = true,
  isExcluded = false,
  isLoading = false,
  reason,
  onClick,
  actionButton,
  className = ''
}) => {
  const baseClasses = "w-full p-3 rounded-lg text-left transition-all";
  
  const stateClasses = isSelected 
    ? "bg-indigo-100 border-2 border-indigo-500 shadow-sm"
    : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent";
    
  const disabledClasses = (isLoading || !isActive) ? "opacity-50 cursor-not-allowed" : "";

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'Perfect match':
        return 'bg-purple-100 text-purple-700';
      case 'Excellent choice':
        return 'bg-indigo-100 text-indigo-700';
      case 'Very compatible':
        return 'bg-green-100 text-green-700';
      case 'Similar movement':
        return 'bg-green-100 text-green-700';
      case 'Same muscle group':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSelected && (
            <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
              <CheckIcon className="w-3 h-3 text-white" />
            </div>
          )}
          <span className={`font-medium ${
            isExcluded 
              ? 'text-gray-400 line-through decoration-2' 
              : isSelected 
                ? 'text-indigo-900' 
                : 'text-gray-900'
          }`}>
            {name}
          </span>
        </div>
        {reason && (
          <span className={`text-xs px-2 py-1 rounded ${getReasonColor(reason)}`}>
            {reason}
          </span>
        )}
        {actionButton}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button 
        className={`${baseClasses} ${stateClasses} ${disabledClasses} ${className}`}
        onClick={onClick}
        disabled={isLoading || !isActive}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`${baseClasses} ${isExcluded ? 'bg-gray-100' : 'bg-gray-50'} ${className}`}>
      {content}
    </div>
  );
});

ExerciseListItem.displayName = 'ExerciseListItem';