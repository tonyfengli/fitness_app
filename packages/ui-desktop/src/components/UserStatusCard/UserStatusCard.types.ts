export interface UserStatusCardProps {
  userName: string;
  userAvatar?: string;
  status: 'online' | 'in-session' | 'offline';
  lastSeen?: string;
  className?: string;
}