import React from "react";
import { cn, Card, UserAvatar, OnlineStatusBadge } from "@acme/ui-shared";
import type { UserStatusCardProps } from "./UserStatusCard.types";

export function UserStatusCard({ 
  userName, 
  userAvatar, 
  status,
  lastSeen,
  className 
}: UserStatusCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <UserAvatar 
            src={userAvatar} 
            alt={userName}
            size="sm"
            className="mr-3"
          />
          <div>
            <h3 className="font-semibold text-gray-800">{userName}</h3>
            {lastSeen && (
              <p className="text-sm text-gray-500">{lastSeen}</p>
            )}
          </div>
        </div>
        <OnlineStatusBadge status={status} />
      </div>
    </Card>
  );
}