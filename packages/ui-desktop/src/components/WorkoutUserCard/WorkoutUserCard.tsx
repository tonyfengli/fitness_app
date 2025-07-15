import React from "react";
import { cn, Card, UserAvatar } from "@acme/ui-shared";
import type { WorkoutUserCardProps } from "./WorkoutUserCard.types";

export function WorkoutUserCard({ 
  userName, 
  userAvatar, 
  exercises,
  className 
}: WorkoutUserCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center mb-3">
        <UserAvatar 
          src={userAvatar} 
          alt={userName}
          size="xs"
          className="mr-2"
        />
        <h3 className="font-semibold text-gray-800">{userName}</h3>
      </div>
      <div className="space-y-1">
        {exercises.map((exercise, index) => (
          <div key={index} className="text-sm text-gray-600">
            {exercise.name} - {exercise.sets} sets
          </div>
        ))}
      </div>
    </Card>
  );
}