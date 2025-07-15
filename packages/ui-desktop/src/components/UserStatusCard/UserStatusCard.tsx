import React from "react";
import { cn, Card } from "@acme/ui-shared";

export interface UserStatusCardProps {
  userName: string;
  userAvatar?: string;
  status: 'online' | 'in-session' | 'offline';
  lastSeen?: string;
  className?: string;
}

export function UserStatusCard({ 
  userName, 
  userAvatar, 
  status,
  lastSeen,
  className 
}: UserStatusCardProps) {
  const statusColors = {
    online: 'bg-green-500',
    'in-session': 'bg-red-500',
    offline: 'bg-gray-400'
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {userAvatar && (
            <img 
              src={userAvatar} 
              alt={userName}
              className="w-10 h-10 rounded-full mr-3"
            />
          )}
          <div>
            <h3 className="font-semibold text-gray-800">{userName}</h3>
            {lastSeen && (
              <p className="text-sm text-gray-500">{lastSeen}</p>
            )}
          </div>
        </div>
        <div className={cn(
          "w-3 h-3 rounded-full",
          statusColors[status]
        )} />
      </div>
    </Card>
  );
}