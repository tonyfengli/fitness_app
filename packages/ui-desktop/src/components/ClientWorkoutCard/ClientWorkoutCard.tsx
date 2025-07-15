import React from "react";
import type { ClientWorkoutCardProps } from "./ClientWorkoutCard.types";
import { cn, Card, Icon, UserAvatar } from "@acme/ui-shared";

const defaultIcons: Record<string, string> = {
  "Bench Press": "fitness_center",
  "Squats": "sports_gymnastics",
  "Deadlifts": "self_improvement",
  "Overhead Press": "sports_mma",
  "Barbell Rows": "sports_handball",
  "Crunches": "accessibility_new",
  "Running": "directions_run",
  "Pull-ups": "sports_mma",
  "Stretching": "spa",
  "Push-ups": "fitness_center",
  "Lunges": "sports_gymnastics",
  "Glute Bridges": "accessibility_new",
  "Swimming": "pool",
  "Bicep Curls": "sports_handball",
  "Plank": "accessibility_new",
  "Tricep Dips": "fitness_center",
  "Russian Twists": "sports_gymnastics",
  "Foam Rolling": "self_improvement",
  "Cycling": "directions_bike",
  "Leg Press": "fitness_center",
  "Yoga": "self_improvement",
  "Hamstring Curls": "sports_gymnastics",
  "Dumbbell Flys": "fitness_center",
  "Side Plank": "accessibility_new",
  "Boxing": "sports_kabaddi",
  "Jump Rope": "skateboarding",
  "Calf Raises": "downhill_skiing",
  "Kettlebell Swings": "fitness_center",
  "Battle Ropes": "sports_mma",
  "Meditation": "self_improvement",
  "Glute Kickbacks": "fitness_center",
  "Shoulder Press": "sports_handball",
  "Rowing Machine": "rowing",
  "Burpees": "sports_gymnastics",
  "Deep Breathing": "self_improvement",
  "Leg Raises": "accessibility_new",
};

export function ClientWorkoutCard({
  clientName,
  clientAvatar,
  exercises,
  showQRCode = true,
  onQRCodeClick,
  className,
}: ClientWorkoutCardProps) {
  return (
    <Card className={cn("p-6 hover:shadow-lg transition-shadow duration-300", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <UserAvatar 
            alt={`${clientName} avatar`}
            size="sm"
            src={clientAvatar}
          />
          <h2 className="text-xl font-bold text-gray-900">{clientName}</h2>
        </div>
        {showQRCode && (
          <button
            onClick={onQRCodeClick}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icon name="qr_code_2" size={30} />
          </button>
        )}
      </div>

      {/* Exercises */}
      <div className="space-y-5">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="flex items-center space-x-4">
            <div className="bg-gray-100 p-3 rounded-full">
              <Icon 
                name={exercise.icon || defaultIcons[exercise.name] || "fitness_center"} 
                color="#6B7280"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{exercise.name}</p>
              <p className="text-sm text-gray-500">
                {exercise.sets && (
                  <>
                    <span className="font-bold text-gray-800">{exercise.sets}</span> sets
                  </>
                )}
                {exercise.reps && (
                  <>
                    , <span className="font-bold text-gray-800">{exercise.reps}</span> reps
                  </>
                )}
                {exercise.duration && (
                  <>
                    , <span className="font-bold text-gray-800">{exercise.duration}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}