import React from "react";
import type { AvatarProps } from "./Avatar.types";

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-14 h-14",
};

export function Avatar({
  src,
  alt = "User avatar",
  size = "md",
  fallback,
  className = "",
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  const sizeClass = sizeClasses[size];
  const baseClasses = `${sizeClass} rounded-full object-cover`;

  if (!src || imageError) {
    return (
      <div
        className={`${baseClasses} bg-gray-200 flex items-center justify-center ${className}`}
      >
        <span className="text-gray-600 font-medium">
          {fallback || alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${baseClasses} ${className}`}
      onError={() => setImageError(true)}
    />
  );
}