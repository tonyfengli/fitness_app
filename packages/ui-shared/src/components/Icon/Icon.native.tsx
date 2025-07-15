import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import type { IconProps } from "./Icon.types";

export function Icon({ 
  name, 
  size = 24, 
  color = "#374151",
  onPress
}: IconProps) {
  const iconElement = (
    <MaterialIcons 
      name={name as any} 
      size={size} 
      color={color}
    />
  );
  
  if (onPress) {
    return (
      <Pressable onPress={onPress}>
        {iconElement}
      </Pressable>
    );
  }
  
  return iconElement;
}