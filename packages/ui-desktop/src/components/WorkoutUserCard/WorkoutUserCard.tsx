import React from "react";
import { cn, Card } from "@acme/ui-shared";

export interface WorkoutUserCardProps {
  userName: string;
  userAvatar?: string;
  exercises: Array<{
    name: string;
    sets: number;
  }>;
  className?: string;
}

export function WorkoutUserCard({ 
  userName, 
  userAvatar, 
  exercises,
  className 
}: WorkoutUserCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center mb-3">
        {userAvatar && (
          <img 
            src={userAvatar} 
            alt={userName}
            className="w-8 h-8 rounded-full mr-2"
          />
        )}
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