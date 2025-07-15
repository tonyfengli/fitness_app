export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface AppHeaderProps {
  logo?: React.ReactNode;
  title?: string;
  navItems?: NavItem[];
  showNotifications?: boolean;
  hasUnreadNotifications?: boolean;
  onNotificationClick?: () => void;
  userAvatar?: string;
  onAvatarClick?: () => void;
  className?: string;
}