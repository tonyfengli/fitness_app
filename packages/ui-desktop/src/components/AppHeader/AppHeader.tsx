import React from "react";
import type { AppHeaderProps } from "./AppHeader.types";
import { cn, Icon } from "@acme/ui-shared";

export function AppHeader({
  logo,
  title,
  navItems = [],
  showNotifications = true,
  hasUnreadNotifications = false,
  onNotificationClick,
  userAvatar,
  onAvatarClick,
  className,
}: AppHeaderProps) {
  return (
    <header className={cn("flex justify-between items-center", className)}>
      {/* Logo and Title */}
      <div className="flex items-center space-x-3">
        {logo}
        {title && <span className="text-3xl font-bold text-gray-900">{title}</span>}
      </div>

      {/* Navigation */}
      {navItems.length > 0 && (
        <nav className="hidden md:flex items-center space-x-10">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "transition-colors",
                item.active
                  ? "text-gray-900 font-semibold border-b-2 border-gray-800 pb-1"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-5">
        {showNotifications && (
          <button
            onClick={onNotificationClick}
            className="relative text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Icon name="notifications" size={30} />
            {hasUnreadNotifications && (
              <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-gray-50"></span>
            )}
          </button>
        )}
        {userAvatar && (
          <button onClick={onAvatarClick}>
            <img
              alt="User avatar"
              className="w-12 h-12 rounded-full border-2 border-gray-200"
              src={userAvatar}
            />
          </button>
        )}
      </div>
    </header>
  );
}