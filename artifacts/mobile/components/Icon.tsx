/**
 * Thin wrapper around @expo/vector-icons Ionicons.
 * Uses direct file import to avoid pnpm barrel-export resolution issues on Android/Hermes.
 */
import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = "#000" }: IconProps) {
  return (
    <Ionicons
      name={name as any}
      size={size}
      color={color}
    />
  );
}
