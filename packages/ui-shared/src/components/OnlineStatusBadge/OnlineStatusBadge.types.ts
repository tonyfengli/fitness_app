export interface OnlineStatusBadgeProps {
  status: 'online' | 'in-session' | 'offline';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}