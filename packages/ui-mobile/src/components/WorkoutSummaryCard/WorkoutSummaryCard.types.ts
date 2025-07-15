import type { ReactNode } from "react";

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  onPress?: () => void;
  onPlay?: () => void;
}

export interface WorkoutSummaryCardProps {
  title: string;
  date?: string;
  exercises: Exercise[];
  onEdit?: () => void;
  onAddExercise?: () => void;
  feedbackSection?: ReactNode;
}