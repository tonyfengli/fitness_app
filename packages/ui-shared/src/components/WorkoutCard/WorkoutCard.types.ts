export interface WorkoutCardProps {
  title: string;
  exerciseCount?: number;
  duration?: string;
  date?: string;
  variant?: 'default' | 'compact';
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}