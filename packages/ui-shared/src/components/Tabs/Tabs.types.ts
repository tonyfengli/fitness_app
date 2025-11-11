import { ReactNode } from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: "top" | "bottom";
}

export interface TabPanelProps {
  isActive: boolean;
  children: ReactNode;
  className?: string;
}