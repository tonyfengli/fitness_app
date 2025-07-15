export interface FeedbackItem {
  id: string;
  text: string;
  date: string;
  author?: string;
}

export interface FeedbackSectionProps {
  feedback?: FeedbackItem[];
  isExpanded?: boolean;
  onToggle?: () => void;
  onAddNote?: () => void;
  className?: string;
}