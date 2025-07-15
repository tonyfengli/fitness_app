import React from "react";
import type { PlayerListItemProps } from "./PlayerListItem.types";
import { cn, UserAvatar, Icon } from "@acme/ui-shared";

const statusConfig = {
  online: {
    label: "Online",
    className: "text-green-500",
  },
  "in-match": {
    label: "In Match",
    className: "text-red-500",
  },
  offline: {
    label: "Offline",
    className: "text-gray-500",
  },
};

export function PlayerListItem({
  name,
  avatar,
  status,
  level,
  description,
  onEdit,
  className,
}: PlayerListItemProps) {
  const statusInfo = statusConfig[status];

  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors",
      className
    )}>
      <div className="flex items-center space-x-4">
        <UserAvatar
          alt={`${name}'s avatar`}
          size="lg"
          src={avatar}
        />
        <div>
          <p className="text-lg font-semibold text-gray-800">{name}</p>
          <p className={cn("text-sm", statusInfo.className)}>
            {statusInfo.label}
          </p>
          {description && (
            <p className="text-sm text-gray-500">
              {level && `Level ${level} | `}
              {description}
            </p>
          )}
        </div>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
        >
          <Icon name="edit" color="#6B7280" />
        </button>
      )}
    </div>
  );
}