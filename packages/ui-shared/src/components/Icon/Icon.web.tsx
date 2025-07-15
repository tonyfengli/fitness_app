import React from "react";
import { cn } from "../../utils/cn";
import type { IconProps } from "./Icon.types";

export function Icon({ 
  name, 
  size = 24, 
  color = "currentColor",
  className,
  onPress
}: IconProps) {
  const Component = onPress ? 'button' : 'span';
  
  return (
    <Component
      onClick={onPress}
      className={cn(
        "material-icons",
        onPress && "cursor-pointer hover:opacity-70 transition-opacity",
        className
      )}
      style={{
        fontSize: size,
        color: color,
        ...(onPress && { background: 'none', border: 'none', padding: 0 })
      }}
      aria-label={onPress ? `${name} button` : undefined}
    >
      {name}
    </Component>
  );
}