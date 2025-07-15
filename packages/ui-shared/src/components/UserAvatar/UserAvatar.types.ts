import type { AvatarProps } from "../Avatar";

export interface UserAvatarProps extends AvatarProps {
  isOnline?: boolean;
  showStatus?: boolean;
}