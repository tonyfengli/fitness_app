export type PlayerStatus = "online" | "in-match" | "offline";

export interface PlayerListItemProps {
  name: string;
  avatar: string;
  status: PlayerStatus;
  level?: number;
  description?: string;
  onEdit?: () => void;
  className?: string;
}