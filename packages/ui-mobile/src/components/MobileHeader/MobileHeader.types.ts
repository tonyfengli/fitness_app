export interface MobileHeaderProps {
  title: string;
  showNotifications?: boolean;
  hasUnreadNotifications?: boolean;
  onNotificationPress?: () => void;
  leftAction?: {
    icon: string;
    onPress: () => void;
  };
  rightAction?: {
    icon: string;
    onPress: () => void;
  };
}