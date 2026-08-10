import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

export interface ScoreRingProps {
  score?: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  customLabel?: string;
  customStrokeColor?: string;
  displayValue?: string;
  progressPercent?: number;
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  customLabel,
  customStrokeColor,
  displayValue,
  progressPercent,
}: ScoreRingProps) {
  const colors = useColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const hasScore = score !== null && score !== undefined;
  const hasCustom = progressPercent !== undefined || displayValue !== undefined;

  if (!hasScore && !hasCustom) {
    return (
      <View style={styles.container}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
        <View style={[styles.center, { width: size, height: size }]}>
          <Text style={[styles.score, { color: colors.mutedForeground }]}>—</Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>غير محدد</Text>
        </View>
      </View>
    );
  }

  const pct = progressPercent ?? (hasScore ? score : 0);
  const progress = Math.max(0, Math.min(circumference, (pct / 100) * circumference));

  const strokeColor =
    customStrokeColor ??
    (hasScore
      ? score >= 70
        ? colors.scoreHigh
        : score >= 40
        ? colors.scoreMid
        : colors.scoreLow
      : colors.primary);

  const label =
    customLabel ??
    (hasScore
      ? score >= 70
        ? "مسموح"
        : score >= 40
        ? "مشروط"
        : "محظور"
      : "");

  const valueText = displayValue ?? (hasScore ? `${score}` : "");

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={[styles.score, { color: strokeColor }]}>{valueText}</Text>
        {label ? <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
  },
  label: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    marginTop: 2,
  },
});
