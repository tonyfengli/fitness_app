import React from "react";
import { Avatar, type AvatarProps } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";

export interface UserAvatarProps extends AvatarProps {
  isOnline?: boolean;
  showStatus?: boolean;
}

export function UserAvatar({ 
  isOnline,
  showStatus = false,
  className,
  ...props 
}: UserAvatarProps) {
  return (
    <div className="relative inline-block">
      <Avatar className={className} {...props} />
      {showStatus && (
        <span className={cn(
          "absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white",
          isOnline ? "bg-green-500" : "bg-gray-400"
        )} />
      )}
    </div>
  );
}