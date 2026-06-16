/**
 * Thin wrapper around @expo/vector-icons Ionicons.
 * Expo Go pre-bundles Ionicons fonts for both iOS and Android — no useFonts needed.
 */
import React from "react";
import { Ionicons } from "@expo/vector-icons";

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
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
