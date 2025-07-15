import React from "react";
import { cn } from "@acme/ui-shared";

export interface OnlineStatusBadgeProps {
  status: 'online' | 'in-session' | 'offline';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function OnlineStatusBadge({ 
  status,
  size = 'md',
  showLabel = false,
  className 
}: OnlineStatusBadgeProps) {
  const statusConfig = {
    online: {
      color: 'bg-green-500',
      label: 'Online'
    },
    'in-session': {
      color: 'bg-red-500',
      label: 'In Session'
    },
    offline: {
      color: 'bg-gray-400',
      label: 'Offline'
    }
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn(
        "block rounded-full",
        sizeClasses[size],
        config.color
      )} />
      {showLabel && (
        <span className="text-sm text-gray-600">{config.label}</span>
      )}
    </div>
  );
}