import React from 'react';
import { XIcon } from '../icons';

export interface PreferenceListItemProps {
  label: string;
  type: 'target' | 'limit' | 'note';
  onRemove?: () => void;
  isRemoving?: boolean;
  className?: string;
}

/**
 * Reusable preference list item component
 * Used for displaying muscle targets, limits, and notes
 */
export const PreferenceListItem: React.FC<PreferenceListItemProps> = React.memo(({
  label,
  type,
  onRemove,
  isRemoving = false,
  className = ''
}) => {
  const baseClasses = "flex items-center justify-between p-3 rounded-lg";
  
  const typeClasses = {
    target: "bg-blue-50",
    limit: "bg-red-50",
    note: "bg-gray-50"
  };
  
  const textClasses = {
    target: "text-blue-700 font-medium",
    limit: "text-red-700 font-medium",
    note: "text-gray-700"
  };

  const getDisplayLabel = () => {
    switch (type) {
      case 'target':
        return `Target: ${label}`;
      case 'limit':
        return `Limit: ${label}`;
      default:
        return label;
    }
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]} ${className}`}>
      <span className={textClasses[type]}>{getDisplayLabel()}</span>
      {onRemove && (
        <button 
          onClick={onRemove}
          disabled={isRemoving}
          className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors p-1"
          aria-label={`Remove ${label}`}
        >
          <XIcon />
        </button>
      )}
    </div>
  );
});

PreferenceListItem.displayName = 'PreferenceListItem';