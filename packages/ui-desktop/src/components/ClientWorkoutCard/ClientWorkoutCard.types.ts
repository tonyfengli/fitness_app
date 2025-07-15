export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps?: number | string;
  duration?: string;
  icon?: string;
}

export interface ClientWorkoutCardProps {
  clientName: string;
  clientAvatar: string;
  exercises: Exercise[];
  showQRCode?: boolean;
  onQRCodeClick?: () => void;
  className?: string;
}