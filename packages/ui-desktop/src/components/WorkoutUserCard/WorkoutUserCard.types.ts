export interface WorkoutUserCardProps {
  userName: string;
  userAvatar?: string;
  exercises: Array<{
    name: string;
    sets: number;
  }>;
  className?: string;
}