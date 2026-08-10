import React from "react";
import { View, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export function ResultLoadingSkeleton() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Card Skeleton */}
      <View style={[styles.heroSkeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.topRow}>
          <View style={[styles.badgeSkeleton, { backgroundColor: colors.muted }]} />
          <View style={[styles.badgeSkeletonSmall, { backgroundColor: colors.muted }]} />
        </View>
        <View style={styles.heroBody}>
          <View style={styles.textColumn}>
            <View style={[styles.lineLarge, { backgroundColor: colors.muted }]} />
            <View style={[styles.lineMedium, { backgroundColor: colors.muted }]} />
          </View>
          <View style={[styles.scoreSkeletonCircle, { backgroundColor: colors.muted }]} />
        </View>
      </View>

      {/* Stats Grid Skeleton */}
      <View style={styles.statsRow}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.statSkeleton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.statCircle, { backgroundColor: colors.muted }]} />
            <View style={[styles.statLine, { backgroundColor: colors.muted }]} />
          </View>
        ))}
      </View>

      {/* Ingredient Section Header Skeleton */}
      <View style={[styles.sectionHeaderSkeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.statLine, { width: 120, backgroundColor: colors.muted }]} />
        <View style={[styles.statCircle, { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.muted }]} />
      </View>

      {/* Ingredient List Items Skeleton */}
      <View style={styles.listContainer}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.cardSkeleton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.itemCircle, { backgroundColor: colors.muted }]} />
            <View style={styles.itemTextWrap}>
              <View style={[styles.itemLine, { backgroundColor: colors.muted }]} />
              <View style={[styles.itemLineShort, { backgroundColor: colors.muted }]} />
            </View>
            <View style={[styles.itemBadge, { backgroundColor: colors.muted }]} />
          </View>
        ))}
      </View>

      {/* Action Buttons Skeleton */}
      <View style={styles.buttonSkeletonRow}>
        <View style={[styles.buttonSkeleton, { backgroundColor: colors.muted }]} />
        <View style={[styles.buttonSkeleton, { backgroundColor: colors.muted }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  heroSkeleton: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  badgeSkeleton: {
    width: 110,
    height: 24,
    borderRadius: 12,
  },
  badgeSkeletonSmall: {
    width: 60,
    height: 24,
    borderRadius: 12,
  },
  heroBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  textColumn: {
    flex: 1,
    gap: 8,
  },
  lineLarge: {
    width: "70%",
    height: 22,
    borderRadius: 6,
  },
  lineMedium: {
    width: "45%",
    height: 14,
    borderRadius: 6,
  },
  scoreSkeletonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statSkeleton: {
    flex: 1,
    height: 84,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  statCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  statLine: {
    width: 36,
    height: 14,
    borderRadius: 4,
  },
  sectionHeaderSkeleton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  listContainer: {
    gap: 10,
  },
  cardSkeleton: {
    height: 68,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
  },
  itemCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  itemTextWrap: {
    flex: 1,
    gap: 6,
  },
  itemLine: {
    width: "60%",
    height: 16,
    borderRadius: 6,
  },
  itemLineShort: {
    width: "35%",
    height: 12,
    borderRadius: 6,
  },
  itemBadge: {
    width: 50,
    height: 24,
    borderRadius: 12,
  },
  buttonSkeletonRow: {
    gap: 10,
    marginTop: 8,
  },
  buttonSkeleton: {
    height: 52,
    borderRadius: 16,
  },
});
