export interface ExerciseItemProps {
  name: string;
  sets?: number | string;
  icon?: React.ReactNode;
  variant?: 'default' | 'editable' | 'selectable';
  onRemove?: () => void;
  onAdd?: () => void;
  onEdit?: () => void;
  onDragStart?: () => void;
  isDraggable?: boolean;
  showEditButton?: boolean;
  className?: string;
}